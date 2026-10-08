import { describe, expect, it } from 'vitest';
import { currencySymbol, formatMoney, monthNames } from '@/lib/format';
import { formatNumber } from '@/lib/locale';

describe('formatMoney', () => {
  it('keeps the current Peru look: symbol, space, 1,234.50', () => {
    expect(formatMoney(1234.5)).toBe('S/ 1,234.50');
    expect(formatMoney(1234567.891, 'PEN')).toBe('S/ 1,234,567.89');
    expect(formatMoney(0)).toBe('S/ 0.00');
  });
  it('signs', () => {
    expect(formatMoney(-12)).toBe('- S/ 12.00');
    expect(formatMoney(12, 'USD', { sign: true })).toBe('+ $ 12.00');
    expect(formatMoney(-3.2, 'EUR', { sign: true })).toBe('- € 3.20');
  });
  it('decimals by currency and on request', () => {
    expect(formatMoney(15000, 'CLP')).toBe('$ 15,000');
    expect(formatMoney(1234.56, 'PEN', { decimals: false })).toBe('S/ 1,235');
  });
  it('no space when asked (compact)', () => {
    expect(formatMoney(5, 'PEN', { space: false })).toBe('S/5.00');
  });
  it('unknown currencies show their code, never S/', () => {
    expect(currencySymbol('AUD')).toBe('AUD');
    expect(formatMoney(10, 'AUD')).toBe('AUD 10.00');
  });
  it('treats NaN as 0', () => {
    expect(formatMoney(Number.NaN)).toBe('S/ 0.00');
  });
});

describe('formatNumber', () => {
  it('groups for the locale', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
    expect(formatNumber(1234.5, 2, 'es-ES')).toBe('1234,50');
  });
});

describe('monthNames', () => {
  it('Spanish long and short, optionally capitalized', () => {
    expect(monthNames('long')[8]).toBe('septiembre');
    expect(monthNames('short')).toEqual([
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ]);
    expect(monthNames('long', { capitalize: true })[0]).toBe('Enero');
    expect(monthNames('short', { capitalize: true })[11]).toBe('Dic');
  });
  it('other languages through Intl', () => {
    expect(monthNames('long', { locale: 'en-AU' })[0]).toBe('January');
  });
  it('returns a copy (callers cannot change the shared list)', () => {
    const a = monthNames('short');
    a[0] = 'x';
    expect(monthNames('short')[0]).toBe('ene');
  });
});
