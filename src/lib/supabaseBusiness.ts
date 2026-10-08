'use client';
import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';
import type { Account, Transaction, TransactionCurrencyFields } from '@/lib/financeStore';
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

// ─── Contacts, payments, collections and movements of a business (fase 3) ─────

export type PartyKind = 'proveedor' | 'cliente' | 'empleado';

export interface Party {
  id: string;
  kind: PartyKind;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  usualAmount: number | null;
  frequency: 'semanal' | 'quincenal' | 'mensual' | null;
  active: boolean;
}

export interface BizObligation {
  id: string;
  type: 'pago' | 'cobro';
  name: string;
  amount: number;
  category: string;
  icon: string;
  due: string; // YYYY-MM-DD
  done: boolean;
  partyId: string | null;
  isRecurring: boolean;
  transactionId: string | null;
}

export interface BizMovement {
  id: string;
  name: string;
  type: 'ingreso' | 'gasto' | 'transferencia';
  amount: number; // signed, account currency
  value: number; // positive, main currency when available
  category: string;
  date: string;
  partyId: string | null;
  accountId: string | null;
}

function toParty(r: Record<string, unknown>): Party {
  return {
    id: String(r.id),
    kind: r.kind as PartyKind,
    name: String(r.name),
    phone: (r.phone as string) ?? null,
    email: (r.email as string) ?? null,
    notes: (r.notes as string) ?? null,
    usualAmount: r.usual_amount == null ? null : Number(r.usual_amount),
    frequency: (r.frequency as Party['frequency']) ?? null,
    active: r.active !== false,
  };
}

export const partiesService = {
  async list(businessId: string): Promise<Party[]> {
    const { data, error } = await createClient()
      .from('business_parties')
      .select('*')
      .eq('business_id', businessId)
      .order('name');
    if (error) throw toDataError(error);
    return (data ?? []).map(toParty);
  },

  async create(
    businessId: string,
    p: Pick<Party, 'kind' | 'name'> & Partial<Omit<Party, 'id' | 'kind' | 'name'>>
  ): Promise<Party> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('business_parties')
      .insert({
        business_id: businessId,
        user_id: userId,
        kind: p.kind,
        name: p.name.trim(),
        phone: p.phone || null,
        email: p.email || null,
        notes: p.notes || null,
        usual_amount: p.usualAmount ?? null,
        frequency: p.frequency ?? null,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return toParty(data);
  },

  async update(id: string, p: Partial<Omit<Party, 'id'>>): Promise<void> {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.name !== undefined) updates.name = p.name.trim();
    if (p.kind !== undefined) updates.kind = p.kind;
    if (p.phone !== undefined) updates.phone = p.phone || null;
    if (p.email !== undefined) updates.email = p.email || null;
    if (p.notes !== undefined) updates.notes = p.notes || null;
    if (p.usualAmount !== undefined) updates.usual_amount = p.usualAmount;
    if (p.frequency !== undefined) updates.frequency = p.frequency;
    if (p.active !== undefined) updates.active = p.active;
    const { data, error } = await createClient()
      .from('business_parties')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length) throw new DataError('not_found', null, 'No se encontró el contacto.');
  },

  /** Payments and movements keep their history; they just lose the contact. */
  async remove(id: string): Promise<void> {
    const { data, error } = await createClient()
      .from('business_parties')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length) throw new DataError('not_found', null, 'No se encontró el contacto.');
  },

  /** The contact with that name (case and accents ignored), created when missing. */
  async ensure(businessId: string, kind: PartyKind, name: string, known: Party[]): Promise<Party> {
    const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const found = known.find((p) => fold(p.name) === fold(name));
    return found ?? partiesService.create(businessId, { kind, name });
  },
};

export const bizObligationsService = {
  async list(businessId: string): Promise<BizObligation[]> {
    const supabase = createClient();
    const [pagos, cobros] = await Promise.all([
      supabase.from('pagos').select('*').eq('business_id', businessId).order('payment_date'),
      supabase
        .from('income_entries')
        .select('*')
        .eq('business_id', businessId)
        .order('collection_date'),
    ]);
    if (pagos.error) throw toDataError(pagos.error);
    if (cobros.error) throw toDataError(cobros.error);
    return [
      ...(pagos.data ?? []).map((r) => ({
        id: r.id,
        type: 'pago' as const,
        name: r.name,
        amount: Number(r.amount),
        category: r.category,
        icon: r.category_icon,
        due: String(r.payment_date).slice(0, 10),
        done: r.status === 'pagado',
        partyId: r.party_id ?? null,
        isRecurring: !!r.is_recurring,
        transactionId: r.transaction_id ?? null,
      })),
      ...(cobros.data ?? []).map((r) => ({
        id: r.id,
        type: 'cobro' as const,
        name: r.name,
        amount: Number(r.amount),
        category: r.category,
        icon: r.category_icon,
        due: String(r.collection_date).slice(0, 10),
        done: r.status === 'cobrado',
        partyId: r.party_id ?? null,
        isRecurring: false,
        transactionId: r.transaction_id ?? null,
      })),
    ];
  },

  async create(
    businessId: string,
    o: {
      type: 'pago' | 'cobro';
      name: string;
      amount: number;
      category: string;
      icon: string;
      due: string;
      partyId: string | null;
      notes?: string;
      recurringDay?: number | null; // pagos only: repeats every month on that day
    }
  ): Promise<void> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const common = {
      user_id: userId,
      business_id: businessId,
      party_id: o.partyId,
      name: o.name.trim(),
      amount: Math.abs(o.amount),
      category: o.category,
      category_icon: o.icon,
      notes: o.notes ?? '',
    };
    const { error } =
      o.type === 'pago'
        ? await supabase.from('pagos').insert({
            ...common,
            payment_date: o.due,
            is_recurring: !!o.recurringDay,
            payment_day: o.recurringDay ?? null,
          })
        : await supabase.from('income_entries').insert({ ...common, collection_date: o.due });
    if (error) throw toDataError(error);
  },

  async remove(o: Pick<BizObligation, 'id' | 'type'>): Promise<void> {
    const { data, error } = await createClient()
      .from(o.type === 'pago' ? 'pagos' : 'income_entries')
      .delete()
      .eq('id', o.id)
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length) throw new DataError('not_found');
  },

  /** Paid / collected from a business account: the database creates the movement. */
  async settle(o: Pick<BizObligation, 'id' | 'type'>, accountId: string, accountAmount?: number) {
    const { error } = await createClient().rpc(
      o.type === 'pago' ? 'mark_pago_paid' : 'mark_income_collected',
      o.type === 'pago'
        ? { p_pago_id: o.id, p_account_id: accountId, p_account_amount: accountAmount ?? null }
        : { p_entry_id: o.id, p_account_id: accountId, p_account_amount: accountAmount ?? null }
    );
    if (error) throw toDataError(error);
  },
};

export const bizMovementsService = {
  async list(businessId: string, from?: string): Promise<BizMovement[]> {
    let q = createClient()
      .from('transactions')
      .select(
        'id, name, amount, base_amount, base_currency_code, transaction_type, category, transaction_date, party_id, account_id'
      )
      .eq('business_id', businessId)
      .order('transaction_date', { ascending: false });
    if (from) q = q.gte('transaction_date', `${from}T00:00:00`);
    const { data, error } = await q;
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.transaction_type,
      amount: Number(r.amount),
      value: Math.abs(Number(r.base_amount ?? r.amount)),
      category: r.category,
      date: r.transaction_date,
      partyId: r.party_id ?? null,
      accountId: r.account_id ?? null,
    }));
  },

  /** A business income or expense; the account must be of this business. */
  async create(
    tx: Omit<Transaction, 'id'> & TransactionCurrencyFields & { partyId: string | null }
  ): Promise<void> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: tx.accountId,
      party_id: tx.partyId,
      name: tx.name,
      category: tx.category,
      category_icon: tx.categoryIcon,
      account_name: tx.account,
      amount: tx.amount,
      transaction_date: tx.date,
      transaction_time: tx.time,
      transaction_type: tx.type,
      notes: tx.notes || '',
      currency_code: tx.currencyCode,
      original_amount: tx.originalAmount,
      base_currency_code: tx.baseCurrencyCode,
      base_amount: tx.baseAmount,
      exchange_rate: tx.exchangeRate,
      exchange_rate_date: tx.exchangeRateDate,
    });
    if (error) throw toDataError(error);
  },
};
