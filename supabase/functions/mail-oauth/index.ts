// Edge Function "mail-oauth": MONEO AUTO reads bank emails straight from the user's
// Gmail (read-only OAuth), so nobody has to set up forwarding.
//
// User actions (POST /mail-oauth, JSON body, Authorization: Bearer <user JWT>):
//   { action: 'status' }              → { configured, connection }
//   { action: 'connect' }             → { url } of Google's consent screen
//   { action: 'sync' }                → reads new bank emails now → { found }
//   { action: 'disconnect' }          → revokes the Google token and forgets it
// Google redirect (GET /mail-oauth/google?code&state): stores the connection and sends
//   the user back to <site>/finanzas/auto?correo=conectado|cancelado|error.
// Cron (POST /mail-oauth, Authorization: Bearer <MAIL_CRON_SECRET>, { action: 'cron' }):
//   reads new bank emails of every active connection (pg_cron, every 5 minutes).
//
// Only emails from the trusted bank senders are requested (Gmail search), and each one
// is interpreted with the same code as the web app. The email itself is never stored:
// only the suggestion fields, plus a hash of the message id to read it only once. Tokens
// are stored encrypted (AES-GCM, MAIL_TOKEN_KEY). Logs carry outcomes only.
//
// Secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, MAIL_TOKEN_KEY (base64, 32 bytes),
// MAIL_CRON_SECRET, BILLING_SITE_URLS (allowed app origins, the first one is the default),
// optional MAIL_GOOGLE_USER_CAP (default 95: Google allows 100 users while unverified) and
// MAIL_REDIRECT_URI (see redirectUri).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  bankForEmail,
  gmailBankQuery,
  gmailBodies,
  gmailHeader,
  htmlToText,
  isLikelyDuplicate,
  maskEmail,
  operationKey,
  parseBankMessage,
} from './interpreter.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const FIRST_LOOKBACK_DAYS = 3;
const MAX_MESSAGES_PER_SYNC = 25;
const STATE_TTL_MS = 15 * 60 * 1000;

type Row = Record<string, unknown>;

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
  console.log(`mail-oauth: ${outcome}`);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function allowedOrigins(): string[] {
  return (Deno.env.get('BILLING_SITE_URLS') ?? 'https://moneo.plus')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function siteUrl(req: Request): string {
  const allowed = allowedOrigins();
  const origin = (req.headers.get('origin') ?? '').replace(/\/$/, '');
  return allowed.includes(origin) ? origin : allowed[0];
}

// MAIL_REDIRECT_URI (e.g. https://moneo.plus/auth/gmail, which forwards here) makes Google
// show the app's domain on its consent screen. It must be registered in Google Cloud.
function redirectUri(): string {
  return (
    Deno.env.get('MAIL_REDIRECT_URI') ||
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/mail-oauth/google`
  );
}

function googleConfigured(): boolean {
  return Boolean(
    Deno.env.get('GMAIL_CLIENT_ID') &&
    Deno.env.get('GMAIL_CLIENT_SECRET') &&
    Deno.env.get('MAIL_TOKEN_KEY')
  );
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (bytes: Uint8Array) =>
  b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let cachedKey: CryptoKey | null = null;
async function tokenKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = unb64(Deno.env.get('MAIL_TOKEN_KEY') ?? '');
  if (raw.length !== 32) throw new Error('bad-token-key');
  cachedKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return cachedKey;
}

async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await tokenKey(),
    new TextEncoder().encode(plain)
  );
  return `v1:${b64(iv)}:${b64(new Uint8Array(ct))}`;
}

async function decrypt(enc: string): Promise<string> {
  const [v, iv, ct] = enc.split(':');
  if (v !== 'v1' || !iv || !ct) throw new Error('bad-ciphertext');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) },
    await tokenKey(),
    unb64(ct)
  );
  return new TextDecoder().decode(plain);
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

async function googleToken(params: Record<string, string>): Promise<Row> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') ?? '',
      ...params,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Row;
  if (!res.ok) throw new Error(`google-token-${String(body.error ?? res.status).slice(0, 30)}`);
  return body;
}

async function gmail(accessToken: string, path: string): Promise<Row> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await res.json().catch(() => ({}))) as Row;
  if (!res.ok) throw new Error(`gmail-${res.status}`);
  return body;
}

// Gmail is for paying MONEO PLUS users only (subscription, pass or lifetime, including a
// card subscription still in its trial): every connection uses one of the 100 places Google
// allows while the app is unverified. The free trial without card does not include it.
async function paidPlus(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_entitlements')
    .select('status, current_period_end, plan:billing_plans(kind)')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return false;
  const kind = (data.plan as { kind?: string } | null)?.kind;
  if (kind === 'one_time') return data.status === 'active';
  if (kind !== 'subscription' && kind !== 'pass') return false;
  return Boolean(data.current_period_end && Date.parse(data.current_period_end) > Date.now());
}

async function connect(req: Request, admin: SupabaseClient, user: Row): Promise<Response> {
  if (!googleConfigured()) return json({ error: 'not-configured' }, 503);
  const userId = String(user.id);
  if (!(await paidPlus(admin, userId))) return json({ error: 'plus-required' }, 402);

  // Google allows 100 users while the app is unverified: keep a margin.
  const cap = Number(Deno.env.get('MAIL_GOOGLE_USER_CAP') ?? 95);
  const { data: mine } = await admin
    .from('mail_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (!mine) {
    const { count } = await admin
      .from('mail_connections')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'google');
    if ((count ?? 0) >= cap) {
      log('connect beta-full');
      return json({ error: 'beta-full' }, 409);
    }
  }

  const state = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  );
  // Old, unfinished attempts of this user are discarded.
  await admin.from('mail_oauth_states').delete().eq('user_id', userId);
  const { error } = await admin.from('mail_oauth_states').insert({
    state_hash: await sha256Hex(state),
    user_id: userId,
    provider: 'google',
    code_verifier: verifier,
    return_origin: siteUrl(req),
  });
  if (error) throw new Error('state-insert-failed');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: Deno.env.get('GMAIL_CLIENT_ID') ?? '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(typeof user.email === 'string' ? { login_hint: user.email } : {}),
  }).toString();
  log('connect url');
  return json({ url: url.toString() });
}

async function callback(req: Request, admin: SupabaseClient): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const state = params.get('state') ?? '';
  const back = (origin: string, result: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${origin}/finanzas/auto?correo=${result}` },
    });

  const { data: row } = state
    ? await admin
        .from('mail_oauth_states')
        .select('*')
        .eq('state_hash', await sha256Hex(state))
        .maybeSingle()
    : { data: null };
  const fallback = allowedOrigins()[0];
  if (!row) {
    log('callback unknown-state');
    return back(fallback, 'error');
  }
  await admin.from('mail_oauth_states').delete().eq('state_hash', row.state_hash);
  const origin = allowedOrigins().includes(row.return_origin) ? row.return_origin : fallback;
  if (Date.now() - Date.parse(row.created_at) > STATE_TTL_MS) {
    log('callback expired-state');
    return back(origin, 'error');
  }
  if (params.get('error') || !params.get('code')) {
    log('callback cancelled');
    return back(origin, 'cancelado');
  }

  try {
    const tok = await googleToken({
      grant_type: 'authorization_code',
      code: params.get('code') ?? '',
      redirect_uri: redirectUri(),
      code_verifier: row.code_verifier,
    });
    // With granular consent the user may leave the Gmail box unchecked.
    if (
      !String(tok.scope ?? '')
        .split(' ')
        .includes(GMAIL_SCOPE)
    ) {
      log('callback scope-missing');
      return back(origin, 'permiso');
    }
    if (typeof tok.refresh_token !== 'string') throw new Error('no-refresh-token');
    if (!(await paidPlus(admin, String(row.user_id)))) {
      log('callback plus-required');
      return back(origin, 'plus');
    }
    const access = String(tok.access_token);
    const profile = await gmail(access, '/profile');
    const now = new Date();
    const { data: conn, error } = await admin
      .from('mail_connections')
      .upsert(
        {
          user_id: row.user_id,
          provider: 'google',
          email_hint: maskEmail(String(profile.emailAddress ?? '')),
          status: 'active',
          refresh_token_enc: await encrypt(tok.refresh_token),
          access_token_enc: await encrypt(access),
          access_expires_at: new Date(
            now.getTime() + Number(tok.expires_in ?? 0) * 1000
          ).toISOString(),
          last_sync_at: null,
          last_error: null,
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id,provider' }
      )
      .select('*')
      .single();
    if (error || !conn) throw new Error('connection-save-failed');
    log('callback connected');
    // First read (last few days) so the inbox fills right away.
    await syncConnection(admin, conn as Row).catch(() => 0);
    return back(origin, 'conectado');
  } catch (e) {
    log(`callback ${e instanceof Error ? e.message : 'failed'}`);
    return back(origin, 'error');
  }
}

// ── Reading bank emails ──────────────────────────────────────────────────────

async function accessToken(admin: SupabaseClient, conn: Row): Promise<string> {
  const expires = conn.access_expires_at ? Date.parse(String(conn.access_expires_at)) : 0;
  if (conn.access_token_enc && expires - Date.now() > 60_000) {
    return decrypt(String(conn.access_token_enc));
  }
  const refresh = await decrypt(String(conn.refresh_token_enc));
  const tok = await googleToken({ grant_type: 'refresh_token', refresh_token: refresh });
  const access = String(tok.access_token);
  await admin
    .from('mail_connections')
    .update({
      access_token_enc: await encrypt(access),
      access_expires_at: new Date(Date.now() + Number(tok.expires_in ?? 0) * 1000).toISOString(),
    })
    .eq('id', conn.id);
  return access;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function rowToParsed(r: Row) {
  return {
    bank: r.bank,
    kind: r.kind,
    type: r.movement_type,
    amount: Number(r.amount),
    currency: r.currency,
    merchant: String(r.merchant ?? ''),
    date: String(r.occurred_date),
    time: r.occurred_time ? String(r.occurred_time).slice(0, 5) : null,
    operationId: undefined,
  };
}

// Interprets one bank email and stores the suggestion. Returns true if it was added.
async function suggest(
  admin: SupabaseClient,
  userId: string,
  msg: { from: string; subject: string; text: string; html: string; sentAt: number }
): Promise<boolean> {
  if (!bankForEmail(msg.from)) return false;
  // Interpret in Lima time (the bundle reads local date/time; Deno runs in UTC).
  const receivedAt = new Date(msg.sentAt - 5 * 3600 * 1000);
  const read = (text: string) =>
    parseBankMessage({ source: 'email', sender: msg.from, subject: msg.subject, text, receivedAt });
  const parsed = (msg.text && read(msg.text)) || (msg.html ? read(htmlToText(msg.html)) : null);
  if (!parsed) return false;

  const { data: near } = await admin
    .from('auto_suggestions')
    .select('bank,kind,movement_type,amount,currency,merchant,occurred_date,occurred_time')
    .eq('user_id', userId)
    .gte('occurred_date', shiftDate(parsed.date, -1))
    .lte('occurred_date', shiftDate(parsed.date, 1))
    .neq('status', 'ignorada');
  if (
    (near ?? []).some((r: Row) =>
      isLikelyDuplicate(rowToParsed(r) as never, { ...parsed, operationId: undefined })
    )
  ) {
    return false;
  }
  const opKey = operationKey(parsed);
  const { error } = await admin.from('auto_suggestions').insert({
    user_id: userId,
    source: 'email',
    bank: parsed.bank,
    kind: parsed.kind,
    movement_type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    merchant: parsed.merchant.slice(0, 120),
    occurred_date: parsed.date,
    occurred_time: parsed.time,
    card_last4: parsed.cardLast4 ?? null,
    card_type: parsed.cardType ?? null,
    destination_last4: parsed.destinationLast4 ?? null,
    destination_bank: parsed.destinationBank?.slice(0, 40) ?? null,
    own_account: parsed.ownAccount ?? null,
    suggested_category: parsed.suggestedCategory,
    recurring: parsed.recurring,
    fingerprint: opKey ? await sha256Hex(opKey) : null,
  });
  return !error;
}

// Reads the new bank emails of one connection. Returns how many suggestions were added.
async function syncConnection(admin: SupabaseClient, conn: Row): Promise<number> {
  const started = new Date();
  const userId = String(conn.user_id);
  const lastSync = conn.last_sync_at ? Date.parse(String(conn.last_sync_at)) : 0;
  // One hour of overlap: Gmail's `after:` is not exact; seen hashes avoid repeats.
  const after = lastSync
    ? lastSync - 3600_000
    : started.getTime() - FIRST_LOOKBACK_DAYS * 86400_000;

  let access: string;
  try {
    access = await accessToken(admin, conn);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'token-failed';
    // invalid_grant: the user revoked the access or the token expired.
    const revoked = reason.includes('invalid_grant');
    await admin
      .from('mail_connections')
      .update({
        ...(revoked ? { status: 'revoked', refresh_token_enc: null, access_token_enc: null } : {}),
        last_error: revoked ? 'revoked' : reason.slice(0, 40),
        updated_at: started.toISOString(),
      })
      .eq('id', conn.id);
    log(`sync ${revoked ? 'revoked' : 'token-error'}`);
    return 0;
  }

  let found = 0;
  try {
    const q = encodeURIComponent(gmailBankQuery(after / 1000));
    const list = await gmail(access, `/messages?q=${q}&maxResults=${MAX_MESSAGES_PER_SYNC}`);
    const ids = ((list.messages as { id: string }[] | undefined) ?? []).map((m) => m.id);
    for (const id of ids.reverse()) {
      const hash = await sha256Hex(`gmail:${id}`);
      const { error: seenErr } = await admin
        .from('mail_seen_messages')
        .insert({ connection_id: conn.id, message_hash: hash });
      if (seenErr) continue; // already read
      let msg: Row;
      try {
        msg = await gmail(access, `/messages/${id}?format=full`);
      } catch (e) {
        // Not read after all: try again on the next sync.
        await admin
          .from('mail_seen_messages')
          .delete()
          .eq('connection_id', conn.id)
          .eq('message_hash', hash);
        throw e;
      }
      const payload = (msg.payload ?? {}) as Parameters<typeof gmailBodies>[0];
      const { text, html } = gmailBodies(payload);
      const added = await suggest(admin, userId, {
        from: gmailHeader(payload, 'From'),
        subject: gmailHeader(payload, 'Subject'),
        text,
        html,
        sentAt: Number(msg.internalDate) || started.getTime(),
      });
      if (added) found++;
    }
    await admin
      .from('mail_connections')
      .update({
        last_sync_at: started.toISOString(),
        ...(found ? { last_found_at: started.toISOString() } : {}),
        last_error: null,
        updated_at: started.toISOString(),
      })
      .eq('id', conn.id);
    log(`sync ok ${found}`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'sync-failed';
    await admin
      .from('mail_connections')
      .update({ last_error: reason.slice(0, 40), updated_at: started.toISOString() })
      .eq('id', conn.id);
    log(`sync ${reason}`);
  }
  return found;
}

async function cron(admin: SupabaseClient): Promise<Response> {
  const deadline = Date.now() + 45_000;
  const { data } = await admin
    .from('mail_connections')
    .select('*')
    .eq('status', 'active')
    .or(`last_sync_at.is.null,last_sync_at.lt.${new Date(Date.now() - 4 * 60_000).toISOString()}`)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(60);
  let synced = 0;
  for (const conn of (data ?? []) as Row[]) {
    if (Date.now() > deadline) break;
    // Without paid PLUS the mailbox is not read (the connection stays, to resume later).
    if (!(await paidPlus(admin, String(conn.user_id)))) {
      await admin
        .from('mail_connections')
        .update({ last_sync_at: new Date().toISOString(), last_error: 'plus-required' })
        .eq('id', conn.id);
      continue;
    }
    await syncConnection(admin, conn);
    synced++;
  }
  // Seen hashes are only needed while the overlap window can return the message again.
  await admin
    .from('mail_seen_messages')
    .delete()
    .lt('seen_at', new Date(Date.now() - 30 * 86400_000).toISOString());
  await admin
    .from('mail_oauth_states')
    .delete()
    .lt('created_at', new Date(Date.now() - STATE_TTL_MS).toISOString());
  log(`cron ${synced}`);
  return json({ synced });
}

async function ownConnection(admin: SupabaseClient, userId: string): Promise<Row | null> {
  const { data } = await admin
    .from('mail_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  return (data as Row | null) ?? null;
}

function publicConnection(conn: Row | null) {
  if (!conn || conn.status === 'disconnected') return null;
  return {
    provider: conn.provider,
    emailHint: conn.email_hint,
    status: conn.status,
    lastSyncAt: conn.last_sync_at,
    lastFoundAt: conn.last_found_at,
    lastError: conn.last_error,
  };
}

async function disconnect(admin: SupabaseClient, userId: string): Promise<Response> {
  const conn = await ownConnection(admin, userId);
  if (!conn) return json({ ok: true });
  if (conn.refresh_token_enc) {
    try {
      const refresh = await decrypt(String(conn.refresh_token_enc));
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
        method: 'POST',
      });
    } catch {
      // The token is forgotten anyway; the user can also revoke it in their Google account.
    }
  }
  await admin
    .from('mail_connections')
    .update({
      status: 'disconnected',
      refresh_token_enc: null,
      access_token_enc: null,
      access_expires_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);
  await admin.from('mail_seen_messages').delete().eq('connection_id', conn.id);
  log('disconnected');
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'missing-configuration' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/google')) {
    return callback(req, admin);
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const cronSecret = Deno.env.get('MAIL_CRON_SECRET');
  if (cronSecret && safeEqual(bearer, cronSecret)) {
    if (!googleConfigured()) return json({ synced: 0 });
    return cron(admin);
  }

  const { data: auth } = await admin.auth.getUser(bearer);
  if (!auth?.user) return json({ error: 'unauthorized' }, 401);
  const user = auth.user as unknown as Row;
  const userId = String(user.id);
  const body = (await req.json().catch(() => ({}))) as Row;

  try {
    if (body.action === 'status') {
      return json({
        configured: googleConfigured(),
        plus: await paidPlus(admin, userId),
        connection: publicConnection(await ownConnection(admin, userId)),
      });
    }
    if (body.action === 'connect') return await connect(req, admin, user);
    if (body.action === 'disconnect') return await disconnect(admin, userId);
    if (body.action === 'sync') {
      const conn = await ownConnection(admin, userId);
      if (!conn || conn.status !== 'active') return json({ error: 'not-connected' }, 409);
      if (!(await paidPlus(admin, userId))) return json({ error: 'plus-required' }, 402);
      // At most once a minute per user.
      const last = conn.last_sync_at ? Date.parse(String(conn.last_sync_at)) : 0;
      if (Date.now() - last < 60_000) return json({ found: 0, throttled: true });
      const found = await syncConnection(admin, conn);
      return json({ found, connection: publicConnection(await ownConnection(admin, userId)) });
    }
    return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    log(`error ${e instanceof Error ? e.message : 'unknown'}`);
    return json({ error: 'unknown' }, 500);
  }
});
