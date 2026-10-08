'use client';
import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';
import type { Account } from '@/lib/financeStore';
import type { Business, BusinessSummary } from '@/lib/business';

// MONEO NEGOCIO data (docs/moneo-negocio.md). Personal services read business_id IS NULL;
// everything of a business goes through here. Context rules live in the database.

async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new DataError('auth', error);
  return data.user.id;
}

function toBusiness(r: Record<string, unknown>): Business {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: (r.kind as string) ?? null,
    createdAt: String(r.created_at),
  };
}

function toAccount(r: Record<string, unknown>): Account {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.account_type as Account['type'],
    institution: (r.institution as string) ?? '',
    balance: Number(r.balance),
    currency: String(r.currency ?? 'PEN'),
    icon: (r.icon as string) ?? 'bank',
    color: (r.color as string) ?? '#111111',
    bgColor: (r.bg_color as string) ?? '#FFF9EC',
  };
}

export const businessService = {
  async list(): Promise<Business[]> {
    const { data, error } = await createClient()
      .from('businesses')
      .select('id, name, kind, created_at')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data ?? []).map(toBusiness);
  },

  async create(name: string, kind: string | null): Promise<Business> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('businesses')
      .insert({ owner_id: userId, name: name.trim(), kind })
      .select('id, name, kind, created_at')
      .single();
    if (error) throw toDataError(error);
    return toBusiness(data);
  },

  async rename(id: string, name: string, kind: string | null): Promise<void> {
    const { data, error } = await createClient()
      .from('businesses')
      .update({ name: name.trim(), kind, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length) throw new DataError('not_found', null, 'No se encontró el negocio.');
  },

  /** Only a business without accounts can be deleted (the database refuses otherwise). */
  async remove(id: string): Promise<void> {
    const { data, error } = await createClient()
      .from('businesses')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      if (error.code === '23503') {
        throw new DataError('validation', error, 'Primero elimina las cuentas de este negocio.');
      }
      throw toDataError(error);
    }
    if (!data?.length) throw new DataError('not_found', null, 'No se encontró el negocio.');
  },

  async accounts(businessId: string): Promise<Account[]> {
    const { data, error } = await createClient()
      .from('accounts')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data ?? []).map(toAccount);
  },

  async createAccount(businessId: string, account: Omit<Account, 'id'>): Promise<Account> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        business_id: businessId,
        name: account.name,
        account_type: account.type,
        institution: account.institution,
        balance: account.balance,
        currency: account.currency,
        icon: account.icon,
        color: account.color,
        bg_color: account.bgColor,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return toAccount(data);
  },

  async summary(businessId: string, from?: string, to?: string): Promise<BusinessSummary> {
    const { data, error } = await createClient().rpc('business_summary', {
      p_business: businessId,
      p_from: from ?? null,
      p_to: to ?? null,
      p_today: null,
    });
    if (error) throw toDataError(error);
    return data as BusinessSummary;
  },
};
