'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  entitlementService,
  hasPaidPlusNow,
  hasPlusNow,
  trialService,
  type Entitlement,
} from '@/lib/billing';
import { ONBOARDING_V2 } from '@/lib/onboardingFlow';

// MONEO PLUS status for the whole app. Users without any plan get the 7-day free trial
// (no card) the first time they open MONEO; the server grants it once per user.
// Where the plans are not live (ONBOARDING_V2 off) nothing is locked.

interface PlusState {
  // undefined while loading; null = MONEO FREE.
  ent: Entitlement | null | undefined;
  plus: boolean;
  // Paid PLUS (subscription, pass or lifetime): the free trial does not count.
  paid: boolean;
  plansLive: boolean;
  refresh: () => Promise<void>;
}

const PlusContext = createContext<PlusState>({
  ent: undefined,
  plus: true,
  paid: false,
  plansLive: false,
  refresh: async () => {},
});

export function usePlus(): PlusState {
  return useContext(PlusContext);
}

export function PlusProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setEnt(await entitlementService.get());
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
        let e = await entitlementService.get();
        if (!e) {
          // Re-read either way: another tab (or a previous run) may have just started it.
          await trialService.start().catch(() => false);
          e = await entitlementService.get();
        }
        if (!cancelled) setEnt(e);
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

  const value: PlusState = ONBOARDING_V2
    ? {
        ent,
        // While loading or unknown, nothing is locked (the server enforces what matters).
        plus: ent === undefined ? true : hasPlusNow(ent),
        paid: hasPaidPlusNow(ent ?? null),
        plansLive: true,
        refresh,
      }
    : { ent: null, plus: true, paid: false, plansLive: false, refresh };

  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
}
