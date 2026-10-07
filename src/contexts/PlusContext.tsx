'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  entitlementService,
  hasPaidPlusNow,
  hasPlusNow,
  packService,
  planKindOf,
  trialService,
  type Entitlement,
  type MyPack,
} from '@/lib/billing';
import { ONBOARDING_V2 } from '@/lib/onboardingFlow';

// MONEO PLUS status for the whole app. Users without any plan get the 7-day free trial
// (no card) the first time they open MONEO; the server grants it once per user.
// A seat in someone's Duo / Familiar counts as PLUS too (`viaPack`).
// Where the plans are not live (ONBOARDING_V2 off) nothing is locked.

interface PlusState {
  // undefined while loading; null = MONEO FREE. When the user has PLUS through a pack and
  // not on their own, this is the pack's plan (`viaPack`).
  ent: Entitlement | null | undefined;
  plus: boolean;
  // Paid PLUS on the user's own account (subscription, pass or lifetime): the free trial
  // and a pack seat do not count. Needed for Gmail.
  paid: boolean;
  // The Duo / Familiar the user pays or belongs to (null while loading or without one).
  pack: MyPack | null;
  viaPack: boolean;
  plansLive: boolean;
  refresh: () => Promise<void>;
}

const PlusContext = createContext<PlusState>({
  ent: undefined,
  plus: true,
  paid: false,
  pack: null,
  viaPack: false,
  plansLive: false,
  refresh: async () => {},
});

export function usePlus(): PlusState {
  return useContext(PlusContext);
}

// The pack's plan as an entitlement, for a member whose own plan does not give PLUS.
function packEntitlement(own: Entitlement | null, pack: MyPack | null): Entitlement | null {
  if (!pack || pack.role !== 'member' || !pack.covered || !pack.planCode) return null;
  // Own paid PLUS wins; the free trial gives way to the pack (no countdown for a member).
  if (hasPlusNow(own) && own?.kind !== 'trial') return null;
  return {
    planCode: pack.planCode,
    status: 'active',
    currentPeriodEnd: pack.periodEnd,
    trialEndsAt: null,
    hadTrial: own?.hadTrial ?? false,
    lifetime: false,
    kind: planKindOf(pack.planCode),
  };
}

async function readPack(): Promise<MyPack | null> {
  try {
    return await packService.mine();
  } catch {
    return null; // packs not available yet (or a failed read): nothing extra
  }
}

export function PlusProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined);
  const [pack, setPack] = useState<MyPack | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([entitlementService.get(), readPack()]);
      setEnt(e);
      setPack(p);
    } catch {
      // Unknown: do not lock anything because of a failed read.
      setEnt(undefined);
    }
  }, []);

  useEffect(() => {
    if (!user || !ONBOARDING_V2) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await readPack();
        let e = await entitlementService.get();
        // A pack member does not need the trial; everybody else gets it once.
        if (!e && !(p?.role === 'member' && p.covered)) {
          // Re-read either way: another tab (or a previous run) may have just started it.
          await trialService.start().catch(() => false);
          e = await entitlementService.get();
        }
        if (!cancelled) {
          setPack(p);
          setEnt(e);
        }
      } catch {
        if (!cancelled) setEnt(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload after a purchase made in another tab or on return from Mercado Pago.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible' && user && ONBOARDING_V2) refresh();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [user, refresh]);

  const fromPack = ent === undefined ? null : packEntitlement(ent, pack);
  const value: PlusState = ONBOARDING_V2
    ? {
        ent: fromPack ?? ent,
        // While loading or unknown, nothing is locked (the server enforces what matters).
        plus: ent === undefined ? true : hasPlusNow(ent) || !!fromPack,
        paid: hasPaidPlusNow(ent ?? null),
        pack,
        viaPack: !!fromPack,
        plansLive: true,
        refresh,
      }
    : { ent: null, plus: true, paid: false, pack: null, viaPack: false, plansLive: false, refresh };

  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
}
