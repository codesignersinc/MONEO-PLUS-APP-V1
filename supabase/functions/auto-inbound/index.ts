// Edge Function: receives bank emails forwarded to u-<token>@auto.moneo.plus (Postmark
// inbound webhook) and turns them into MONEO AUTO suggestions.
//
// - Authenticated with HTTP Basic credentials in the webhook URL
//   (https://postmark:<AUTO_INBOUND_SECRET>@<project>.supabase.co/functions/v1/auto-inbound).
// - The recipient token (or Postmark's MailboxHash "u-<token>") identifies the user;
//   unknown tokens are ignored.
// - Only bank senders are accepted (same allowlist as the web interpreter). Emails
//   forwarded by hand ("---------- Forwarded message ----------") use the original sender.
// - Gmail's forwarding confirmation code is stored so the app can show it once.
// - The email itself is never stored: only the interpreted fields of the suggestion.
//   Logs carry outcomes only (no ids, addresses, amounts, merchants or content).
// - Always answers 200 for well-authenticated requests so Postmark does not retry
//   emails that are simply not bank notices.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { bankForEmail, isLikelyDuplicate, operationKey, parseBankMessage } from './interpreter.js';

const ADDRESS_RE = /\bu-([a-z0-9]{12})@auto\.moneo\.plus\b/i;

function done(outcome: string, status = 200): Response {
  console.log(`auto-inbound: ${outcome}`);
  return new Response(JSON.stringify({ ok: status === 200, outcome }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, ' ');
}

// A hand-forwarded email: the bank sender and the original body are inside the text.
function unwrapForward(text: string): { sender: string; body: string } | null {
  const m = text.match(
    /-{3,}\s*(?:Forwarded message|Mensaje reenviado)\s*-{3,}([\s\S]*?)\n\s*\n([\s\S]*)$/i
  );
  if (!m) return null;
  const from = m[1].match(/^(?:From|De):\s*(.+)$/im)?.[1] ?? '';
  const email = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  return email ? { sender: email, body: m[2] } : null;
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
    // The fingerprint stands in for the operation id when comparing.
    operationId: undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return done('method-not-allowed', 405);

  const secret = Deno.env.get('AUTO_INBOUND_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey) return done('missing-configuration', 500);
  const expected = `Basic ${btoa(`postmark:${secret}`)}`;
  if (!safeEqual(req.headers.get('Authorization') ?? '', expected)) return done('unauthorized', 401);

  let body: Row;
  try {
    body = await req.json();
  } catch {
    return done('invalid-json');
  }

  const recipients = [
    body.OriginalRecipient,
    body.To,
    ...((body.ToFull as Row[] | undefined) ?? []).map((t) => t.Email),
  ]
    .filter(Boolean)
    .join(' ');
  // Also accepted through Postmark's own address with "+": <hash>+u-<token>@inbound.postmarkapp.com
  // (MailboxHash), useful before the auto.moneo.plus MX record exists.
  const token = (
    recipients.match(ADDRESS_RE)?.[1] ?? String(body.MailboxHash ?? '').match(/^u-([a-z0-9]{12})$/i)?.[1]
  )?.toLowerCase();
  if (!token) return done('no-recipient');

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: address } = await admin
    .from('auto_addresses')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();
  if (!address) return done('unknown-address');
  const userId = address.user_id as string;
  const now = new Date();
  await admin.from('auto_addresses').update({ last_received_at: now.toISOString() }).eq('user_id', userId);

  const from = String((body.FromFull as Row | undefined)?.Email ?? body.From ?? '');
  const subject = String(body.Subject ?? '');
  let text = String(body.TextBody || '') || htmlToText(String(body.HtmlBody ?? ''));

  // Gmail forwarding confirmation: keep only the numeric code.
  if (/forwarding-noreply@google\.com/i.test(from)) {
    const code = `${subject}\n${text}`.match(/\b(\d{6,12})\b/)?.[1];
    if (code) {
      await admin
        .from('auto_addresses')
        .update({ gmail_code: code, gmail_code_at: now.toISOString() })
        .eq('user_id', userId);
    }
    return done(code ? 'gmail-code' : 'gmail-no-code');
  }

  let sender = from;
  if (!bankForEmail(sender)) {
    const fwd = unwrapForward(text);
    if (!fwd || !bankForEmail(fwd.sender)) return done('sender-not-allowed');
    sender = fwd.sender;
    text = fwd.body;
  }

  // Interpret in Lima time (the bundle reads local date/time; Deno runs in UTC).
  const sentAt = Date.parse(String(body.Date ?? '')) || now.getTime();
  const receivedAt = new Date(sentAt - 5 * 3600 * 1000);
  const parsed = parseBankMessage({ source: 'email', sender, subject, text, receivedAt });
  if (!parsed) return done('not-recognized');

  const { data: near } = await admin
    .from('auto_suggestions')
    .select('bank,kind,movement_type,amount,currency,merchant,occurred_date,occurred_time')
    .eq('user_id', userId)
    .gte('occurred_date', shiftDate(parsed.date, -1))
    .lte('occurred_date', shiftDate(parsed.date, 1))
    .neq('status', 'ignorada');
  if ((near ?? []).some((r: Row) => isLikelyDuplicate(rowToParsed(r) as never, { ...parsed, operationId: undefined }))) {
    return done('duplicate');
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
  if (error) return done(error.code === '23505' ? 'duplicate' : 'insert-failed');
  return done('suggested');
});
