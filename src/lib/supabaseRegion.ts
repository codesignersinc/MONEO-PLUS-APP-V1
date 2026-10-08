'use client';
import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';
import type { Country } from '@/lib/region';

// Countries (public) and the signed-in user's region (user_settings). See src/lib/region.ts.

export interface MyRegion {
  country: string | null;
  locale: string | null;
  timezone: string | null;
  confirmed: boolean;
}

export const regionService = {
  async countries(): Promise<Country[]> {
    const { data, error } = await createClient()
      .from('countries')
      .select('code, name, flag, default_currency, default_locale, default_timezone, status')
      .order('sort_order');
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({
      code: r.code,
      name: r.name,
      flag: r.flag,
      defaultCurrency: r.default_currency,
      defaultLocale: r.default_locale,
      defaultTimezone: r.default_timezone,
      status: r.status,
    }));
  },

  async mine(): Promise<MyRegion> {
    const { data, error } = await createClient()
      .from('user_settings')
      .select('country_code, locale, timezone, region_confirmed_at')
      .maybeSingle();
    if (error) throw toDataError(error);
    return {
      country: data?.country_code ?? null,
      locale: data?.locale ?? null,
      timezone: data?.timezone ?? null,
      confirmed: !!data?.region_confirmed_at,
    };
  },

  /** Saves the confirmed region; baseCurrency only when it should change too. */
  async save(country: string, locale: string, timezone: string, baseCurrency?: string) {
    const { error } = await createClient().rpc('set_my_region', {
      p_country: country,
      p_locale: locale,
      p_timezone: timezone,
      p_base_currency: baseCurrency ?? null,
    });
    if (error) {
      const e = error as { code?: string; message?: string };
      if (e.code === '22023' && e.message) throw new DataError('validation', error, e.message);
      throw toDataError(error);
    }
  },
};

/** Country of the visitor's IP, left by the middleware in the `moneo_geo` cookie. */
export function ipCountryFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)moneo_geo=([A-Z]{2})/);
  return m ? m[1] : null;
}
