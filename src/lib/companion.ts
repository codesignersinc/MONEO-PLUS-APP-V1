import { monthNames } from '@/lib/format';
// Pure texts for MONEO Mini / widgets built from the MONEO Core summary.

const MONTHS = monthNames('short');

/** "20 oct" from YYYY-MM-DD. */
export function shortDate(ymd: string): string {
  const [, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** When a payment is due, relative to today: "Hoy", "Mañana", "En 3 días", "Vencido". */
export function dueLabel(date: string, today: string, overdue = false): string {
  const n = daysBetween(today, date);
  if (overdue || n < 0) return 'Vencido';
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n <= 7) return `En ${n} días`;
  return shortDate(date);
}

/** Under "Puedes gastar hoy": what the estimate covers. */
export function safeToSpendHint(s: {
  until: string;
  untilKind: 'proximo_ingreso' | 'fin_de_mes';
  days: number;
}): string {
  const span = s.days === 1 ? 'solo hoy' : `${s.days} días`;
  return s.untilKind === 'proximo_ingreso'
    ? `Hasta tu próximo ingreso, el ${shortDate(s.until)} (${span})`
    : `Hasta fin de mes (${span})`;
}
