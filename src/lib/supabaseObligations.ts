'use client';

import { createClient } from '@/lib/supabase/client';
import { assertAffected, authRequired, toDataError } from '@/lib/dataError';

// Pagos (obligaciones) e ingresos por cobrar. Pending entries don't move money.
// Marking one as paid/collected asks for an account: the database creates the
// movement (and moves the balance) and links it in transaction_id; going back to
// pending deletes exactly that movement. `status` is only written by those RPCs.
// Amounts are in the user's base currency; for an account in another currency the
// caller passes `accountAmount` (what was really debited/credited in that currency).
//
// Every function resolves with real data or throws a DataError.

export interface PagoEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  paymentDate: string;
  notes: string;
  status: 'pendiente' | 'pagado' | 'vencido';
  isRecurring: boolean;
  paymentDay: number | null;
  transactionId: string | null;
}

export interface IncomeEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  collectionDate: string;
  notes: string;
  status: 'pendiente' | 'cobrado';
  transactionId: string | null;
}

export type NewPago = Omit<PagoEntry, 'id' | 'status' | 'transactionId'>;
export type NewIncome = Omit<IncomeEntry, 'id' | 'status' | 'transactionId'>;

async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw toDataError(error);
  if (!user) throw authRequired();
  return user.id;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function toPago(r: Row): PagoEntry {
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    category: r.category,
    categoryIcon: r.category_icon,
    paymentDate: r.payment_date,
    notes: r.notes || '',
    status: r.status,
    isRecurring: r.is_recurring,
    paymentDay: r.payment_day,
    transactionId: r.transaction_id ?? null,
  };
}

function toIncome(r: Row): IncomeEntry {
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    category: r.category,
    categoryIcon: r.category_icon,
    collectionDate: r.collection_date,
    notes: r.notes || '',
    status: r.status,
    transactionId: r.transaction_id ?? null,
  };
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export const pagosService = {
  async getAll(): Promise<PagoEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .is('business_id', null)
      .order('payment_date', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(toPago);
  },

  // Always created as pending; call markPaid to pay it from an account.
  async create(p: NewPago): Promise<PagoEntry> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('pagos')
      .insert({
        user_id: userId,
        name: p.name,
        amount: p.amount,
        category: p.category,
        category_icon: p.categoryIcon,
        payment_date: p.paymentDate,
        notes: p.notes,
        is_recurring: p.isRecurring,
        payment_day: p.paymentDay,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return toPago(data);
  },

  // Editing a paid entry also updates its movement (and the balance) in the database.
  async update(id: string, p: Partial<NewPago>): Promise<void> {
    const supabase = createClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.name !== undefined) updates.name = p.name;
    if (p.amount !== undefined) updates.amount = p.amount;
    if (p.category !== undefined) updates.category = p.category;
    if (p.categoryIcon !== undefined) updates.category_icon = p.categoryIcon;
    if (p.paymentDate !== undefined) updates.payment_date = p.paymentDate;
    if (p.notes !== undefined) updates.notes = p.notes;
    if (p.isRecurring !== undefined) updates.is_recurring = p.isRecurring;
    if (p.paymentDay !== undefined) updates.payment_day = p.paymentDay;
    const { data, error } = await supabase.from('pagos').update(updates).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('pagos').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  // Idempotent. For a recurring payment the database also creates next month's one.
  async markPaid(id: string, accountId: string, accountAmount?: number): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('mark_pago_paid', {
      p_pago_id: id,
      p_account_id: accountId,
      p_account_amount: accountAmount ?? null,
    });
    if (error) throw toDataError(error);
    return data as string;
  },

  async markPending(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.rpc('mark_pago_pending', { p_pago_id: id });
    if (error) throw toDataError(error);
  },
};

// ─── Ingresos ─────────────────────────────────────────────────────────────────

export const incomeService = {
  async getAll(): Promise<IncomeEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('income_entries')
      .select('*')
      .is('business_id', null)
      .order('collection_date', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(toIncome);
  },

  // Always created as pending; call markCollected to credit it to an account.
  async create(e: NewIncome): Promise<IncomeEntry> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('income_entries')
      .insert({
        user_id: userId,
        name: e.name,
        amount: e.amount,
        category: e.category,
        category_icon: e.categoryIcon,
        collection_date: e.collectionDate,
        notes: e.notes,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return toIncome(data);
  },

  async update(id: string, e: Partial<NewIncome>): Promise<void> {
    const supabase = createClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (e.name !== undefined) updates.name = e.name;
    if (e.amount !== undefined) updates.amount = e.amount;
    if (e.category !== undefined) updates.category = e.category;
    if (e.categoryIcon !== undefined) updates.category_icon = e.categoryIcon;
    if (e.collectionDate !== undefined) updates.collection_date = e.collectionDate;
    if (e.notes !== undefined) updates.notes = e.notes;
    const { data, error } = await supabase
      .from('income_entries')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('income_entries')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  // Idempotent.
  async markCollected(id: string, accountId: string, accountAmount?: number): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('mark_income_collected', {
      p_entry_id: id,
      p_account_id: accountId,
      p_account_amount: accountAmount ?? null,
    });
    if (error) throw toDataError(error);
    return data as string;
  },

  async markPending(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.rpc('mark_income_pending', { p_entry_id: id });
    if (error) throw toDataError(error);
  },
};
