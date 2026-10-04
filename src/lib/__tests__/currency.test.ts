import { describe, expect, it } from 'vitest';
import { buildCurrencyFields, getRateFromMap } from '@/lib/currency';

describe('getRateFromMap', () => {
  it('returns 1 for the same currency', () => {
    expect(getRateFromMap({}, 'PEN', 'PEN')).toBe(1);
  });

  it('uses the direct rate, then the inverse of the reverse rate', () => {
    expect(getRateFromMap({ USD_PEN: 3.8 }, 'USD', 'PEN')).toBe(3.8);
    expect(getRateFromMap({ USD_PEN: 4 }, 'PEN', 'USD')).toBe(0.25);
  });

  it('falls back to the default reference rates', () => {
    expect(getRateFromMap({}, 'USD', 'PEN')).toBe(3.73);
  });
});

describe('buildCurrencyFields', () => {
  it('keeps the sign and uses rate 1 in the base currency', () => {
    expect(
      buildCurrencyFields({
        amount: -50,
        currency: 'PEN',
        baseCurrency: 'PEN',
        rateToBase: 3.7,
        date: '2026-10-04',
      })
    ).toEqual({
      currencyCode: 'PEN',
      originalAmount: -50,
      baseCurrencyCode: 'PEN',
      baseAmount: -50,
      exchangeRate: 1,
      exchangeRateDate: '2026-10-04',
    });
  });

  it('converts a foreign-currency amount to base, rounded to cents', () => {
    const f = buildCurrencyFields({
      amount: 10.555,
      currency: 'USD',
      baseCurrency: 'PEN',
      rateToBase: 3.75,
      date: '2026-10-04T12:00:00.000Z',
    });
    expect(f.currencyCode).toBe('USD');
    expect(f.originalAmount).toBe(10.56);
    expect(f.baseAmount).toBe(39.58);
    expect(f.exchangeRate).toBe(3.75);
    expect(f.exchangeRateDate).toBe('2026-10-04');
  });

  it('records the original currency when it differs from the account', () => {
    // A PEN-priced subscription paid from a USD account.
    const f = buildCurrencyFields({
      amount: -8.1,
      currency: 'USD',
      baseCurrency: 'PEN',
      rateToBase: 3.7,
      date: '2026-10-04',
      original: { amount: -30, currency: 'PEN' },
    });
    expect(f).toMatchObject({
      currencyCode: 'PEN',
      originalAmount: -30,
      baseAmount: -30,
      exchangeRate: 1,
    });
  });

  it('rejects an invalid rate', () => {
    expect(() =>
      buildCurrencyFields({
        amount: 1,
        currency: 'USD',
        baseCurrency: 'PEN',
        rateToBase: 0,
        date: '2026-10-04',
      })
    ).toThrow();
  });
});
