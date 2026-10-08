import { describe, expect, it } from 'vitest';
import { daysBetween, dueLabel, safeToSpendHint, shortDate } from '@/lib/companion';
import { parseSummary } from '@/lib/supabaseCompanion';

describe('companion texts', () => {
  it('formats short dates in Spanish, like the dashboard', () => {
    expect(shortDate('2026-10-20')).toBe('20 oct');
    expect(shortDate('2026-09-01')).toBe('1 sep');
  });
  it('counts days across months', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
  it('labels due dates', () => {
    expect(dueLabel('2026-10-10', '2026-10-10')).toBe('Hoy');
    expect(dueLabel('2026-10-11', '2026-10-10')).toBe('Mañana');
    expect(dueLabel('2026-10-14', '2026-10-10')).toBe('En 4 días');
    expect(dueLabel('2026-10-30', '2026-10-10')).toBe('30 oct');
    expect(dueLabel('2026-10-09', '2026-10-10')).toBe('Vencido');
    expect(dueLabel('2026-10-12', '2026-10-10', true)).toBe('Vencido');
  });
  it('explains the "Puedes gastar hoy" horizon', () => {
    expect(safeToSpendHint({ until: '2026-10-20', untilKind: 'proximo_ingreso', days: 11 })).toBe(
      'Hasta tu próximo ingreso, el 20 oct (11 días)'
    );
    expect(safeToSpendHint({ until: '2026-10-31', untilKind: 'fin_de_mes', days: 1 })).toBe(
      'Hasta fin de mes (solo hoy)'
    );
  });
});

describe('parseSummary', () => {
  it('turns numeric strings into numbers and keeps nulls', () => {
    const s = parseSummary({
      currency: 'PEN',
      asOf: '2026-10-10',
      netWorth: '6610.00',
      available: '6310',
      committed: '149.90',
      inGoals: '900',
      netWorthPct: null,
      spentToday: '30',
      safeToSpend: {
        today: '505.46',
        dailyBudget: '535.46',
        until: '2026-10-20',
        untilKind: 'proximo_ingreso',
        days: 11,
        committed: '149.90',
        goals: '300',
      },
      nextPayment: null,
      mainGoal: { name: 'Fondo', icon: null, current: '400', target: '1000', pct: '40' },
      recent: [
        {
          id: 'x',
          name: 'Taxi',
          icon: 'taxi',
          type: 'gasto',
          amount: '-30',
          currency: 'PEN',
          date: '',
        },
      ],
    });
    expect(s.netWorth).toBe(6610);
    expect(s.netWorthPct).toBeNull();
    expect(s.safeToSpend.today).toBe(505.46);
    expect(s.mainGoal?.pct).toBe(40);
    expect(s.recent[0].amount).toBe(-30);
    expect(s.nextPayment).toBeNull();
  });
});
