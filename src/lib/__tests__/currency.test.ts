import { describe, expect, it } from 'vitest';
import { getRateFromMap } from '@/lib/currency';

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
