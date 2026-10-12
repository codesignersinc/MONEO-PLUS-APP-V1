// Edge Function: MONEO AUTO on Android. The MONEO+ app reads the notifications of Yape, BCP,
// Interbank and BBVA on the phone and posts them here; they become MONEO AUTO suggestions.
//
// - Authenticated with the phone's MONEO Companion token that has the MONEO AUTO permission
//   (companion_devices.can_auto, created on /finanzas/auto/celular). The widget's token is
//   not enough. Unknown or revoked tokens get 401 and the phone turns the feature off.
// - Only the four bank apps are accepted, by package name.
// - The notification text is never stored nor logged: only the interpreted fields of the
//   suggestion. Logs carry outcomes only (no ids, amounts, merchants or content).
// - Answers the detected movement (type, amount, currency, merchant) so the phone can show
//   "Gasto detectado · S/ 18.00"; the phone already had that text.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isLikelyDuplicate, operationKey, parseBankMessage } from './interpreter.js';

// Package → the app name the interpreter expects as sender.
const APPS: Record<string, string> = {
  'com.bcp.innovacxion.yapeapp': 'Yape',
  'com.bcp.bank.bcp': 'BCP',
  'pe.com.interbank.mobilebanking': 'Interbank',
  'com.bbva.nxt_peru': 'BBVA',
};

// Notifications per phone owner and hour; above it the phone is ignored for a while.
const HOURLY_LIMIT = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

function done(outcome: string, status = 200, extra: Record<string, unknown> = {}): Response {
  console.log(`auto-notify: ${outcome}`);
  return new Response(JSON.stringify({ ok: status === 200, outcome, ...extra }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Row = Record<string, unknown>;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return done('method-not-allowed', 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return done('missing-configuration', 500);

  let body: Row;
  try {
    body = await req.json();
  } catch {
    return done('invalid-json', 400);
  }
  const token = String(body.token ?? '');
  const app = APPS[String(body.app ?? '')];
  const title = String(body.title ?? '').slice(0, 300);
  const text = String(body.text ?? '').slice(0, 2000);
  if (!/^[0-9a-f]{64}$/.test(token)) return done('unauthorized', 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userId, error: authError } = await admin.rpc('companion_auto_user', {
    p_token: token,
  });
  if (authError) return done('auth-failed', 500);
  if (!userId) return done('unauthorized', 401);
  if (!app) return done('app-not-allowed');
  if (!text.trim() && !title.trim()) return done('empty');

  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await admin
    .from('auto_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'notification')
    .gte('created_at', since);
  if ((count ?? 0) >= HOURLY_LIMIT) return done('rate-limited', 429);

  // Interpret in Lima time (the bundle reads local date/time; Deno runs in UTC).
  const postedAt = Number(body.postedAt);
  const now = Date.now();
  const at = Number.isFinite(postedAt) && Math.abs(now - postedAt) < 7 * 86400 * 1000 ? postedAt : now;
  const receivedAt = new Date(at - 5 * 3600 * 1000);
  const parsed = parseBankMessage({
    source: 'notification',
    sender: app,
    text: title ? `${title}\n${text}` : text,
    receivedAt,
  });
  if (!parsed) return done('not-recognized');

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
    return done('duplicate');
  }

  const opKey = operationKey(parsed);
  const { error } = await admin.from('auto_suggestions').insert({
    user_id: userId,
    source: 'notification',
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
  if (error) return done(error.code === '23505' ? 'duplicate' : 'insert-failed');
  return done('suggested', 200, {
    movement: {
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant.slice(0, 60),
    },
  });
});
