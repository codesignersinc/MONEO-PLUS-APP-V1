'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  FileDown,
  FileSpreadsheet,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import ContextSwitch from '@/components/business/ContextSwitch';
import { Initials } from '@/components/business/kit';
import { useNegocio } from '@/components/business/useNegocio';
import { PeriodFilter, type PeriodState } from '@/components/dashboard/TopBar';
import { card, moneyFormatter } from '@/components/dashboard/ui';
import { MONTHS_SHORT } from '@/lib/dashboard';
import { todayLocal } from '@/lib/dates';
import { pctChange, type BusinessSummary } from '@/lib/business';
import {
  movementsCsv,
  reportBreakdown,
  reportFileName,
  reportInsights,
  reportPeriod,
  type ReportLine,
  type ReportParty,
} from '@/lib/businessReport';
import {
  bizMovementsService,
  businessService,
  partiesService,
  type BizMovement,
  type Party,
} from '@/lib/supabaseBusiness';
import type { Account } from '@/lib/financeStore';
import { useDataChanged } from '@/lib/dataSync';

// MONEO NEGOCIO, fase 5: report of a period — result, flow, categories, customers and
// suppliers, withdrawals and true insights — exportable as CSV (movements) and PDF (print).
// A management report, not accounting: it says so on the printed page.

const fmtDay = (d: string, year = false) => {
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${MONTHS_SHORT[m - 1]}.${year ? ` ${y}` : ''}`;
};

function Change({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs font-semibold text-[#111]/50">sin dato</span>;
  const good = invert ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-black ${good ? 'text-[#15803D]' : 'text-[#B42318]'}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {value > 0 ? '+' : ''}
      {value}%
    </span>
  );
}

function Bars({
  title,
  rows,
  color,
  money,
  empty,
}: {
  title: string;
  rows: ReportLine[];
  color: string;
  money: (n: number) => string;
  empty: string;
}) {
  return (
    <section className={`${card} break-inside-avoid p-5`}>
      <p className="text-sm font-black">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-[#111]/60">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.slice(0, 8).map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-bold">{r.label}</span>
                <span className="shrink-0 font-black tabular-nums">
                  {money(r.amount)} <span className="text-xs text-[#111]/60">· {r.share}%</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-[#111] bg-white">
                <div
                  className="h-full"
                  style={{ width: `${Math.max(2, r.share)}%`, background: color }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function People({
  title,
  rows,
  businessId,
  money,
  empty,
  color,
}: {
  title: string;
  rows: ReportParty[];
  businessId: string;
  money: (n: number) => string;
  empty: string;
  color: string;
}) {
  return (
    <section className={`${card} break-inside-avoid p-5`}>
      <p className="text-sm font-black">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-[#111]/60">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#111]/10">
          {rows.slice(0, 5).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Initials name={p.name} color={color} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/finanzas/negocio/${businessId}/contactos/${p.id}`}
                  className="block truncate text-sm font-black hover:underline"
                >
                  {p.name}
                </Link>
                <p className="text-xs font-semibold text-[#111]/60">
                  {p.count} {p.count === 1 ? 'movimiento' : 'movimientos'}
                </p>
              </div>
              <span className="text-sm font-black tabular-nums">{money(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function BusinessReportPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { businesses } = useNegocio();
  const business = businesses.find((b) => b.id === id);
  const now = useMemo(() => new Date(), []);
  const [periodState, setPeriodState] = useState<PeriodState>({
    kind: 'mes',
    offset: 0,
    custom: { from: '', to: '' },
  });
  const period = useMemo(() => reportPeriod(periodState, now), [periodState, now]);
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [movements, setMovements] = useState<BizMovement[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setError(null);
    setSummary(null);
    Promise.all([
      businessService.summary(id, period.from, period.to),
      bizMovementsService.list(id, { from: period.from, to: period.to }),
      partiesService.list(id),
      businessService.accounts(id),
    ])
      .then(([s, m, p, a]) => {
        setSummary(s);
        setMovements(m);
        setParties(p);
        setAccounts(a);
      })
      .catch(setError);
  }, [id, period.from, period.to]);
  useEffect(load, [load]);
  useDataChanged(load);

  const breakdown = useMemo(() => reportBreakdown(movements, parties), [movements, parties]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError what="el reporte" error={error} onRetry={load} />
      </div>
    );
  }

  const currency = summary?.currency ?? 'PEN';
  const money = moneyFormatter(currency);
  const m = (n: number) => money(n);
  const insights = summary ? reportInsights(summary, breakdown, m) : [];
  const name = business?.name ?? 'Negocio';
  const periodText = `${fmtDay(period.from, period.from.slice(0, 4) !== period.to.slice(0, 4))} – ${fmtDay(period.to, true)}`;
  const maxBar = Math.max(1, ...(summary?.series ?? []).flatMap((s) => [s.income, s.expense]));
  const margin =
    summary && summary.income > 0 ? Math.round((summary.result / summary.income) * 100) : null;

  const exportCsv = () => {
    if (movements.length === 0) {
      toast.showError('No hay movimientos en este periodo.');
      return;
    }
    const csv = movementsCsv(movements, { baseCurrency: currency, accounts, parties });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFileName(name, period.from, period.to, 'csv');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // PDF: the browser's "Guardar como PDF". The page title becomes the suggested file name.
  const exportPdf = () => {
    const title = document.title;
    document.title = reportFileName(name, period.from, period.to, 'pdf').replace(/\.pdf$/, '');
    window.print();
    setTimeout(() => {
      document.title = title;
    }, 500);
  };

  return (
    <div className="print-area mx-auto max-w-5xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6 print:max-w-none print:p-0">
      <div className="print:hidden">
        <ContextSwitch className="mb-4 lg:hidden" />
        <Link
          href={`/finanzas/negocio/${id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm font-black"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> {name}
        </Link>
      </div>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-black leading-tight">Reporte del negocio</h1>
          <p className="text-sm font-semibold text-[#111]/70">
            {name} · {periodText}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!summary}
            className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-white px-3 py-2 text-sm font-black shadow-[0_3px_0_#111] disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" strokeWidth={2.5} /> CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={!summary}
            className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#111] px-3 py-2 text-sm font-black text-white shadow-[0_3px_0_#FFD83D] disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" strokeWidth={2.5} /> PDF
          </button>
        </div>
      </header>

      <div className="mb-4 print:hidden">
        <PeriodFilter value={periodState} onChange={setPeriodState} now={now} />
      </div>

      {!summary ? (
        <div className="h-64 animate-pulse rounded-[22px] border-2 border-[#111]/20 bg-white" />
      ) : (
        <div className="space-y-4">
          {/* Result */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: 'Ingresos',
                value: money(summary.income),
                icon: <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.5} />,
                tone: 'text-[#15803D]',
                change: <Change value={pctChange(summary.income, summary.previous.income)} />,
              },
              {
                label: 'Gastos',
                value: money(summary.expense),
                icon: <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />,
                tone: 'text-[#B42318]',
                change: (
                  <Change value={pctChange(summary.expense, summary.previous.expense)} invert />
                ),
              },
              {
                label: 'Resultado',
                value: money(summary.result, { sign: true }),
                icon: null,
                tone: '',
                change: <Change value={pctChange(summary.result, summary.previous.result)} />,
              },
              {
                label: 'Margen',
                value: margin === null ? '—' : `${margin}%`,
                icon: null,
                tone: '',
                change: (
                  <span className="text-xs font-semibold text-[#111]/60">
                    {breakdown.incomeCount} ingresos · {breakdown.expenseCount} gastos
                  </span>
                ),
              },
            ].map((k) => (
              <div key={k.label} className={`${card} break-inside-avoid p-4`}>
                <p className={`flex items-center gap-1 text-xs font-black ${k.tone}`}>
                  {k.icon} {k.label}
                </p>
                <p className="mt-1 whitespace-nowrap text-[18px] font-black leading-tight tabular-nums sm:text-[22px]">
                  {k.value}
                </p>
                <div className="mt-1">{k.change}</div>
              </div>
            ))}
          </section>
          <p className="-mt-2 text-xs font-semibold text-[#111]/60">
            Comparado con {fmtDay(summary.previous.from)} – {fmtDay(summary.previous.to, true)}. Los
            retiros y aportes no son ingresos ni gastos.
          </p>

          {insights.length > 0 && (
            <section className={`${card} break-inside-avoid bg-[#FFF3C4] p-5`}>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
                <Lightbulb className="h-5 w-5" strokeWidth={2.5} /> Lo que dicen tus números
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-bold">
                {insights.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Flow, six months */}
          <section className={`${card} break-inside-avoid p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-black">Flujo de los últimos 6 meses</p>
              <span className="flex gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#45D98B]" /> Ingresos
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#FF806E]" /> Gastos
                </span>
              </span>
            </div>
            <div
              className="mt-4 grid h-40 grid-cols-6 items-end gap-2"
              role="img"
              aria-label="Ingresos y gastos por mes"
            >
              {summary.series.map((s) => (
                <div key={s.month} className="flex h-full flex-col items-center justify-end gap-1">
                  <div className="flex h-full w-full items-end justify-center gap-1">
                    <span
                      title={`Ingresos ${money(s.income)}`}
                      className="w-1/3 rounded-t-md border-2 border-b-0 border-[#111] bg-[#45D98B]"
                      style={{ height: `${Math.max(2, (s.income / maxBar) * 100)}%` }}
                    />
                    <span
                      title={`Gastos ${money(s.expense)}`}
                      className="w-1/3 rounded-t-md border-2 border-b-0 border-[#111] bg-[#FF806E]"
                      style={{ height: `${Math.max(2, (s.expense / maxBar) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold capitalize">
                    {MONTHS_SHORT[Number(s.month.slice(5, 7)) - 1]}
                  </span>
                </div>
              ))}
            </div>
            <table className="mt-4 w-full text-xs tabular-nums">
              <thead>
                <tr className="text-left text-[#111]/60">
                  <th className="font-black">Mes</th>
                  <th className="text-right font-black">Ingresos</th>
                  <th className="text-right font-black">Gastos</th>
                  <th className="text-right font-black">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {summary.series.map((s) => (
                  <tr key={s.month} className="border-t border-[#111]/10">
                    <td className="py-1 font-bold capitalize">
                      {MONTHS_SHORT[Number(s.month.slice(5, 7)) - 1]} {s.month.slice(0, 4)}
                    </td>
                    <td className="text-right font-bold">{money(s.income)}</td>
                    <td className="text-right font-bold">{money(s.expense)}</td>
                    <td className="text-right font-black">
                      {money(s.income - s.expense, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <Bars
              title="Ingresos por categoría"
              rows={breakdown.incomeByCategory}
              color="#45D98B"
              money={m}
              empty="Sin ingresos en este periodo."
            />
            <Bars
              title="Gastos por categoría"
              rows={breakdown.expenseByCategory}
              color="#FF806E"
              money={m}
              empty="Sin gastos en este periodo."
            />
            <People
              title="Clientes que más te pagaron"
              rows={breakdown.clients}
              businessId={id}
              money={m}
              color="#45D98B"
              empty="Ningún ingreso tiene cliente en este periodo."
            />
            <People
              title="Proveedores a los que más pagaste"
              rows={breakdown.suppliers}
              businessId={id}
              money={m}
              color="#FF806E"
              empty="Ningún gasto tiene proveedor en este periodo."
            />
          </div>

          <section className={`${card} break-inside-avoid p-5`}>
            <p className="text-sm font-black">Otros datos del periodo</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ['Equipo (sueldos y pagos a empleados)', money(breakdown.payroll)],
                ['Ingresos sin cliente asignado', money(breakdown.incomeWithoutClient)],
                ['Retiros para ti (a Personal)', money(breakdown.withdrawals)],
                ['Aportes desde Personal', money(breakdown.contributions)],
                [
                  breakdown.biggestExpense
                    ? `Gasto más grande: ${breakdown.biggestExpense.name}`
                    : 'Gasto más grande',
                  breakdown.biggestExpense ? money(breakdown.biggestExpense.amount) : '—',
                ],
                ['Caja disponible hoy', money(summary.cash)],
                ['Te deben (pendiente)', money(summary.receivable)],
                ['Debes (pendiente)', money(summary.payable)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[#111]/10 pb-1">
                  <dt className="min-w-0 font-semibold text-[#111]/70">{k}</dt>
                  <dd className="shrink-0 whitespace-nowrap text-right font-black tabular-nums">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="text-xs font-semibold text-[#111]/60">
            Reporte de gestión generado por MONEO+ el {fmtDay(todayLocal(), true)} con los
            movimientos que registraste, en {currency}. No es un estado financiero ni reemplaza a tu
            contador. El CSV incluye cada movimiento del periodo.
          </p>
        </div>
      )}
    </div>
  );
}
