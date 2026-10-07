// Edge Function "billing": MONEO PLUS with Mercado Pago.
//
// User actions (POST /billing, JSON body, Authorization: Bearer <user JWT>):
//   { action: 'checkout', plan: 'plus_monthly' | 'plus_yearly' | 'plus_lifetime' | 'founder' }
//       → { url } of Mercado Pago (subscription with free trial, or one-time payment).
//   { action: 'sync' }    → re-reads the user's recent checkouts in Mercado Pago and
//       updates the entitlement ("Restaurar compra", return from the checkout).
//   { action: 'cancel' }  → cancels the subscription; access stays until the period end.
//   { action: 'config' }  → { publicKey } for the Mercado Pago JS SDK (checkout in MONEO):
//       MP_PUBLIC_KEY, the pair of MP_PAYMENTS_ACCESS_TOKEN when that one is set.
//   { action: 'pay', plan, method: 'card' | 'yape' | 'pagoefectivo', token?, ... }
//       → pays inside MONEO with a token made by the Mercado Pago SDK in the browser:
//       card subscriptions (preapproval with card_token_id), card / Yape payments of
//       one-time plans and passes, and PagoEfectivo (pending until paid, voucher url).
//       → { status: 'approved' | 'pending' | 'rejected', detail?, url? }
// Mercado Pago notifications (POST /billing/webhook): signature checked with
//   MP_WEBHOOK_SECRET; the resource is always re-read from the Mercado Pago API and
//   resolved to a user and plan through our own billing_checkouts row.
//
// The entitlement (user_entitlements) is only written here, with the service role.
// No card data is ever received or stored. Logs carry outcomes only.
//
// Secrets: MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET, BILLING_SITE_URLS (comma-separated
// allowed app origins, the first one is the default); staging only: MP_TEST_PAYER_EMAIL
// (email of the Mercado Pago buyer test account that pays every test checkout).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MP_API = 'https://api.mercadopago.com';

type Row = Record<string, unknown>;
type Plan = {
  code: string;
  name: string;
  // pass: prepaid interval_months, paid once. trial: granted by MONEO, never sold.
  kind: 'subscription' | 'one_time' | 'pass' | 'trial';
  price: number;
  currency: string;
  interval_months: number | null;
  // People covered: 1 individual, 2 Duo, 6 Familiar (the payer invites the others).
  seats?: number;
  trial_days: number;
  active: boolean;
  available_until: string | null;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function log(outcome: string) {
  console.log(`billing: ${outcome}`);
}

// Direct payments (/v1/payments: card, Yape, PagoEfectivo inside MONEO) may use their own
// credentials: Mercado Pago tests them with the TEST- credentials of the real account,
// while subscriptions are tested with a seller test account. In production both are unset
// or equal, and MP_ACCESS_TOKEN is used for everything.
async function mp(path: string, init: RequestInit = {}): Promise<Row> {
  const token =
    (path.startsWith('/v1/payments') && Deno.env.get('MP_PAYMENTS_ACCESS_TOKEN')) ||
    Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) throw new Error('mp-not-configured');
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Row;
  if (!res.ok) {
    // Keep Mercado Pago's reason (without emails) to diagnose rejected checkouts.
    const reason = String(body.message ?? body.error ?? '')
      .replace(/[\w.+-]+@[\w.-]+/g, '<email>')
      .slice(0, 120);
    throw new Error(`mp-${res.status}${reason ? `: ${reason}` : ''}`);
  }
  return body;
}

function siteUrl(req: Request): string {
  const allowed = (Deno.env.get('BILLING_SITE_URLS') ?? 'https://moneo.plus')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const origin = (req.headers.get('origin') ?? '').replace(/\/$/, '');
  return allowed.includes(origin) ? origin : allowed[0];
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400e3);
}

// ── Entitlement updates ────────────────────────────────────────────────────────

async function loadCheckout(admin: SupabaseClient, id: unknown) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin
    .from('billing_checkouts')
    .select('*, plan:billing_plans(*)')
    .eq('id', id)
    .maybeSingle();
  return data as (Row & { plan: Plan }) | null;
}

async function currentEntitlement(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('user_entitlements')
    .select('*, plan:billing_plans(kind, seats)')
    .eq('user_id', userId)
    .maybeSingle();
  return data as (Row & { plan: { kind: string; seats?: number } }) | null;
}

// A lifetime / Founder purchase is never replaced by subscription events.
function isLifetime(e: (Row & { plan: { kind: string } }) | null): boolean {
  return Boolean(e && e.plan?.kind === 'one_time' && e.status === 'active');
}

// Applies the state of a Mercado Pago subscription (preapproval) to the entitlement.
async function applyPreapproval(admin: SupabaseClient, pre: Row): Promise<string> {
  const checkout = await loadCheckout(admin, pre.external_reference);
  if (!checkout || checkout.plan.kind !== 'subscription') return 'unknown-checkout';
  const userId = checkout.user_id as string;
  const current = await currentEntitlement(admin, userId);
  if (isLifetime(current)) return 'lifetime-kept';
  if (
    current?.provider_subscription_id &&
    current.provider_subscription_id !== pre.id &&
    pre.status !== 'authorized'
  ) {
    // An old or abandoned subscription must not overwrite the current one.
    return 'stale-subscription';
  }

  const status = String(pre.status);
  if (status === 'pending') return 'pending';
  const created = new Date(String(pre.date_created ?? Date.now()));
  const trialEnd = checkout.with_trial ? addDays(created, checkout.plan.trial_days) : null;
  const next = pre.next_payment_date ? new Date(String(pre.next_payment_date)) : null;
  const now = new Date();

  let entStatus: string;
  if (status === 'authorized') entStatus = trialEnd && now < trialEnd ? 'trialing' : 'active';
  else if (status === 'paused') entStatus = 'past_due';
  else if (status === 'cancelled') entStatus = 'cancelled';
  else return `ignored-${status}`;

  // Access runs until the next charge (+1 day of margin for the charge to settle).
  // Cancelled / paused: keep the end of the period already paid, never extend it.
  const periodEnd =
    entStatus === 'trialing' || entStatus === 'active'
      ? addDays(next ?? trialEnd ?? addDays(now, 30 * checkout.plan.interval_months!), 1)
      : current?.current_period_end
        ? new Date(String(current.current_period_end))
        : (trialEnd ?? now);

  const { error } = await admin.from('user_entitlements').upsert({
    user_id: userId,
    plan_code: checkout.plan.code,
    status: entStatus,
    current_period_end: periodEnd.toISOString(),
    trial_ends_at: trialEnd?.toISOString() ?? null,
    had_trial: Boolean(current?.had_trial) || Boolean(trialEnd),
    provider: 'mercadopago',
    provider_subscription_id: String(pre.id),
    provider_payment_id: null,
    checkout_id: checkout.id,
  });
  if (error) throw new Error('entitlement-write');
  if (status === 'authorized') {
    await admin.from('billing_checkouts').update({ status: 'completed' }).eq('id', checkout.id);
    // Upgrade (e.g. individual → Duo / Familiar): the previous subscription must not be
    // charged on top of the new one.
    if (current?.provider_subscription_id && current.provider_subscription_id !== pre.id) {
      await mp(`/preapproval/${encodeURIComponent(String(current.provider_subscription_id))}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      }).catch(() => log('cancel-old-subscription-failed'));
    }
  }
  return `subscription-${entStatus}`;
}

// Applies a one-time payment (Lifetime / Founder). Only an approved payment for the
// exact price and currency of the plan grants access.
async function applyPayment(admin: SupabaseClient, payment: Row): Promise<string> {
  const checkout = await loadCheckout(admin, payment.external_reference);
  if (!checkout) return 'unknown-checkout';
  if (checkout.plan.kind === 'subscription') {
    // A charge of a subscription: refresh the subscription itself.
    if (!checkout.provider_id) return 'no-subscription';
    return applyPreapproval(
      admin,
      await mp(`/preapproval/${encodeURIComponent(String(checkout.provider_id))}`)
    );
  }
  if (payment.status !== 'approved') {
    if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await admin.from('billing_checkouts').update({ status: 'failed' }).eq('id', checkout.id);
    }
    return `payment-${payment.status}`;
  }
  const paid = Math.round(Number(payment.transaction_amount) * 100);
  const expected = Math.round(Number(checkout.amount) * 100);
  if (paid !== expected || payment.currency_id !== checkout.currency) return 'amount-mismatch';

  const userId = checkout.user_id as string;
  const current = await currentEntitlement(admin, userId);
  // The same payment arrives from the in-app checkout, the webhook and "sync": apply once.
  if (checkout.status === 'completed' && current?.provider_payment_id === String(payment.id)) {
    return 'already-applied';
  }
  if (checkout.plan.kind === 'pass') return applyPass(admin, checkout, current, payment);
  // A one-time payment link can be paid more than once (reopened, paid again, or an old
  // link of someone who already has lifetime). Only the first approved payment counts;
  // any other one is refunded at once, never kept.
  if (
    isLifetime(current) &&
    current?.provider_payment_id &&
    current.provider_payment_id !== String(payment.id)
  ) {
    if (payment.status === 'approved' && !(payment.refunds as unknown[] | undefined)?.length) {
      await mp(`/v1/payments/${encodeURIComponent(String(payment.id))}/refunds`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': `refund-${payment.id}` },
        body: JSON.stringify({}),
      });
      return 'duplicate-refunded';
    }
    return 'duplicate-ignored';
  }
  const { error } = await admin.from('user_entitlements').upsert({
    user_id: userId,
    plan_code: checkout.plan.code,
    status: 'active',
    current_period_end: null,
    trial_ends_at: null,
    had_trial: Boolean(current?.had_trial),
    provider: 'mercadopago',
    provider_subscription_id: null,
    provider_payment_id: String(payment.id),
    checkout_id: checkout.id,
  });
  if (error) throw new Error('entitlement-write');
  await admin.from('billing_checkouts').update({ status: 'completed' }).eq('id', checkout.id);
  // Bought lifetime while subscribed: stop the subscription so it is not charged again.
  if (current?.provider_subscription_id && !isLifetime(current)) {
    await mp(`/preapproval/${encodeURIComponent(String(current.provider_subscription_id))}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    }).catch(() => log('cancel-old-subscription-failed'));
  }
  return 'lifetime-active';
}

// A prepaid pass: interval_months more of PLUS from today, or from the end of a pass that
// is still running (buying again extends it). A subscription running at the same time is
// cancelled so it is not charged on top of the pass.
async function applyPass(
  admin: SupabaseClient,
  checkout: Row & { plan: Plan },
  current: (Row & { plan: { kind: string } }) | null,
  payment: Row
): Promise<string> {
  const now = new Date();
  const runningEnd =
    current?.plan?.kind === 'pass' && current.current_period_end
      ? new Date(String(current.current_period_end))
      : null;
  const from = runningEnd && runningEnd > now ? runningEnd : now;
  const end = new Date(from);
  end.setMonth(end.getMonth() + Number(checkout.plan.interval_months));
  const { error } = await admin.from('user_entitlements').upsert({
    user_id: checkout.user_id,
    plan_code: checkout.plan.code,
    status: 'active',
    current_period_end: end.toISOString(),
    trial_ends_at: null,
    had_trial: Boolean(current?.had_trial),
    provider: 'mercadopago',
    provider_subscription_id: null,
    provider_payment_id: String(payment.id),
    checkout_id: checkout.id,
  });
  if (error) throw new Error('entitlement-write');
  await admin.from('billing_checkouts').update({ status: 'completed' }).eq('id', checkout.id);
  if (current?.provider_subscription_id) {
    await mp(`/preapproval/${encodeURIComponent(String(current.provider_subscription_id))}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    }).catch(() => log('cancel-old-subscription-failed'));
  }
  return 'pass-active';
}

// ── Webhook ─────────────────────────────────────────────────────────────────────

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handleWebhook(req: Request, admin: SupabaseClient): Promise<Response> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return json({ ok: false }, 500);
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as Row;
  const topic = String(
    body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  );
  const rawId = String(
    url.searchParams.get('data.id') ??
      (body.data as Row | undefined)?.id ??
      url.searchParams.get('id') ??
      ''
  );
  if (!topic || !/^[\w-]{1,80}$/.test(rawId)) return json({ ok: true, outcome: 'ignored' });

  // x-signature: "ts=<ts>,v1=<hmac>" over "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
  const parts = Object.fromEntries(
    (req.headers.get('x-signature') ?? '')
      .split(',')
      .map((p) => p.trim().split('=') as [string, string])
  );
  const requestId = req.headers.get('x-request-id') ?? '';
  const dataId = /^[a-z0-9]+$/i.test(rawId) ? rawId.toLowerCase() : rawId;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  if (!parts.ts || !parts.v1 || !safeEqual(await hmacHex(secret, manifest), parts.v1)) {
    log('webhook-bad-signature');
    return json({ ok: false }, 401);
  }

  let outcome: string;
  try {
    if (topic === 'payment') {
      outcome = await applyPayment(admin, await mp(`/v1/payments/${rawId}`));
    } else if (topic === 'subscription_preapproval') {
      outcome = await applyPreapproval(admin, await mp(`/preapproval/${rawId}`));
    } else if (topic === 'subscription_authorized_payment') {
      const charge = await mp(`/authorized_payments/${rawId}`);
      outcome = charge.preapproval_id
        ? await applyPreapproval(admin, await mp(`/preapproval/${charge.preapproval_id}`))
        : 'no-preapproval';
      if (
        charge.status === 'rejected' ||
        (charge.payment as Row | undefined)?.status === 'rejected'
      ) {
        outcome += ' charge-rejected';
      }
    } else {
      outcome = 'ignored-topic';
    }
  } catch (e) {
    outcome = e instanceof Error ? e.message : 'error';
  }
  await admin.from('billing_events').upsert(
    {
      provider: 'mercadopago',
      event_key: `${topic}:${rawId}:${requestId}`.slice(0, 200),
      topic: topic.slice(0, 60),
      resource_id: rawId,
      outcome: outcome.slice(0, 60),
    },
    { onConflict: 'provider,event_key', ignoreDuplicates: true }
  );
  log(`webhook ${topic} ${outcome}`);
  // 500 makes Mercado Pago retry when we could not reach its API or the database.
  const retry = /^(mp-5|mp-429|entitlement-write|error)/.test(outcome);
  return json({ ok: !retry, outcome }, retry ? 500 : 200);
}

// ── User actions ────────────────────────────────────────────────────────────────

// Plan the user may buy now, or the error to answer. Lifetime owners cannot buy again;
// an active subscription cannot be doubled with another subscription or a pass.
async function sellablePlan(
  admin: SupabaseClient,
  userId: string,
  planCode: string
): Promise<
  | { p: Plan; current: (Row & { plan: { kind: string } }) | null; error?: undefined }
  | { error: Response }
> {
  const { data: plan } = await admin
    .from('billing_plans')
    .select('*')
    .eq('code', planCode)
    .maybeSingle();
  const p = plan as Plan | null;
  if (
    !p ||
    !p.active ||
    p.kind === 'trial' ||
    (p.available_until && new Date(p.available_until) <= new Date())
  ) {
    return { error: json({ error: 'plan-unavailable' }, 400) };
  }
  const current = await currentEntitlement(admin, userId);
  if (isLifetime(current)) return { error: json({ error: 'already-lifetime' }, 409) };
  const subscribed =
    current &&
    current.plan?.kind === 'subscription' &&
    ['trialing', 'active'].includes(String(current.status)) &&
    current.current_period_end &&
    new Date(String(current.current_period_end)) > new Date();
  // Moving to a plan for more people (Duo / Familiar) is allowed: the old subscription
  // is cancelled once the new one is active.
  const upgrade = Number(p.seats ?? 1) > Number(current?.plan?.seats ?? 1);
  if (subscribed && !upgrade && (p.kind === 'subscription' || p.kind === 'pass')) {
    return { error: json({ error: 'already-plus' }, 409) };
  }
  return { p, current };
}

// Staging only: Mercado Pago test integrations must be paid by the buyer test account.
// The customer may pay with the email of their Mercado Pago account (Peru) when it is not
// the one of their MONEO account.
function payerEmailFor(user: Row, askedPayer?: unknown): string {
  const asked =
    typeof askedPayer === 'string' &&
    /^[^\s@]{1,64}@[^\s@]{1,100}\.[a-z]{2,}$/i.test(askedPayer.trim())
      ? askedPayer.trim()
      : '';
  return Deno.env.get('MP_TEST_PAYER_EMAIL') || asked || String(user.email);
}

async function checkout(
  req: Request,
  admin: SupabaseClient,
  user: Row,
  planCode: string,
  askedPayer?: unknown
) {
  const sold = await sellablePlan(admin, user.id as string, planCode);
  if (sold.error) return sold.error;
  const { p, current } = sold;

  const withTrial = p.kind === 'subscription' && p.trial_days > 0 && !current?.had_trial;
  const { data: row, error } = await admin
    .from('billing_checkouts')
    .insert({
      user_id: user.id,
      plan_code: p.code,
      amount: p.price,
      currency: p.currency,
      with_trial: withTrial,
    })
    .select('id')
    .single();
  if (error || !row) return json({ error: 'checkout-failed' }, 500);

  const payerEmail = payerEmailFor(user, askedPayer);
  const site = siteUrl(req);
  const back = `${site}/empezar?paso=confirmando&checkout=${row.id}`;
  const notify = `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing/webhook`;
  let providerId: string;
  let url: string;
  if (p.kind === 'subscription') {
    const pre = await mp('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: p.name,
        external_reference: row.id,
        payer_email: payerEmail,
        back_url: back,
        status: 'pending',
        auto_recurring: {
          frequency: p.interval_months,
          frequency_type: 'months',
          transaction_amount: Number(p.price),
          currency_id: p.currency,
          ...(withTrial ? { free_trial: { frequency: p.trial_days, frequency_type: 'days' } } : {}),
        },
      }),
    });
    providerId = String(pre.id);
    url = String(pre.init_point);
  } else {
    // The payment link expires in 24 h so an old link cannot be paid later.
    const expires = new Date(Date.now() + 24 * 3600e3).toISOString();
    const pref = await mp('/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `pref-${row.id}` },
      body: JSON.stringify({
        expires: true,
        expiration_date_to: expires,
        items: [
          {
            id: p.code,
            title: p.name,
            quantity: 1,
            unit_price: Number(p.price),
            currency_id: p.currency,
          },
        ],
        payer: { email: payerEmail },
        external_reference: row.id,
        back_urls: { success: back, pending: back, failure: back },
        auto_return: 'approved',
        notification_url: notify,
        statement_descriptor: 'MONEO PLUS',
      }),
    });
    providerId = String(pref.id);
    const sandbox = (Deno.env.get('MP_ACCESS_TOKEN') ?? '').startsWith('TEST-');
    url = String((sandbox && pref.sandbox_init_point) || pref.init_point);
  }
  await admin.from('billing_checkouts').update({ provider_id: providerId }).eq('id', row.id);
  log(`checkout ${p.code}${withTrial ? ' trial' : ''}`);
  return json({ url, checkoutId: row.id, trial: withTrial });
}

// ── Checkout inside MONEO (Mercado Pago SDK tokens) ──────────────────────────

type PayMethod = 'card' | 'yape' | 'pagoefectivo';

async function pay(req: Request, admin: SupabaseClient, user: Row, body: Row) {
  const method = String(body.method ?? '') as PayMethod;
  if (!['card', 'yape', 'pagoefectivo'].includes(method)) {
    return json({ error: 'bad-request' }, 400);
  }
  const sold = await sellablePlan(admin, user.id as string, String(body.plan ?? ''));
  if (sold.error) return sold.error;
  const { p, current } = sold;
  // Subscriptions renew on a card; Yape and PagoEfectivo only pay one-time plans and passes.
  if (p.kind === 'subscription' && method !== 'card') {
    return json({ error: 'method-not-allowed' }, 400);
  }
  const token = typeof body.token === 'string' ? body.token : '';
  if (method !== 'pagoefectivo' && !/^[\w-]{8,200}$/.test(token)) {
    return json({ error: 'bad-request' }, 400);
  }
  const cardMethod = String(body.payment_method_id ?? '');
  if (method === 'card' && p.kind !== 'subscription' && !/^[a-z_]{2,30}$/.test(cardMethod)) {
    return json({ error: 'bad-request' }, 400);
  }

  const withTrial = p.kind === 'subscription' && p.trial_days > 0 && !current?.had_trial;
  const { data: row, error } = await admin
    .from('billing_checkouts')
    .insert({
      user_id: user.id,
      plan_code: p.code,
      amount: p.price,
      currency: p.currency,
      with_trial: withTrial,
      method,
    })
    .select('*, plan:billing_plans(*)')
    .single();
  if (error || !row) return json({ error: 'checkout-failed' }, 500);
  const payerEmail = payerEmailFor(user, body.payer_email);
  const notify = `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing/webhook`;

  const fail = async (detail: string) => {
    await admin.from('billing_checkouts').update({ status: 'failed' }).eq('id', row.id);
    log(`pay ${p.code} ${method} rejected`);
    return json({ status: 'rejected', detail: detail.slice(0, 60) });
  };

  // Card subscription: authorized at once with the card token (no redirect).
  if (p.kind === 'subscription') {
    let pre: Row;
    try {
      pre = await mp('/preapproval', {
        method: 'POST',
        body: JSON.stringify({
          reason: p.name,
          external_reference: row.id,
          payer_email: payerEmail,
          card_token_id: token,
          back_url: `${siteUrl(req)}/finanzas`,
          status: 'authorized',
          auto_recurring: {
            frequency: p.interval_months,
            frequency_type: 'months',
            transaction_amount: Number(p.price),
            currency_id: p.currency,
            ...(withTrial
              ? { free_trial: { frequency: p.trial_days, frequency_type: 'days' } }
              : {}),
          },
        }),
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'error';
      if (/^mp-5|^mp-429/.test(reason)) throw e;
      return fail(reason.replace(/^mp-\d+:?\s*/, '') || 'card-rejected');
    }
    await admin.from('billing_checkouts').update({ provider_id: String(pre.id) }).eq('id', row.id);
    const outcome = await applyPreapproval(admin, pre);
    log(`pay ${p.code} card ${outcome}`);
    if (pre.status === 'authorized') return json({ status: 'approved', trial: withTrial });
    return fail(String(pre.status ?? 'not-authorized'));
  }

  // One-time plans and passes: a payment with the card / Yape token, or PagoEfectivo.
  const identification = body.identification as Row | undefined;
  const payment = await mp('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `pay-${row.id}` },
    body: JSON.stringify({
      transaction_amount: Number(p.price),
      description: p.name,
      external_reference: row.id,
      notification_url: notify,
      statement_descriptor: 'MONEO PLUS',
      payer: {
        email: payerEmail,
        ...(identification &&
        typeof identification.type === 'string' &&
        typeof identification.number === 'string'
          ? {
              identification: {
                type: identification.type.slice(0, 10),
                number: identification.number.replace(/\D/g, '').slice(0, 20),
              },
            }
          : {}),
      },
      ...(method === 'pagoefectivo'
        ? {
            payment_method_id: 'pagoefectivo_atm',
            date_of_expiration: new Date(Date.now() + 48 * 3600e3).toISOString(),
          }
        : method === 'yape'
          ? { payment_method_id: 'yape', token, installments: 1 }
          : {
              payment_method_id: cardMethod,
              token,
              installments: Math.min(Math.max(Number(body.installments) || 1, 1), 12),
              ...(/^\d{1,10}$/.test(String(body.issuer_id ?? ''))
                ? { issuer_id: Number(body.issuer_id) }
                : {}),
            }),
    }),
  });
  await admin
    .from('billing_checkouts')
    .update({ provider_id: String(payment.id) })
    .eq('id', row.id);

  if (payment.status === 'approved') {
    const outcome = await applyPayment(admin, payment);
    log(`pay ${p.code} ${method} ${outcome}`);
    return json({ status: 'approved' });
  }
  if (payment.status === 'pending' || payment.status === 'in_process') {
    const details = (payment.transaction_details ?? {}) as Row;
    const url =
      typeof details.external_resource_url === 'string' ? details.external_resource_url : null;
    await admin
      .from('billing_checkouts')
      .update({
        pending_url: url?.slice(0, 500) ?? null,
        pending_expires_at: (payment.date_of_expiration as string | null) ?? null,
      })
      .eq('id', row.id);
    log(`pay ${p.code} ${method} pending`);
    return json({ status: 'pending', url, detail: String(payment.status_detail ?? '') });
  }
  return fail(String(payment.status_detail ?? payment.status ?? 'rejected'));
}

async function sync(admin: SupabaseClient, user: Row) {
  const { data: rows } = await admin
    .from('billing_checkouts')
    .select('id, provider_id, plan:billing_plans(kind)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);
  const outcomes: string[] = [];
  for (const r of (rows ?? []) as (Row & { plan: { kind: string } })[]) {
    try {
      if (r.plan.kind === 'subscription') {
        if (r.provider_id) {
          outcomes.push(
            await applyPreapproval(
              admin,
              await mp(`/preapproval/${encodeURIComponent(String(r.provider_id))}`)
            )
          );
        }
      } else {
        const found = await mp(
          `/v1/payments/search?external_reference=${r.id}&sort=date_created&criteria=desc`
        );
        const results = (found.results as Row[] | undefined) ?? [];
        const approved = results.find((x) => x.status === 'approved') ?? results[0];
        if (approved) outcomes.push(await applyPayment(admin, approved));
      }
    } catch (e) {
      outcomes.push(e instanceof Error ? e.message : 'error');
    }
  }
  log(`sync ${outcomes.join(',') || 'none'}`);
  return json({ ok: true });
}

async function cancel(admin: SupabaseClient, user: Row) {
  const current = await currentEntitlement(admin, user.id as string);
  if (!current?.provider_subscription_id || isLifetime(current)) {
    return json({ error: 'no-subscription' }, 400);
  }
  const pre = await mp(
    `/preapproval/${encodeURIComponent(String(current.provider_subscription_id))}`,
    {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    }
  );
  await applyPreapproval(admin, pre);
  log('cancel');
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'missing-configuration' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (new URL(req.url).pathname.endsWith('/webhook')) return handleWebhook(req, admin);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return json({ error: 'unauthorized' }, 401);
  const user = auth.user as unknown as Row;
  if (!Deno.env.get('MP_ACCESS_TOKEN')) return json({ error: 'payments-not-configured' }, 503);

  const body = (await req.json().catch(() => ({}))) as Row;
  try {
    if (body.action === 'checkout') {
      try {
        return await checkout(req, admin, user, String(body.plan ?? ''), body.payer_email);
      } catch (e) {
        const reason = e instanceof Error ? e.message : 'unknown';
        await admin.from('billing_events').insert({
          provider: 'mercadopago',
          event_key: `checkout-error:${crypto.randomUUID()}`,
          topic: 'checkout-error',
          resource_id: String(body.plan ?? '').slice(0, 80) || 'unknown',
          outcome: reason.slice(0, 60),
        });
        log(`checkout-error ${reason}`);
        // The email belongs to a Mercado Pago account of another country, or is not valid
        // for Mercado Pago: the customer can try with another email.
        if (/different site|payer_email|invalid.*email|email.*invalid/i.test(reason)) {
          return json({ error: 'payer-email-rejected', reason: reason.slice(0, 120) }, 400);
        }
        return json({ error: 'provider-error', reason: reason.slice(0, 120) }, 502);
      }
    }
    if (body.action === 'sync') return await sync(admin, user);
    if (body.action === 'cancel') return await cancel(admin, user);
    if (body.action === 'config') {
      return json({ publicKey: Deno.env.get('MP_PUBLIC_KEY') ?? null });
    }
    if (body.action === 'pay') {
      try {
        return await pay(req, admin, user, body);
      } catch (e) {
        const reason = e instanceof Error ? e.message : 'unknown';
        await admin.from('billing_events').insert({
          provider: 'mercadopago',
          event_key: `pay-error:${crypto.randomUUID()}`,
          topic: 'pay-error',
          resource_id: String(body.plan ?? '').slice(0, 80) || 'unknown',
          outcome: reason.slice(0, 60),
        });
        log(`pay-error ${reason}`);
        if (/different site|payer_email|invalid.*email|email.*invalid/i.test(reason)) {
          return json({ error: 'payer-email-rejected', reason: reason.slice(0, 120) }, 400);
        }
        return json({ error: 'provider-error', reason: reason.slice(0, 120) }, 502);
      }
    }
    return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    log(`error ${e instanceof Error ? e.message : 'unknown'}`);
    return json({ error: 'provider-error' }, 502);
  }
});
