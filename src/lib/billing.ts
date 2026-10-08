import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';

// MONEO PLUS: plans, the user's entitlement and Mercado Pago checkout.
// The entitlement is written only by the `billing` Edge Function after Mercado Pago
// confirms the payment; the client can read it but never grant it.

export type PlanCode =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'plus_lifetime'
  | 'founder'
  | 'pass_3m'
  | 'pass_12m'
  | 'free_trial'
  | 'duo_monthly'
  | 'duo_3m'
  | 'duo_12m'
  | 'family_monthly'
  | 'family_3m'
  | 'family_12m';

// Who a plan is for: 1 person, Duo (2) or Familiar (up to 6).
export type Audience = 'individual' | 'duo' | 'family';

export function audienceOf(seats: number): Audience {
  return seats >= 3 ? 'family' : seats === 2 ? 'duo' : 'individual';
}

// subscription: card, renews · one_time: lifetime · pass: prepaid months, paid once
// (card, Yape or PagoEfectivo) · trial: the free trial without card (never sold).
export type PlanKind = 'subscription' | 'one_time' | 'pass' | 'trial';

export interface BillingPlan {
  code: PlanCode;
  name: string;
  kind: PlanKind;
  price: number;
  currency: string;
  intervalMonths: number | null;
  trialDays: number;
  seats: number;
}

export interface Entitlement {
  planCode: PlanCode;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  hadTrial: boolean;
  lifetime: boolean;
  kind: PlanKind;
}

export const LIFETIME_PLANS: PlanCode[] = ['plus_lifetime', 'founder'];

export function planKindOf(code: PlanCode): PlanKind {
  if (LIFETIME_PLANS.includes(code)) return 'one_time';
  if (/^(pass_|duo_|family_)\d+m$/.test(code)) return 'pass';
  if (code === 'free_trial') return 'trial';
  return 'subscription';
}

export const PLUS_BENEFITS = [
  'MONEO AUTO',
  'MONEO VOZ',
  'MONEO SCAN',
  'MONEO NEGOCIO',
  'Reportes avanzados',
  'Alertas inteligentes',
  'Metas avanzadas',
  'Análisis de hábitos',
  'Sin anuncios',
  'Funciones premium futuras',
];

// "Desde S/ 8.13 al mes": the lowest monthly cost among the individual plans that renew or
// last a period (subscriptions and passes; lifetime is not monthly). Null when none is active.
export function cheapestMonthly(
  plans: Pick<BillingPlan, 'kind' | 'price' | 'currency' | 'intervalMonths' | 'seats'>[]
): { amount: number; currency: string } | null {
  let best: { amount: number; currency: string } | null = null;
  for (const p of plans) {
    if ((p.seats ?? 1) > 1 || p.price <= 0 || !p.intervalMonths) continue;
    if (p.kind !== 'subscription' && p.kind !== 'pass') continue;
    const amount = Math.round((p.price / p.intervalMonths) * 100) / 100;
    if (!best || amount < best.amount) best = { amount, currency: p.currency };
  }
  return best;
}

// Monthly price × 12 vs. the annual price, rounded down ("Ahorra 17%").
export function annualSavingsPercent(monthly: number, yearly: number): number {
  return Math.floor((1 - yearly / (monthly * 12)) * 100);
}

export function hasPlusNow(e: Entitlement | null): boolean {
  if (!e) return false;
  if (e.lifetime) return e.status === 'active';
  return Boolean(e.currentPeriodEnd && new Date(e.currentPeriodEnd).getTime() > Date.now());
}

// Paid MONEO PLUS (not the free trial without card): needed for Gmail.
export function hasPaidPlusNow(e: Entitlement | null): boolean {
  return Boolean(e && e.kind !== 'trial' && hasPlusNow(e));
}

// Whole days left of the free trial (0 on its last day), or null when not in it.
export function trialDaysLeft(e: Entitlement | null, now = Date.now()): number | null {
  if (!e || e.kind !== 'trial' || !e.currentPeriodEnd) return null;
  const ms = new Date(e.currentPeriodEnd).getTime() - now;
  if (ms <= 0) return null;
  return Math.floor(ms / 86400e3);
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
      seats: r.seats ?? 1,
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
      kind: planKindOf(data.plan_code),
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

export const trialService = {
  // Starts the 7-day trial without card once per user (the server decides). Returns true
  // when it started now.
  async start(): Promise<boolean> {
    const { data, error } = await createClient().rpc('start_free_trial');
    if (error) throw toDataError(error);
    return data === true;
  },
};

export type PayMethod = 'card' | 'yape' | 'pagoefectivo';

export interface PayResult {
  status: 'approved' | 'pending' | 'rejected';
  // Mercado Pago status_detail (rejections) and the PagoEfectivo voucher.
  detail?: string;
  url?: string | null;
  trial?: boolean;
}

export interface CardData {
  token: string;
  paymentMethodId?: string;
  issuerId?: string | number;
  installments?: number;
  identification?: { type: string; number: string };
}

// Mercado Pago rejection codes → message for the customer.
export function rejectionMessage(detail: string | undefined): string {
  const d = detail ?? '';
  if (/insufficient_amount/.test(d)) return 'Saldo insuficiente. Prueba con otro medio de pago.';
  if (/call_for_authorize/.test(d))
    return 'Tu banco pide autorizar el pago. Llámalo o usa otro medio de pago.';
  if (/bad_filled|form_error/.test(d)) return 'Revisa los datos ingresados e intenta de nuevo.';
  if (/max_attempts/.test(d)) return 'Superaste los intentos permitidos. Usa otro medio de pago.';
  if (/card_type_not_allowed/.test(d)) return 'Este medio de pago no está permitido. Usa otro.';
  if (/duplicated/.test(d)) return 'Ya hiciste un pago igual hace un momento.';
  return 'El pago fue rechazado. Prueba con otro medio de pago.';
}

export const paymentsService = {
  // Public key for the Mercado Pago JS SDK (null if payments are not configured).
  async publicKey(): Promise<string | null> {
    const data = await invoke({ action: 'config' });
    return typeof data.publicKey === 'string' ? data.publicKey : null;
  },

  // Pays inside MONEO with a token made by the Mercado Pago SDK. PLUS is granted on the
  // server only when Mercado Pago approves the payment.
  async pay(
    plan: PlanCode,
    method: PayMethod,
    card?: CardData,
    payerEmail?: string
  ): Promise<PayResult> {
    const data = await invoke({
      action: 'pay',
      plan,
      method,
      ...(card
        ? {
            token: card.token,
            payment_method_id: card.paymentMethodId,
            issuer_id: card.issuerId,
            installments: card.installments,
            identification: card.identification,
          }
        : {}),
      ...(payerEmail ? { payer_email: payerEmail } : {}),
    });
    const status = data.status;
    if (status !== 'approved' && status !== 'pending' && status !== 'rejected') {
      throw new BillingError('unknown');
    }
    return {
      status,
      detail: typeof data.detail === 'string' ? data.detail : undefined,
      url: typeof data.url === 'string' ? data.url : null,
      trial: data.trial === true,
    };
  },
};

// ---------- Duo / Familiar ----------

export interface PackMember {
  id: string;
  name: string;
  joinedAt: string;
  covered: boolean; // has a seat with the current plan
}

export type MyPack =
  | { role: null }
  | {
      role: 'owner';
      planCode: PlanCode;
      planName: string;
      seats: number;
      ownerName: string | null;
      members: PackMember[];
    }
  | {
      role: 'member';
      planCode: PlanCode | null;
      planName: string | null;
      seats: number | null;
      ownerName: string | null;
      covered: boolean;
      periodEnd: string | null;
    };

export type PackInviteStatus =
  | 'valid'
  | 'expired'
  | 'used'
  | 'revoked'
  | 'invalid'
  | 'inactive'
  | 'full';

// Keeps the messages the database writes for the user (Spanish) on validation errors.
function packError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code && ['42501', '22023', '23505'].includes(e.code) && e.message) {
    return new DataError(
      e.code === '42501' ? 'permission' : e.code === '23505' ? 'conflict' : 'validation',
      error,
      e.message
    );
  }
  return toDataError(error);
}

export const packService = {
  // The pack the user pays (owner) or belongs to (member). Members never see the others.
  async mine(): Promise<MyPack> {
    const { data, error } = await createClient().rpc('my_plus_pack');
    if (error) throw toDataError(error);
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.role === 'owner') {
      return {
        role: 'owner',
        planCode: r.plan_code as PlanCode,
        planName: String(r.plan_name ?? ''),
        seats: Number(r.seats ?? 1),
        ownerName: (r.owner_name as string | null) ?? null,
        members: ((r.members as Record<string, unknown>[] | null) ?? []).map((m) => ({
          id: String(m.id),
          name: String(m.name),
          joinedAt: String(m.joined_at),
          covered: m.covered === true,
        })),
      };
    }
    if (r.role === 'member') {
      return {
        role: 'member',
        planCode: (r.plan_code as PlanCode | null) ?? null,
        planName: (r.plan_name as string | null) ?? null,
        seats: r.seats == null ? null : Number(r.seats),
        ownerName: (r.owner_name as string | null) ?? null,
        covered: r.covered === true,
        periodEnd: (r.period_end as string | null) ?? null,
      };
    }
    return { role: null };
  },

  // Single-use link token (7 days); optionally only for one email.
  async invite(ownerName: string, email?: string): Promise<string> {
    const { data, error } = await createClient().rpc('create_plus_pack_invite', {
      p_owner_name: ownerName,
      p_email: email?.trim() || null,
    });
    if (error) throw packError(error);
    return data as string;
  },

  async invitations(): Promise<{ id: string; email: string | null; expiresAt: string }[]> {
    const { data, error } = await createClient().rpc('my_plus_pack_invitations');
    if (error) throw toDataError(error);
    return ((data ?? []) as { id: string; email: string | null; expires_at: string }[]).map(
      (r) => ({
        id: r.id,
        email: r.email,
        expiresAt: r.expires_at,
      })
    );
  },

  async revoke(invitationId: string): Promise<void> {
    const { error } = await createClient().rpc('revoke_plus_pack_invite', {
      p_invitation: invitationId,
    });
    if (error) throw toDataError(error);
  },

  async inviteInfo(
    token: string
  ): Promise<{ ownerName: string | null; planName: string | null; status: PackInviteStatus }> {
    const { data, error } = await createClient().rpc('plus_pack_invite_info', { p_token: token });
    if (error) throw toDataError(error);
    const r = (
      data as { owner_name: string | null; plan_name: string | null; status: PackInviteStatus }[]
    )[0];
    return {
      ownerName: r?.owner_name ?? null,
      planName: r?.plan_name ?? null,
      status: r?.status ?? 'invalid',
    };
  },

  async accept(token: string, displayName: string): Promise<void> {
    const { error } = await createClient().rpc('accept_plus_pack_invite', {
      p_token: token,
      p_display_name: displayName,
    });
    if (error) throw packError(error);
  },

  async remove(memberId: string): Promise<void> {
    const { error } = await createClient().rpc('remove_plus_pack_member', { p_member: memberId });
    if (error) throw packError(error);
  },

  async leave(): Promise<void> {
    const { error } = await createClient().rpc('leave_plus_pack');
    if (error) throw toDataError(error);
  },
};
