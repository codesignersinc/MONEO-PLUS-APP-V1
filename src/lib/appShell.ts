'use client';
import { useEffect, useState } from 'react';

// The Android app (Trusted Web Activity, android/) opens moneo.plus in Chrome. It launches
// /finanzas?source=android and Chrome sends the referrer android-app://plus.moneo.app.
// public/register-sw.js marks the tab in sessionStorage (per tab, so the same phone's
// regular browser is not affected). Google Play does not allow selling digital plans with
// another payment system inside the app, so the checkout is hidden there.

export const ANDROID_APP_ID = 'plus.moneo.app';
export const SHELL_KEY = 'moneo.shell';

export function detectShell(search: string, referrer: string): 'android' | null {
  if (new URLSearchParams(search).get('source') === 'android') return 'android';
  if (referrer.startsWith(`android-app://${ANDROID_APP_ID}`)) return 'android';
  return null;
}

export function isAndroidApp(): boolean {
  try {
    return (
      sessionStorage.getItem(SHELL_KEY) === 'android' ||
      detectShell(window.location.search, document.referrer) === 'android'
    );
  } catch {
    return false;
  }
}

/** false during SSR and the first render; true inside the Android app after mount. */
export function useIsAndroidApp(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isAndroidApp()), []);
  return inApp;
}
