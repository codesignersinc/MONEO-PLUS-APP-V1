// MONEO AUTO interpreter: turns a bank email / notification / pasted text into a
// suggested movement. Pure functions, no I/O: callers decide what to store (only the
// ParsedMovement, never the original text).

import type { BankId, BankMessage, ParsedMovement } from './types';
import type { BankParser } from './banks/common';
import { parseBcp } from './banks/bcp';
import { parseBbva } from './banks/bbva';
import { parseInterbank } from './banks/interbank';
import { parseYape } from './banks/yape';
import { sameMerchant } from './merchant';
import { parseFreeText } from './freeText';

export type { BankMessage, ParsedMovement } from './types';

// Email domains each bank sends from. Emails from anywhere else are ignored, so a
// phishing email imitating a bank cannot create suggestions.
export const TRUSTED_EMAIL_DOMAINS: Record<string, BankId> = {
  'notificacionesbcp.com.pe': 'bcp',
  'bcp.com.pe': 'bcp',
  'bbva.com.pe': 'bbva',
  'netinterbank.com.pe': 'interbank',
  'interbank.pe': 'interbank',
  'yape.pe': 'yape',
};

const PARSERS: Record<BankId, BankParser[]> = {
  bcp: [parseBcp, parseYape], // Yape emails are sent through BCP infrastructure
  bbva: [parseBbva],
  interbank: [parseInterbank],
  yape: [parseYape],
  plin: [parseInterbank],
  scotiabank: [],
  otro: [],
};

export function bankForEmail(sender: string | undefined): BankId | null {
  const domain = sender?.match(/@([a-z0-9.-]+)>?\s*$/i)?.[1]?.toLowerCase();
  if (!domain) return null;
  for (const [d, bank] of Object.entries(TRUSTED_EMAIL_DOMAINS)) {
    if (domain === d || domain.endsWith(`.${d}`)) return bank;
  }
  return null;
}

// Notification app name / package → bank.
export function bankForApp(sender: string | undefined): BankId | null {
  const s = (sender ?? '').toLowerCase();
  if (/yape/.test(s)) return 'yape';
  if (/interbank/.test(s)) return 'interbank';
  if (/bcp|viabcp|com\.bcp/.test(s)) return 'bcp';
  if (/bbva/.test(s)) return 'bbva';
  if (/plin/.test(s)) return 'plin';
  return null;
}

export function parseBankMessage(msg: BankMessage): ParsedMovement | null {
  if (!msg.text?.trim()) return null;
  let candidates: BankParser[];
  if (msg.source === 'email') {
    const bank = bankForEmail(msg.sender);
    if (!bank) return null;
    candidates = PARSERS[bank];
  } else {
    const bank = bankForApp(msg.sender);
    // Pasted text / SMS without a known sender: try every parser.
    candidates = bank ? PARSERS[bank] : [parseInterbank, parseBcp, parseBbva, parseYape];
  }
  for (const parse of candidates) {
    const result = parse(msg);
    if (result) return result;
  }
  // Text the user typed or dictated: "gasté 25 en taxi", "almuerzo 18 bcp".
  return msg.source === 'text' ? parseFreeText(msg.text, msg.receivedAt) : null;
}

// Stable key for exact duplicates (same bank operation number).
export function operationKey(m: ParsedMovement): string | null {
  return m.operationId ? `${m.bank}:${m.operationId}` : null;
}

function minutes(m: ParsedMovement): number | null {
  if (!m.time) return null;
  const [h, mi] = m.time.split(':').map(Number);
  return new Date(`${m.date}T00:00:00`).getTime() / 60000 + h * 60 + mi;
}

// Same purchase reported twice (two notification formats, or notification + email):
// same direction, currency and amount, within `windowMinutes`, and the same merchant
// written a different way.
export function isLikelyDuplicate(
  a: ParsedMovement,
  b: ParsedMovement,
  windowMinutes = 15
): boolean {
  const ka = operationKey(a);
  const kb = operationKey(b);
  if (ka && kb) return ka === kb;
  if (a.type !== b.type || a.currency !== b.currency || a.amount !== b.amount) return false;
  const ma = minutes(a);
  const mb = minutes(b);
  if (ma !== null && mb !== null) {
    if (Math.abs(ma - mb) > windowMinutes) return false;
  } else if (a.date !== b.date) {
    return false;
  }
  return sameMerchant(a.merchant, b.merchant);
}
