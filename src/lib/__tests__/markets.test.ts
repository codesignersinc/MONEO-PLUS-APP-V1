import { describe, expect, it } from 'vitest';
import {
  cleanUtm,
  isMarketSlug,
  isValidEmail,
  landingAlternates,
  MARKETS,
  marketForCountry,
  marketMoney,
} from '@/lib/markets';
import { GLYPH_KEYS } from '@/lib/glyphs';

describe('markets', () => {
  it('match the waiting-list countries of the database seed', () => {
    expect(Object.values(MARKETS).map((m) => m.country)).toEqual(['ES', 'US', 'AU', 'AE', 'SG']);
  });

  it('have complete copy, icons and pay bands', () => {
    const keys = new Set<string>(GLYPH_KEYS);
    for (const m of Object.values(MARKETS)) {
      expect(Object.keys(m.copy.payOptions), m.slug).toEqual(['free', 'low', 'mid', 'high']);
      for (const x of [...m.copy.examples, ...m.copy.features]) expect(keys.has(x.icon)).toBe(true);
      expect(m.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it('format amounts in the local currency and locale', () => {
    expect(marketMoney(-63.8, MARKETS.es)).toMatch(/63,80\s?€/);
    expect(marketMoney(1450, MARKETS.us)).toMatch(/\$1,450/);
    expect(marketMoney(-6500, MARKETS.ae)).toMatch(/6,500/);
  });

  it('finds the landing of an IP country', () => {
    expect(marketForCountry('ES')?.slug).toBe('es');
    expect(marketForCountry('sg')?.slug).toBe('sg');
    expect(marketForCountry('PE')).toBeNull();
    expect(marketForCountry(null)).toBeNull();
  });

  it('builds hreflang for every landing', () => {
    expect(landingAlternates()).toEqual({
      'es-PE': '/',
      'x-default': '/',
      'es-ES': '/es',
      'es-US': '/us',
      'en-AU': '/au',
      'en-AE': '/ae',
      'en-SG': '/sg',
    });
  });

  it('only accepts known slugs', () => {
    expect(isMarketSlug('es')).toBe(true);
    expect(isMarketSlug('pe')).toBe(false);
    expect(isMarketSlug('finanzas')).toBe(false);
  });
});

describe('waiting-list input', () => {
  it('validates emails like the database', () => {
    expect(isValidEmail(' Ana@Example.com ')).toBe(true);
    expect(isValidEmail('ana@example')).toBe(false);
    expect(isValidEmail('ana example.com')).toBe(false);
  });

  it('keeps clean UTM values only', () => {
    expect(cleanUtm(' instagram ')).toBe('instagram');
    expect(cleanUtm('<script>')).toBeUndefined();
    expect(cleanUtm('')).toBeUndefined();
    expect(cleanUtm('a'.repeat(150))).toHaveLength(100);
  });
});
