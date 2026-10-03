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
  if (from === to) return 1;
  const key = `${from}_${to}`;
  if (DEFAULT_EXCHANGE_RATES[key]) return DEFAULT_EXCHANGE_RATES[key];
  // Try reverse
  const reverseKey = `${to}_${from}`;
  if (DEFAULT_EXCHANGE_RATES[reverseKey]) return 1 / DEFAULT_EXCHANGE_RATES[reverseKey];
  return 1;
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

export function getRateFromMap(ratesMap: Record<string, number>, from: string, to: string): number {
  if (from === to) return 1;
  const key = buildRateKey(from, to);
  if (ratesMap[key]) return ratesMap[key];
  const reverseKey = buildRateKey(to, from);
  if (ratesMap[reverseKey]) return 1 / ratesMap[reverseKey];
  return getDefaultRate(from, to);
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
