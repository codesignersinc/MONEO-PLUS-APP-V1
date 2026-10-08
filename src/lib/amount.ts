// Typed amounts: "1,250" is one thousand two hundred fifty (thousands comma), "12,50" and
// "12.50" are twelve and a half. Used by the amount calculator and other free-text amount
// fields. The decimal separator for now is the dot (Peru); with country packs it will come
// from the user's locale.

/** One number written by a person → a plain "1250.5" string (no thousands separators). */
export function normalizeNumberToken(token: string): string {
  const t = token.trim();
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  if (hasComma && hasDot) {
    // The last separator is the decimal one: "1,250.50" or "1.250,50".
    const dec = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    const thousands = dec === ',' ? '.' : ',';
    return t.split(thousands).join('').replace(dec, '.');
  }
  if (hasComma) {
    // "1,250" / "12,500,000" → thousands; "12,5" / "12,50" → decimal.
    if (/^\d{1,3}(,\d{3})+$/.test(t)) return t.replace(/,/g, '');
    const last = t.lastIndexOf(',');
    return t.slice(0, last).replace(/,/g, '') + '.' + t.slice(last + 1);
  }
  if (hasDot && /^\d{1,3}(\.\d{3}){2,}$/.test(t)) {
    // "1.250.000" can only be thousands.
    return t.replace(/\./g, '');
  }
  return t;
}

/** An amount expression ("1,250+12,50") with every number normalized and no spaces. */
export function normalizeAmountExpression(expr: string): string {
  return expr.replace(/\s+/g, '').replace(/[\d.,]+/g, (n) => normalizeNumberToken(n));
}

/** A single typed amount → number (NaN when it is not a number). */
export function parseAmountInput(text: string): number {
  const s = normalizeAmountExpression(text);
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}
