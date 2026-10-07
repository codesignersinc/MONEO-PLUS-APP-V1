'use client';
import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';

// MONEO Core summary (public.moneo_summary): the same numbers for Inicio, MONEO Mini and
// the future widgets, computed once in the database.

export interface CompanionSummary {
  currency: string;
  asOf: string;
  netWorth: number;
  available: number;
  committed: number;
  inGoals: number;
  netWorthPct: number | null;
  spentToday: number;
  safeToSpend: {
    /** "Puedes gastar hoy" (estimate, never negative). */
    today: number;
    dailyBudget: number;
    until: string;
    untilKind: 'proximo_ingreso' | 'fin_de_mes';
    days: number;
    committed: number;
    goals: number;
  };
  nextPayment: {
    name: string;
    amount: number;
    date: string;
    overdue: boolean;
    kind: 'pago' | 'suscripcion';
  } | null;
  mainGoal: {
    name: string;
    icon: string | null;
    current: number;
    target: number;
    pct: number;
  } | null;
  recent: {
    id: string;
    name: string;
    icon: string | null;
    type: 'gasto' | 'ingreso' | 'transferencia';
    amount: number;
    currency: string;
    date: string;
  }[];
}

const num = (v: unknown) => Number(v ?? 0);

export function parseSummary(raw: Record<string, unknown>): CompanionSummary {
  const s = raw as unknown as CompanionSummary;
  return {
    ...s,
    netWorth: num(s.netWorth),
    available: num(s.available),
    committed: num(s.committed),
    inGoals: num(s.inGoals),
    netWorthPct: s.netWorthPct == null ? null : num(s.netWorthPct),
    spentToday: num(s.spentToday),
    safeToSpend: {
      ...s.safeToSpend,
      today: num(s.safeToSpend?.today),
      dailyBudget: num(s.safeToSpend?.dailyBudget),
      days: num(s.safeToSpend?.days),
      committed: num(s.safeToSpend?.committed),
      goals: num(s.safeToSpend?.goals),
    },
    nextPayment: s.nextPayment ? { ...s.nextPayment, amount: num(s.nextPayment.amount) } : null,
    mainGoal: s.mainGoal
      ? {
          ...s.mainGoal,
          current: num(s.mainGoal.current),
          target: num(s.mainGoal.target),
          pct: num(s.mainGoal.pct),
        }
      : null,
    recent: (s.recent ?? []).map((r) => ({ ...r, amount: num(r.amount) })),
  };
}

export const companionService = {
  async summary(): Promise<CompanionSummary> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('moneo_summary');
    if (error) throw toDataError(error);
    return parseSummary((data ?? {}) as Record<string, unknown>);
  },
};

// Devices linked to MONEO Companion (Android widget, …). The token is returned only when
// linking and goes straight to the device; it is never stored by the web app.
export interface CompanionDevice {
  id: string;
  name: string;
  platform: 'android' | 'ios' | 'windows' | 'mac';
  createdAt: string;
  lastSeenAt: string | null;
}

export const companionDevicesService = {
  async list(): Promise<CompanionDevice[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('companion_devices')
      .select('id, name, platform, created_at, last_seen_at, revoked_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      platform: r.platform,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
    }));
  },

  async link(
    name: string,
    platform: CompanionDevice['platform']
  ): Promise<{ id: string; token: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_companion_device', {
      p_name: name,
      p_platform: platform,
    });
    if (error) {
      // Keep the database's own Spanish message for the 10-device limit.
      const e = error as { code?: string; message?: string };
      if (e.code === '22023' && e.message) throw new DataError('validation', error, e.message);
      throw toDataError(error);
    }
    return data as { id: string; token: string };
  },

  async revoke(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.rpc('revoke_companion_device', { p_id: id });
    if (error) throw toDataError(error);
  },
};

/** "Android · SM-A546E" from the user agent (the phone model, when it says). */
export function androidDeviceName(ua: string): string {
  const model = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/)?.[1]?.trim();
  return model && model !== 'K' && !/^wv$/i.test(model)
    ? `Android · ${model}`.slice(0, 60)
    : 'Android';
}

/** Link that hands the token to the MONEO app (only our package can receive it). */
export function androidLinkIntent(token: string): string {
  return `intent://link?token=${encodeURIComponent(token)}#Intent;scheme=moneo-widget;package=plus.moneo.app;end`;
}
