'use client';

import { createClient } from '@/lib/supabase/client';
import { assertAffected, authRequired, toDataError } from '@/lib/dataError';
import type {
  Account, Transaction, BudgetCategory, SavingsGoal,
  Debt, Investment, Subscription, FinanceData
} from './financeStore';

// Every function below either resolves with real data or throws a DataError.
// An empty array always means "no rows", never "the request failed".

async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
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
    return (data || []).map(r => ({
      id: r.id, name: r.name, type: r.account_type,
      institution: r.institution, balance: r.balance,
      currency: r.currency, icon: r.icon, color: r.color, bgColor: r.bg_color,
    }));
  },

  async create(account: Omit<Account, 'id'>): Promise<Account> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId, name: account.name, account_type: account.type,
        institution: account.institution, balance: account.balance,
        currency: account.currency, icon: account.icon,
        color: account.color, bg_color: account.bgColor,
      })
      .select().single();
    if (error) throw toDataError(error);
    return { id: data.id, name: data.name, type: data.account_type, institution: data.institution, balance: data.balance, currency: data.currency, icon: data.icon, color: data.color, bgColor: data.bg_color };
  },

  async update(id: string, account: Partial<Account>): Promise<void> {
    const supabase = createClient();
    const updates: any = {};
    if (account.name !== undefined) updates.name = account.name;
    if (account.type !== undefined) updates.account_type = account.type;
    if (account.institution !== undefined) updates.institution = account.institution;
    if (account.balance !== undefined) updates.balance = account.balance;
    if (account.currency !== undefined) updates.currency = account.currency;
    if (account.icon !== undefined) updates.icon = account.icon;
    if (account.color !== undefined) updates.color = account.color;
    if (account.bgColor !== undefined) updates.bg_color = account.bgColor;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('accounts').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactionsService = {
  async getAll(): Promise<Transaction[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({
      id: r.id, name: r.name, category: r.category, categoryIcon: r.category_icon,
      account: r.account_name, accountId: r.account_id || '',
      amount: r.amount, date: r.transaction_date, time: r.transaction_time,
      type: r.transaction_type, notes: r.notes || '',
    }));
  },

  async create(tx: Omit<Transaction, 'id'>): Promise<Transaction> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId, account_id: tx.accountId || null,
        name: tx.name, category: tx.category, category_icon: tx.categoryIcon,
        account_name: tx.account, amount: tx.amount,
        transaction_date: tx.date, transaction_time: tx.time,
        transaction_type: tx.type, notes: tx.notes || '',
      })
      .select().single();
    if (error) throw toDataError(error);
    return { id: data.id, name: data.name, category: data.category, categoryIcon: data.category_icon, account: data.account_name, accountId: data.account_id || '', amount: data.amount, date: data.transaction_date, time: data.transaction_time, type: data.transaction_type, notes: data.notes };
  },

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
    const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select('id');
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

// ─── Budget Categories ─────────────────────────────────────────────────────────

export const budgetService = {
  async getAll(): Promise<BudgetCategory[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('budget_categories').select('*').order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({ id: r.id, name: r.name, icon: r.icon, budget: r.budget, color: r.color, bgColor: r.bg_color }));
  },

  async create(cat: Omit<BudgetCategory, 'id'>): Promise<BudgetCategory> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase.from('budget_categories').insert({ user_id: userId, name: cat.name, icon: cat.icon, budget: cat.budget, color: cat.color, bg_color: cat.bgColor }).select().single();
    if (error) throw toDataError(error);
    return { id: data.id, name: data.name, icon: data.icon, budget: data.budget, color: data.color, bgColor: data.bg_color };
  },

  async update(id: string, cat: Partial<BudgetCategory>): Promise<void> {
    const supabase = createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (cat.name !== undefined) updates.name = cat.name;
    if (cat.icon !== undefined) updates.icon = cat.icon;
    if (cat.budget !== undefined) updates.budget = cat.budget;
    if (cat.color !== undefined) updates.color = cat.color;
    if (cat.bgColor !== undefined) updates.bg_color = cat.bgColor;
    const { data, error } = await supabase.from('budget_categories').update(updates).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from('budget_categories').delete().eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Savings Goals ─────────────────────────────────────────────────────────────

export const savingsService = {
  async getAll(): Promise<SavingsGoal[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('savings_goals').select('*').order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({ id: r.id, name: r.name, icon: r.icon, current: r.current_amount, target: r.target_amount, color: r.color, targetDate: r.target_date }));
  },

  async create(goal: Omit<SavingsGoal, 'id'>): Promise<SavingsGoal> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase.from('savings_goals').insert({ user_id: userId, name: goal.name, icon: goal.icon, current_amount: goal.current, target_amount: goal.target, color: goal.color, target_date: goal.targetDate }).select().single();
    if (error) throw toDataError(error);
    return { id: data.id, name: data.name, icon: data.icon, current: data.current_amount, target: data.target_amount, color: data.color, targetDate: data.target_date };
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
    const { data, error } = await supabase.from('savings_goals').update(updates).eq('id', id).select('id');
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
    const { data, error } = await supabase.from('debts').select('*').order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({ id: r.id, name: r.name, institution: r.institution, icon: r.icon, balance: r.balance, limit: r.credit_limit, monthlyPayment: r.monthly_payment, dueDate: r.due_date, type: r.debt_type, color: r.color, interestRate: r.interest_rate }));
  },

  async create(debt: Omit<Debt, 'id'>): Promise<Debt> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase.from('debts').insert({ user_id: userId, name: debt.name, institution: debt.institution, icon: debt.icon, balance: debt.balance, credit_limit: debt.limit, monthly_payment: debt.monthlyPayment, due_date: debt.dueDate, debt_type: debt.type, color: debt.color, interest_rate: debt.interestRate }).select().single();
    if (error) throw toDataError(error);
    return { id: data.id, name: data.name, institution: data.institution, icon: data.icon, balance: data.balance, limit: data.credit_limit, monthlyPayment: data.monthly_payment, dueDate: data.due_date, type: data.debt_type, color: data.color, interestRate: data.interest_rate };
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
    const { data, error } = await supabase.from('investments').select('*').order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({ id: r.id, name: r.name, ticker: r.ticker, type: r.investment_type, shares: r.shares, price: r.price, cost: r.cost, icon: r.icon, color: r.color }));
  },

  async create(inv: Omit<Investment, 'id'>): Promise<Investment> {
    const supabase = createClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase.from('investments').insert({ user_id: userId, name: inv.name, ticker: inv.ticker, investment_type: inv.type, shares: inv.shares, price: inv.price, cost: inv.cost, icon: inv.icon, color: inv.color }).select().single();
    if (error) throw toDataError(error);
    return { id: data.id, name: data.name, ticker: data.ticker, type: data.investment_type, shares: data.shares, price: data.price, cost: data.cost, icon: data.icon, color: data.color };
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
    const { data, error } = await supabase.from('investments').update(updates).eq('id', id).select('id');
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

export const subscriptionsService = {
  async getAll(): Promise<Subscription[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: true });
    if (error) throw toDataError(error);
    return (data || []).map(r => ({
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
    const { data, error } = await supabase.from('subscriptions').insert({
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
    }).select().single();
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
    const { data, error } = await supabase.from('subscriptions').update(updates).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },

  async markAsPaid(id: string, paymentDay: number): Promise<string> {
    // Advance next_payment_date by one month keeping the same day
    const today = new Date();
    const next = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
    const nextDateStr = next.toISOString().split('T')[0];
    await subscriptionsService.update(id, {
      paymentStatus: 'pending',
      nextPaymentDate: nextDateStr,
    });
    return nextDateStr;
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
  const [accounts, transactions, budgetCategories, savingsGoals, debts, investments, subscriptions] = await Promise.all([
    accountsService.getAll(),
    transactionsService.getAll(),
    budgetService.getAll(),
    savingsService.getAll(),
    debtsService.getAll(),
    investmentsService.getAll(),
    subscriptionsService.getAll(),
  ]);
  return { accounts, transactions, budgetCategories, savingsGoals, debts, investments, subscriptions };
}

export { SavingsGoal };
export { Account };
export { Debt };
export { Investment };
export { Transaction };
export { BudgetCategory };
export { Subscription };
