// Edge Function "billing": MONEO PLUS with Mercado Pago.
//
// User actions (POST /billing, JSON body, Authorization: Bearer <user JWT>):
//   { action: 'checkout', plan: 'plus_monthly' | 'plus_yearly' | 'plus_lifetime' | 'founder' }
//       → { url } of Mercado Pago (subscription with free trial, or one-time payment).
//   { action: 'sync' }    → re-reads the user's recent checkouts in Mercado Pago and
//       updates the entitlement ("Restaurar compra", return from the checkout).
//   { action: 'cancel' }  → cancels the subscription; access stays until the period end.
// Mercado Pago notifications (POST /billing/webhook): signature checked with
//   MP_WEBHOOK_SECRET; the resource is always re-read from the Mercado Pago API and
//   resolved to a user and plan through our own billing_checkouts row.
//
// The entitlement (user_entitlements) is only written here, with the service role.
// No card data is ever received or stored. Logs carry outcomes only.
//
// Secrets: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, BILLING_SITE_URLS (comma-separated
// allowed app origins, the first one is the default); staging only: MP_TEST_PAYER_EMAIL
// (email of the Mercado Pago buyer test account that pays every test checkout).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MP_API = 'https://api.mercadopago.com';

type Row = Record<string, unknown>;
type Plan = {
  code: string;
  name: string;
  kind: 'subscription' | 'one_time';
  price: number;
  currency: string;
  interval_months: number | null;
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

async function mp(path: string, init: RequestInit = {}): Promise<Row> {
  const token = Deno.env.get('MP_ACCESS_TOKEN');
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
  if (!res.ok) throw new Error(`mp-${res.status}`);
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
    .select('*, plan:billing_plans(kind)')
    .eq('user_id', userId)
    .maybeSingle();
  return data as (Row & { plan: { kind: string } }) | null;
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
    provider_subscription_id: String(pre.id),
    provider_payment_id: null,
    checkout_id: checkout.id,
  });
  if (error) throw new Error('entitlement-write');
  if (status === 'authorized') {
    await admin.from('billing_checkouts').update({ status: 'completed' }).eq('id', checkout.id);
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
  const { error } = await admin.from('user_entitlements').upsert({
    user_id: userId,
    plan_code: checkout.plan.code,
    status: 'active',
    current_period_end: null,
    trial_ends_at: null,
    had_trial: Boolean(current?.had_trial),
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

async function checkout(req: Request, admin: SupabaseClient, user: Row, planCode: string) {
  const { data: plan } = await admin
    .from('billing_plans')
    .select('*')
    .eq('code', planCode)
    .maybeSingle();
  const p = plan as Plan | null;
  if (!p || !p.active || (p.available_until && new Date(p.available_until) <= new Date())) {
    return json({ error: 'plan-unavailable' }, 400);
  }
  const current = await currentEntitlement(admin, user.id as string);
  if (isLifetime(current)) return json({ error: 'already-lifetime' }, 409);
  const subscribed =
    current &&
    current.plan?.kind === 'subscription' &&
    ['trialing', 'active'].includes(String(current.status)) &&
    current.current_period_end &&
    new Date(String(current.current_period_end)) > new Date();
  if (subscribed && p.kind === 'subscription') return json({ error: 'already-plus' }, 409);

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

  // Staging only: Mercado Pago test integrations must be paid by the buyer test account.
  const payerEmail = Deno.env.get('MP_TEST_PAYER_EMAIL') || String(user.email);
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
    const pref = await mp('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
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
    if (body.action === 'checkout')
      return await checkout(req, admin, user, String(body.plan ?? ''));
    if (body.action === 'sync') return await sync(admin, user);
    if (body.action === 'cancel') return await cancel(admin, user);
    return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    log(`error ${e instanceof Error ? e.message : 'unknown'}`);
    return json({ error: 'provider-error' }, 502);
  }
});
