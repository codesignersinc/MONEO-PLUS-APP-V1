import { describe, expect, it } from 'vitest';
import { buildCurrencyFields, buildTransferAmounts, getRateFromMap } from '@/lib/currency';

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

describe('buildTransferAmounts', () => {
  const ratesMap = { USD_PEN: 3.75 };

  it('uses the same amount between accounts of the same currency', () => {
    expect(
      buildTransferAmounts({
        fromAmount: 100.004,
        toAmount: 5,
        fromCurrency: 'PEN',
        toCurrency: 'PEN',
        baseCurrency: 'PEN',
        ratesMap,
      })
    ).toEqual({ fromAmount: 100, toAmount: 100, baseAmount: 100 });
  });

  it('converts to the destination currency unless the received amount is given', () => {
    const base = { fromCurrency: 'PEN', toCurrency: 'USD', baseCurrency: 'PEN', ratesMap };
    expect(buildTransferAmounts({ ...base, fromAmount: 375 })).toEqual({
      fromAmount: 375,
      toAmount: 100,
      baseAmount: 375,
    });
    expect(buildTransferAmounts({ ...base, fromAmount: 375, toAmount: 99.5 }).toAmount).toBe(99.5);
  });

  it('values a foreign-currency origin in the base currency', () => {
    expect(
      buildTransferAmounts({
        fromAmount: 10,
        fromCurrency: 'USD',
        toCurrency: 'PEN',
        baseCurrency: 'PEN',
        ratesMap,
      })
    ).toEqual({ fromAmount: 10, toAmount: 37.5, baseAmount: 37.5 });
  });
});

describe('findRate (cross rates)', () => {
  it('crosses through PEN when there is no direct rate', async () => {
    const { findRate, getRateFromMap } = await import('@/lib/currency');
    // COP → MXN = COP→PEN × PEN→MXN = 0.00093 / 0.22
    expect(findRate({}, 'COP', 'MXN')).toBeCloseTo(0.00093 / 0.22, 8);
    expect(getRateFromMap({}, 'CLP', 'BRL')).toBeCloseTo(0.0041 / 0.74, 8);
  });
  it('prefers the user own rates, also when crossing', async () => {
    const { findRate } = await import('@/lib/currency');
    const map = { USD_PEN: 3.8, COP_PEN: 0.001 };
    expect(findRate(map, 'USD', 'PEN')).toBe(3.8);
    expect(findRate(map, 'COP', 'USD')).toBeCloseTo(0.001 / 3.8, 10);
  });
  it('returns null only for unknown currencies', async () => {
    const { findRate, getRateFromMap } = await import('@/lib/currency');
    expect(findRate({}, 'XYZ', 'PEN')).toBeNull();
    expect(getRateFromMap({}, 'XYZ', 'PEN')).toBe(1);
  });
});
