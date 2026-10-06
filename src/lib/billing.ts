import { createClient } from '@/lib/supabase/client';
import { toDataError } from '@/lib/dataError';

// MONEO PLUS: plans, the user's entitlement and Mercado Pago checkout.
// The entitlement is written only by the `billing` Edge Function after Mercado Pago
// confirms the payment; the client can read it but never grant it.

export type PlanCode = 'plus_monthly' | 'plus_yearly' | 'plus_lifetime' | 'founder';

export interface BillingPlan {
  code: PlanCode;
  name: string;
  kind: 'subscription' | 'one_time';
  price: number;
  currency: string;
  intervalMonths: number | null;
  trialDays: number;
}

export interface Entitlement {
  planCode: PlanCode;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  hadTrial: boolean;
  lifetime: boolean;
}

export const LIFETIME_PLANS: PlanCode[] = ['plus_lifetime', 'founder'];

export const PLUS_BENEFITS = [
  'MONEO AUTO',
  'MONEO VOZ',
  'MONEO SCAN',
  'Reportes avanzados',
  'Alertas inteligentes',
  'Metas avanzadas',
  'Análisis de hábitos',
  'Sin anuncios',
  'Funciones premium futuras',
];

// Monthly price × 12 vs. the annual price, rounded down ("Ahorra 17%").
export function annualSavingsPercent(monthly: number, yearly: number): number {
  return Math.floor((1 - yearly / (monthly * 12)) * 100);
}

export function hasPlusNow(e: Entitlement | null): boolean {
  if (!e) return false;
  if (e.lifetime) return e.status === 'active';
  return Boolean(e.currentPeriodEnd && new Date(e.currentPeriodEnd).getTime() > Date.now());
}

export const plansService = {
  async list(): Promise<BillingPlan[]> {
    const { data, error } = await createClient()
      .from('billing_plans')
      .select('*')
      .order('sort_order');
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({
      code: r.code,
      name: r.name,
      kind: r.kind,
      price: Number(r.price),
      currency: r.currency,
      intervalMonths: r.interval_months,
      trialDays: r.trial_days,
    }));
  },
};

export const entitlementService = {
  // null = MONEO FREE (no purchase yet).
  async get(): Promise<Entitlement | null> {
    const { data, error } = await createClient()
      .from('user_entitlements')
      .select('*')
      .maybeSingle();
    if (error) throw toDataError(error);
    if (!data) return null;
    return {
      planCode: data.plan_code,
      status: data.status,
      currentPeriodEnd: data.current_period_end,
      trialEndsAt: data.trial_ends_at,
      hadTrial: data.had_trial,
      lifetime: LIFETIME_PLANS.includes(data.plan_code),
    };
  },

  // Source of truth on the server (same rule as hasPlusNow).
  async hasPlus(): Promise<boolean> {
    const { data, error } = await createClient().rpc('has_plus');
    if (error) throw toDataError(error);
    return data === true;
  },
};

export type CheckoutError =
  | 'payments-not-configured'
  | 'already-plus'
  | 'already-lifetime'
  | 'plan-unavailable'
  | 'payer-email-rejected'
  | 'unknown';

const BILLING_MESSAGES: Record<CheckoutError, string> = {
  'payments-not-configured': 'Los pagos con Mercado Pago se activan muy pronto.',
  'already-plus': 'Ya tienes MONEO PLUS activo.',
  'already-lifetime': 'Ya tienes MONEO PLUS de por vida.',
  'plan-unavailable': 'Este plan ya no está disponible.',
  'payer-email-rejected':
    'Mercado Pago no aceptó tu correo: puede estar asociado a una cuenta de Mercado Pago de otro país.',
  unknown: 'No pudimos conectar con Mercado Pago. Intenta de nuevo.',
};

export class BillingError extends Error {
  readonly code: CheckoutError;
  readonly userMessage: string;
  constructor(code: CheckoutError) {
    super(BILLING_MESSAGES[code]);
    this.name = 'BillingError';
    this.code = code;
    this.userMessage = BILLING_MESSAGES[code];
  }
}

function toCheckoutError(code: string | undefined): CheckoutError {
  return code && code in BILLING_MESSAGES ? (code as CheckoutError) : 'unknown';
}

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await createClient().functions.invoke('billing', { body });
  if (error) {
    // The function answers errors as { error: code } with a non-2xx status.
    let code: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      code = ((await ctx?.json()) as { error?: string } | undefined)?.error;
    } catch {
      // not JSON
    }
    throw new BillingError(toCheckoutError(code));
  }
  return (data ?? {}) as Record<string, unknown>;
}

export const billingService = {
  // Returns the Mercado Pago URL to complete the payment (or start the free trial).
  // `payerEmail`: optional email of the customer's Mercado Pago (Peru) account.
  async checkout(plan: PlanCode, payerEmail?: string): Promise<{ url: string; trial: boolean }> {
    const data = await invoke({
      action: 'checkout',
      plan,
      ...(payerEmail ? { payer_email: payerEmail } : {}),
    });
    if (typeof data.url !== 'string') throw new BillingError('unknown');
    return { url: data.url, trial: data.trial === true };
  },

  // Re-reads the purchase in Mercado Pago ("Restaurar compra" / back from checkout).
  async sync(): Promise<void> {
    await invoke({ action: 'sync' });
  },

  // Cancels the subscription; access stays until the end of the paid period.
  async cancel(): Promise<void> {
    await invoke({ action: 'cancel' });
  },
};
