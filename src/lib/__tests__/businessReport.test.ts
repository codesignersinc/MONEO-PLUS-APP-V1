import { describe, expect, it } from 'vitest';
import {
  csvCell,
  movementsCsv,
  reportBreakdown,
  reportFileName,
  reportInsights,
  reportPeriod,
} from '@/lib/businessReport';
import type { BusinessSummary } from '@/lib/business';
import type { BizMovement, Party } from '@/lib/supabaseBusiness';

const money = (n: number) => `S/ ${n.toFixed(2)}`;

const party = (id: string, name: string, kind: Party['kind']): Party =>
  ({
    id,
    name,
    kind,
    phone: null,
    email: null,
    notes: null,
    usualAmount: null,
    active: true,
  }) as unknown as Party;

const parties = [
  party('c1', 'Vega', 'cliente'),
  party('c2', 'Ruiz', 'cliente'),
  party('p1', 'Makro', 'proveedor'),
  party('e1', 'Ana', 'empleado'),
];

let n = 0;
const mv = (o: Partial<BizMovement>): BizMovement => ({
  id: `m${++n}`,
  name: 'Mov',
  type: 'gasto',
  amount: -10,
  value: 10,
  category: 'Otros gastos',
  date: '2026-10-05T15:00:00.000Z',
  partyId: null,
  accountId: 'a1',
  notes: '',
  transferId: null,
  ...o,
});

const movements: BizMovement[] = [
  mv({
    type: 'ingreso',
    amount: 5000,
    value: 5000,
    category: 'Servicios prestados',
    partyId: 'c1',
  }),
  mv({ type: 'ingreso', amount: 1000, value: 1000, category: 'Ventas', partyId: 'c2' }),
  mv({ type: 'ingreso', amount: 500, value: 500, category: 'Ventas' }),
  mv({ name: 'Insumos', amount: -850, value: 850, category: 'Proveedores', partyId: 'p1' }),
  mv({ name: 'Sueldo Ana', amount: -1200, value: 1200, category: 'Planilla', partyId: 'e1' }),
  mv({ name: 'Luz', amount: -150, value: 150, category: 'Servicios' }),
  // Owner withdrawal (the other leg is personal) and a move between two business accounts.
  mv({ type: 'transferencia', amount: -2000, value: 2000, transferId: 't1' }),
  mv({ type: 'transferencia', amount: -300, value: 300, transferId: 't2' }),
  mv({ type: 'transferencia', amount: 300, value: 300, transferId: 't2', accountId: 'a2' }),
];

const summary = (o: Partial<BusinessSummary> = {}): BusinessSummary =>
  ({
    currency: 'PEN',
    income: 6500,
    expense: 2200,
    result: 4300,
    previous: { from: '', to: '', income: 4000, expense: 2000, result: 2000 },
    byCategory: [],
    ...o,
  }) as BusinessSummary;

describe('reportBreakdown', () => {
  const b = reportBreakdown(movements, parties);

  it('splits income and expenses by category with shares', () => {
    expect(b.incomeByCategory).toEqual([
      { label: 'Servicios prestados', amount: 5000, share: 77 },
      { label: 'Ventas', amount: 1500, share: 23 },
    ]);
    expect(b.expenseByCategory[0]).toEqual({ label: 'Planilla', amount: 1200, share: 55 });
    expect(b.incomeCount).toBe(3);
    expect(b.expenseCount).toBe(3);
  });

  it('ranks customers and suppliers and counts payroll', () => {
    expect(b.clients.map((c) => [c.name, c.amount])).toEqual([
      ['Vega', 5000],
      ['Ruiz', 1000],
    ]);
    expect(b.suppliers.map((c) => c.name)).toEqual(['Makro']);
    expect(b.payroll).toBe(1200);
    expect(b.incomeWithoutClient).toBe(500);
    expect(b.biggestExpense?.name).toBe('Sueldo Ana');
  });

  it('counts withdrawals but not moves between business accounts', () => {
    expect(b.withdrawals).toBe(2000);
    expect(b.contributions).toBe(0);
  });

  it('is empty without movements', () => {
    const e = reportBreakdown([], parties);
    expect(e.clients).toEqual([]);
    expect(e.biggestExpense).toBeNull();
  });
});

describe('reportInsights', () => {
  const b = reportBreakdown(movements, parties);

  it('says only true things', () => {
    const lines = reportInsights(summary(), b, money);
    expect(lines[0]).toBe('El negocio ganó S/ 4300.00: 66% de lo que ingresó.');
    expect(lines).toContain('Tus ingresos subieron 63% respecto al periodo anterior.');
    expect(lines.some((l) => l.startsWith('Vega es el 77%'))).toBe(true);
    expect(lines).toContain('Planilla es el 55% de tus gastos.');
    expect(lines).toContain('Retiraste S/ 2000.00 del negocio para ti.');
    expect(lines.some((l) => l.startsWith('El equipo'))).toBe(false);
    expect(lines.length).toBeLessThanOrEqual(5);
  });

  it('names the team when payroll is not the top category', () => {
    const team = reportBreakdown(
      [
        mv({ amount: -300, value: 300, category: 'Planilla', partyId: 'e1' }),
        mv({ amount: -700, value: 700, category: 'Proveedores', partyId: 'p1' }),
      ],
      parties
    );
    expect(reportInsights(summary({ expense: 1000 }), team, money)).toContain(
      'El equipo es el 30% de tus gastos.'
    );
  });

  it('warns when withdrawals exceed the result and when there is a loss', () => {
    const loss = reportInsights(
      summary({ income: 1000, expense: 1500, result: -500 }),
      reportBreakdown([], parties),
      money
    );
    expect(loss).toEqual([
      'Los gastos superaron a los ingresos por S/ 500.00.',
      expect.any(String),
    ]);
    const small = reportInsights(summary({ result: 1000, income: 1000, expense: 0 }), b, money);
    expect(small).toContain('Retiraste S/ 2000.00, más de lo que ganó el negocio en el periodo.');
  });

  it('is empty for a period without movements', () => {
    const none = summary({ income: 0, expense: 0, result: 0 });
    none.previous = { from: '', to: '', income: 0, expense: 0, result: 0 };
    expect(reportInsights(none, reportBreakdown([], parties), money)).toEqual([]);
  });
});

describe('CSV', () => {
  it('escapes cells and neutralizes formulas', () => {
    expect(csvCell('Bodega, Vega')).toBe('"Bodega, Vega"');
    expect(csvCell('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('línea\nnueva')).toBe('línea nueva');
    expect(csvCell(-850)).toBe('-850.00');
  });

  it('writes the movements oldest first with signed amounts', () => {
    const csv = movementsCsv(
      [
        mv({
          name: 'Insumos',
          amount: -850,
          value: 850,
          partyId: 'p1',
          date: '2026-10-06T17:30:00Z',
        }),
        mv({
          type: 'ingreso',
          name: 'Diseño',
          amount: 5000,
          value: 5000,
          partyId: 'c1',
          category: 'Servicios prestados',
          date: '2026-10-02T17:30:00Z',
        }),
        mv({ type: 'transferencia', name: 'Retiro', amount: -2000, value: 2000, transferId: 't9' }),
      ],
      {
        baseCurrency: 'PEN',
        accounts: [{ id: 'a1', name: 'BCP Negocio', currency: 'PEN' }],
        parties,
      }
    );
    expect(
      csv.startsWith(
        '\uFEFFFecha,Tipo,Categoría,Descripción,Contacto,Cuenta,Monto,Moneda,Monto en PEN,Notas\r\n'
      )
    ).toBe(true);
    const rows = csv.trim().split('\r\n').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(
      /,Ingreso,Servicios prestados,Diseño,Vega,BCP Negocio,5000.00,PEN,5000.00,$/
    );
    expect(rows[1]).toMatch(/,Retiro,,Retiro,,BCP Negocio,-2000.00,PEN,-2000.00,$/);
    expect(rows[2]).toMatch(/,Gasto,Otros gastos,Insumos,Makro,BCP Negocio,-850.00,PEN,-850.00,$/);
  });

  it('names the file after the business and period', () => {
    expect(reportFileName('Bodega Vegá & Hijos', '2026-10-01', '2026-10-31', 'csv')).toBe(
      'moneo-negocio-bodega-vega-hijos-2026-10-01_2026-10-31.csv'
    );
    expect(reportFileName('***', '2026-01-01', '2026-12-31', 'csv')).toBe(
      'moneo-negocio-negocio-2026-01-01_2026-12-31.csv'
    );
  });
});

describe('reportPeriod', () => {
  it('builds the month, previous month and year', () => {
    const now = new Date(2026, 9, 8);
    const custom = { from: '', to: '' };
    expect(reportPeriod({ kind: 'mes', offset: 0, custom }, now)).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(reportPeriod({ kind: 'mes', offset: -1, custom }, now)).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(reportPeriod({ kind: 'anio', offset: 0, custom }, now)).toMatchObject({
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });
});
