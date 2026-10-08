// The app's locale and local currency, in one place. Today MONEO runs in Peru (es-PE, PEN);
// with country packs (docs/global-core.md, step 3) these come from the user's settings.

/** Locale for numbers and dates (es-PE groups as 1,234.50). */
export const APP_LOCALE = 'es-PE';

/**
 * Currency of the amounts stored without a currency column (payments, incomes, subscriptions,
 * budgets, debts, goals, juntas). They are typed in the local currency.
 */
export const LOCAL_CURRENCY = 'PEN';

const numberFormats = new Map<string, Intl.NumberFormat>();

/** A number grouped for the app locale with a fixed number of decimals. */
export function formatNumber(n: number, decimals = 2, locale = APP_LOCALE): string {
  const key = `${locale}|${decimals}`;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormats.set(key, f);
  }
  return f.format(n);
}

/** Decimals a currency uses (CLP 0, most others 2). */
export function currencyDecimals(code: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}
