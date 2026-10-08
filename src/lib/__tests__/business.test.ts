import { describe, expect, it } from 'vitest';
import {
  businessIdFromPath,
  businessInsight,
  nextPayDate,
  pctChange,
  type BusinessSummary,
} from '@/lib/business';

const money = (n: number) => `S/ ${n.toFixed(2)}`;

function summary(over: Partial<BusinessSummary> = {}): BusinessSummary {
  return {
    currency: 'PEN',
    asOf: '2026-10-15',
    period: { from: '2026-10-01', to: '2026-10-31' },
    income: 0,
    expense: 0,
    result: 0,
    previous: { from: '2026-09-01', to: '2026-09-30', income: 0, expense: 0, result: 0 },
    cash: 0,
    receivable: 0,
    payable: 0,
    committed: 0,
    projection: {
      until: '2026-10-31',
      cash: 0,
      receivable: 0,
      payable: 0,
      subscriptions: 0,
      projected: 0,
    },
    byCategory: [],
    series: [],
    nextPayments: [],
    nextCollections: [],
    ...over,
  };
}

describe('pctChange', () => {
  it('compares with the previous period', () => {
    expect(pctChange(118, 100)).toBe(18);
    expect(pctChange(90, 100)).toBe(-10);
  });
  it('has nothing to compare without a previous value', () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(100, -50)).toBeNull();
  });
});

describe('businessInsight', () => {
  it('warns first about overdue payments', () => {
    const s = summary({
      nextPayments: [
        { id: '1', name: 'Makro', amount: 850, due: '2026-10-10', party: null, overdue: true },
      ],
      projection: {
        until: '2026-10-31',
        cash: 1000,
        receivable: 0,
        payable: 850,
        subscriptions: 0,
        projected: 150,
      },
    });
    expect(businessInsight(s, money)).toBe('Tienes un pago vencido: Makro por S/ 850.00.');
  });

  it('then gives the month-end projection when something is pending', () => {
    const s = summary({
      projection: {
        until: '2026-10-31',
        cash: 11100,
        receivable: 4700,
        payable: 3200,
        subscriptions: 60,
        projected: 12540,
      },
    });
    expect(businessInsight(s, money)).toBe(
      'Si se cumplen tus cobros y pagos pendientes, cerrarías el mes con S/ 12540.00.'
    );
  });

  it('then the change in expenses', () => {
    const s = summary({
      expense: 1180,
      previous: { from: '', to: '', income: 0, expense: 1000, result: 0 },
    });
    expect(businessInsight(s, money)).toBe('Tus gastos subieron 18% respecto al periodo anterior.');
  });

  it('then the biggest category, and nothing when there is no data', () => {
    const s = summary({ expense: 1000, byCategory: [{ category: 'Planilla', amount: 600 }] });
    expect(businessInsight(s, money)).toBe('Planilla es el 60% de tus gastos.');
    expect(businessInsight(summary(), money)).toBeNull();
  });
});

describe('businessIdFromPath', () => {
  const id = '0b8f3c1e-5d2a-4c7e-9f10-2a3b4c5d6e7f';
  it('reads the business of the route', () => {
    expect(businessIdFromPath(`/finanzas/negocio/${id}`)).toBe(id);
    expect(businessIdFromPath(`/finanzas/negocio/${id}/cuentas`)).toBe(id);
  });
  it('ignores other routes', () => {
    expect(businessIdFromPath('/finanzas/negocio')).toBeNull();
    expect(businessIdFromPath('/finanzas/cuentas')).toBeNull();
  });
});

describe('nextPayDate', () => {
  it('this month when the day has not passed, next month otherwise', () => {
    expect(nextPayDate(15, '2026-10-08')).toBe('2026-10-15');
    expect(nextPayDate(8, '2026-10-08')).toBe('2026-10-08');
    expect(nextPayDate(5, '2026-10-08')).toBe('2026-11-05');
    expect(nextPayDate(5, '2026-12-20')).toBe('2027-01-05');
  });
  it('clamps to short months', () => {
    expect(nextPayDate(31, '2026-11-10')).toBe('2026-11-30');
    expect(nextPayDate(30, '2027-02-01')).toBe('2027-02-28');
  });
});
