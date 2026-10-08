'use client';
import { createClient } from '@/lib/supabase/client';
import { toDataError } from '@/lib/dataError';
import type { WillingToPay } from '@/lib/markets';

// Waiting list of the country landings (table public.waitlist, see the 20261019120000
// migration). Visitors only add themselves; admins read the counts.

export interface WaitlistEntry {
  email: string;
  country: string;
  locale: string;
  willingToPay?: WillingToPay;
  utm?: { source?: string; medium?: string; campaign?: string };
}

export interface WaitlistStats {
  code: string;
  total: number;
  last7Days: number;
  pay: Record<WillingToPay, number>;
}

export const waitlistService = {
  /** Adds (or refreshes) the email for that country. Never says if it was already there. */
  async join(entry: WaitlistEntry): Promise<void> {
    const { error } = await createClient().rpc('join_waitlist', {
      p_email: entry.email,
      p_country: entry.country,
      p_locale: entry.locale,
      p_willing_to_pay: entry.willingToPay ?? null,
      p_utm_source: entry.utm?.source ?? null,
      p_utm_medium: entry.utm?.medium ?? null,
      p_utm_campaign: entry.utm?.campaign ?? null,
    });
    if (error) throw toDataError(error);
  },

  /** Admin panel: counts per country. */
  async stats(): Promise<WaitlistStats[]> {
    const { data, error } = await createClient().rpc('admin_waitlist_stats');
    if (error) throw toDataError(error);
    return ((data as Record<string, unknown>[]) || []).map((r) => ({
      code: String(r.code),
      total: Number(r.total),
      last7Days: Number(r.last_7_days),
      pay: {
        free: Number(r.pay_free),
        low: Number(r.pay_low),
        mid: Number(r.pay_mid),
        high: Number(r.pay_high),
      },
    }));
  },
};
