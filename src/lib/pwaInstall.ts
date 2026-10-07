// "Instala MONEO+" prompt: pure rules (platform, when to show). No browser APIs here so it
// can be unit-tested; the component reads navigator/localStorage and passes the values in.

export type InstallPlatform =
  | 'android' // Chromium on Android: one-tap install via beforeinstallprompt
  | 'android-other' // Firefox/Opera… on Android: install from the browser menu
  | 'ios-safari' // Safari (or Chrome/Edge 16.4+) on iPhone/iPad: Share → Add to Home Screen
  | 'in-app' // Instagram, Facebook, TikTok, WhatsApp… webviews: must open in the real browser
  | 'none'; // desktop or unknown: no prompt

export interface InstallState {
  /** Day (YYYY-MM-DD) until which the prompt stays hidden after "Ahora no". */
  snoozedUntil: string | null;
  /** Distinct days the user opened the app (most recent last, capped). */
  visitDays: string[];
  /** The user has registered something (quick-add, forms…). */
  engaged: boolean;
}

export const INSTALL_SNOOZE_DAYS = 21;
const IN_APP =
  /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Bytedance|Twitter|Snapchat|WhatsApp|LinkedInApp|Pinterest|; wv\)/i;

export function isIOS(ua: string, maxTouchPoints = 0): boolean {
  // iPadOS 13+ reports itself as a Mac; a touch screen gives it away.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
}

export function detectInstallPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  if (IN_APP.test(ua)) return 'in-app';
  if (isIOS(ua, maxTouchPoints)) return 'ios-safari';
  if (/Android/i.test(ua)) {
    if (/Firefox|OPR\/|Opera/i.test(ua)) return 'android-other';
    return 'android';
  }
  return 'none';
}

/** Adds today to the visit list (no duplicates, keeps the last 10). */
export function recordVisit(days: string[], today: string): string[] {
  if (days[days.length - 1] === today) return days;
  return [...days.filter((d) => d !== today), today].slice(-10);
}

export function snoozeUntil(today: string, days = INSTALL_SNOOZE_DAYS): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Shown on phones only, never when already installed, not on the very first visit:
 * after the user registered something, or from the second day they open the app.
 */
export function shouldShowInstall(
  platform: InstallPlatform,
  standalone: boolean,
  state: InstallState,
  today: string
): boolean {
  if (platform === 'none' || standalone) return false;
  if (state.snoozedUntil && today < state.snoozedUntil) return false;
  return state.engaged || state.visitDays.length >= 2;
}
