'use client';
import { createClient } from '@/lib/supabase/client';
import { toDataError } from '@/lib/dataError';

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
