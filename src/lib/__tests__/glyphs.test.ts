import { describe, expect, it } from 'vitest';
import { GLYPH_KEYS, glyphKey, isGlyph } from '@/lib/glyphs';
import { CATEGORY_PRESETS } from '@/lib/financeStore';
import { POPULAR_SERVICES } from '@/lib/brands';
import { getNotificationTypeConfig } from '@/lib/notifications';

describe('glyphKey', () => {
  it('keeps glyph keys', () => {
    expect(glyphKey('food')).toBe('food');
    expect(glyphKey(' piggy ')).toBe('piggy');
  });

  it('maps legacy emojis saved in old rows, with or without variation selector', () => {
    expect(glyphKey('🍽️')).toBe('food');
    expect(glyphKey('🍽')).toBe('food');
    expect(glyphKey('🐷')).toBe('piggy');
    expect(glyphKey('📦')).toBe('package');
    expect(glyphKey('🎉')).toBe('party');
    expect(glyphKey('🏦')).toBe('bank');
  });

  it('returns null for empty or unknown values', () => {
    expect(glyphKey('')).toBeNull();
    expect(glyphKey(null)).toBeNull();
    expect(glyphKey('🦄')).toBeNull();
    expect(glyphKey('comida')).toBeNull();
    expect(isGlyph('🦄')).toBe(false);
  });

  it('every database default emoji has a glyph', () => {
    for (const e of ['🏦', '📦', '🎯', '💳', '📈', '📱', '💰', '💡', '🎉', '🏠']) {
      expect(glyphKey(e), e).not.toBeNull();
    }
  });
});

describe('icon data uses glyph keys', () => {
  const keys = new Set<string>(GLYPH_KEYS);
  it('categories', () => {
    for (const c of CATEGORY_PRESETS) expect(keys.has(c.icon), c.label).toBe(true);
  });
  it('subscription brands', () => {
    for (const s of POPULAR_SERVICES) expect(keys.has(s.icon), s.name).toBe(true);
  });
  it('notifications', () => {
    for (const t of ['expense', 'goal', 'security', 'unknown-type']) {
      expect(keys.has(getNotificationTypeConfig(t).icon), t).toBe(true);
    }
  });
});
