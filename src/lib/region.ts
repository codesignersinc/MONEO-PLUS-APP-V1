// Country, language and time zone of a user (docs/global-core.md, step 3). Detection only
// proposes: the user always confirms or changes it.

export type CountryStatus = 'hidden' | 'waitlist' | 'beta' | 'live';

export interface Country {
  code: string;
  name: string;
  flag: string;
  defaultCurrency: string;
  defaultLocale: string;
  defaultTimezone: string;
  status: CountryStatus;
}

export interface RegionSignals {
  /** Country of the visitor's IP (Vercel `x-vercel-ip-country`), if known. */
  ipCountry?: string | null;
  /** Device time zone (Intl). */
  timeZone?: string | null;
  /** Browser languages, most preferred first. */
  languages?: readonly string[];
}

// Time zones that clearly point to a country when the IP country is unknown.
const TZ_COUNTRY: [RegExp, string][] = [
  [/^America\/Lima$/, 'PE'],
  [/^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta)$/, 'ES'],
  [/^Australia\//, 'AU'],
  [/^Asia\/Dubai$/, 'AE'],
  [/^Asia\/Singapore$/, 'SG'],
  [
    /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu|US\/.+)$/,
    'US',
  ],
];

/** The country to propose, among the available ones (never "hidden"). Null if unknown. */
export function suggestCountry(signals: RegionSignals, countries: Country[]): string | null {
  const offered = new Set(countries.filter((c) => c.status !== 'hidden').map((c) => c.code));
  const ip = signals.ipCountry?.toUpperCase();
  if (ip && offered.has(ip)) return ip;
  const tz = signals.timeZone ?? '';
  for (const [re, code] of TZ_COUNTRY) if (re.test(tz) && offered.has(code)) return code;
  for (const lang of signals.languages ?? []) {
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && offered.has(region)) return region;
  }
  return null;
}

/** Locale for a country: its default, except where both Spanish and English are common. */
export function suggestLocale(country: Country, languages: readonly string[] = []): string {
  const first = (languages[0] ?? '').toLowerCase();
  if (country.code === 'US') return first.startsWith('en') ? 'en-US' : 'es-US';
  return country.defaultLocale;
}

/** Time zone to save: the device's when it is a real IANA zone, else the country default. */
export function suggestTimezone(country: Country, deviceTimeZone?: string | null): string {
  return deviceTimeZone && deviceTimeZone.includes('/') ? deviceTimeZone : country.defaultTimezone;
}

/** Base currency for a new user in a country: its own if MONEO supports it, else USD. */
export function currencyForCountry(country: Country, supported: readonly string[]): string {
  return supported.includes(country.defaultCurrency) ? country.defaultCurrency : 'USD';
}

/** City part of a time zone: "America/New_York" → "New York". */
export function timezoneCity(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}
