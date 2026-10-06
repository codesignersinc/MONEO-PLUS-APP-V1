// Quick typed entries: "gasté 25 en taxi", "almuerzo 18 bcp", "me pagaron 1500 de sueldo",
// "Wong 92.50 ayer", "$10 netflix". Pure function; used only for text the user types
// (or dictates), after the bank-notice parsers did not match.

import type { BankId, ParsedMovement } from './types';
import { localDate, localTime, parseDate } from './normalize';
import { cleanMerchant, suggestCategory } from './merchant';

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const BANKS: [RegExp, BankId][] = [
  [/\bbcp\b/, 'bcp'],
  [/\bbbva\b/, 'bbva'],
  [/\binterbank\b|\bibk\b/, 'interbank'],
  [/\byape\b|\byapee\b|\byapeo\b|\byapearon\b|\byapee\b/, 'yape'],
  [/\bplin\b|\bplinee\b|\bplinearon\b/, 'plin'],
  [/\bscotiabank\b|\bscotia\b/, 'scotiabank'],
];

const INCOME =
  /\b(me pagaron|me pago|cobre|cobro|recibi|me depositaron|me yapearon|me plinearon|me transfirieron|sueldo|salario|quincena|ingreso|abono|vendi|venta|me devolvieron|reembolso|propina)\b/;

// Everyday words → category (labels of CATEGORY_PRESETS).
const CONCEPTS: [RegExp, string][] = [
  [
    /\b(taxi|uber|cabify|didi|indrive|combi|micro|bus|pasaje|metropolitano|gasolina|grifo|peaje|estacionamiento|cochera|tren)\b/,
    'Transporte',
  ],
  [
    /\b(almuerzo|cena|desayuno|lonche|menu|comida|pollo|chifa|cafe|pizza|hamburguesa|restaurante|delivery|rappi|pedidosya|snack|helado|ceviche)\b/,
    'Comida',
  ],
  [
    /\b(mercado|supermercado|bodega|abarrotes|compras|wong|tottus|plaza vea|metro|makro|tambo|oxxo)\b/,
    'Supermercado',
  ],
  [
    /\b(luz|agua|internet|celular|telefono|recarga|cable|gas|bitel|claro|movistar|entel)\b/,
    'Servicios',
  ],
  [/\b(farmacia|botica|medicina|medico|doctor|clinica|dentista|analisis|consulta)\b/, 'Salud'],
  [
    /\b(cine|netflix|spotify|disney|juego|concierto|entrada|fiesta|salida|bar|discoteca)\b/,
    'Entretenimiento',
  ],
  [/\b(alquiler|renta|departamento|condominio|mantenimiento|casa)\b/, 'Vivienda'],
  [/\b(colegio|universidad|curso|clase|libro|libros|pension|matricula|utiles)\b/, 'Educación'],
];

// Words that are not the concept ("gasté 25 soles en el taxi de ayer").
const FILLER = new Set(
  (
    'gaste gasto pague pago compre compra consumi consumo realice hice di dio puse me mi mis el la los las un una unos unas ' +
    'en de del por para con a al y o que hoy ayer anteayer soles sol s dolares dolar usd pen ' +
    'bcp bbva interbank ibk yape yapee yapeo plin scotiabank scotia tarjeta cuenta debito credito efectivo ' +
    'pagaron cobre cobro recibi depositaron yapearon plinearon transfirieron'
  ).split(' ')
);

// Amount: "S/25", "s/ 12.50", "25 soles", "$10", "10 dólares", or a plain number "18" / "12,50".
function findAmount(t: string): { amount: number; currency: 'PEN' | 'USD'; raw: string } | null {
  // Spoken decimals: "12 con 50" (soles) → 12.50.
  const spoken = t.match(/(?<![\d/:.,])(\d+)\s+con\s+(\d{1,2})\b/);
  if (spoken) {
    const amount = parseFloat(`${spoken[1]}.${spoken[2].padStart(2, '0')}`);
    const currency = /\b(dolares|dolar|usd)\b|\$/.test(t) ? 'USD' : 'PEN';
    if (amount > 0) return { amount, currency, raw: spoken[0] };
  }
  const patterns: [RegExp, 'PEN' | 'USD'][] = [
    [/(?:us\$|\$)\s*(\d+(?:[.,]\d{1,2})?)/, 'USD'],
    [/(\d+(?:[.,]\d{1,2})?)\s*(?:dolares|dolar|usd)\b/, 'USD'],
    [/s\/\.?\s*(\d+(?:[.,]\d{1,2})?)/, 'PEN'],
    [/(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|pen)\b/, 'PEN'],
    // plain number not part of a date (12/10) or a time (5:30)
    [/(?<![\d/:.,])(\d+(?:[.,]\d{1,2})?)(?![\d/:]|[.,]\d)/, 'PEN'],
  ];
  for (const [re, currency] of patterns) {
    const m = t.match(re);
    if (m) {
      const amount = Math.round(parseFloat(m[1].replace(',', '.')) * 100) / 100;
      if (amount > 0 && amount < 10_000_000) return { amount, currency, raw: m[0] };
    }
  }
  return null;
}

// Category for everyday words in a text ("taxi" → Transporte), or null.
export function conceptCategory(text: string): string | null {
  const t = strip(text);
  return CONCEPTS.find(([re]) => re.test(t))?.[1] ?? null;
}

export function parseFreeText(text: string, receivedAt: Date): ParsedMovement | null {
  const original = text.replace(/\s+/g, ' ').trim();
  if (!original || original.length > 160) return null;
  const t = strip(original);
  const amt = findAmount(t);
  if (!amt) return null;

  const type: ParsedMovement['type'] = INCOME.test(t) ? 'ingreso' : 'gasto';
  const bank = BANKS.find(([re]) => re.test(t))?.[1] ?? 'otro';

  // Date: "ayer", "anteayer" or an explicit dd/mm(/yyyy); otherwise now.
  let date = localDate(receivedAt);
  let time: string | null = localTime(receivedAt);
  const daysBack = /\banteayer\b/.test(t) ? 2 : /\bayer\b/.test(t) ? 1 : 0;
  if (daysBack) {
    const d = new Date(receivedAt);
    d.setDate(d.getDate() - daysBack);
    date = localDate(d);
    time = null;
  } else {
    const explicit = t.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/);
    const parsed = explicit ? parseDate(explicit[0], receivedAt) : null;
    if (parsed) {
      date = parsed;
      time = null;
    }
  }

  // Concept: the words left after removing the amount, dates and filler words, taken
  // from the original text to keep its accents.
  const words = original
    .replace(new RegExp(amt.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/g, ' ')
    .replace(/[$]|s\/\.?/gi, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w && !FILLER.has(strip(w)) && !/^\d+([.,]\d+)?$/.test(w));
  const concept = words.join(' ').trim();
  const merchant = concept ? cleanMerchant(concept) : type === 'ingreso' ? 'Ingreso' : 'Gasto';

  const category =
    type === 'ingreso'
      ? 'Ingreso'
      : (CONCEPTS.find(([re]) => re.test(t))?.[1] ?? suggestCategory(merchant, original));

  return {
    bank,
    kind: 'texto',
    type,
    amount: amt.amount,
    currency: amt.currency,
    merchant: merchant.slice(0, 120),
    date,
    time,
    suggestedCategory: category,
    recurring: false,
  };
}
