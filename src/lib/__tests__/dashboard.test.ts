import { describe, expect, it } from 'vitest';
import {
  baseValue,
  budgetProgress,
  buildPeriod,
  categoryBreakdown,
  mainGoal,
  periodTotals,
  spendingInsight,
  upcomingPayments,
} from '@/lib/dashboard';
import type { Transaction } from '@/lib/financeStore';

const now = new Date(2026, 9, 10, 12, 0); // 10 oct 2026

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++n),
  name: 'x',
  category: 'Comida',
  categoryIcon: '🍔',
  account: 'BCP',
  accountId: 'a',
  amount: -10,
  date: '2026-10-05T12:00:00',
  time: '',
  type: 'gasto',
  ...p,
});

describe('periods', () => {
  it('this month vs previous month', () => {
    const p = buildPeriod('mes', now);
    expect(p).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      prevFrom: '2026-09-01',
      prevTo: '2026-09-30',
      compareLabel: 'vs. septiembre',
    });
  });
  it('last 3 months, year and custom (same length before)', () => {
    expect(buildPeriod('trimestre', now)).toMatchObject({
      from: '2026-08-01',
      to: '2026-10-31',
      prevFrom: '2026-05-01',
      prevTo: '2026-07-31',
    });
    expect(buildPeriod('anio', now)).toMatchObject({ from: '2026-01-01', prevTo: '2025-12-31' });
    expect(buildPeriod('custom', now, { from: '2026-10-11', to: '2026-10-20' })).toMatchObject({
      prevFrom: '2026-10-01',
      prevTo: '2026-10-10',
    });
  });
});

describe('amounts in base currency', () => {
  it('uses the stored base amount, never today’s rate', () => {
    expect(
      baseValue(
        { amount: -10, currencyCode: 'USD', baseAmount: -37.5, baseCurrencyCode: 'PEN' },
        'PEN',
        { 'USD/PEN': 4 }
      )
    ).toBe(37.5);
  });
  it('legacy rows without base amount use the user’s rates', () => {
    expect(
      baseValue({ amount: -10, currencyCode: 'USD' }, 'PEN', {
        USD_PEN: 3.7,
        'USD-PEN': 3.7,
        USDPEN: 3.7,
      })
    ).toBeGreaterThan(0);
    expect(baseValue({ amount: 25 }, 'PEN', {})).toBe(25);
  });
});

describe('totals and categories', () => {
  const txs = [
    tx({ amount: -100, category: 'Comida' }),
    tx({ amount: -50, category: 'Transporte' }),
    tx({ amount: 1000, type: 'ingreso', category: 'Sueldo' }),
    tx({ amount: -300, type: 'transferencia', category: 'Transferencia', transferLeg: 'out' }),
    tx({ amount: -40, category: 'Comida', date: '2026-09-15T12:00:00' }),
  ];
  it('income, expense and balance of the period; transfers excluded', () => {
    expect(periodTotals(txs, '2026-10-01', '2026-10-31', 'PEN', {})).toEqual({
      income: 1000,
      expense: 150,
      balance: 850,
    });
  });
  it('categories sorted with share', () => {
    const c = categoryBreakdown(txs, '2026-10-01', '2026-10-31', 'PEN', {});
    expect(c.map((r) => [r.category, r.amount, Math.round(r.pct)])).toEqual([
      ['Comida', 100, 67],
      ['Transporte', 50, 33],
    ]);
  });
  it('“Otros” groups the rest', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c, i) =>
      tx({ category: c, amount: -(10 + i) })
    );
    const c = categoryBreakdown(many, '2026-10-01', '2026-10-31', 'PEN', {});
    expect(c).toHaveLength(6);
    expect(c[5]).toMatchObject({ category: 'Otros', amount: 10 + 11 });
  });
  it('budget uses the month expenses of the same category', () => {
    const b = budgetProgress(
      [{ id: '1', name: 'Comida', icon: '', budget: 200, color: '', bgColor: '' }],
      txs,
      '2026-10-01',
      '2026-10-31',
      'PEN',
      {}
    );
    expect(b[0]).toMatchObject({ spent: 100, pct: 50 });
  });
});

describe('upcoming payments, goal and insight', () => {
  it('pending payments and active subscriptions, soonest first', () => {
    const rows = upcomingPayments(
      [
        {
          id: '1',
          name: 'Tarjeta BCP',
          amount: 320,
          category: '',
          categoryIcon: '',
          paymentDate: '2026-10-12',
          notes: '',
          status: 'pendiente',
          isRecurring: false,
          paymentDay: null,
          transactionId: null,
        },
        {
          id: '2',
          name: 'Luz',
          amount: 80,
          category: '',
          categoryIcon: '',
          paymentDate: '2026-10-01',
          notes: '',
          status: 'pagado',
          isRecurring: false,
          paymentDay: null,
          transactionId: null,
        },
      ],
      [
        {
          id: 's',
          name: 'Netflix',
          category: '',
          amount: 49.9,
          nextDate: '2026-10-10',
          nextPaymentDate: '2026-10-10',
          paymentDay: 10,
          paymentStatus: 'pending',
          active: true,
          icon: '',
          color: '',
        },
      ],
      '2026-10-10'
    );
    expect(rows.map((r) => r.name)).toEqual(['Netflix', 'Tarjeta BCP']);
  });
  it('main goal: first one not reached', () => {
    expect(
      mainGoal([
        { id: '1', name: 'Viaje', icon: '', current: 500, target: 500, color: '', targetDate: '' },
        {
          id: '2',
          name: 'Fondo',
          icon: '',
          current: 4000,
          target: 10000,
          color: '',
          targetDate: '',
        },
      ])?.name
    ).toBe('Fondo');
    expect(mainGoal([])).toBeNull();
  });
  it('insight only from real increases; nothing when there is no data', () => {
    const fmt = (v: number) => `S/ ${v.toFixed(2)}`;
    const cur = [{ category: 'Delivery', icon: '', amount: 220, pct: 100 }];
    const prev = [{ category: 'Delivery', icon: '', amount: 180, pct: 100 }];
    expect(
      spendingInsight(cur, prev, { expense: 220, prevExpense: 180 }, 'del mes', fmt)?.text
    ).toBe(
      'Gastaste 22% más en delivery este mes. Si vuelves a tu ritmo anterior, ahorrarías S/ 40.00.'
    );
    expect(spendingInsight([], [], { expense: 0, prevExpense: 0 }, 'del mes', fmt)).toBeNull();
  });
});
