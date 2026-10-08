import type { GlyphKey } from '@/lib/glyphs';

// MONEO NEGOCIO (docs/moneo-negocio.md): pure helpers. The numbers themselves come from
// business_summary() in the database; this file only words and compares them.

export interface BusinessSummary {
  currency: string;
  asOf: string;
  period: { from: string; to: string };
  income: number;
  expense: number;
  result: number;
  previous: { from: string; to: string; income: number; expense: number; result: number };
  cash: number;
  receivable: number;
  payable: number;
  committed: number;
  projection: {
    until: string;
    cash: number;
    receivable: number;
    payable: number;
    subscriptions: number;
    projected: number;
  };
  byCategory: { category: string; amount: number }[];
  series: { month: string; income: number; expense: number }[];
  nextPayments: BusinessDue[];
  nextCollections: BusinessDue[];
}

export interface BusinessDue {
  id: string;
  name: string;
  amount: number;
  due: string;
  party: string | null;
  overdue: boolean;
}

export interface Business {
  id: string;
  name: string;
  kind: string | null;
  createdAt: string;
}

export const BUSINESS_EXPENSE_CATEGORIES: { label: string; icon: GlyphKey }[] = [
  { label: 'Compras y mercadería', icon: 'cart' },
  { label: 'Proveedores', icon: 'package' },
  { label: 'Planilla', icon: 'users' },
  { label: 'Alquiler del local', icon: 'store' },
  { label: 'Servicios', icon: 'bulb' },
  { label: 'Marketing', icon: 'sparkles' },
  { label: 'Software', icon: 'laptop' },
  { label: 'Transporte', icon: 'car' },
  { label: 'Impuestos', icon: 'receipt' },
  { label: 'Comisiones bancarias', icon: 'bank' },
  { label: 'Otros gastos', icon: 'tag' },
];

export const BUSINESS_INCOME_CATEGORIES: { label: string; icon: GlyphKey }[] = [
  { label: 'Ventas', icon: 'store' },
  { label: 'Servicios prestados', icon: 'briefcase' },
  { label: 'Anticipos', icon: 'coins' },
  { label: 'Otros ingresos', icon: 'tag' },
];

export const BUSINESS_KINDS = [
  'Tienda',
  'Restaurante',
  'Agencia',
  'Ecommerce',
  'Servicios profesionales',
  'Freelance',
  'Estudio',
  'Otro',
];

/** % change vs the previous period, or null when there is nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * One short, true sentence about the business (never invented data). Priority: an overdue
 * payment, the month-end projection, the change in expenses, the biggest expense category.
 */
export function businessInsight(s: BusinessSummary, money: (n: number) => string): string | null {
  const overdue = s.nextPayments.filter((p) => p.overdue);
  if (overdue.length > 0) {
    const total = overdue.reduce((a, p) => a + p.amount, 0);
    return overdue.length === 1
      ? `Tienes un pago vencido: ${overdue[0].name} por ${money(total)}.`
      : `Tienes ${overdue.length} pagos vencidos por ${money(total)}.`;
  }
  const p = s.projection;
  if (p.receivable > 0 || p.payable > 0 || p.subscriptions > 0) {
    return p.projected >= 0
      ? `Si se cumplen tus cobros y pagos pendientes, cerrarías el mes con ${money(p.projected)}.`
      : `Con tus pagos pendientes, la caja quedaría en ${money(p.projected)} a fin de mes.`;
  }
  const change = pctChange(s.expense, s.previous.expense);
  if (change !== null && Math.abs(change) >= 10) {
    return change > 0
      ? `Tus gastos subieron ${change}% respecto al periodo anterior.`
      : `Tus gastos bajaron ${Math.abs(change)}% respecto al periodo anterior.`;
  }
  const top = s.byCategory[0];
  if (top && s.expense > 0) {
    const share = Math.round((top.amount / s.expense) * 100);
    if (share >= 30) return `${top.category} es el ${share}% de tus gastos.`;
  }
  return null;
}

const LAST_KEY = 'moneo_last_business';

/** The business last opened on this device (to come back to it from the switch). */
export function lastBusinessId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function rememberBusiness(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch {
    // Storage blocked: the switch falls back to the list.
  }
}

/** /finanzas/negocio/<id>/… → <id>; anything else → null. */
export function businessIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/finanzas\/negocio\/([0-9a-f-]{36})(?:\/|$)/);
  return m ? m[1] : null;
}
