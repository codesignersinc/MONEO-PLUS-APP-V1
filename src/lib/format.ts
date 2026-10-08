// The single formatting layer for amounts and month names (docs/global-core.md, step 2).
// Every screen formats money and months through here, so a new country or language only
// changes src/lib/locale.ts (and later the user's settings), never the screens.

import { CURRENCIES } from '@/lib/currency';
import { APP_LOCALE, LOCAL_CURRENCY, currencyDecimals, formatNumber } from '@/lib/locale';

export { APP_LOCALE, LOCAL_CURRENCY };

/** Symbol of a currency (S/, $, €…); the ISO code for a currency the app does not list. */
export function currencySymbol(code: string = LOCAL_CURRENCY): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export interface MoneyOptions {
  /** Always show + or − (movements); otherwise only − for negatives. */
  sign?: boolean;
  /** false = no decimals (large totals in charts). */
  decimals?: boolean;
  /** Space between symbol and number (default true: "S/ 12.50"). */
  space?: boolean;
}

/** "S/ 1,234.50", "- S/ 12.00", "+ $ 3.20". Currency defaults to the local currency. */
export function formatMoney(
  amount: number,
  currency: string = LOCAL_CURRENCY,
  opts: MoneyOptions = {}
): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const decimals = opts.decimals === false ? 0 : currencyDecimals(currency);
  const sign = opts.sign ? (n < 0 ? '- ' : '+ ') : n < 0 ? '- ' : '';
  const space = opts.space === false ? '' : ' ';
  return `${sign}${currencySymbol(currency)}${space}${formatNumber(Math.abs(n), decimals)}`;
}

// Spanish month names (neutral Spanish: "septiembre", "sep"). Other languages use Intl.
const ES_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const ES_SHORT = ES_LONG.map((m) => m.slice(0, 3));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The 12 month names: long ("enero") or short ("ene"), optionally capitalized. */
export function monthNames(
  style: 'long' | 'short' = 'long',
  opts: { capitalize?: boolean; locale?: string } = {}
): string[] {
  const locale = opts.locale ?? APP_LOCALE;
  let names: string[];
  if (locale.startsWith('es')) {
    names = style === 'long' ? ES_LONG : ES_SHORT;
  } else {
    const f = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' });
    names = Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 15))));
  }
  return opts.capitalize ? names.map(cap) : [...names];
}
