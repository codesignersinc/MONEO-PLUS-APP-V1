import { describe, expect, it } from 'vitest';
import {
  hasPaidPlusNow,
  hasPlusNow,
  planKindOf,
  rejectionMessage,
  trialDaysLeft,
  type Entitlement,
} from '../billing';

const DAY = 86400e3;
const ent = (over: Partial<Entitlement>): Entitlement => ({
  planCode: 'free_trial',
  status: 'trialing',
  currentPeriodEnd: null,
  trialEndsAt: null,
  hadTrial: true,
  lifetime: false,
  kind: 'trial',
  ...over,
});

describe('planKindOf', () => {
  it('classifies every plan', () => {
    expect(planKindOf('plus_monthly')).toBe('subscription');
    expect(planKindOf('plus_yearly')).toBe('subscription');
    expect(planKindOf('plus_lifetime')).toBe('one_time');
    expect(planKindOf('founder')).toBe('one_time');
    expect(planKindOf('pass_3m')).toBe('pass');
    expect(planKindOf('pass_12m')).toBe('pass');
    expect(planKindOf('free_trial')).toBe('trial');
  });
});

describe('trial and paid PLUS', () => {
  const now = Date.now();
  it('counts whole days left of the free trial', () => {
    const e = ent({ currentPeriodEnd: new Date(now + 13.5 * DAY).toISOString() });
    expect(trialDaysLeft(e, now)).toBe(13);
    expect(
      trialDaysLeft(ent({ currentPeriodEnd: new Date(now + 3600e3).toISOString() }), now)
    ).toBe(0);
    expect(
      trialDaysLeft(ent({ currentPeriodEnd: new Date(now - 1).toISOString() }), now)
    ).toBeNull();
    expect(trialDaysLeft(null, now)).toBeNull();
  });

  it('the free trial gives PLUS but not paid PLUS', () => {
    const e = ent({ currentPeriodEnd: new Date(now + 5 * DAY).toISOString() });
    expect(hasPlusNow(e)).toBe(true);
    expect(hasPaidPlusNow(e)).toBe(false);
  });

  it('passes, subscriptions and lifetime are paid PLUS while valid', () => {
    const pass = ent({
      planCode: 'pass_3m',
      kind: 'pass',
      status: 'active',
      currentPeriodEnd: new Date(now + 30 * DAY).toISOString(),
    });
    expect(hasPaidPlusNow(pass)).toBe(true);
    expect(trialDaysLeft(pass, now)).toBeNull();
    expect(hasPaidPlusNow({ ...pass, currentPeriodEnd: new Date(now - 1).toISOString() })).toBe(
      false
    );
    expect(
      hasPaidPlusNow(
        ent({ planCode: 'plus_lifetime', kind: 'one_time', lifetime: true, status: 'active' })
      )
    ).toBe(true);
  });
});

describe('rejectionMessage', () => {
  it('maps Mercado Pago rejection codes', () => {
    expect(rejectionMessage('cc_rejected_insufficient_amount')).toMatch(/Saldo insuficiente/);
    expect(rejectionMessage('cc_rejected_call_for_authorize')).toMatch(/autorizar/);
    expect(rejectionMessage('cc_rejected_bad_filled_security_code')).toMatch(/Revisa/);
    expect(rejectionMessage(undefined)).toMatch(/rechazado/);
  });
});
