import { describe, expect, it } from 'vitest';
import {
  annualProjection,
  averageMonthly,
  budgetProgress,
  budgetsCrossing,
  categoryTotals,
  emergencyFundTarget,
  simulatedSaving,
  simulatorLines,
  topInsight,
  changePct,
  householdShares,
  latestRecurring,
  monthSummary,
  monthlyEquivalent,
  nextOccurrence,
  settleUp,
  shiftMonth,
  splitAmount,
  toPercentages,
  twoWayShares,
  upcomingPayments,
  type HouseholdExpense,
  type HouseholdMember,
} from '@/lib/household';

const member = (id: string, extra: Partial<HouseholdMember> = {}): HouseholdMember => ({
  id,
  userId: id,
  displayName: id,
  role: 'member',
  status: 'active',
  declaredIncome: null,
  customPct: null,
  joinedAt: '2026-10-01',
  ...extra,
});

const expense = (
  paidBy: string,
  baseAmount: number,
  splits: [string, number][],
  extra: Partial<HouseholdExpense> = {}
): HouseholdExpense => ({
  id: Math.random().toString(36),
  createdBy: null,
  paidBy,
  transactionId: null,
  name: 'x',
  category: 'Vivienda',
  amount: baseAmount,
  currencyCode: 'PEN',
  baseAmount,
  exchangeRate: 1,
  expenseDate: '2026-10-05',
  responsibility: 'shared',
  isRecurring: false,
  frequency: null,
  nextDate: null,
  notes: '',
  splits: splitAmount(
    baseAmount,
    splits.map(([memberId, percentage]) => ({ memberId, percentage }))
  ),
  ...extra,
});

const felix = member('felix', { declaredIncome: 7862 });
const sophia = member('sophia', { declaredIncome: 3151 });

describe('householdShares', () => {
  it('50/50', () => {
    expect(householdShares('equal', [felix, sophia])).toEqual({
      ok: true,
      shares: [
        { memberId: 'felix', percentage: 50 },
        { memberId: 'sophia', percentage: 50 },
      ],
    });
  });

  it('three members add up to exactly 100', () => {
    const r = householdShares('equal', [member('a'), member('b'), member('c')]);
    expect(r.ok && r.shares.map((s) => s.percentage)).toEqual([33.333, 33.333, 33.334]);
  });

  it('proportional to declared incomes (≈ 71.4 / 28.6)', () => {
    const r = householdShares('income', [felix, sophia]);
    expect(r.ok && r.shares).toEqual([
      { memberId: 'felix', percentage: 71.388 },
      { memberId: 'sophia', percentage: 28.612 },
    ]);
  });

  it('proportional needs every income', () => {
    expect(householdShares('income', [felix, member('x')])).toEqual({
      ok: false,
      reason: 'missing-income',
    });
  });

  it('custom must add up to 100', () => {
    expect(
      householdShares('custom', [member('a', { customPct: 70 }), member('b', { customPct: 30 })])
    ).toMatchObject({ ok: true });
    expect(
      householdShares('custom', [member('a', { customPct: 70 }), member('b', { customPct: 20 })])
    ).toEqual({ ok: false, reason: 'custom-not-100' });
  });

  it('ignores members who left', () => {
    const r = householdShares('equal', [felix, member('old', { status: 'left' })]);
    expect(r.ok && r.shares).toEqual([{ memberId: 'felix', percentage: 100 }]);
  });
});

describe('splitAmount', () => {
  it('Internet S/70 50/50 → 35 + 35', () => {
    expect(splitAmount(70, twoWayShares('felix', 'sophia', 50)).map((s) => s.amount)).toEqual([
      35, 35,
    ]);
  });

  it('the last share takes the cents (like the database)', () => {
    const s = splitAmount(70, [
      { memberId: 'a', percentage: 71.4 },
      { memberId: 'b', percentage: 28.6 },
    ]);
    expect(s.map((x) => x.amount)).toEqual([49.98, 20.02]);
  });

  it('70/30 drops a 0% side', () => {
    expect(twoWayShares('a', 'b', 70)).toEqual([
      { memberId: 'a', percentage: 70 },
      { memberId: 'b', percentage: 30 },
    ]);
    expect(twoWayShares('a', 'b', 100)).toEqual([{ memberId: 'a', percentage: 100 }]);
  });

  it('toPercentages returns null without weights', () => {
    expect(toPercentages([{ memberId: 'a', weight: 0 }])).toBeNull();
  });
});

describe('monthSummary and settleUp (brief example)', () => {
  // Félix paid S/7,862 and Sophia S/3,151 of shared 50/50 expenses: S/11,013.
  const expenses = [
    expense('felix', 7862, [
      ['felix', 50],
      ['sophia', 50],
    ]),
    expense('sophia', 3151, [
      ['felix', 50],
      ['sophia', 50],
    ]),
  ];
  const summary = monthSummary(expenses, [felix, sophia]);

  it('total, paid and percentage of the total', () => {
    expect(summary.total).toBe(11013);
    expect(summary.members).toEqual([
      { memberId: 'felix', paid: 7862, paidPct: 71.4, responsibility: 5506.5, balance: 2355.5 },
      {
        memberId: 'sophia',
        paid: 3151,
        paidPct: 28.6,
        responsibility: 5506.5,
        balance: -2355.5,
      },
    ]);
  });

  it('Sophia should compensate S/2,355.50', () => {
    expect(settleUp(summary)).toEqual([{ from: 'sophia', to: 'felix', amount: 2355.5 }]);
  });

  it('a settlement already recorded is discounted; waived/deferred are not', () => {
    expect(
      settleUp(summary, [
        { fromMember: 'sophia', toMember: 'felix', amount: 2355.5, status: 'proposed' },
      ])
    ).toEqual([]);
    expect(
      settleUp(summary, [
        { fromMember: 'sophia', toMember: 'felix', amount: 2355.5, status: 'waived' },
      ])
    ).toHaveLength(1);
  });

  it('a member-only expense is that member responsibility', () => {
    const s = monthSummary(
      [expense('felix', 450, [['felix', 100]], { responsibility: 'member' })],
      [felix, sophia]
    );
    expect(settleUp(s)).toEqual([]);
  });

  it('three members: fewest payments', () => {
    const a = member('a');
    const b = member('b');
    const c = member('c');
    const s = monthSummary(
      [
        expense('a', 300, [
          ['a', 33.333],
          ['b', 33.333],
          ['c', 33.334],
        ]),
      ],
      [a, b, c]
    );
    expect(settleUp(s)).toEqual([
      { from: 'b', to: 'a', amount: 100 },
      { from: 'c', to: 'a', amount: 100 },
    ]);
  });
});

describe('categories, months and recurring', () => {
  it('Comida and Supermercado are grouped as Alimentación', () => {
    const t = categoryTotals([
      expense('a', 100, [['a', 100]], { category: 'Comida' }),
      expense('a', 50, [['a', 100]], { category: 'Supermercado' }),
      expense('a', 200, [['a', 100]], { category: 'Vivienda' }),
    ]);
    expect(t).toEqual([
      { category: 'Vivienda', total: 200 },
      { category: 'Alimentación', total: 150 },
    ]);
  });

  it('months', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(changePct(11013, 10197)).toBe(8);
    expect(changePct(10, 0)).toBeNull();
  });

  it('next occurrence keeps the day (or the last day of a short month)', () => {
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextOccurrence('2026-10-05', 'weekly')).toBe('2026-10-12');
    expect(nextOccurrence('2026-10-05', 'yearly')).toBe('2027-10-05');
  });

  it('monthly equivalent', () => {
    expect(monthlyEquivalent(120, 'yearly')).toBe(10);
    expect(monthlyEquivalent(30, 'weekly')).toBe(130);
    expect(monthlyEquivalent(70, 'monthly')).toBe(70);
  });

  it('upcoming payments within the window, overdue first', () => {
    const list = upcomingPayments(
      [
        expense('a', 1, [['a', 100]], {
          name: 'late',
          isRecurring: true,
          frequency: 'monthly',
          nextDate: '2026-10-01',
        }),
        expense('a', 1, [['a', 100]], {
          name: 'far',
          isRecurring: true,
          frequency: 'monthly',
          nextDate: '2027-01-01',
        }),
        expense('a', 1, [['a', 100]], {
          name: 'soon',
          isRecurring: true,
          frequency: 'monthly',
          nextDate: '2026-10-20',
        }),
      ],
      '2026-10-07'
    );
    expect(list.map((e) => e.name)).toEqual(['late', 'soon']);
  });
});

describe('latestRecurring', () => {
  it('keeps the latest occurrence of each series', () => {
    const r = latestRecurring([
      expense('a', 70, [['a', 100]], {
        name: 'Internet',
        category: 'Servicios',
        isRecurring: true,
        frequency: 'monthly',
        expenseDate: '2026-09-05',
        nextDate: '2026-10-05',
      }),
      expense('a', 70, [['a', 100]], {
        name: 'internet ',
        category: 'Servicios',
        isRecurring: true,
        frequency: 'monthly',
        expenseDate: '2026-10-05',
        nextDate: '2026-11-05',
      }),
      expense('a', 9, [['a', 100]], { name: 'Pan', isRecurring: false }),
    ]);
    expect(r.map((e) => e.nextDate)).toEqual(['2026-11-05']);
  });
});

describe('budget, emergency fund, simulator, insights and projection', () => {
  const oct = [
    expense('a', 1000, [['a', 100]], { category: 'Comida', name: 'Súper' }),
    expense('a', 650, [['a', 100]], { category: 'Supermercado', name: 'Mercado' }),
    expense('a', 2600, [['a', 100]], { category: 'Vivienda', name: 'Alquiler' }),
  ];

  it('budget progress groups Alimentación and flags 80% and over', () => {
    const p = budgetProgress(
      [
        { id: 'b1', category: 'Alimentación', monthlyLimit: 2000 },
        { id: 'b2', category: 'Vivienda', monthlyLimit: 2600 },
        { id: 'b3', category: 'Servicios', monthlyLimit: 500 },
      ],
      oct
    );
    expect(p.map((b) => [b.spent, b.pct, b.status])).toEqual([
      [1650, 83, 'warning'],
      [2600, 100, 'over'],
      [0, 0, 'ok'],
    ]);
  });

  it('budgetsCrossing only reports the ones that just crossed 80%', () => {
    const before = budgetProgress(
      [{ id: 'b1', category: 'Comida', monthlyLimit: 2000 }],
      oct.slice(0, 1)
    );
    const after = budgetProgress([{ id: 'b1', category: 'Comida', monthlyLimit: 2000 }], oct);
    expect(budgetsCrossing(before, after).map((b) => b.id)).toEqual(['b1']);
    expect(budgetsCrossing(after, after)).toEqual([]);
  });

  it('average monthly uses past months with data, else the current month', () => {
    const sep = expense('a', 900, [['a', 100]], { expenseDate: '2026-09-10' });
    const aug = expense('a', 1100, [['a', 100]], { expenseDate: '2026-08-10' });
    expect(averageMonthly([...oct, sep, aug], '2026-10')).toBe(1000);
    expect(averageMonthly(oct, '2026-10')).toBe(4250);
    expect(emergencyFundTarget(11013, 6)).toBe(66078);
  });

  it('simulator lines and savings (brief example: S/ 750 / month)', () => {
    const lines = simulatorLines(oct);
    expect(lines.map((l) => l.label)).toEqual(['Alquiler', 'Súper', 'Mercado']);
    const cuts = [
      { key: 'a', label: 'Alquiler', monthly: 2600, cut: 300 },
      { key: 'd', label: 'Delivery', monthly: 400, cut: 200 },
      { key: 'g', label: 'Gasolina', monthly: 450, cut: 150 },
      { key: 's', label: 'Suscripciones', monthly: 100, cut: 9999 },
    ];
    expect(simulatedSaving(cuts)).toEqual({ monthly: 750, yearly: 9000 });
  });

  it('insight and annual projection', () => {
    expect(topInsight(oct)).toEqual({
      category: 'Vivienda',
      monthly: 2600,
      pct: 61,
      tenPercent: 260,
    });
    expect(topInsight([])).toBeNull();
    const p = annualProjection(oct);
    expect(p.total).toBe(51000);
    expect(p.byCategory[0]).toEqual({ category: 'Vivienda', total: 31200 });
  });
});
