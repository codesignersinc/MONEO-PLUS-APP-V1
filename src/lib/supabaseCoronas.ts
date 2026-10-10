'use client';
import { createClient } from '@/lib/supabase/client';
import { toDataError } from '@/lib/dataError';
import type { CoronaRule, CoronasSummary } from '@/lib/coronas';

// Coronas (gamification phase 1). The database grants them in coronas_sync(); the app only
// asks for the sync and reads the ledger. See src/lib/coronas.ts.

export interface CoronaEntry {
  id: string;
  rule: CoronaRule;
  key: string;
  earnedOn: string;
  amount: number;
  expiresAt: string;
}

export interface EarnedAchievement {
  code: string;
  earnedAt: string;
}

export const coronasService = {
  /** Grants the Coronas due for today's habits and returns the summary. */
  async sync(): Promise<CoronasSummary> {
    const { data, error } = await createClient().rpc('coronas_sync');
    if (error) throw toDataError(error);
    const d = (data ?? {}) as Partial<CoronasSummary>;
    return {
      balance: Number(d.balance ?? 0),
      lifetime: Number(d.lifetime ?? 0),
      streak: Number(d.streak ?? 0),
      registeredToday: !!d.registeredToday,
      startedOn: String(d.startedOn ?? ''),
      today: String(d.today ?? ''),
      new: Array.isArray(d.new) ? d.new : [],
    };
  },

  /** Latest ledger rows, newest first. */
  async history(limit = 50): Promise<CoronaEntry[]> {
    const { data, error } = await createClient()
      .from('coronas_ledger')
      .select('id, rule, award_key, earned_on, amount, expires_at')
      .order('created_at', { ascending: false })
      .order('award_key', { ascending: false })
      .limit(limit);
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      rule: r.rule as CoronaRule,
      key: r.award_key,
      earnedOn: r.earned_on,
      amount: r.amount,
      expiresAt: r.expires_at,
    }));
  },

  async achievements(): Promise<EarnedAchievement[]> {
    const { data, error } = await createClient()
      .from('coronas_achievements')
      .select('code, earned_at')
      .order('earned_at');
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({ code: r.code, earnedAt: r.earned_at }));
  },
};
