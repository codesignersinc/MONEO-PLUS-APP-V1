// Receipts / tickets read with OCR (photo of a paper receipt or a screenshot): the
// TOTAL, the merchant (first line with a name) and the date. Pure function; the user
// always reviews the suggestion before registering it.

import type { ParsedMovement } from './types';
import { localDate, localTime, parseDate } from './normalize';
import { cleanMerchant, suggestCategory } from './merchant';
import { conceptCategory } from './freeText';

const NUM = /(\d{1,3}(?:[ ,.]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/g;

function toAmount(raw: string): number {
  // "1,250.00" / "1.250,00" / "1 250.00" / "92.92" / "92,92"
  const cleaned = raw.replace(/\s/g, '');
  const lastSep = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  const int = cleaned.slice(0, lastSep).replace(/[.,]/g, '');
  return Math.round(parseFloat(`${int}.${cleaned.slice(lastSep + 1)}`) * 100) / 100;
}

// Lines that are not the merchant name.
const NOT_NAME =
  /\b(ruc|r\.u\.c|boleta|factura|ticket|electr[oó]nica|venta|nota|fecha|hora|cajero|caja|direcci[oó]n|av\.?|jr\.?|calle|tel[eé]fono|telf|www\.|http|cliente|dni|serie)\b/i;

export function parseReceipt(text: string, receivedAt: Date): ParsedMovement | null {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  // Last "TOTAL" line with an amount (skips SUBTOTAL, TOTAL DESCUENTO, TOTAL ITEMS…).
  let total: number | null = null;
  for (const line of lines) {
    if (!/\b(importe\s+)?total\b/i.test(line)) continue;
    if (
      /sub\s*-?\s*total|descuento|items?|art[ií]culos|gravad|exonerad|inafect|igv|ahorro/i.test(
        line
      )
    )
      continue;
    const nums = line.match(NUM);
    if (nums?.length) total = toAmount(nums[nums.length - 1]);
  }
  if (!total || total <= 0 || total > 1_000_000) return null;

  const currency: 'PEN' | 'USD' =
    /\b(us\$|usd|d[oó]lares)\b|\$\s*\d/i.test(text) && !/s\/\.?/i.test(text) ? 'USD' : 'PEN';

  const nameLine = lines
    .slice(0, 6)
    .find((l) => /[a-záéíóúñ]{3,}/i.test(l) && !NOT_NAME.test(l) && !/\d{6,}/.test(l));
  const merchant = nameLine ? cleanMerchant(nameLine).slice(0, 120) : 'Compra';

  const dateLine = text.replace(/(\d{1,2})-(\d{1,2})-(\d{4})/g, '$1/$2/$3');
  const date = parseDate(dateLine.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)?.[0] ?? '', receivedAt);

  return {
    bank: 'otro',
    kind: 'texto',
    type: 'gasto',
    amount: total,
    currency,
    merchant,
    date: date ?? localDate(receivedAt),
    time: date ? null : localTime(receivedAt),
    suggestedCategory: suggestCategory(merchant, text) ?? conceptCategory(text),
    recurring: false,
  };
}

// Typical OCR slips on Peruvian amounts: "5/" or "$/" read for "S/", spaces inside.
export function cleanOcrText(text: string): string {
  return (
    text
      .replace(/\r/g, '')
      .replace(/(^|[\s(])[5$§]\s?\/\s?\.?\s*(?=\d)/gm, '$1S/ ')
      // "sI 50" / "S| 50": the slash read as a letter.
      .replace(/(^|[\s(])[sS5§][|Il]\s?\.?\s*(?=\d)/gm, '$1S/ ')
      .replace(/\bS\s*\/\s*\.?\s*(?=\d)/g, 'S/ ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
