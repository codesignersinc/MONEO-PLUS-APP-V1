'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Landmark,
  Lightbulb,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import ContextSwitch from '@/components/business/ContextSwitch';
import BusinessEntrySheet, {
  type BusinessEntryMode,
} from '@/components/business/BusinessEntrySheet';
import { useNegocio } from '@/components/business/useNegocio';
import { PeriodFilter, type PeriodState } from '@/components/dashboard/TopBar';
import { card, moneyFormatter } from '@/components/dashboard/ui';
import { useAuth } from '@/contexts/AuthContext';
import { buildPeriod, MONTHS_SHORT, type Period } from '@/lib/dashboard';
import { businessInsight, pctChange, type BusinessSummary } from '@/lib/business';
import { businessService } from '@/lib/supabaseBusiness';
import { useDataChanged } from '@/lib/dataSync';

// MONEO NEGOCIO dashboard (docs/moneo-negocio.md, fase 2): result of the period, cash,
// what you are owed and owe, month-end projection and a true insight. Numbers come from
// business_summary() in the database.

function periodOf(p: PeriodState, now: Date): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p.kind === 'mes') return buildPeriod('mes', new Date(y, m + p.offset, 15));
  if (p.kind === 'trimestre') return buildPeriod('trimestre', new Date(y, m + 3 * p.offset, 15));
  if (p.kind === 'anio') return buildPeriod('anio', new Date(y + p.offset, 5, 15));
  return buildPeriod('custom', now, p.custom);
}

const shortDate = (d: string) => {
  const [, mm, dd] = d.split('-').map(Number);
  return `${dd} ${MONTHS_SHORT[mm - 1]}.`;
};

function Change({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
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

export default function BusinessDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { businesses } = useNegocio();
  const business = businesses.find((b) => b.id === id);
  const now = useMemo(() => new Date(), []);
  const [periodState, setPeriodState] = useState<PeriodState>({
    kind: 'mes',
    offset: 0,
    custom: { from: '', to: '' },
  });
  const period = useMemo(() => periodOf(periodState, now), [periodState, now]);
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [entry, setEntry] = useState<BusinessEntryMode | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([businessService.summary(id, period.from, period.to), businessService.accounts(id)])
      .then(([s, accounts]) => {
        setSummary(s);
        setAccountCount(accounts.length);
      })
      .catch(setError);
  }, [id, period.from, period.to]);

  useEffect(load, [load]);
  useDataChanged(load);

  // The mobile "+" opens the business entry here.
  useEffect(() => {
    const open = () => setEntry('gasto');
    window.addEventListener('moneo:negocio-nuevo', open);
    return () => window.removeEventListener('moneo:negocio-nuevo', open);
  }, []);

  const firstName =
    String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '').split(' ')[0] || '';

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError what="tu negocio" error={error} onRetry={load} />
      </div>
    );
  }

  const money = moneyFormatter(summary?.currency ?? 'PEN');
  const insight = summary ? businessInsight(summary, (n) => money(n)) : null;
  const maxBar = Math.max(1, ...(summary?.series ?? []).flatMap((s) => [s.income, s.expense]));
  const p = summary?.projection;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-black leading-tight lg:text-[32px]">
            {firstName ? `Hola, ${firstName}` : 'Tu negocio'}
          </h1>
          <p className="truncate text-sm font-semibold text-[#111]/70">
            {business ? business.name : ' '}
            {business?.kind ? ` · ${business.kind}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEntry('ingreso')}
            className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#45D98B] px-3 py-2 text-sm font-black shadow-[0_3px_0_#111]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Ingreso
          </button>
          <button
            type="button"
            onClick={() => setEntry('gasto')}
            className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#FF806E] px-3 py-2 text-sm font-black shadow-[0_3px_0_#111]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Gasto
          </button>
        </div>
      </header>

      <div className="mb-4">
        <PeriodFilter value={periodState} onChange={setPeriodState} now={now} />
      </div>

      {accountCount === 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-[22px] border-2 border-[#111] bg-[#FFF3C4] p-4 sm:flex-row sm:items-center">
          <Landmark className="h-6 w-6 shrink-0" strokeWidth={2.5} />
          <p className="flex-1 text-sm font-bold">
            Agrega la cuenta de tu negocio (banco, caja o billetera) para empezar a registrar.
          </p>
          <Link
            href={`/finanzas/negocio/${id}/cuentas`}
            className="paper-opaque rounded-xl border-2 border-[#111] bg-[#111] px-4 py-2 text-center text-sm font-black text-white"
          >
            Agregar cuenta
          </Link>
        </div>
      )}

      {!summary ? (
        <div className="h-64 animate-pulse rounded-[22px] border-2 border-[#111]/20 bg-white" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Result of the period */}
          <section
            className={`${card} p-5 lg:col-span-2 ${summary.result >= 0 ? 'bg-[#DDF7E9]' : 'bg-[#FFE1DB]'}`}
          >
            <p className="text-sm font-black">Resultado {period.noun}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <p className="text-[38px] font-black leading-none tabular-nums">
                {money(summary.result, { sign: true })}
              </p>
              <Change value={pctChange(summary.result, summary.previous.result)} />
              <span className="text-xs font-semibold text-[#111]/60">{period.compareLabel}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-[#111] bg-white p-3">
                <p className="flex items-center gap-1 text-xs font-black text-[#15803D]">
                  <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.5} /> Ingresos
                </p>
                <p className="mt-1 text-xl font-black tabular-nums">{money(summary.income)}</p>
                <Change value={pctChange(summary.income, summary.previous.income)} />
              </div>
              <div className="rounded-2xl border-2 border-[#111] bg-white p-3">
                <p className="flex items-center gap-1 text-xs font-black text-[#B42318]">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} /> Gastos
                </p>
                <p className="mt-1 text-xl font-black tabular-nums">{money(summary.expense)}</p>
                <Change value={pctChange(summary.expense, summary.previous.expense)} invert />
              </div>
            </div>
          </section>

          {/* Cash: what you have, apart from what you are owed and owe */}
          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-black">Caja disponible</p>
              <Link
                href={`/finanzas/negocio/${id}/cuentas`}
                className="text-xs font-bold text-[#2F62F0] hover:underline"
              >
                Cuentas
              </Link>
            </div>
            <p className="mt-1 text-[30px] font-black leading-none tabular-nums">
              {money(summary.cash)}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-[#111]/70">Te deben</dt>
                <dd className="font-black tabular-nums text-[#15803D]">
                  {money(summary.receivable)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-[#111]/70">Debes</dt>
                <dd className="font-black tabular-nums text-[#B42318]">{money(summary.payable)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-[#111]/70">Comprometido este mes</dt>
                <dd className="font-black tabular-nums">{money(summary.committed)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setEntry('retiro')}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#111] bg-white py-2 text-xs font-black"
            >
              <ArrowRightLeft className="h-4 w-4" strokeWidth={2.5} /> Retiro o aporte
            </button>
          </section>

          {/* Month-end projection, with its assumptions */}
          {p && (
            <section className={`${card} p-5`}>
              <p className="text-sm font-black">Cierre estimado al {shortDate(p.until)}</p>
              <p className="mt-1 text-[30px] font-black leading-none tabular-nums">
                {money(p.projected)}
              </p>
              <dl className="mt-4 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="font-semibold text-[#111]/70">Caja hoy</dt>
                  <dd className="font-bold tabular-nums">{money(p.cash)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-[#111]/70">Cobros pendientes</dt>
                  <dd className="font-bold tabular-nums text-[#15803D]">+ {money(p.receivable)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-[#111]/70">Pagos pendientes</dt>
                  <dd className="font-bold tabular-nums text-[#B42318]">- {money(p.payable)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-[#111]/70">Suscripciones</dt>
                  <dd className="font-bold tabular-nums text-[#B42318]">
                    - {money(p.subscriptions)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {/* Flow: income vs expenses, last 6 months */}
          <section className={`${card} p-5 lg:col-span-2`}>
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
          </section>

          {/* Upcoming payments and collections */}
          <section className={`${card} p-5`}>
            <p className="text-sm font-black">Próximos pagos</p>
            {summary.nextPayments.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-[#111]/60">
                No tienes pagos pendientes.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[#111]/10">
                {summary.nextPayments.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{d.party || d.name}</span>
                      <span
                        className={`text-xs font-semibold ${d.overdue ? 'text-[#B42318]' : 'text-[#111]/60'}`}
                      >
                        {d.overdue ? 'Vencido · ' : 'Vence '}
                        {shortDate(d.due)}
                      </span>
                    </span>
                    <span className="text-sm font-black tabular-nums">{money(d.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={`${card} p-5`}>
            <p className="text-sm font-black">Por cobrar</p>
            {summary.nextCollections.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-[#111]/60">
                No tienes cobros pendientes.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[#111]/10">
                {summary.nextCollections.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{d.party || d.name}</span>
                      <span
                        className={`text-xs font-semibold ${d.overdue ? 'text-[#B42318]' : 'text-[#111]/60'}`}
                      >
                        {d.overdue ? 'Vencido · ' : 'Vence '}
                        {shortDate(d.due)}
                      </span>
                    </span>
                    <span className="text-sm font-black tabular-nums text-[#15803D]">
                      {money(d.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {insight && (
            <section className={`${card} flex items-start gap-3 bg-[#FFF3C4] p-5`}>
              <Lightbulb className="h-6 w-6 shrink-0" strokeWidth={2.5} />
              <div>
                <p className="text-xs font-black uppercase tracking-wide">MONEO te cuenta</p>
                <p className="mt-1 text-sm font-bold">{insight}</p>
              </div>
            </section>
          )}
        </div>
      )}

      {entry && (
        <BusinessEntrySheet
          businessId={id}
          mode={entry}
          onClose={() => setEntry(null)}
          onSaved={() => {
            setEntry(null);
            load();
          }}
        />
      )}
    </div>
  );
}
