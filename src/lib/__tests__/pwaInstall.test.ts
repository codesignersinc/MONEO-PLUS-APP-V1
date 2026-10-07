import { describe, expect, it } from 'vitest';
import {
  detectInstallPlatform,
  recordVisit,
  shouldShowInstall,
  snoozeUntil,
  type InstallState,
} from '@/lib/pwaInstall';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
  androidWebview:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36',
  androidFacebook:
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/400.0]',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

describe('detectInstallPlatform', () => {
  it('iPhone and iPad browsers use the Share sheet', () => {
    expect(detectInstallPlatform(UA.iphoneSafari)).toBe('ios-safari');
    expect(detectInstallPlatform(UA.iphoneChrome)).toBe('ios-safari');
    expect(detectInstallPlatform(UA.ipad, 5)).toBe('ios-safari');
  });
  it('a Mac without touch is desktop', () => {
    expect(detectInstallPlatform(UA.ipad, 0)).toBe('none');
  });
  it('Android Chrome gets one-tap install; other browsers the menu', () => {
    expect(detectInstallPlatform(UA.androidChrome)).toBe('android');
    expect(detectInstallPlatform(UA.androidFirefox)).toBe('android-other');
  });
  it('social apps and webviews must open the real browser', () => {
    expect(detectInstallPlatform(UA.iphoneInstagram)).toBe('in-app');
    expect(detectInstallPlatform(UA.androidFacebook)).toBe('in-app');
    expect(detectInstallPlatform(UA.androidWebview)).toBe('in-app');
  });
  it('desktop never shows the prompt', () => {
    expect(detectInstallPlatform(UA.desktop)).toBe('none');
  });
});

describe('recordVisit', () => {
  it('adds each day once and keeps the last 10', () => {
    expect(recordVisit([], '2026-10-07')).toEqual(['2026-10-07']);
    expect(recordVisit(['2026-10-07'], '2026-10-07')).toEqual(['2026-10-07']);
    const many = Array.from({ length: 10 }, (_, i) => `2026-09-${String(i + 10)}`);
    const next = recordVisit(many, '2026-10-07');
    expect(next).toHaveLength(10);
    expect(next[9]).toBe('2026-10-07');
  });
});

describe('snoozeUntil', () => {
  it('adds days across month ends', () => {
    expect(snoozeUntil('2026-10-20')).toBe('2026-11-10');
    expect(snoozeUntil('2026-12-25', 10)).toBe('2027-01-04');
  });
});

describe('shouldShowInstall', () => {
  const base: InstallState = { snoozedUntil: null, visitDays: ['2026-10-07'], engaged: false };
  const today = '2026-10-07';
  it('not on the first visit without activity', () => {
    expect(shouldShowInstall('android', false, base, today)).toBe(false);
  });
  it('after registering something or from the second day', () => {
    expect(shouldShowInstall('android', false, { ...base, engaged: true }, today)).toBe(true);
    expect(
      shouldShowInstall('ios-safari', false, { ...base, visitDays: ['2026-10-06', today] }, today)
    ).toBe(true);
  });
  it('never when installed, on desktop or while snoozed', () => {
    const ready = { ...base, engaged: true };
    expect(shouldShowInstall('android', true, ready, today)).toBe(false);
    expect(shouldShowInstall('none', false, ready, today)).toBe(false);
    expect(
      shouldShowInstall('android', false, { ...ready, snoozedUntil: '2026-10-28' }, today)
    ).toBe(false);
    expect(shouldShowInstall('android', false, { ...ready, snoozedUntil: today }, today)).toBe(
      true
    );
  });
});
