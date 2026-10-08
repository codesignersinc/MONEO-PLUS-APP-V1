import { describe, expect, it } from 'vitest';
import {
  currencyForCountry,
  suggestCountry,
  suggestLocale,
  suggestTimezone,
  timezoneCity,
  type Country,
} from '@/lib/region';

const C = (
  code: string,
  cur: string,
  locale: string,
  tz: string,
  status = 'waitlist'
): Country => ({
  code,
  name: code,
  flag: '',
  defaultCurrency: cur,
  defaultLocale: locale,
  defaultTimezone: tz,
  status: status as Country['status'],
});
const COUNTRIES = [
  C('PE', 'PEN', 'es-PE', 'America/Lima', 'live'),
  C('ES', 'EUR', 'es-ES', 'Europe/Madrid'),
  C('US', 'USD', 'es-US', 'America/New_York'),
  C('AU', 'AUD', 'en-AU', 'Australia/Sydney'),
  C('MX', 'MXN', 'es-MX', 'America/Mexico_City', 'hidden'),
];

describe('suggestCountry', () => {
  it('trusts the IP country first', () => {
    expect(suggestCountry({ ipCountry: 'es', timeZone: 'America/Lima' }, COUNTRIES)).toBe('ES');
  });
  it('falls back to the time zone, then the browser language', () => {
    expect(suggestCountry({ timeZone: 'America/Lima' }, COUNTRIES)).toBe('PE');
    expect(suggestCountry({ timeZone: 'Australia/Perth' }, COUNTRIES)).toBe('AU');
    expect(suggestCountry({ timeZone: 'America/Chicago' }, COUNTRIES)).toBe('US');
    expect(suggestCountry({ timeZone: 'UTC', languages: ['es-ES', 'es'] }, COUNTRIES)).toBe('ES');
  });
  it('never proposes a hidden or unknown country', () => {
    expect(suggestCountry({ ipCountry: 'MX', languages: ['es-MX'] }, COUNTRIES)).toBeNull();
    expect(suggestCountry({ ipCountry: 'JP' }, COUNTRIES)).toBeNull();
  });
});

describe('suggestLocale / timezone / currency', () => {
  it('US: English or Spanish by the browser', () => {
    expect(suggestLocale(COUNTRIES[2], ['en-US'])).toBe('en-US');
    expect(suggestLocale(COUNTRIES[2], ['es-419'])).toBe('es-US');
    expect(suggestLocale(COUNTRIES[0], ['en-US'])).toBe('es-PE');
  });
  it('uses the device time zone when valid', () => {
    expect(suggestTimezone(COUNTRIES[3], 'Australia/Perth')).toBe('Australia/Perth');
    expect(suggestTimezone(COUNTRIES[0], 'UTC')).toBe('America/Lima');
  });
  it('picks a supported currency or USD', () => {
    expect(currencyForCountry(COUNTRIES[1], ['PEN', 'USD', 'EUR'])).toBe('EUR');
    expect(currencyForCountry(COUNTRIES[3], ['PEN', 'USD', 'EUR'])).toBe('USD');
  });
  it('city of a time zone', () => {
    expect(timezoneCity('America/New_York')).toBe('New York');
  });
});
