import { describe, expect, it } from 'vitest';
import { annualSavingsPercent, hasPlusNow, type Entitlement } from '@/lib/billing';

const base: Entitlement = {
  planCode: 'plus_yearly',
  status: 'active',
  currentPeriodEnd: null,
  trialEndsAt: null,
  hadTrial: false,
  lifetime: false,
  kind: 'subscription',
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

describe('cheapestMonthly', () => {
  it('takes the lowest monthly cost among individual subscriptions and passes', async () => {
    const { cheapestMonthly } = await import('@/lib/billing');
    const plans = [
      { kind: 'subscription', price: 9.9, currency: 'PEN', intervalMonths: 1, seats: 1 },
      { kind: 'subscription', price: 97.5, currency: 'PEN', intervalMonths: 12, seats: 1 },
      { kind: 'pass', price: 25.9, currency: 'PEN', intervalMonths: 3, seats: 1 },
      { kind: 'one_time', price: 127, currency: 'PEN', intervalMonths: null, seats: 1 },
      { kind: 'subscription', price: 13.9, currency: 'PEN', intervalMonths: 1, seats: 2 },
      { kind: 'trial', price: 0, currency: 'PEN', intervalMonths: null, seats: 1 },
    ] as Parameters<typeof cheapestMonthly>[0];
    expect(cheapestMonthly(plans)).toEqual({ amount: 8.13, currency: 'PEN' });
  });
  it('is null without active priced plans', async () => {
    const { cheapestMonthly } = await import('@/lib/billing');
    expect(cheapestMonthly([])).toBeNull();
  });
});
