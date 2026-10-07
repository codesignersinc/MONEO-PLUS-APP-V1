import { describe, expect, it } from 'vitest';
import { androidDeviceName, androidLinkIntent } from '@/lib/supabaseCompanion';

describe('androidDeviceName', () => {
  it('uses the phone model when the browser reports it', () => {
    expect(
      androidDeviceName(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'
      )
    ).toBe('Android · SM-A546E');
    expect(
      androidDeviceName(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001) AppleWebKit'
      )
    ).toBe('Android · Pixel 7');
  });
  it('falls back to "Android" when the model is hidden (reduced user agent)', () => {
    expect(
      androidDeviceName('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/126.0')
    ).toBe('Android');
    expect(androidDeviceName('Mozilla/5.0 (Windows NT 10.0)')).toBe('Android');
  });
});

describe('androidLinkIntent', () => {
  it('targets only the MONEO package', () => {
    const url = androidLinkIntent('abc123');
    expect(url).toBe(
      'intent://link?token=abc123#Intent;scheme=moneo-widget;package=plus.moneo.app;end'
    );
  });
});
