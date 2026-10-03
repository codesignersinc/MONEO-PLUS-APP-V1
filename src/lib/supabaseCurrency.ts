'use client';

import { createClient } from '@/lib/supabase/client';
import { UserCurrencySettings, ExchangeRate, DEFAULT_USER_SETTINGS, getDefaultRate } from './currency';

// ─── User Settings ─────────────────────────────────────────────────────────────

export const userSettingsService = {
  async get(): Promise<UserCurrencySettings> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_USER_SETTINGS;
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (!data) return DEFAULT_USER_SETTINGS;
    return {
      baseCurrencyCode: data.base_currency_code || 'PEN',
      exchangeRateMode: data.exchange_rate_mode || 'manual',
      showEquivalents: data.show_equivalents !== false,
    };
  },

  async upsert(settings: Partial<UserCurrencySettings>): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updates: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
    if (settings.baseCurrencyCode !== undefined) updates.base_currency_code = settings.baseCurrencyCode;
    if (settings.exchangeRateMode !== undefined) updates.exchange_rate_mode = settings.exchangeRateMode;
    if (settings.showEquivalents !== undefined) updates.show_equivalents = settings.showEquivalents;
    await supabase.from('user_settings').upsert(updates, { onConflict: 'user_id' });
  },
};

// ─── Exchange Rates ────────────────────────────────────────────────────────────

export const exchangeRatesService = {
  async getAll(): Promise<ExchangeRate[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('user_id', user.id);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('exchange_rates').upsert({
      user_id: user.id,
      from_currency: from,
      to_currency: to,
      rate,
      rate_date: today,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,from_currency,to_currency' });
  },

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return getDefaultRate(from, to);
    const { data } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('user_id', user.id)
      .eq('from_currency', from)
      .eq('to_currency', to)
      .single();
    if (data) return data.rate;
    // Try reverse
    const { data: rev } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('user_id', user.id)
      .eq('from_currency', to)
      .eq('to_currency', from)
      .single();
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('currency_exchanges')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
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

  async create(exchange: Omit<CurrencyExchange, 'id' | 'createdAt'>): Promise<CurrencyExchange | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('currency_exchanges')
      .insert({
        user_id: user.id,
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
    if (error) { console.error(error); return null; }
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
