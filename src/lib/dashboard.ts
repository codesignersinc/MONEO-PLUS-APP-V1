// Home (dashboard) figures derived from the user's real data. Pure functions: no fetching,
// no writes, no invented numbers. Amounts are always in the user's base currency:
// a movement uses its stored base_amount (rate fixed when it was saved) and only legacy
// rows without it are converted with the user's own rates.

import type { BudgetCategory, SavingsGoal, Subscription, Transaction } from '@/lib/financeStore';
import type { PagoEntry } from '@/lib/supabaseObligations';
import { getRateFromMap } from '@/lib/currency';
import { monthNames } from '@/lib/format';

export type PeriodKind = 'mes' | 'trimestre' | 'anio' | 'custom';

export interface Period {
  kind: PeriodKind;
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
  prevFrom: string;
  prevTo: string;
  // "del mes" / "del período"
  noun: string;
  // "vs. septiembre" / "vs. período anterior"
  compareLabel: string;
}

export const MONTH_NAMES = monthNames('long');
export const MONTHS_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const daysBetween = (a: string, b: string) =>
  Math.round((parse(b).getTime() - parse(a).getTime()) / 86400e3);

export function buildPeriod(
  kind: PeriodKind,
  now: Date,
  custom?: { from: string; to: string }
): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (kind === 'mes') {
    const prev = new Date(y, m - 1, 1);
    return {
      kind,
      from: ymd(new Date(y, m, 1)),
      to: ymd(new Date(y, m + 1, 0)),
      prevFrom: ymd(prev),
      prevTo: ymd(new Date(y, m, 0)),
      noun: 'del mes',
      compareLabel: `vs. ${MONTH_NAMES[prev.getMonth()]}`,
    };
  }
  if (kind === 'trimestre') {
    return {
      kind,
      from: ymd(new Date(y, m - 2, 1)),
      to: ymd(new Date(y, m + 1, 0)),
      prevFrom: ymd(new Date(y, m - 5, 1)),
      prevTo: ymd(new Date(y, m - 2, 0)),
      noun: 'del período',
      compareLabel: 'vs. 3 meses anteriores',
    };
  }
  if (kind === 'anio') {
    return {
      kind,
      from: `${y}-01-01`,
      to: `${y}-12-31`,
      prevFrom: `${y - 1}-01-01`,
      prevTo: `${y - 1}-12-31`,
      noun: 'del año',
      compareLabel: `vs. ${y - 1}`,
    };
  }
  let from = custom?.from || ymd(new Date(y, m, 1));
  let to = custom?.to || ymd(now);
  if (from > to) [from, to] = [to, from];
  const len = daysBetween(from, to) + 1;
  return {
    kind,
    from,
    to,
    prevFrom: addDays(from, -len),
    prevTo: addDays(from, -1),
    noun: 'del período',
    compareLabel: 'vs. período anterior',
  };
}

// Local calendar day of a movement (transaction_date is a timestamptz).
export function txDay(t: Pick<Transaction, 'date'>): string {
  const d = new Date(t.date);
  return Number.isNaN(d.getTime()) ? t.date.slice(0, 10) : ymd(d);
}

export function inRange(t: Pick<Transaction, 'date'>, from: string, to: string): boolean {
  const d = txDay(t);
  return d >= from && d <= to;
}

// Positive amount of a movement in the base currency.
export function baseValue(
  t: Pick<Transaction, 'amount' | 'baseAmount' | 'baseCurrencyCode' | 'currencyCode'>,
  base: string,
  rates: Record<string, number>
): number {
  if (t.baseAmount != null && t.baseCurrencyCode === base) return Math.abs(t.baseAmount);
  const currency = t.currencyCode || 'PEN';
  return Math.abs(t.amount) * getRateFromMap(rates, currency, base);
}

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

// Income and expenses of a period; transfers move money between the user's own accounts
// and are neither.
export function periodTotals(
  txs: Transaction[],
  from: string,
  to: string,
  base: string,
  rates: Record<string, number>
): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!inRange(t, from, to)) continue;
    if (t.type === 'ingreso') income += baseValue(t, base, rates);
    else if (t.type === 'gasto') expense += baseValue(t, base, rates);
  }
  return { income, expense, balance: income - expense };
}

export interface CategorySpend {
  category: string;
  icon: string;
  amount: number;
  pct: number; // share of the period's expenses, 0–100
}

// Top categories of the period (+ "Otros" with the rest), largest first.
export function categoryBreakdown(
  txs: Transaction[],
  from: string,
  to: string,
  base: string,
  rates: Record<string, number>,
  top = 5
): CategorySpend[] {
  const map = new Map<string, { icon: string; amount: number }>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== 'gasto' || !inRange(t, from, to)) continue;
    const v = baseValue(t, base, rates);
    total += v;
    const key = t.category || 'Otros';
    const cur = map.get(key) ?? { icon: t.categoryIcon, amount: 0 };
    cur.amount += v;
    map.set(key, cur);
  }
  if (total <= 0) return [];
  const sorted = [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  const head = sorted.slice(0, top);
  const restAmount = sorted.slice(top).reduce((s, [, v]) => s + v.amount, 0);
  const rows = head.map(([category, v]) => ({
    category,
    icon: v.icon,
    amount: v.amount,
    pct: (v.amount / total) * 100,
  }));
  if (restAmount > 0) {
    rows.push({ category: 'Otros', icon: '', amount: restAmount, pct: (restAmount / total) * 100 });
  }
  return rows;
}

export interface BudgetRow {
  id: string;
  name: string;
  icon: string;
  spent: number;
  budget: number;
  pct: number;
}

// Same rule as the Presupuesto page: expenses of the month whose category is the budget's.
export function budgetProgress(
  budgets: BudgetCategory[],
  txs: Transaction[],
  monthFrom: string,
  monthTo: string,
  base: string,
  rates: Record<string, number>
): BudgetRow[] {
  return budgets.map((b) => {
    const spent = txs
      .filter((t) => t.type === 'gasto' && t.category === b.name && inRange(t, monthFrom, monthTo))
      .reduce((s, t) => s + baseValue(t, base, rates), 0);
    return {
      id: b.id,
      name: b.name,
      icon: b.icon,
      spent,
      budget: b.budget,
      pct: b.budget > 0 ? Math.round((spent / b.budget) * 100) : 0,
    };
  });
}

export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  kind: 'pago' | 'suscripcion';
  overdue: boolean;
}

// Pending payments and active subscriptions, soonest first (overdue included).
export function upcomingPayments(
  pagos: PagoEntry[],
  subs: Subscription[],
  today: string
): UpcomingPayment[] {
  const rows: UpcomingPayment[] = [];
  for (const p of pagos) {
    if (p.status === 'pagado' || !p.paymentDate) continue;
    const date = p.paymentDate.slice(0, 10);
    rows.push({
      id: `p-${p.id}`,
      name: p.name,
      amount: Math.abs(p.amount),
      date,
      kind: 'pago',
      overdue: p.status === 'vencido' || date < today,
    });
  }
  for (const s of subs) {
    if (!s.active) continue;
    const date = (s.nextPaymentDate || s.nextDate || '').slice(0, 10);
    if (!date) continue;
    rows.push({
      id: `s-${s.id}`,
      name: s.name,
      amount: Math.abs(s.amount),
      date,
      kind: 'suscripcion',
      overdue: s.paymentStatus === 'overdue',
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// Main goal: the first goal not reached yet (else the first one).
export function mainGoal(goals: SavingsGoal[]): SavingsGoal | null {
  return goals.find((g) => g.target > 0 && g.current < g.target) ?? goals[0] ?? null;
}

// Percent change, or null when there is nothing to compare with.
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface Insight {
  tone: 'alert' | 'good' | 'info';
  text: string;
}

// Deterministic insight from the user's own numbers (no AI, no financial advice).
export function spendingInsight(
  current: CategorySpend[],
  previous: CategorySpend[],
  totals: { expense: number; prevExpense: number },
  noun: string,
  fmt: (n: number) => string
): Insight | null {
  const prev = new Map(previous.map((c) => [c.category, c.amount]));
  let best: { cat: string; pct: number; diff: number } | null = null;
  for (const c of current) {
    if (c.category === 'Otros') continue;
    const before = prev.get(c.category) ?? 0;
    const diff = c.amount - before;
    if (before < 20 || diff < 20) continue;
    const pct = Math.round((diff / before) * 100);
    if (pct >= 10 && (!best || diff > best.diff)) best = { cat: c.category, pct, diff };
  }
  const when =
    noun === 'del mes' ? 'este mes' : noun === 'del año' ? 'este año' : 'en este período';
  if (best) {
    return {
      tone: 'alert',
      text: `Gastaste ${best.pct}% más en ${best.cat.toLowerCase()} ${when}. Si vuelves a tu ritmo anterior, ahorrarías ${fmt(best.diff)}.`,
    };
  }
  const change = pctChange(totals.expense, totals.prevExpense);
  if (change !== null && change <= -5) {
    return {
      tone: 'good',
      text: `¡Bien! Gastaste ${Math.abs(change)}% menos que el período anterior: ${fmt(totals.prevExpense - totals.expense)} que quedan para ti.`,
    };
  }
  if (current.length > 0) {
    const top = current[0];
    return {
      tone: 'info',
      text: `Tu mayor gasto ${when} es ${top.category.toLowerCase()}: ${Math.round(top.pct)}% de lo que gastaste.`,
    };
  }
  return null;
}
