'use client';

import { createClient } from '@/lib/supabase/client';
import { authRequired, toDataError } from '@/lib/dataError';
import { UserCurrencySettings, ExchangeRate, DEFAULT_USER_SETTINGS, getDefaultRate } from './currency';

// Every function below either resolves with real data or throws a DataError.
// "No row" (e.g. a new user without settings) is a valid result, not an error.

async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw toDataError(error);
  if (!user) throw authRequired();
  return user.id;
}

// ─── User Settings ─────────────────────────────────────────────────────────────

export const userSettingsService = {
  async get(): Promise<UserCurrencySettings> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw toDataError(error);
    if (!data) return DEFAULT_USER_SETTINGS;
    return {
      baseCurrencyCode: data.base_currency_code || 'PEN',
      exchangeRateMode: data.exchange_rate_mode || 'manual',
      showEquivalents: data.show_equivalents !== false,
    };
  },

  async upsert(settings: Partial<UserCurrencySettings>): Promise<void> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const updates: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (settings.baseCurrencyCode !== undefined) updates.base_currency_code = settings.baseCurrencyCode;
    if (settings.exchangeRateMode !== undefined) updates.exchange_rate_mode = settings.exchangeRateMode;
    if (settings.showEquivalents !== undefined) updates.show_equivalents = settings.showEquivalents;
    const { error } = await supabase.from('user_settings').upsert(updates, { onConflict: 'user_id' });
    if (error) throw toDataError(error);
  },
};

// ─── Exchange Rates ────────────────────────────────────────────────────────────

export const exchangeRatesService = {
  async getAll(): Promise<ExchangeRate[]> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('user_id', userId);
    if (error) throw toDataError(error);
    return (data || []).map(r => ({
      id: r.id,
      fromCurrency: r.from_currency,
      toCurrency: r.to_currency,
      rate: r.rate,
      rateDate: r.rate_date,
      source: r.source,
    }));
  },

  async getRatesMap(): Promise<Record<string, number>> {
    const rates = await this.getAll();
    const map: Record<string, number> = {};
    for (const r of rates) {
      map[`${r.fromCurrency}_${r.toCurrency}`] = r.rate;
    }
    return map;
  },

  async upsert(from: string, to: string, rate: number): Promise<void> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('exchange_rates').upsert({
      user_id: userId,
      from_currency: from,
      to_currency: to,
      rate,
      rate_date: today,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,from_currency,to_currency' });
    if (error) throw toDataError(error);
  },

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('user_id', userId)
      .eq('from_currency', from)
      .eq('to_currency', to)
      .maybeSingle();
    if (error) throw toDataError(error);
    if (data) return data.rate;
    // Try reverse
    const { data: rev, error: revError } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('user_id', userId)
      .eq('from_currency', to)
      .eq('to_currency', from)
      .maybeSingle();
    if (revError) throw toDataError(revError);
    if (rev) return 1 / rev.rate;
    return getDefaultRate(from, to);
  },
};

// ─── Currency Exchanges ────────────────────────────────────────────────────────

export interface CurrencyExchange {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  exchangeRate: number;
  exchangeDate: string;
  notes: string;
  createdAt: string;
}

export const currencyExchangesService = {
  async getAll(): Promise<CurrencyExchange[]> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('currency_exchanges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({
      id: r.id,
      fromAccountId: r.from_account_id,
      toAccountId: r.to_account_id,
      fromCurrency: r.from_currency,
      fromAmount: r.from_amount,
      toCurrency: r.to_currency,
      toAmount: r.to_amount,
      exchangeRate: r.exchange_rate,
      exchangeDate: r.exchange_date,
      notes: r.notes || '',
      createdAt: r.created_at,
    }));
  },

  async create(exchange: Omit<CurrencyExchange, 'id' | 'createdAt'>): Promise<CurrencyExchange> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('currency_exchanges')
      .insert({
        user_id: userId,
        from_account_id: exchange.fromAccountId,
        to_account_id: exchange.toAccountId,
        from_currency: exchange.fromCurrency,
        from_amount: exchange.fromAmount,
        to_currency: exchange.toCurrency,
        to_amount: exchange.toAmount,
        exchange_rate: exchange.exchangeRate,
        exchange_date: exchange.exchangeDate,
        notes: exchange.notes,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      fromAccountId: data.from_account_id,
      toAccountId: data.to_account_id,
      fromCurrency: data.from_currency,
      fromAmount: data.from_amount,
      toCurrency: data.to_currency,
      toAmount: data.to_amount,
      exchangeRate: data.exchange_rate,
      exchangeDate: data.exchange_date,
      notes: data.notes || '',
      createdAt: data.created_at,
    };
  },
};
