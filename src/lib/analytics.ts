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

// Onboarding / MONEO PLUS funnel. Properties are ids and plan codes only, never
// amounts, balances, account names or bank data.
export type OnboardingEvent =
  | 'onboarding_started'
  | 'goal_selected'
  | 'expense_category_selected'
  | 'registration_method_selected'
  | 'financial_goal_selected'
  | 'paywall_viewed'
  | 'plan_selected'
  | 'checkout_started'
  | 'trial_started'
  | 'subscription_started'
  | 'lifetime_purchased'
  | 'founder_purchased'
  | 'payment_failed'
  | 'payment_approved'
  | 'pass_purchased'
  | 'free_trial_started'
  | 'trial_countdown_clicked'
  | 'plus_locked_viewed'
  | 'account_created'
  | 'bank_selection_started'
  | 'bank_selected'
  | 'first_account_created'
  | 'notifications_enabled'
  | 'onboarding_completed'
  | 'dashboard_first_view';

// MONEO HOGAR. Properties are methods and counts only, never amounts or names.
export type HouseholdEvent =
  | 'household_created'
  | 'household_invitation_sent'
  | 'household_invitation_accepted'
  | 'household_expense_created'
  | 'household_expense_split'
  | 'household_goal_created'
  | 'household_budget_created'
  | 'household_settlement_created'
  | 'household_excel_import_started'
  | 'household_excel_import_completed'
  | 'household_simulation_created';

type Props = Record<string, string | number | boolean>;

interface AnalyticsWindow extends Window {
  gtag?: (command: 'event', name: string, params?: Props) => void;
  plausible?: (name: string, options?: { props?: Props }) => void;
}

export function track(
  event: LandingEvent | OnboardingEvent | HouseholdEvent,
  props: Props = {}
): void {
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
