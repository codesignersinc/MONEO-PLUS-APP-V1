import type { TransactionCurrencyFields } from './financeStore';

// ─── Currency Constants & Types ───────────────────────────────────────────────

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  locale: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/', flag: '🇵🇪', locale: 'es-PE' },
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', flag: '🇺🇸', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', locale: 'de-DE' },
  { code: 'GBP', name: 'Libra esterlina', symbol: '£', flag: '🇬🇧', locale: 'en-GB' },
  { code: 'BRL', name: 'Real brasileño', symbol: 'R$', flag: '🇧🇷', locale: 'pt-BR' },
  { code: 'CLP', name: 'Peso chileno', symbol: '$', flag: '🇨🇱', locale: 'es-CL' },
  { code: 'COP', name: 'Peso colombiano', symbol: '$', flag: '🇨🇴', locale: 'es-CO' },
  { code: 'MXN', name: 'Peso mexicano', symbol: '$', flag: '🇲🇽', locale: 'es-MX' },
  { code: 'ARS', name: 'Peso argentino', symbol: '$', flag: '🇦🇷', locale: 'es-AR' },
];

export const DEFAULT_CURRENCY = 'PEN';

export function getCurrencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

// ─── Default exchange rates (reference only, not for production) ──────────────
// These are reference rates. In production, user sets manual rates.
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD_PEN: 3.73,
  EUR_PEN: 4.05,
  GBP_PEN: 4.72,
  BRL_PEN: 0.74,
  CLP_PEN: 0.0041,
  COP_PEN: 0.00093,
  MXN_PEN: 0.22,
  ARS_PEN: 0.0041,
  PEN_USD: 0.268,
  PEN_EUR: 0.247,
  PEN_GBP: 0.212,
  EUR_USD: 1.085,
  GBP_USD: 1.265,
};

export function getDefaultRate(from: string, to: string): number {
  return findRate({}, from, to) ?? 1;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currencyCode: string): string {
  const info = getCurrencyInfo(currencyCode);
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${info.symbol}${formatted}`;
}

export function formatCurrencyWithCode(amount: number, currencyCode: string): string {
  return `${formatCurrency(amount, currencyCode)} ${currencyCode}`;
}

export function formatEquivalent(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): string {
  if (fromCurrency === toCurrency) return '';
  const converted = amount * rate;
  return `≈ ${formatCurrency(converted, toCurrency)}`;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  return amount * rate;
}

// ─── User Settings ────────────────────────────────────────────────────────────

export interface UserCurrencySettings {
  baseCurrencyCode: string;
  exchangeRateMode: 'manual' | 'automatic';
  showEquivalents: boolean;
}

export const DEFAULT_USER_SETTINGS: UserCurrencySettings = {
  baseCurrencyCode: 'PEN',
  exchangeRateMode: 'manual',
  showEquivalents: true,
};

// ─── Exchange Rate Store (client-side cache) ──────────────────────────────────

export interface ExchangeRate {
  id?: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDate: string;
  source: string;
}

export function buildRateKey(from: string, to: string): string {
  return `${from}_${to}`;
}

// ─── Transaction currency fields ─────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Builds the multi-currency columns of a transaction. All amounts keep the sign of
// the movement (gasto negativo, ingreso positivo):
// - `amount` is in the account's currency (`currency`).
// - `original` is the amount in the currency the movement was priced in, when it
//   differs from the account's (e.g. a subscription priced in PEN paid from a USD
//   account). Defaults to `amount` in `currency`.
// - `rateToBase` converts the original currency into `baseCurrency`. It is stored as
//   the historical rate; it is never recomputed with today's rates.
// - `date` is the movement's day (YYYY-MM-DD).
export function buildCurrencyFields(params: {
  amount: number;
  currency: string;
  baseCurrency: string;
  rateToBase: number;
  date: string;
  original?: { amount: number; currency: string };
}): TransactionCurrencyFields {
  const originalAmount = params.original?.amount ?? params.amount;
  const originalCurrency = params.original?.currency ?? params.currency;
  const rate = originalCurrency === params.baseCurrency ? 1 : params.rateToBase;
  if (!(rate > 0)) throw new Error('Tipo de cambio inválido');
  return {
    currencyCode: originalCurrency,
    originalAmount: round2(originalAmount),
    baseCurrencyCode: params.baseCurrency,
    baseAmount: round2(originalAmount * rate),
    exchangeRate: rate,
    exchangeRateDate: params.date.slice(0, 10),
  };
}

// Amounts of a transfer between two accounts, rounded to cents. `toAmount` defaults to
// `fromAmount` converted with the user's rate (the user may override it with what the
// bank really credited); `baseAmount` is the value in the base currency.
export function buildTransferAmounts(params: {
  fromAmount: number;
  toAmount?: number;
  fromCurrency: string;
  toCurrency: string;
  baseCurrency: string;
  ratesMap: Record<string, number>;
}): { fromAmount: number; toAmount: number; baseAmount: number } {
  const { fromCurrency, toCurrency, baseCurrency, ratesMap } = params;
  const fromAmount = round2(params.fromAmount);
  const toAmount = round2(
    fromCurrency === toCurrency
      ? fromAmount
      : (params.toAmount ?? fromAmount * getRateFromMap(ratesMap, fromCurrency, toCurrency))
  );
  const baseAmount = round2(fromAmount * getRateFromMap(ratesMap, fromCurrency, baseCurrency));
  return { fromAmount, toAmount, baseAmount };
}

// Rate for a pair: the user's own rate (direct or reverse), else the app default.
function pairRate(ratesMap: Record<string, number>, from: string, to: string): number | null {
  if (from === to) return 1;
  const own = ratesMap[buildRateKey(from, to)];
  if (own) return own;
  const reverse = ratesMap[buildRateKey(to, from)];
  if (reverse) return 1 / reverse;
  const def = DEFAULT_EXCHANGE_RATES[`${from}_${to}`];
  if (def) return def;
  const defReverse = DEFAULT_EXCHANGE_RATES[`${to}_${from}`];
  if (defReverse) return 1 / defReverse;
  return null;
}

// Currencies used to bridge two currencies without a direct rate (e.g. COP → MXN via PEN).
const PIVOT_CURRENCIES = ['PEN', 'USD'];

/** Rate from → to, crossing through PEN or USD when needed; null when it cannot be known. */
export function findRate(
  ratesMap: Record<string, number>,
  from: string,
  to: string
): number | null {
  const direct = pairRate(ratesMap, from, to);
  if (direct !== null) return direct;
  for (const pivot of PIVOT_CURRENCIES) {
    if (pivot === from || pivot === to) continue;
    const a = pairRate(ratesMap, from, pivot);
    const b = pairRate(ratesMap, pivot, to);
    if (a !== null && b !== null) return a * b;
  }
  return null;
}

export function getRateFromMap(ratesMap: Record<string, number>, from: string, to: string): number {
  // 1 only for a currency the app does not know at all (never for the listed currencies).
  return findRate(ratesMap, from, to) ?? 1;
}

// ─── Multi-currency account summary ──────────────────────────────────────────

export interface CurrencyGroup {
  currencyCode: string;
  totalOriginal: number;
  totalInBase: number;
  percentage: number;
  rate: number;
}

export function groupAccountsByCurrency(
  accounts: Array<{ balance: number; currency: string }>,
  baseCurrency: string,
  ratesMap: Record<string, number>
): CurrencyGroup[] {
  const groups: Record<string, { total: number; totalBase: number; rate: number }> = {};

  for (const acc of accounts) {
    const code = acc.currency || 'PEN';
    const rate = getRateFromMap(ratesMap, code, baseCurrency);
    if (!groups[code]) {
      groups[code] = { total: 0, totalBase: 0, rate };
    }
    groups[code].total += acc.balance;
    groups[code].totalBase += acc.balance * rate;
  }

  const totalBase = Object.values(groups).reduce((s, g) => s + g.totalBase, 0);

  return Object.entries(groups)
    .map(([code, g]) => ({
      currencyCode: code,
      totalOriginal: g.total,
      totalInBase: g.totalBase,
      percentage: totalBase > 0 ? Math.round((g.totalBase / totalBase) * 100) : 0,
      rate: g.rate,
    }))
    .sort((a, b) => b.totalInBase - a.totalInBase);
}
