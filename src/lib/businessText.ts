import { normalizeNumberToken } from '@/lib/amount';

// MONEO NEGOCIO, fase 3: understands short phrases about the business ("Vega me pagó 5,000",
// "Pagué 850 a Makro", "Vendí 120 hoy") with plain rules — no AI, nothing leaves the device.
// The result is only a proposal: the person confirms it before anything is saved.

export interface BusinessIntent {
  kind: 'ingreso' | 'gasto';
  amount: number;
  /** Customer (income) or supplier (expense) named in the phrase. */
  party: string | null;
  /** What it was for, when said ("por el diseño", "en insumos"). */
  concept: string | null;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Income verbs: someone paid me, I collected, I sold, I received.
const INCOME =
  /\b(me pago|me pagaron|pago|pagaron|cobre|vendi|recibi|me deposito|deposito|me transfirio|me yapeo|me plineo|ingreso)\b/;
// Expense verbs: I paid, spent, bought.
const EXPENSE = /\b(pague|gaste|compre|invert[i]|abone)\b/;

const AMOUNT =
  /(?:s\/\.?\s*|\$\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s*mil\b|\s*k\b)?/;

const FILLER =
  /\b(hoy|ayer|soles?|sol|nuevos|dolares?|s\/\.?|el|la|los|las|al|del|de|proveedor|cliente|senor|senora|sr|sra|por|en|a|y|me|le)\b/g;

function cleanName(raw: string): string | null {
  const words = fold(raw)
    .replace(AMOUNT, ' ')
    .replace(/[^a-z0-9ñ& .'-]/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words || words.length < 2) return null;
  // Keep the original spelling (accents, capitals) of those words when possible.
  const original = raw
    .replace(AMOUNT, ' ')
    .replace(/[^\p{L}\p{N}& .'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && words.split(' ').includes(fold(w)));
  const name = (original.length ? original.join(' ') : words).slice(0, 40).trim();
  return name.replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase());
}

function amountOf(text: string): number | null {
  const m = text.match(AMOUNT);
  if (!m) return null;
  const n = Number(normalizeNumberToken(m[1]));
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2] ? n * 1000 : n;
}

/** "Vega me pagó 5,000" → { ingreso, 5000, "Vega" }. Null when it is not understood. */
export function parseBusinessText(text: string): BusinessIntent | null {
  const raw = text.trim();
  if (!raw) return null;
  const f = fold(raw);
  const amount = amountOf(f);
  if (amount === null) return null;

  const expense = EXPENSE.exec(f);
  const income = expense ? null : INCOME.exec(f);
  if (!expense && !income) return null;
  const kind: BusinessIntent['kind'] = expense ? 'gasto' : 'ingreso';
  const verb = (expense ?? income)!;

  // Concept: "por <x>" or, for spending, "en <x>".
  const conceptMatch =
    f.match(/\bpor\s+(.+)$/) ?? (kind === 'gasto' ? f.match(/\ben\s+(.+)$/) : null);
  const concept = conceptMatch ? cleanName(raw.slice(raw.length - conceptMatch[1].length)) : null;

  let party: string | null = null;
  const before = raw.slice(0, verb.index).trim();
  const after = raw.slice(verb.index + verb[0].length);
  if (kind === 'ingreso' && before && /pag|deposit|transfir|yape|plin/.test(verb[0])) {
    // "<Vega> me pagó …"
    party = cleanName(before);
  } else {
    // "… a <Vega>", "… al proveedor <Makro>", "compré … en <Makro>"
    const fa = fold(after);
    const target =
      fa.match(/\b(?:a|al)\s+(?:proveedor\s+|cliente\s+)?(.+?)(?:\s+por\s+.*)?$/) ??
      (kind === 'gasto' && /compr/.test(verb[0])
        ? fa.match(/\ben\s+(.+?)(?:\s+por\s+.*)?$/)
        : null);
    if (target)
      party = cleanName(after.slice(after.length - target[0].length).replace(/^\s*(a|al)\s+/i, ''));
  }
  if (party && concept && fold(party) === fold(concept)) {
    // "Gasté 50 en insumos": a concept, not a supplier.
    if (/gast/.test(verb[0])) party = null;
  }
  return { kind, amount: Math.round(amount * 100) / 100, party, concept };
}

/** Same name, ignoring case and accents. */
export function sameName(a: string, b: string): boolean {
  return fold(a).trim() === fold(b).trim();
}

/** Peruvian receipt number (factura F001-3256, boleta B001-123), if the text has one. */
export function receiptNumber(text: string): string | null {
  const m = text.toUpperCase().match(/\b([FBE][A-Z0-9]{3})\s*[-–]\s*0*(\d{1,8})\b/);
  return m ? `${m[1]}-${m[2]}` : null;
}
