'use client';

import { createClient } from '@/lib/supabase/client';
import { assertAffected, authRequired, toDataError } from '@/lib/dataError';
import { buildCurrencyFields, getRateFromMap } from '@/lib/currency';
import type { FxContext } from '@/lib/supabaseCurrency';
import type {
  Account,
  Transaction,
  BudgetCategory,
  SavingsGoal,
  Debt,
  Investment,
  Subscription,
  FinanceData,
  TransactionCurrencyFields,
  Transfer,
} from './financeStore';

// Every function below either resolves with real data or throws a DataError.
// An empty array always means "no rows", never "the request failed".

async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw toDataError(error);
  if (!user) throw authRequired();
  return user.id;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const accountsService = {
  async getAll(): Promise<Account[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.account_type,
      institution: r.institution,
      balance: r.balance,
      currency: r.currency,
      icon: r.icon,
      color: r.color,
      bgColor: r.bg_color,
    }));
  },

  async create(account: Omit<Account, 'id'>): Promise<Account> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
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
    return {
      id: data.id,
      name: data.name,
      type: data.account_type,
      institution: data.institution,
      balance: data.balance,
      currency: data.currency,
      icon: data.icon,
      color: data.color,
      bgColor: data.bg_color,
    };
  },

  // The balance is not editable here: movements move it through the database engine
  // and a manual correction goes through adjustBalance (audited).
  async update(id: string, account: Partial<Omit<Account, 'balance'>>): Promise<void> {
    const supabase = createClient();
    const updates: any = {};
    if (account.name !== undefined) updates.name = account.name;
    if (account.type !== undefined) updates.account_type = account.type;
    if (account.institution !== undefined) updates.institution = account.institution;
    if (account.currency !== undefined) updates.currency = account.currency;
    if (account.icon !== undefined) updates.icon = account.icon;
    if (account.color !== undefined) updates.color = account.color;
    if (account.bgColor !== undefined) updates.bg_color = account.bgColor;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  // Sets the balance to `newBalance` and records the adjustment with its reason.
  async adjustBalance(id: string, newBalance: number, reason: string): Promise<number> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('adjust_account_balance', {
      p_account_id: id,
      p_new_balance: newBalance,
      p_reason: reason,
    });
    if (error) throw toDataError(error);
    return Number(data);
  },

  async getBalance(id: string): Promise<number> {
    const supabase = createClient();
    const { data, error } = await supabase.from('accounts').select('balance').eq('id', id).single();
    if (error) throw toDataError(error);
    return Number(data.balance);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('accounts').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────────

function currencyFieldsFromRow(r: any): TransactionCurrencyFields {
  return {
    currencyCode: r.currency_code,
    originalAmount: Number(r.original_amount),
    baseCurrencyCode: r.base_currency_code,
    baseAmount: Number(r.base_amount),
    exchangeRate: Number(r.exchange_rate),
    exchangeRateDate: r.exchange_rate_date,
  };
}

export const transactionsService = {
  async getAll(): Promise<Transaction[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      categoryIcon: r.category_icon,
      account: r.account_name,
      accountId: r.account_id || '',
      amount: r.amount,
      date: r.transaction_date,
      time: r.transaction_time,
      type: r.transaction_type,
      notes: r.notes || '',
      transferId: r.transfer_id || undefined,
      transferLeg: r.transfer_leg || undefined,
      ...currencyFieldsFromRow(r),
    }));
  },

  // Every new transaction must carry its currency fields (see buildCurrencyFields);
  // the database defaults (PEN / 0) would silently corrupt multi-currency reports.
  async create(tx: Omit<Transaction, 'id'> & TransactionCurrencyFields): Promise<Transaction> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: tx.accountId || null,
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
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      categoryIcon: data.category_icon,
      account: data.account_name,
      accountId: data.account_id || '',
      amount: data.amount,
      date: data.transaction_date,
      time: data.transaction_time,
      type: data.transaction_type,
      notes: data.notes,
      ...currencyFieldsFromRow(data),
    };
  },

  // When `amount`, `type` or the account change, pass the recomputed currency fields too.
  async update(id: string, tx: Partial<Transaction>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (tx.name !== undefined) updates.name = tx.name;
    if (tx.category !== undefined) updates.category = tx.category;
    if (tx.categoryIcon !== undefined) updates.category_icon = tx.categoryIcon;
    if (tx.account !== undefined) updates.account_name = tx.account;
    if (tx.accountId !== undefined) updates.account_id = tx.accountId || null;
    if (tx.amount !== undefined) updates.amount = tx.amount;
    if (tx.date !== undefined) updates.transaction_date = tx.date;
    if (tx.time !== undefined) updates.transaction_time = tx.time;
    if (tx.type !== undefined) updates.transaction_type = tx.type;
    if (tx.notes !== undefined) updates.notes = tx.notes;
    if (tx.currencyCode !== undefined) updates.currency_code = tx.currencyCode;
    if (tx.originalAmount !== undefined) updates.original_amount = tx.originalAmount;
    if (tx.baseCurrencyCode !== undefined) updates.base_currency_code = tx.baseCurrencyCode;
    if (tx.baseAmount !== undefined) updates.base_amount = tx.baseAmount;
    if (tx.exchangeRate !== undefined) updates.exchange_rate = tx.exchangeRate;
    if (tx.exchangeRateDate !== undefined) updates.exchange_rate_date = tx.exchangeRateDate;
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('transactions').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Transfers ────────────────────────────────────────────────────────────────

// A transfer moves money between two of the user's accounts. The database creates,
// updates and deletes its two legs (transactions) atomically and moves both balances.
export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number; // > 0, in the origin account's currency
  toAmount: number; // > 0, in the destination account's currency
  baseAmount: number; // > 0, value in the user's base currency
  date: string; // ISO timestamp
  name: string;
  notes: string;
}

function transferRpcArgs(t: TransferInput) {
  return {
    p_from_account_id: t.fromAccountId,
    p_to_account_id: t.toAccountId,
    p_from_amount: t.fromAmount,
    p_to_amount: t.toAmount,
    p_base_amount: t.baseAmount,
    p_transfer_date: t.date,
    p_name: t.name,
    p_notes: t.notes,
  };
}

export const transfersService = {
  async get(id: string): Promise<Transfer> {
    const supabase = createClient();
    const { data, error } = await supabase.from('transfers').select('*').eq('id', id).single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      fromAccountId: data.from_account_id,
      toAccountId: data.to_account_id,
      fromAmount: Number(data.from_amount),
      fromCurrency: data.from_currency,
      toAmount: Number(data.to_amount),
      toCurrency: data.to_currency,
      baseCurrencyCode: data.base_currency_code,
      baseAmount: Number(data.base_amount),
      date: data.transfer_date,
      name: data.name,
      notes: data.notes,
    };
  },

  async create(t: TransferInput): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_transfer', transferRpcArgs(t));
    if (error) throw toDataError(error);
    return data as string;
  },

  async update(id: string, t: TransferInput): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.rpc('update_transfer', {
      p_transfer_id: id,
      ...transferRpcArgs(t),
    });
    if (error) throw toDataError(error);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_transfer', { p_transfer_id: id });
    if (error) throw toDataError(error);
  },
};

// ─── Budget Categories ─────────────────────────────────────────────────────────

export const budgetService = {
  async getAll(): Promise<BudgetCategory[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('budget_categories')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      budget: r.budget,
      color: r.color,
      bgColor: r.bg_color,
    }));
  },

  async create(cat: Omit<BudgetCategory, 'id'>): Promise<BudgetCategory> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('budget_categories')
      .insert({
        user_id: userId,
        name: cat.name,
        icon: cat.icon,
        budget: cat.budget,
        color: cat.color,
        bg_color: cat.bgColor,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      budget: data.budget,
      color: data.color,
      bgColor: data.bg_color,
    };
  },

  async update(id: string, cat: Partial<BudgetCategory>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (cat.name !== undefined) updates.name = cat.name;
    if (cat.icon !== undefined) updates.icon = cat.icon;
    if (cat.budget !== undefined) updates.budget = cat.budget;
    if (cat.color !== undefined) updates.color = cat.color;
    if (cat.bgColor !== undefined) updates.bg_color = cat.bgColor;
    const { data, error } = await supabase
      .from('budget_categories')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('budget_categories')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Savings Goals ─────────────────────────────────────────────────────────────

export const savingsService = {
  async getAll(): Promise<SavingsGoal[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      current: r.current_amount,
      target: r.target_amount,
      color: r.color,
      targetDate: r.target_date,
    }));
  },

  async create(goal: Omit<SavingsGoal, 'id'>): Promise<SavingsGoal> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        user_id: userId,
        name: goal.name,
        icon: goal.icon,
        current_amount: goal.current,
        target_amount: goal.target,
        color: goal.color,
        target_date: goal.targetDate,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      current: data.current_amount,
      target: data.target_amount,
      color: data.color,
      targetDate: data.target_date,
    };
  },

  async update(id: string, goal: Partial<SavingsGoal>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (goal.name !== undefined) updates.name = goal.name;
    if (goal.icon !== undefined) updates.icon = goal.icon;
    if (goal.current !== undefined) updates.current_amount = goal.current;
    if (goal.target !== undefined) updates.target_amount = goal.target;
    if (goal.color !== undefined) updates.color = goal.color;
    if (goal.targetDate !== undefined) updates.target_date = goal.targetDate;
    const { data, error } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('savings_goals').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Debts ─────────────────────────────────────────────────────────────────────

export const debtsService = {
  async getAll(): Promise<Debt[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      institution: r.institution,
      icon: r.icon,
      balance: r.balance,
      limit: r.credit_limit,
      monthlyPayment: r.monthly_payment,
      dueDate: r.due_date,
      type: r.debt_type,
      color: r.color,
      interestRate: r.interest_rate,
    }));
  },

  async create(debt: Omit<Debt, 'id'>): Promise<Debt> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('debts')
      .insert({
        user_id: userId,
        name: debt.name,
        institution: debt.institution,
        icon: debt.icon,
        balance: debt.balance,
        credit_limit: debt.limit,
        monthly_payment: debt.monthlyPayment,
        due_date: debt.dueDate,
        debt_type: debt.type,
        color: debt.color,
        interest_rate: debt.interestRate,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      name: data.name,
      institution: data.institution,
      icon: data.icon,
      balance: data.balance,
      limit: data.credit_limit,
      monthlyPayment: data.monthly_payment,
      dueDate: data.due_date,
      type: data.debt_type,
      color: data.color,
      interestRate: data.interest_rate,
    };
  },

  async update(id: string, debt: Partial<Debt>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (debt.name !== undefined) updates.name = debt.name;
    if (debt.institution !== undefined) updates.institution = debt.institution;
    if (debt.icon !== undefined) updates.icon = debt.icon;
    if (debt.balance !== undefined) updates.balance = debt.balance;
    if (debt.limit !== undefined) updates.credit_limit = debt.limit;
    if (debt.monthlyPayment !== undefined) updates.monthly_payment = debt.monthlyPayment;
    if (debt.dueDate !== undefined) updates.due_date = debt.dueDate;
    if (debt.type !== undefined) updates.debt_type = debt.type;
    if (debt.color !== undefined) updates.color = debt.color;
    if (debt.interestRate !== undefined) updates.interest_rate = debt.interestRate;
    const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('debts').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Investments ───────────────────────────────────────────────────────────────

export const investmentsService = {
  async getAll(): Promise<Investment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      ticker: r.ticker,
      type: r.investment_type,
      shares: r.shares,
      price: r.price,
      cost: r.cost,
      icon: r.icon,
      color: r.color,
    }));
  },

  async create(inv: Omit<Investment, 'id'>): Promise<Investment> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('investments')
      .insert({
        user_id: userId,
        name: inv.name,
        ticker: inv.ticker,
        investment_type: inv.type,
        shares: inv.shares,
        price: inv.price,
        cost: inv.cost,
        icon: inv.icon,
        color: inv.color,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      name: data.name,
      ticker: data.ticker,
      type: data.investment_type,
      shares: data.shares,
      price: data.price,
      cost: data.cost,
      icon: data.icon,
      color: data.color,
    };
  },

  async update(id: string, inv: Partial<Investment>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (inv.name !== undefined) updates.name = inv.name;
    if (inv.ticker !== undefined) updates.ticker = inv.ticker;
    if (inv.type !== undefined) updates.investment_type = inv.type;
    if (inv.shares !== undefined) updates.shares = inv.shares;
    if (inv.price !== undefined) updates.price = inv.price;
    if (inv.cost !== undefined) updates.cost = inv.cost;
    if (inv.icon !== undefined) updates.icon = inv.icon;
    if (inv.color !== undefined) updates.color = inv.color;
    const { data, error } = await supabase
      .from('investments')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('investments').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Subscriptions ─────────────────────────────────────────────────────────────

// Shifts a YYYY-MM-DD date by `months`, using `paymentDay` clamped to the target
// month's last day (e.g. day 31 → 30 Nov, 28/29 Feb).
export function addMonthKeepingDay(dateStr: string, paymentDay: number, months: number): string {
  const base = new Date(dateStr + 'T00:00:00');
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(paymentDay || base.getDate(), lastDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(day)}`;
}

export const subscriptionsService = {
  async getAll(): Promise<Subscription[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      amount: r.amount,
      nextDate: r.next_date,
      nextPaymentDate: r.next_payment_date ?? null,
      paymentDay: r.payment_day ?? 1,
      paymentStatus: (r.payment_status as 'pending' | 'paid' | 'overdue') ?? 'pending',
      active: r.active,
      icon: r.icon,
      color: r.color,
    }));
  },

  async create(sub: Omit<Subscription, 'id'>): Promise<Subscription> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        name: sub.name,
        category: sub.category,
        amount: sub.amount,
        next_date: sub.nextDate,
        next_payment_date: sub.nextPaymentDate,
        payment_day: sub.paymentDay,
        payment_status: sub.paymentStatus,
        active: sub.active,
        icon: sub.icon,
        color: sub.color,
      })
      .select()
      .single();
    if (error) throw toDataError(error);
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      amount: data.amount,
      nextDate: data.next_date,
      nextPaymentDate: data.next_payment_date ?? null,
      paymentDay: data.payment_day ?? 1,
      paymentStatus: (data.payment_status as 'pending' | 'paid' | 'overdue') ?? 'pending',
      active: data.active,
      icon: data.icon,
      color: data.color,
    };
  },

  async update(id: string, sub: Partial<Subscription>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (sub.name !== undefined) updates.name = sub.name;
    if (sub.category !== undefined) updates.category = sub.category;
    if (sub.amount !== undefined) updates.amount = sub.amount;
    if (sub.nextDate !== undefined) updates.next_date = sub.nextDate;
    if (sub.nextPaymentDate !== undefined) updates.next_payment_date = sub.nextPaymentDate;
    if (sub.paymentDay !== undefined) updates.payment_day = sub.paymentDay;
    if (sub.paymentStatus !== undefined) updates.payment_status = sub.paymentStatus;
    if (sub.active !== undefined) updates.active = sub.active;
    if (sub.icon !== undefined) updates.icon = sub.icon;
    if (sub.color !== undefined) updates.color = sub.color;
    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  // Records the payment as an expense ("gasto") and advances next_payment_date
  // by one month from the current due date, keeping the same payment day.
  // Pays the current cycle from `account`: records the expense of `debitAmount` (in the
  // account's currency; the database debits the balance), marks the subscription
  // as paid and advances next_payment_date one month, keeping the payment day.
  // Subscriptions are priced in PEN; `fx` records the historical rate to the base currency.
  async markAsPaid(
    sub: Subscription,
    account: Account,
    debitAmount: number,
    fx: FxContext
  ): Promise<{ nextPaymentDate: string; newBalance: number; transaction: Transaction }> {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nextDateStr = addMonthKeepingDay(sub.nextPaymentDate ?? todayStr, sub.paymentDay, 1);
    const amount = Math.abs(debitAmount);

    const transaction = await transactionsService.create({
      name: sub.name,
      type: 'gasto',
      amount: -amount,
      category: 'Suscripciones',
      categoryIcon: sub.icon || '📱',
      accountId: account.id,
      account: account.name,
      notes: `Pago de suscripción${sub.nextPaymentDate ? ` (vencimiento ${sub.nextPaymentDate})` : ''}`,
      date: new Date(todayStr + 'T12:00:00').toISOString(),
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      ...buildCurrencyFields({
        amount: -amount,
        currency: account.currency || 'PEN',
        baseCurrency: fx.baseCurrency,
        rateToBase: getRateFromMap(fx.ratesMap, 'PEN', fx.baseCurrency),
        date: todayStr,
        original: { amount: -Math.abs(sub.amount), currency: 'PEN' },
      }),
    });

    // The database engine debits the account when the expense is recorded.
    const newBalance = await accountsService.getBalance(account.id);

    await subscriptionsService.update(sub.id, {
      paymentStatus: 'paid',
      nextPaymentDate: nextDateStr,
      nextDate: nextDateStr,
    });
    return { nextPaymentDate: nextDateStr, newBalance, transaction };
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('subscriptions').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Load all finance data ─────────────────────────────────────────────────────

export async function loadFinanceData(): Promise<FinanceData> {
  const [
    accounts,
    transactions,
    budgetCategories,
    savingsGoals,
    debts,
    investments,
    subscriptions,
  ] = await Promise.all([
    accountsService.getAll(),
    transactionsService.getAll(),
    budgetService.getAll(),
    savingsService.getAll(),
    debtsService.getAll(),
    investmentsService.getAll(),
    subscriptionsService.getAll(),
  ]);
  return {
    accounts,
    transactions,
    budgetCategories,
    savingsGoals,
    debts,
    investments,
    subscriptions,
  };
}

export { SavingsGoal };
export { Account };
export { Debt };
export { Investment };
export { Transaction };
export { BudgetCategory };
export { Subscription };
