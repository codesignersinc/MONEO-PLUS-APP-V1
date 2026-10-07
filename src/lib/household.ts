// MONEO HOGAR: pure calculations (no data access). Amounts are in the household currency
// (`baseAmount` of each expense); percentages have up to 3 decimals and always add up to
// exactly 100; money is rounded to cents and the last share takes the rounding.

export type SplitMethod = 'equal' | 'income' | 'custom';
export type MemberRole = 'owner' | 'member';
export type MemberStatus = 'active' | 'left' | 'removed';
export type Responsibility = 'shared' | 'member';
export type Frequency = 'weekly' | 'monthly' | 'yearly';
export type SettlementStatus = 'proposed' | 'deferred' | 'waived' | 'settled';

export interface Household {
  id: string;
  name: string;
  subtitle: string;
  baseCurrency: string;
  splitMethod: SplitMethod;
  emergencyMonths: number;
}

export interface HouseholdMember {
  id: string;
  userId: string | null;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
  declaredIncome: number | null;
  customPct: number | null;
  joinedAt: string;
}

export interface ExpenseSplit {
  memberId: string;
  percentage: number;
  amount: number;
}

export interface HouseholdExpense {
  id: string;
  createdBy: string | null;
  paidBy: string;
  transactionId: string | null;
  name: string;
  category: string;
  amount: number;
  currencyCode: string;
  baseAmount: number;
  exchangeRate: number;
  expenseDate: string; // YYYY-MM-DD
  responsibility: Responsibility;
  isRecurring: boolean;
  frequency: Frequency | null;
  nextDate: string | null;
  notes: string;
  splits: ExpenseSplit[];
}

export interface HouseholdSettlement {
  id: string;
  period: string; // YYYY-MM-01
  fromMember: string;
  toMember: string;
  amount: number;
  status: SettlementStatus;
  createdBy: string | null;
  paidAt: string | null;
  receivedAt: string | null;
}

export interface Share {
  memberId: string;
  percentage: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Scales `weights` to percentages that add up to exactly 100 (the last one takes the
// rounding). Null when the weights add up to 0.
export function toPercentages(weights: { memberId: string; weight: number }[]): Share[] | null {
  const total = weights.reduce((s, w) => s + Math.max(0, w.weight), 0);
  if (!(total > 0)) return null;
  let assigned = 0;
  return weights.map((w, i) => {
    const pct =
      i === weights.length - 1
        ? round3(100 - assigned)
        : round3((Math.max(0, w.weight) / total) * 100);
    assigned = round3(assigned + pct);
    return { memberId: w.memberId, percentage: pct };
  });
}

export type ShareResult =
  | { ok: true; shares: Share[] }
  | { ok: false; reason: 'no-members' | 'missing-income' | 'custom-not-100' };

// The household's default split for a shared expense, from its chosen method.
//   equal: the same for everyone. income: proportional to the incomes each member
//   declared (all must have declared one). custom: the percentages the owner set (must
//   add up to 100).
export function householdShares(method: SplitMethod, members: HouseholdMember[]): ShareResult {
  const active = members.filter((m) => m.status === 'active');
  if (active.length === 0) return { ok: false, reason: 'no-members' };
  if (method === 'income') {
    if (active.some((m) => m.declaredIncome === null || m.declaredIncome <= 0)) {
      return { ok: false, reason: 'missing-income' };
    }
    const shares = toPercentages(
      active.map((m) => ({ memberId: m.id, weight: m.declaredIncome ?? 0 }))
    );
    return shares ? { ok: true, shares } : { ok: false, reason: 'missing-income' };
  }
  if (method === 'custom') {
    const sum = active.reduce((s, m) => s + (m.customPct ?? 0), 0);
    if (Math.abs(sum - 100) > 0.01) return { ok: false, reason: 'custom-not-100' };
    return {
      ok: true,
      shares: active.map((m) => ({ memberId: m.id, percentage: m.customPct ?? 0 })),
    };
  }
  const shares = toPercentages(active.map((m) => ({ memberId: m.id, weight: 1 })));
  return shares ? { ok: true, shares } : { ok: false, reason: 'no-members' };
}

// Money per share, as the database computes it (the last share takes the cents).
export function splitAmount(total: number, shares: Share[]): ExpenseSplit[] {
  let assigned = 0;
  return shares.map((s, i) => {
    const amount =
      i === shares.length - 1 ? round2(total - assigned) : round2((total * s.percentage) / 100);
    assigned = round2(assigned + amount);
    return { memberId: s.memberId, percentage: s.percentage, amount };
  });
}

// "70/30" for two members, from the first member's percentage.
export function twoWayShares(first: string, second: string, firstPct: number): Share[] {
  const a = round3(Math.min(100, Math.max(0, firstPct)));
  return [
    { memberId: first, percentage: a },
    { memberId: second, percentage: round3(100 - a) },
  ].filter((s) => s.percentage > 0);
}

// ---------- Months ----------

// "2026-10" for a YYYY-MM-DD date.
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function inMonth(expenses: HouseholdExpense[], key: string): HouseholdExpense[] {
  return expenses.filter((e) => monthKey(e.expenseDate) === key);
}

// ---------- Categories ----------

// Household view: food at home and eating out are shown together as "Alimentación".
export function householdCategory(category: string): string {
  return /^(comida|supermercado|alimentaci[oó]n)$/i.test(category.trim())
    ? 'Alimentación'
    : category.trim();
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export function categoryTotals(expenses: HouseholdExpense[]): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const c = householdCategory(e.category);
    map.set(c, round2((map.get(c) ?? 0) + e.baseAmount));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// ---------- Monthly summary and settlement ----------

export interface MemberMonth {
  memberId: string;
  paid: number; // what they really paid
  paidPct: number; // share of the total paid (0–100)
  responsibility: number; // what the agreed split assigns them
  balance: number; // paid − responsibility (> 0: paid more than agreed)
}

export interface MonthSummary {
  total: number;
  members: MemberMonth[];
}

export function monthSummary(
  expenses: HouseholdExpense[],
  members: HouseholdMember[]
): MonthSummary {
  const total = round2(expenses.reduce((s, e) => s + e.baseAmount, 0));
  const paid = new Map<string, number>();
  const resp = new Map<string, number>();
  for (const e of expenses) {
    paid.set(e.paidBy, round2((paid.get(e.paidBy) ?? 0) + e.baseAmount));
    for (const s of e.splits) resp.set(s.memberId, round2((resp.get(s.memberId) ?? 0) + s.amount));
  }
  // Active members first, then anyone who left but still appears this month.
  const ids = [
    ...members.filter((m) => m.status === 'active').map((m) => m.id),
    ...members
      .filter((m) => m.status !== 'active' && (paid.has(m.id) || resp.has(m.id)))
      .map((m) => m.id),
  ];
  return {
    total,
    members: ids.map((id) => {
      const p = paid.get(id) ?? 0;
      const r = resp.get(id) ?? 0;
      return {
        memberId: id,
        paid: p,
        paidPct: total > 0 ? Math.round((p / total) * 1000) / 10 : 0,
        responsibility: r,
        balance: round2(p - r),
      };
    }),
  };
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

// Fewest payments that leave everybody even (who owes pays who paid more). Already
// confirmed or open settlements of the month can be passed to discount them.
export function settleUp(
  summary: MonthSummary,
  existing: Pick<HouseholdSettlement, 'fromMember' | 'toMember' | 'amount' | 'status'>[] = []
): Transfer[] {
  const bal = new Map(summary.members.map((m) => [m.memberId, m.balance]));
  for (const s of existing) {
    if (s.status === 'waived' || s.status === 'deferred') continue;
    // A settlement from A to B moves A towards even (+) and B (−).
    bal.set(s.fromMember, round2((bal.get(s.fromMember) ?? 0) + s.amount));
    bal.set(s.toMember, round2((bal.get(s.toMember) ?? 0) - s.amount));
  }
  const debtors = [...bal.entries()]
    .filter(([, b]) => b < -0.004)
    .map(([id, b]) => ({ id, left: -b }))
    .sort((a, b) => b.left - a.left);
  const creditors = [...bal.entries()]
    .filter(([, b]) => b > 0.004)
    .map(([id, b]) => ({ id, left: b }))
    .sort((a, b) => b.left - a.left);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].left, creditors[j].left));
    if (amount >= 0.01) out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].left = round2(debtors[i].left - amount);
    creditors[j].left = round2(creditors[j].left - amount);
    if (debtors[i].left < 0.01) i++;
    if (creditors[j].left < 0.01) j++;
  }
  return out;
}

// % change of `current` against `previous` (null without a previous month).
export function changePct(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------- Recurring ----------

// Monthly equivalent of a recurring amount.
export function monthlyEquivalent(amount: number, frequency: Frequency | null): number {
  if (frequency === 'weekly') return round2((amount * 52) / 12);
  if (frequency === 'yearly') return round2(amount / 12);
  return amount;
}

// Next date after `date` for a frequency (YYYY-MM-DD in, YYYY-MM-DD out, local dates).
export function nextOccurrence(date: string, frequency: Frequency): string {
  const d = new Date(date + 'T00:00:00');
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Recurring expenses whose next date falls within `days` of `today` (overdue first).
export function upcomingPayments(
  expenses: HouseholdExpense[],
  today: string,
  days = 31
): HouseholdExpense[] {
  const limit = new Date(today + 'T00:00:00');
  limit.setDate(limit.getDate() + days);
  return expenses
    .filter((e) => e.isRecurring && e.nextDate && new Date(e.nextDate + 'T00:00:00') <= limit)
    .sort((a, b) => (a.nextDate ?? '').localeCompare(b.nextDate ?? ''));
}

// One entry per recurring series (same name and category): the latest occurrence, which
// carries the next date. Older occurrences may still be flagged when someone else
// recorded the payment.
export function latestRecurring(expenses: HouseholdExpense[]): HouseholdExpense[] {
  const series = new Map<string, HouseholdExpense>();
  for (const e of expenses) {
    if (!e.isRecurring) continue;
    const key = `${e.name.trim().toLowerCase()}|${householdCategory(e.category).toLowerCase()}`;
    const cur = series.get(key);
    if (!cur || e.expenseDate > cur.expenseDate) series.set(key, e);
  }
  return [...series.values()];
}
