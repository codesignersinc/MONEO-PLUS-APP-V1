import { describe, expect, it } from 'vitest';
import { resolveAccountChoice } from '@/components/finance/AccountAmountPicker';

describe('resolveAccountChoice', () => {
  it('requires an account', () => {
    expect(resolveAccountChoice({ accountId: '', accountAmount: '', foreign: false })).toEqual({
      error: 'Elige la cuenta.',
    });
  });

  it('needs no amount for an account in the base currency', () => {
    expect(resolveAccountChoice({ accountId: 'a', accountAmount: '', foreign: false })).toEqual({
      accountId: 'a',
    });
  });

  it('requires a positive amount for a foreign-currency account, rounded to cents', () => {
    expect(
      resolveAccountChoice({ accountId: 'a', accountAmount: '0', foreign: true })
    ).toHaveProperty('error');
    expect(
      resolveAccountChoice({ accountId: 'a', accountAmount: '10.005', foreign: true })
    ).toEqual({ accountId: 'a', accountAmount: 10.01 });
  });
});
