// Helpers for reading bank emails straight from the user's mailbox (Gmail API), shared
// with the mail-oauth Edge Function through the edge bundle. Pure functions, no I/O.

import { TRUSTED_EMAIL_DOMAINS } from './index';

// Gmail search that only matches the trusted bank senders, received after `afterSec`
// (Unix seconds). Gmail's `from:` matches the domain part of the sender address.
export function gmailBankQuery(afterSec: number): string {
  const domains = Object.keys(TRUSTED_EMAIL_DOMAINS).join(' OR ');
  return `from:(${domains}) after:${Math.floor(afterSec)} -in:chats`;
}

// "jorge.alberti@gmail.com" → "jo***i@gmail.com": enough for the user to recognize the
// connected mailbox without keeping the full address.
export function maskEmail(email: string): string {
  const [user, domain] = email.trim().toLowerCase().split('@');
  if (!user || !domain) return '***';
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export function htmlToText(html: string): string {
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

// Gmail API message payload (users.messages.get, format=full), only the parts we read.
export interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function gmailHeader(payload: GmailPart, name: string): string {
  const h = payload.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

// First text/plain and text/html bodies of the message (attachments are ignored).
export function gmailBodies(payload: GmailPart): { text: string; html: string } {
  let text = '';
  let html = '';
  const walk = (part: GmailPart, depth: number) => {
    if (depth > 8) return;
    const data = part.body?.data;
    if (data && part.mimeType === 'text/plain' && !text) text = decodeBase64Url(data);
    if (data && part.mimeType === 'text/html' && !html) html = decodeBase64Url(data);
    for (const p of part.parts ?? []) walk(p, depth + 1);
  };
  walk(payload, 0);
  return { text, html };
}
