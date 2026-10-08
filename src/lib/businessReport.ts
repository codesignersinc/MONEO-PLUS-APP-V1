import { buildPeriod, type Period, type PeriodKind } from '@/lib/dashboard';
import { pctChange, type BusinessSummary } from '@/lib/business';
import type { BizMovement, Party, PartyKind } from '@/lib/supabaseBusiness';

// MONEO NEGOCIO, fase 5 (docs/moneo-negocio.md): business reports. Totals come from
// business_summary(); this file breaks the period's movements down (categories, contacts,
// withdrawals), words true insights and writes the CSV. Pure: no data access.

/** The period picked in the filter (same shape as the dashboard's). */
export function reportPeriod(
  p: { kind: PeriodKind; offset: number; custom: { from: string; to: string } },
  now: Date
): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p.kind === 'mes') return buildPeriod('mes', new Date(y, m + p.offset, 15));
  if (p.kind === 'trimestre') return buildPeriod('trimestre', new Date(y, m + 3 * p.offset, 15));
  if (p.kind === 'anio') return buildPeriod('anio', new Date(y + p.offset, 5, 15));
  return buildPeriod('custom', now, p.custom);
}

export interface ReportLine {
  label: string;
  amount: number;
  /** Share of the income or expense total, 0–100. */
  share: number;
}

export interface ReportParty {
  id: string;
  name: string;
  kind: PartyKind;
  amount: number;
  count: number;
}

export interface ReportBreakdown {
  incomeByCategory: ReportLine[];
  expenseByCategory: ReportLine[];
  /** Customers by what they paid in the period. */
  clients: ReportParty[];
  /** Suppliers by what was paid to them. */
  suppliers: ReportParty[];
  /** Paid to employees (party kind empleado). */
  payroll: number;
  /** Income not linked to a customer. */
  incomeWithoutClient: number;
  incomeCount: number;
  expenseCount: number;
  /** Money taken out to Personal / put in from Personal (transfers between contexts). */
  withdrawals: number;
  contributions: number;
  biggestExpense: { name: string; amount: number; date: string } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function lines(map: Map<string, number>, total: number): ReportLine[] {
  return [...map.entries()]
    .map(([label, amount]) => ({
      label,
      amount: round2(amount),
      share: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

/**
 * Breakdown of a period's movements. A transfer leg whose pair is in another business account
 * of the same business is an internal move (neither withdrawal nor contribution).
 */
export function reportBreakdown(movements: BizMovement[], parties: Party[]): ReportBreakdown {
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  const legs = new Map<string, number>();
  for (const m of movements) {
    if (m.transferId) legs.set(m.transferId, (legs.get(m.transferId) ?? 0) + 1);
  }

  const inc = new Map<string, number>();
  const exp = new Map<string, number>();
  const byParty = new Map<string, ReportParty>();
  const out: ReportBreakdown = {
    incomeByCategory: [],
    expenseByCategory: [],
    clients: [],
    suppliers: [],
    payroll: 0,
    incomeWithoutClient: 0,
    incomeCount: 0,
    expenseCount: 0,
    withdrawals: 0,
    contributions: 0,
    biggestExpense: null,
  };
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const m of movements) {
    if (m.type === 'transferencia') {
      if (m.transferId && (legs.get(m.transferId) ?? 0) > 1) continue; // between own accounts
      if (m.amount < 0) out.withdrawals += m.value;
      else out.contributions += m.value;
      continue;
    }
    const category = m.category?.trim() || 'Otros';
    const party = m.partyId ? partyOf.get(m.partyId) : undefined;
    if (m.type === 'ingreso') {
      out.incomeCount += 1;
      incomeTotal += m.value;
      inc.set(category, (inc.get(category) ?? 0) + m.value);
      if (!party) out.incomeWithoutClient += m.value;
    } else {
      out.expenseCount += 1;
      expenseTotal += m.value;
      exp.set(category, (exp.get(category) ?? 0) + m.value);
      if (party?.kind === 'empleado') out.payroll += m.value;
      if (!out.biggestExpense || m.value > out.biggestExpense.amount) {
        out.biggestExpense = { name: m.name, amount: m.value, date: String(m.date).slice(0, 10) };
      }
    }
    if (party) {
      const row = byParty.get(party.id) ?? {
        id: party.id,
        name: party.name,
        kind: party.kind,
        amount: 0,
        count: 0,
      };
      row.amount += m.value;
      row.count += 1;
      byParty.set(party.id, row);
    }
  }

  const ranked = [...byParty.values()]
    .map((p) => ({ ...p, amount: round2(p.amount) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  out.clients = ranked.filter((p) => p.kind === 'cliente');
  out.suppliers = ranked.filter((p) => p.kind === 'proveedor');
  out.incomeByCategory = lines(inc, incomeTotal);
  out.expenseByCategory = lines(exp, expenseTotal);
  out.payroll = round2(out.payroll);
  out.incomeWithoutClient = round2(out.incomeWithoutClient);
  out.withdrawals = round2(out.withdrawals);
  out.contributions = round2(out.contributions);
  return out;
}

/**
 * Up to five short, true sentences about the period. Nothing is estimated or invented: each
 * one only appears when the data supports it.
 */
export function reportInsights(
  s: BusinessSummary,
  b: ReportBreakdown,
  money: (n: number) => string
): string[] {
  const out: string[] = [];
  if (s.income > 0 || s.expense > 0) {
    if (s.result >= 0) {
      const margin = s.income > 0 ? Math.round((s.result / s.income) * 100) : 0;
      out.push(`El negocio ganó ${money(s.result)}: ${margin}% de lo que ingresó.`);
    } else {
      out.push(`Los gastos superaron a los ingresos por ${money(Math.abs(s.result))}.`);
    }
  }
  const incomeChange = pctChange(s.income, s.previous.income);
  if (incomeChange !== null && Math.abs(incomeChange) >= 10) {
    out.push(
      incomeChange > 0
        ? `Tus ingresos subieron ${incomeChange}% respecto al periodo anterior.`
        : `Tus ingresos bajaron ${Math.abs(incomeChange)}% respecto al periodo anterior.`
    );
  }
  const top = b.clients[0];
  if (top && s.income > 0) {
    const share = Math.round((top.amount / s.income) * 100);
    if (share >= 30) {
      out.push(
        b.clients.length === 1
          ? `Todos tus cobros con cliente vinieron de ${top.name}.`
          : `${top.name} es el ${share}% de tus ingresos: depender de un cliente es un riesgo.`
      );
    }
  }
  if (b.withdrawals > 0) {
    out.push(
      s.result > 0 && b.withdrawals > s.result
        ? `Retiraste ${money(b.withdrawals)}, más de lo que ganó el negocio en el periodo.`
        : `Retiraste ${money(b.withdrawals)} del negocio para ti.`
    );
  }
  const cat = b.expenseByCategory[0];
  if (cat && cat.share >= 30 && b.expenseByCategory.length > 1) {
    out.push(`${cat.label} es el ${cat.share}% de tus gastos.`);
  }
  // The team, unless that sentence was just said through the Planilla category.
  if (b.payroll > 0 && s.expense > 0 && !(cat && cat.label === 'Planilla' && cat.share >= 30)) {
    out.push(`El equipo es el ${Math.round((b.payroll / s.expense) * 100)}% de tus gastos.`);
  }
  return out.slice(0, 5);
}

// ─── CSV ───────────────────────────────────────────────────────────────────

export interface CsvContext {
  baseCurrency: string;
  accounts: { id: string; name: string; currency: string }[];
  parties: Party[];
}

const BOM = '\uFEFF';
const pad = (n: number) => String(n).padStart(2, '0');

/** Local date and time of a timestamptz value, as YYYY-MM-DD HH:MM. */
function localStamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** One CSV cell. Text that a spreadsheet would run as a formula is prefixed with '. */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return value.toFixed(2);
  let v = value.replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t]/.test(v)) v = `'${v}`;
  return /[",;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * The period's movements as CSV (UTF-8 with BOM so Excel reads accents, CRLF lines).
 * Amounts are signed: income positive, expenses and withdrawals negative.
 */
export function movementsCsv(movements: BizMovement[], ctx: CsvContext): string {
  const account = new Map(ctx.accounts.map((a) => [a.id, a]));
  const party = new Map(ctx.parties.map((p) => [p.id, p.name]));
  const legs = new Map<string, number>();
  for (const m of movements) {
    if (m.transferId) legs.set(m.transferId, (legs.get(m.transferId) ?? 0) + 1);
  }
  const kindOf = (m: BizMovement) => {
    if (m.type === 'ingreso') return 'Ingreso';
    if (m.type === 'gasto') return 'Gasto';
    if (m.transferId && (legs.get(m.transferId) ?? 0) > 1) return 'Entre cuentas del negocio';
    return m.amount < 0 ? 'Retiro' : 'Aporte';
  };
  const header = [
    'Fecha',
    'Tipo',
    'Categoría',
    'Descripción',
    'Contacto',
    'Cuenta',
    'Monto',
    'Moneda',
    `Monto en ${ctx.baseCurrency}`,
    'Notas',
  ];
  const rows = [...movements]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((m) => {
      const acc = m.accountId ? account.get(m.accountId) : undefined;
      const sign = m.amount < 0 ? -1 : 1;
      return [
        localStamp(m.date),
        kindOf(m),
        m.type === 'transferencia' ? '' : m.category || 'Otros',
        m.name || '',
        (m.partyId && party.get(m.partyId)) || '',
        acc?.name ?? '',
        m.amount,
        acc?.currency ?? ctx.baseCurrency,
        sign * m.value,
        m.notes || '',
      ]
        .map(csvCell)
        .join(',');
    });
  return `${BOM}${[header.map(csvCell).join(','), ...rows].join('\r\n')}\r\n`;
}

/** File name like moneo-negocio-bodega-vega-2026-10-01_2026-10-31.csv */
export function reportFileName(businessName: string, from: string, to: string, ext: string) {
  const slug =
    businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'negocio';
  return `moneo-negocio-${slug}-${from}_${to}.${ext}`;
}
