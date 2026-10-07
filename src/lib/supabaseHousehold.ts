'use client';

import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError, type DataErrorKind } from '@/lib/dataError';
import { transactionsService } from '@/lib/supabaseFinance';
import type { FxContext } from '@/lib/supabaseCurrency';
import { buildCurrencyFields, getRateFromMap } from '@/lib/currency';
import { localDateTimeToISO, nowTimeLocal } from '@/lib/dates';
import type { Account } from '@/lib/financeStore';
import type {
  Frequency,
  Household,
  HouseholdExpense,
  HouseholdMember,
  HouseholdSettlement,
  Responsibility,
  Share,
  SettlementStatus,
  SplitMethod,
} from '@/lib/household';

// MONEO HOGAR data access. Shared data only: nothing here reads another member's
// accounts, balances or movements (RLS would not allow it anyway). Writes that need
// validation go through the database functions of migration 20261012120000.

// The database functions raise messages written for the user (Spanish); keep them
// instead of the generic text, except for technical errors.
const FRIENDLY_CODES: Record<string, DataErrorKind> = {
  '42501': 'permission',
  '22023': 'validation',
  '23505': 'conflict',
  '54000': 'validation',
};

function rpcError(error: unknown): DataError {
  const e = error as { code?: string; message?: string };
  const kind = e?.code ? FRIENDLY_CODES[e.code] : undefined;
  const msg = e?.message ?? '';
  if (kind && msg && !/violates|permission denied|syntax|column|relation|function/i.test(msg)) {
    return new DataError(kind, error, msg);
  }
  return toDataError(error);
}

// ---------- Rows ----------

interface HouseholdRow {
  id: string;
  name: string;
  subtitle: string | null;
  base_currency: string;
  split_method: SplitMethod;
  emergency_months: number;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  display_name: string;
  role: HouseholdMember['role'];
  status: HouseholdMember['status'];
  declared_income: number | string | null;
  custom_pct: number | string | null;
  joined_at: string;
}

interface ExpenseRow {
  id: string;
  created_by: string | null;
  paid_by: string;
  transaction_id: string | null;
  name: string;
  category: string;
  amount: number | string;
  currency_code: string;
  base_amount: number | string;
  exchange_rate: number | string;
  expense_date: string;
  responsibility: Responsibility;
  is_recurring: boolean;
  frequency: Frequency | null;
  next_date: string | null;
  notes: string | null;
  household_expense_splits: {
    member_id: string;
    percentage: number | string;
    amount: number | string;
  }[];
}

interface SettlementRow {
  id: string;
  period: string;
  from_member: string;
  to_member: string;
  amount: number | string;
  status: SettlementStatus;
  created_by: string | null;
  paid_at: string | null;
  received_at: string | null;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

const toHousehold = (r: HouseholdRow): Household => ({
  id: r.id,
  name: r.name,
  subtitle: r.subtitle ?? '',
  baseCurrency: r.base_currency,
  splitMethod: r.split_method,
  emergencyMonths: r.emergency_months,
});

const toMember = (r: MemberRow): HouseholdMember => ({
  id: r.id,
  userId: r.user_id,
  displayName: r.display_name,
  role: r.role,
  status: r.status,
  declaredIncome: num(r.declared_income),
  customPct: num(r.custom_pct),
  joinedAt: r.joined_at,
});

const toExpense = (r: ExpenseRow): HouseholdExpense => ({
  id: r.id,
  createdBy: r.created_by,
  paidBy: r.paid_by,
  transactionId: r.transaction_id,
  name: r.name,
  category: r.category,
  amount: Number(r.amount),
  currencyCode: r.currency_code,
  baseAmount: Number(r.base_amount),
  exchangeRate: Number(r.exchange_rate),
  expenseDate: r.expense_date,
  responsibility: r.responsibility,
  isRecurring: r.is_recurring,
  frequency: r.frequency,
  nextDate: r.next_date,
  notes: r.notes ?? '',
  splits: (r.household_expense_splits ?? []).map((s) => ({
    memberId: s.member_id,
    percentage: Number(s.percentage),
    amount: Number(s.amount),
  })),
});

const toSettlement = (r: SettlementRow): HouseholdSettlement => ({
  id: r.id,
  period: r.period,
  fromMember: r.from_member,
  toMember: r.to_member,
  amount: Number(r.amount),
  status: r.status,
  createdBy: r.created_by,
  paidAt: r.paid_at,
  receivedAt: r.received_at,
});

export interface MyHousehold {
  household: Household;
  members: HouseholdMember[]; // every member, including those who left (history)
  me: HouseholdMember;
}

export interface Invitation {
  id: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export type InviteStatus = 'valid' | 'expired' | 'used' | 'revoked' | 'invalid';

export interface InviteInfo {
  householdName: string | null;
  inviterName: string | null;
  status: InviteStatus;
}

export interface ExpenseInput {
  paidBy: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  date: string; // YYYY-MM-DD
  responsibility: Responsibility;
  shares: Share[];
  isRecurring: boolean;
  frequency: Frequency | null;
  nextDate: string | null;
  notes: string;
  transactionId: string | null;
  source?: 'manual' | 'excel' | 'auto';
}

// ---------- Household ----------

export const householdService = {
  // The caller's active household, or null when they have none.
  async getMine(): Promise<MyHousehold | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new DataError('auth');
    const { data: mine, error: e1 } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (e1) throw toDataError(e1);
    if (!mine) return null;
    const [h, m] = await Promise.all([
      supabase
        .from('households')
        .select('id, name, subtitle, base_currency, split_method, emergency_months')
        .eq('id', mine.household_id)
        .single(),
      supabase
        .from('household_members')
        .select('id, user_id, display_name, role, status, declared_income, custom_pct, joined_at')
        .eq('household_id', mine.household_id)
        .order('joined_at'),
    ]);
    if (h.error) throw toDataError(h.error);
    if (m.error) throw toDataError(m.error);
    const members = (m.data as MemberRow[]).map(toMember);
    const me = members.find((x) => x.userId === user.id && x.status === 'active');
    if (!me) return null;
    return { household: toHousehold(h.data as HouseholdRow), members, me };
  },

  async create(input: {
    name: string;
    displayName: string;
    subtitle?: string;
    baseCurrency?: string;
  }): Promise<string> {
    const { data, error } = await createClient().rpc('create_household', {
      p_name: input.name,
      p_display_name: input.displayName,
      p_subtitle: input.subtitle ?? null,
      p_base_currency: input.baseCurrency ?? 'PEN',
    });
    if (error) throw rpcError(error);
    return data as string;
  },

  // Owner only (RLS).
  async update(
    id: string,
    patch: Partial<
      Pick<Household, 'name' | 'subtitle' | 'baseCurrency' | 'splitMethod' | 'emergencyMonths'>
    >
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.subtitle !== undefined) row.subtitle = patch.subtitle.trim() || null;
    if (patch.baseCurrency !== undefined) row.base_currency = patch.baseCurrency;
    if (patch.splitMethod !== undefined) row.split_method = patch.splitMethod;
    if (patch.emergencyMonths !== undefined) row.emergency_months = patch.emergencyMonths;
    const { data, error } = await createClient()
      .from('households')
      .update(row)
      .eq('id', id)
      .select('id');
    if (error) throw rpcError(error);
    if (!data?.length) throw new DataError('permission');
  },

  // Own name and declared income; the owner also sets everybody's custom share.
  async updateMember(
    memberId: string,
    patch: { displayName?: string; declaredIncome?: number | null; customPct?: number | null }
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
    if (patch.declaredIncome !== undefined) row.declared_income = patch.declaredIncome;
    if (patch.customPct !== undefined) row.custom_pct = patch.customPct;
    const { data, error } = await createClient()
      .from('household_members')
      .update(row)
      .eq('id', memberId)
      .select('id');
    if (error) throw rpcError(error);
    if (!data?.length) throw new DataError('permission');
  },

  // Returns the one-time token (only its hash is stored).
  async invite(householdId: string, email?: string): Promise<string> {
    const { data, error } = await createClient().rpc('create_household_invite', {
      p_household: householdId,
      p_email: email?.trim() || null,
    });
    if (error) throw rpcError(error);
    return data as string;
  },

  async invitations(householdId: string): Promise<Invitation[]> {
    const { data, error } = await createClient()
      .from('household_invitations')
      .select('id, email, created_at, expires_at, accepted_at, revoked_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    if (error) throw toDataError(error);
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
      revokedAt: r.revoked_at,
    }));
  },

  async revokeInvite(invitationId: string): Promise<void> {
    const { error } = await createClient().rpc('revoke_household_invite', {
      p_invitation: invitationId,
    });
    if (error) throw rpcError(error);
  },

  async inviteInfo(token: string): Promise<InviteInfo> {
    const { data, error } = await createClient().rpc('household_invite_info', {
      p_token: token,
    });
    if (error) throw rpcError(error);
    const r = (
      data as { household_name: string | null; inviter_name: string | null; status: InviteStatus }[]
    )[0];
    return {
      householdName: r?.household_name ?? null,
      inviterName: r?.inviter_name ?? null,
      status: r?.status ?? 'invalid',
    };
  },

  async accept(token: string, displayName: string): Promise<string> {
    const { data, error } = await createClient().rpc('accept_household_invite', {
      p_token: token,
      p_display_name: displayName,
    });
    if (error) throw rpcError(error);
    return data as string;
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await createClient().rpc('remove_household_member', {
      p_member: memberId,
    });
    if (error) throw rpcError(error);
  },

  async transferOwnership(memberId: string): Promise<void> {
    const { error } = await createClient().rpc('transfer_household_ownership', {
      p_member: memberId,
    });
    if (error) throw rpcError(error);
  },

  async leave(householdId: string): Promise<void> {
    const { error } = await createClient().rpc('leave_household', { p_household: householdId });
    if (error) throw rpcError(error);
  },

  async remove(householdId: string): Promise<void> {
    const { error } = await createClient().rpc('delete_household', { p_household: householdId });
    if (error) throw rpcError(error);
  },

  // MONEO HOGAR's PLUS features are open for everyone when one active member has PLUS.
  async hasPlus(householdId: string): Promise<boolean> {
    const { data, error } = await createClient().rpc('household_has_plus', {
      p_household: householdId,
    });
    if (error) throw toDataError(error);
    return data === true;
  },

  // Tells the other members (no amounts in the text). Never fails the caller's action.
  async notify(
    householdId: string,
    type:
      | 'household_expense'
      | 'household_payment'
      | 'household_budget'
      | 'household_goal'
      | 'household_settlement'
      | 'household_member',
    title: string,
    message?: string
  ): Promise<void> {
    try {
      await createClient().rpc('notify_household', {
        p_household: householdId,
        p_type: type,
        p_title: title,
        p_message: message ?? null,
        p_action_url: '/finanzas/hogar',
      });
    } catch {
      // A notification is a courtesy: never block the action.
    }
  },
};

// ---------- Expenses ----------

const EXPENSE_COLUMNS =
  'id, created_by, paid_by, transaction_id, name, category, amount, currency_code, base_amount, exchange_rate, expense_date, responsibility, is_recurring, frequency, next_date, notes, household_expense_splits(member_id, percentage, amount)';

export const householdExpensesService = {
  // Expenses dated from `from` (YYYY-MM-DD, inclusive), newest first.
  async list(householdId: string, from?: string): Promise<HouseholdExpense[]> {
    let q = createClient()
      .from('household_expenses')
      .select(EXPENSE_COLUMNS)
      .eq('household_id', householdId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (from) q = q.gte('expense_date', from);
    const { data, error } = await q;
    if (error) throw toDataError(error);
    return (data as unknown as ExpenseRow[]).map(toExpense);
  },

  // Recurring expenses (for upcoming payments), whatever their date.
  async recurring(householdId: string): Promise<HouseholdExpense[]> {
    const { data, error } = await createClient()
      .from('household_expenses')
      .select(EXPENSE_COLUMNS)
      .eq('household_id', householdId)
      .eq('is_recurring', true)
      .order('next_date');
    if (error) throw toDataError(error);
    return (data as unknown as ExpenseRow[]).map(toExpense);
  },

  // Creates (id = null) or edits an expense with its split. Returns its id.
  async save(householdId: string, id: string | null, e: ExpenseInput): Promise<string> {
    const { data, error } = await createClient().rpc('save_household_expense', {
      p_household: householdId,
      p_expense: id,
      p_paid_by: e.paidBy,
      p_name: e.name,
      p_category: e.category,
      p_amount: e.amount,
      p_currency: e.currency,
      p_exchange_rate: e.exchangeRate,
      p_expense_date: e.date,
      p_responsibility: e.responsibility,
      p_splits: e.shares.map((s) => ({ member_id: s.memberId, percentage: s.percentage })),
      p_is_recurring: e.isRecurring,
      p_frequency: e.isRecurring ? e.frequency : null,
      p_next_date: e.isRecurring ? e.nextDate : null,
      p_notes: e.notes || null,
      p_transaction: e.transactionId,
      p_source: e.source ?? 'manual',
    });
    if (error) throw rpcError(error);
    return data as string;
  },

  // Its creator or the owner (RLS). Does not touch the payer's real movement.
  async remove(id: string): Promise<void> {
    const { data, error } = await createClient()
      .from('household_expenses')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length) {
      throw new DataError(
        'permission',
        undefined,
        'Solo quien registró el gasto o quien administra el hogar puede eliminarlo.'
      );
    }
  },
};

// ---------- Settlements ----------

export const householdSettlementsService = {
  async list(householdId: string, fromPeriod?: string): Promise<HouseholdSettlement[]> {
    let q = createClient()
      .from('household_settlements')
      .select(
        'id, period, from_member, to_member, amount, status, created_by, paid_at, received_at'
      )
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    if (fromPeriod) q = q.gte('period', fromPeriod);
    const { data, error } = await q;
    if (error) throw toDataError(error);
    return (data as SettlementRow[]).map(toSettlement);
  },

  // Records a proposal (nothing moves until each side confirms with their own movement).
  async propose(
    householdId: string,
    period: string,
    fromMember: string,
    toMember: string,
    amount: number,
    status: 'proposed' | 'deferred' | 'waived' = 'proposed'
  ): Promise<string> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new DataError('auth');
    const { data, error } = await supabase
      .from('household_settlements')
      .insert({
        household_id: householdId,
        period,
        from_member: fromMember,
        to_member: toMember,
        amount,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (error) throw rpcError(error);
    if (status !== 'proposed') await this.setStatus(data.id, status);
    return data.id;
  },

  async setStatus(id: string, status: 'proposed' | 'deferred' | 'waived'): Promise<void> {
    const { error } = await createClient().rpc('set_household_settlement_status', {
      p_settlement: id,
      p_status: status,
    });
    if (error) throw rpcError(error);
  },

  // The payer confirms with the expense in their own account (or null: paid outside MONEO).
  async confirmPaid(id: string, transactionId: string | null): Promise<void> {
    const { error } = await createClient().rpc('confirm_household_settlement_paid', {
      p_settlement: id,
      p_transaction: transactionId,
    });
    if (error) throw rpcError(error);
  },

  // The receiver confirms with the income in their own account (or null).
  async confirmReceived(id: string, transactionId: string | null): Promise<void> {
    const { error } = await createClient().rpc('confirm_household_settlement_received', {
      p_settlement: id,
      p_transaction: transactionId,
    });
    if (error) throw rpcError(error);
  },

  async remove(id: string): Promise<void> {
    const { data, error } = await createClient()
      .from('household_settlements')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length) throw new DataError('permission');
  },
};

// ---------- The member's own real movement ----------

// Records an expense or income in one of the caller's OWN accounts (the only way HOGAR
// moves a real balance: paying a shared expense, or each side of a settlement). Returns
// the movement id, to link it. The amount is in the account currency.
export async function recordOwnMovement(input: {
  account: Account;
  type: 'gasto' | 'ingreso';
  amount: number; // positive
  name: string;
  category: string;
  categoryIcon: string;
  date: string; // YYYY-MM-DD
  fx: FxContext;
}): Promise<string> {
  const signed = input.type === 'gasto' ? -Math.abs(input.amount) : Math.abs(input.amount);
  const currency = input.account.currency || 'PEN';
  const tx = await transactionsService.create({
    name: input.name,
    type: input.type,
    amount: signed,
    category: input.category,
    categoryIcon: input.categoryIcon,
    accountId: input.account.id,
    account: input.account.name,
    notes: 'MONEO HOGAR',
    date: localDateTimeToISO(input.date, nowTimeLocal()),
    time: nowTimeLocal(),
    ...buildCurrencyFields({
      amount: signed,
      currency,
      baseCurrency: input.fx.baseCurrency,
      rateToBase: getRateFromMap(input.fx.ratesMap, currency, input.fx.baseCurrency),
      date: input.date,
    }),
  });
  return tx.id;
}

// Undo for a movement created just before a household write that failed.
export async function discardOwnMovement(id: string): Promise<void> {
  try {
    await transactionsService.delete(id);
  } catch {
    // Best effort: the user still sees the movement in Movimientos and can delete it.
  }
}
