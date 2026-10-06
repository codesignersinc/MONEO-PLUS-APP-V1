import type { BankMessage, ParsedMovement } from '../types';
import { localDate, localTime, parseDate, parseTime } from '../normalize';
import { cleanMerchant, suggestCategory } from '../merchant';

export type BankParser = (msg: BankMessage) => ParsedMovement | null;

const AMT = String.raw`(?:US\$|\$|S\/\.?)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?`;
export const AMOUNT_SRC = AMT;

// Date/time from the text, falling back to when the message arrived.
export function when(msg: BankMessage, dateText?: string | null, timeText?: string | null) {
  const date = (dateText && parseDate(dateText, msg.receivedAt)) || localDate(msg.receivedAt);
  const time =
    (timeText && parseTime(timeText)) ||
    (dateText && parseTime(dateText)) ||
    (dateText ? null : localTime(msg.receivedAt));
  return { date, time };
}

export function merchantFields(raw: string) {
  const merchant = cleanMerchant(raw);
  return { merchant, suggestedCategory: suggestCategory(merchant, raw) };
}

// Person names in Yape/Plin are sometimes cut with "*" ("Violeta Rey*").
export function personName(raw: string): string {
  return raw
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñ])/g, (_, s, c) => s + c.toUpperCase());
}
