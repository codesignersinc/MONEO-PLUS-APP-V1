// Minimal analytics bridge. The project has no analytics platform yet: events are sent
// to whatever is present on the page (gtag / plausible) and always dispatched as a DOM
// CustomEvent ("moneo:track") so a future integration can subscribe without changing
// call sites. Never send amounts, merchants, accounts or other personal data here.

export type LandingEvent =
  | 'landing_view'
  | 'hero_cta_click'
  | 'login_click'
  | 'register_click'
  | 'feature_click'
  | 'juntas_click'
  | 'auto_click'
  | 'voice_click'
  | 'scan_click'
  | 'pricing_click'
  | 'faq_open'
  | 'google_play_click';

type Props = Record<string, string | number | boolean>;

interface AnalyticsWindow extends Window {
  gtag?: (command: 'event', name: string, params?: Props) => void;
  plausible?: (name: string, options?: { props?: Props }) => void;
}

export function track(event: LandingEvent, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  const w = window as AnalyticsWindow;
  try {
    w.gtag?.('event', event, props);
    w.plausible?.(event, { props });
    window.dispatchEvent(new CustomEvent('moneo:track', { detail: { event, props } }));
  } catch {
    // Analytics must never break the page.
  }
}
