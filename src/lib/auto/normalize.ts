// Text, amount and date helpers for bank messages (pure functions).

const MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  jan: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  set: 9,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
};

// Collapses whitespace (including non-breaking spaces) and trims each line.
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f\t]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/ {2,}/g, ' ').trim())
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();
}

// Gmail's plain-text version of a forwarded email marks bold text with asterisks
// ("consumo de *S/ 2.99* con tu *Tarjeta*"). Removes those markers but keeps card masks
// ("****1997") and merchant separators ("IZI*YOPO", "BENVID*0056604").
export function stripBoldMarkers(text: string): string {
  return text.replace(/(^|\s)\*(?=[^\s*])/g, '$1').replace(/(?<=[^\s*])\*(?=\s|[.,;:)]|$)/gm, '');
}

// Single-line version, for regexes that may span what were separate lines.
export function flatten(text: string): string {
  return normalizeText(text).replace(/\n+/g, ' ');
}

const AMOUNT_RE =
  /(US\$|\$|S\/\.?)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/;

// "S/.19.90", "S/ 13.3", "S/. 103.71", "S/ 1,250.00", "US$ 10.00" → amount + currency.
export function parseAmount(text: string): { amount: number; currency: 'PEN' | 'USD' } | null {
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const amount = Math.round(parseFloat(m[2].replace(/,/g, '')) * 100) / 100;
  if (!isFinite(amount) || amount <= 0) return null;
  return { amount, currency: m[1].startsWith('S/') ? 'PEN' : 'USD' };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "05:56 PM", "10:01 p. m.", "06:56 pm", "05:41", "05:20:55" → "HH:MM".
export function parseTime(text: string): string | null {
  const m = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3]?.toLowerCase().replace(/[\s.]/g, '');
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

function validDate(y: number, mo: number, d: number): string | null {
  if (!y || !mo || !d || mo > 12 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

// Dates as banks write them. Without a year (e.g. "04/10"), the year of `ref` is used,
// or the previous one if that would put the date in the future.
//   05/10/2026 · 01 de octubre de 2026 · 04 octubre, 2026 · 27 Jun. 2025 · 24 agosto 2026 · 04/10
export function parseDate(text: string, ref: Date): string | null {
  let m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  m = text.match(/\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3,10})\.?,?\s+(?:de\s+|del\s+)?(\d{4})\b/i);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return validDate(+m[3], mo, +m[1]);
  }
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    let year = ref.getFullYear();
    const candidate = new Date(year, +m[2] - 1, +m[1]);
    if (candidate.getTime() - ref.getTime() > 24 * 3600 * 1000) year -= 1;
    return validDate(year, +m[2], +m[1]);
  }
  return null;
}

// Value written after a label, on the same line ("Comercio: X") or on the next one
// ("Empresa\tX" / "Cuenta de destino\n• 3520").
export function valueAfter(text: string, label: RegExp): string | null {
  const lines = normalizeText(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`^${label.source}\\s*:?\\s*(.*)$`, 'i'));
    if (!m) continue;
    const sameLine = m[m.length - 1].trim();
    if (sameLine) return sameLine;
    const next = lines.slice(i + 1).find((l) => l.trim() !== '');
    return next?.trim() ?? null;
  }
  return null;
}

export function last4(text: string | null | undefined): string | undefined {
  const m = text?.match(/(\d{4})\s*$/);
  return m ? m[1] : undefined;
}
