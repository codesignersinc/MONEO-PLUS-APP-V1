import { describe, expect, it } from 'vitest';
import { annualSavingsPercent, hasPlusNow, type Entitlement } from '@/lib/billing';

const base: Entitlement = {
  planCode: 'plus_yearly',
  status: 'active',
  currentPeriodEnd: null,
  trialEndsAt: null,
  hadTrial: false,
  lifetime: false,
};
const inDays = (d: number) => new Date(Date.now() + d * 86400e3).toISOString();

describe('MONEO PLUS', () => {
  it('annual saving vs. 12 monthly payments (S/ 9.90 × 12 vs S/ 97.50)', () => {
    expect(annualSavingsPercent(9.9, 97.5)).toBe(17);
  });

  it('FREE without entitlement', () => {
    expect(hasPlusNow(null)).toBe(false);
  });

  it('subscription: access until the end of the period, also when cancelled', () => {
    expect(hasPlusNow({ ...base, currentPeriodEnd: inDays(10) })).toBe(true);
    expect(hasPlusNow({ ...base, status: 'trialing', currentPeriodEnd: inDays(14) })).toBe(true);
    expect(hasPlusNow({ ...base, status: 'cancelled', currentPeriodEnd: inDays(3) })).toBe(true);
    expect(hasPlusNow({ ...base, status: 'cancelled', currentPeriodEnd: inDays(-1) })).toBe(false);
    expect(hasPlusNow({ ...base, status: 'past_due', currentPeriodEnd: inDays(-1) })).toBe(false);
  });

  it('lifetime / Founder: no end date, never renews', () => {
    expect(hasPlusNow({ ...base, planCode: 'founder', lifetime: true })).toBe(true);
    expect(
      hasPlusNow({ ...base, planCode: 'plus_lifetime', lifetime: true, status: 'cancelled' })
    ).toBe(false);
  });
});
