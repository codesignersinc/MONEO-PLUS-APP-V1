'use client';
import { useEffect, useState } from 'react';
import type { Business } from '@/lib/business';
import { businessService } from '@/lib/supabaseBusiness';
import { adminService } from '@/lib/supabaseAdmin';
import { useAuth } from '@/contexts/AuthContext';

// MONEO NEGOCIO is a beta (decision 5): visible for everyone when NEXT_PUBLIC_NEGOCIO=true,
// otherwise only for admins and for people who already have a business.

const OPEN_FOR_ALL = process.env.NEXT_PUBLIC_NEGOCIO === 'true';
const CHANGED = 'moneo:negocio-changed';

interface NegocioState {
  enabled: boolean;
  businesses: Business[];
  loaded: boolean;
}

let cache: Promise<NegocioState> | null = null;
let cacheUser: string | null = null; // a different session never reuses it

function load(userId: string): Promise<NegocioState> {
  if (cacheUser !== userId) {
    cache = null;
    cacheUser = userId;
  }
  cache ??= Promise.all([
    businessService.list().catch(() => [] as Business[]),
    OPEN_FOR_ALL ? Promise.resolve(false) : adminService.isAdmin().catch(() => false),
  ]).then(([businesses, admin]) => ({
    enabled: OPEN_FOR_ALL || admin || businesses.length > 0,
    businesses,
    loaded: true,
  }));
  return cache;
}

/** Call after creating, renaming or deleting a business. */
export function negocioChanged(): void {
  cache = null;
  window.dispatchEvent(new Event(CHANGED));
}

export function useNegocio(): NegocioState {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<NegocioState>({
    enabled: false,
    businesses: [],
    loaded: false,
  });
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const refresh = () =>
      load(userId).then((s) => {
        if (alive) setState(s);
      });
    refresh();
    window.addEventListener(CHANGED, refresh);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, refresh);
    };
  }, [userId]);
  return state;
}
