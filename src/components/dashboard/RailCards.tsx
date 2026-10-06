'use client';
import React from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Crown,
  Equal,
  Lightbulb,
  RefreshCw,
  Sprout,
} from 'lucide-react';
import BrandLogo from '@/components/finance/BrandLogo';
import { findBank, findService } from '@/lib/brands';
import { MONTHS_SHORT, type Insight, type UpcomingPayment } from '@/lib/dashboard';
import type { SavingsGoal } from '@/lib/financeStore';
import type { Entitlement } from '@/lib/billing';
import { CardHead, EmptyNote, SmallLink, card, type Money } from './ui';

// ── Próximos pagos ────────────────────────────────────────────────────────────

function dueLabel(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00`);
  const label = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}.`;
  if (date === today) return `Hoy, ${label}`;
  if (date < today) return `Vencido · ${label}`;
  return label;
}

export function UpcomingPayments({
  rows,
  today,
  money,
  hidden,
  error,
  onRetry,
}: {
  rows: UpcomingPayment[];
  today: string;
  money: Money;
  hidden: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className={`${card} p-5`}>
      <CardHead title="Próximos pagos" href="/finanzas/pagos" />
      {error ? (
        <EmptyNote
          action={
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#111] bg-white px-3 py-1.5 text-[13px] font-black"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          }
        >
          No pudimos cargar tus pagos.
        </EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote action={<SmallLink href="/finanzas/pagos">Agregar un pago</SmallLink>}>
          No tienes pagos pendientes.
        </EmptyNote>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Link
                href={r.kind === 'suscripcion' ? '/finanzas/suscripciones' : '/finanzas/pagos'}
                className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-[#FFF9EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]"
              >
                {findService(r.name) || r.kind === 'suscripcion' ? (
                  <BrandLogo kind="subscription" name={r.name} size="md" />
                ) : (
                  <BrandLogo
                    kind="account"
                    name={r.name}
                    institution={findBank(r.name)?.name}
                    type="credito"
                    size="md"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{r.name}</span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-black tabular-nums">
                    {hidden ? '••••' : money(r.amount)}
                  </span>
                  <span
                    className={`block text-xs font-semibold ${r.overdue ? 'text-[#C2321B]' : 'text-gray-500'}`}
                  >
                    {dueLabel(r.date, today)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Mi meta principal ─────────────────────────────────────────────────────────

export function MainGoal({
  goal,
  money,
  hidden,
}: {
  goal: SavingsGoal | null;
  money: Money;
  hidden: boolean;
}) {
  const pct =
    goal && goal.target > 0 ? Math.min(Math.round((goal.current / goal.target) * 100), 100) : 0;
  return (
    <section className="rounded-[22px] border-2 border-[#111] bg-[#FFD83D] p-5 shadow-[0_3px_0_#111]">
      <CardHead title="Mi meta principal" href="/finanzas/ahorros" link="Ver todas" />
      {!goal ? (
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-[#111] bg-white">
            <Sprout className="h-7 w-7" strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-sm font-bold">Aún no tienes metas.</p>
            <div className="mt-1.5">
              <SmallLink href="/finanzas/ahorros">Crear mi meta</SmallLink>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <span
            className="relative grid h-[72px] w-[64px] shrink-0 place-items-end justify-center"
            aria-hidden
          >
            <Sprout className="absolute top-0 h-9 w-9 text-[#0B9A50]" strokeWidth={2.6} />
            <span className="h-8 w-12 rounded-b-xl rounded-t-md border-2 border-[#111] bg-[#FF806E]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{goal.name}</p>
            <p className="mt-0.5 tabular-nums">
              <span className="text-[24px] font-black">
                {hidden ? '••••' : money(goal.current, { decimals: false })}
              </span>
              <span className="text-[17px] font-bold text-[#111]/60">
                {' '}
                / {hidden ? '••••' : money(goal.target, { decimals: false }).replace(/^\S+ /, '')}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="h-3 flex-1 overflow-hidden rounded-full bg-white/80"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Meta ${goal.name}: ${pct}%`}
              >
                <div className="h-full rounded-full bg-[#45D98B]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[15px] font-black text-[#0B7A43]">{pct}%</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Resumen del período ───────────────────────────────────────────────────────

export function PeriodSummary({
  noun,
  income,
  expense,
  money,
  hidden,
}: {
  noun: string;
  income: number;
  expense: number;
  money: Money;
  hidden: boolean;
}) {
  const balance = income - expense;
  const rows = [
    { label: 'Ingresos', value: money(income), icon: ArrowUp, tile: '#DDF7E9', color: '' },
    { label: 'Gastos', value: money(expense), icon: ArrowDown, tile: '#FFE1DB', color: '' },
    {
      label: 'Balance',
      value: money(balance, { sign: true }),
      icon: Equal,
      tile: '#EDE5FF',
      color: balance >= 0 ? 'text-[#0B9A50]' : 'text-[#C2321B]',
    },
  ];
  return (
    <section className={`${card} p-5`}>
      <CardHead title={`Tu resumen ${noun}`} href="/finanzas/reportes" link="Ver detalles" />
      <ul className="divide-y divide-[#111]/10 rounded-2xl border-2 border-[#111]/10">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 px-3 py-2.5">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: r.tile }}
            >
              <r.icon className="h-4 w-4" strokeWidth={2.8} />
            </span>
            <span className="flex-1 text-[14px] font-semibold">{r.label}</span>
            <span className={`text-[17px] font-black tabular-nums ${r.color}`}>
              {hidden ? '••••' : r.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Insight de MONEO ──────────────────────────────────────────────────────────

export function MoneoInsight({ insight }: { insight: Insight | null }) {
  return (
    <section className="rounded-[22px] border-2 border-[#111] bg-[#DDF7E9] p-5 shadow-[0_3px_0_#111]">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-7 w-7 shrink-0" strokeWidth={2.4} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-black">Insight de MONEO</h2>
          <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-gray-800">
            {insight?.text ??
              'Registra tus gastos de unos días y aquí verás cómo cambian tus hábitos.'}
          </p>
        </div>
        <Link
          href="/finanzas/reportes"
          aria-label="Ver reportes"
          className="mt-6 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#111] text-white transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF]"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

// ── MONEO PLUS ────────────────────────────────────────────────────────────────

const PLUS_FEATURES = [
  'MONEO AUTO',
  'MONEO VOZ',
  'Reportes avanzados',
  'Metas inteligentes',
  'Sin anuncios',
];

export function plusStatus(ent: Entitlement | null): { active: boolean; line: string } {
  if (!ent) return { active: false, line: '14 días gratis para probarlo' };
  if (ent.lifetime) return { active: ent.status === 'active', line: 'Plan de por vida' };
  const end = ent.currentPeriodEnd ? new Date(ent.currentPeriodEnd) : null;
  const days = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400e3)) : 0;
  if (!end || days === 0) return { active: false, line: 'Tu plan terminó · Reactívalo' };
  if (ent.status === 'trialing')
    return {
      active: true,
      line: `${days} ${days === 1 ? 'día gratis restante' : 'días gratis restantes'}`,
    };
  if (ent.status === 'cancelled')
    return {
      active: true,
      line: `Activo hasta el ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}.`,
    };
  if (ent.status === 'past_due') return { active: true, line: 'Revisa tu método de pago' };
  return {
    active: true,
    line: ent.planCode === 'plus_yearly' ? 'Plan anual activo' : 'Plan mensual activo',
  };
}

export function PlusCard({
  ent,
  variant,
}: {
  ent: Entitlement | null;
  variant: 'rail' | 'sidebar';
}) {
  const { active, line } = plusStatus(ent);
  const href = active ? '/finanzas/configuracion' : '/empezar?paso=planes';
  if (variant === 'sidebar') {
    return (
      <div className="rounded-[18px] border-2 border-[#111] bg-white p-3 text-[#111] shadow-[0_3px_0_#111]">
        <div className="flex items-center gap-2">
          <Crown className="h-7 w-7 shrink-0 fill-[#FFD83D]" strokeWidth={2.2} />
          <div className="min-w-0">
            <p className="text-[15px] font-black leading-tight">
              MONEO <span className="rounded bg-[#FFD83D] px-1 text-[11px]">PLUS</span>
            </p>
            <p className="truncate text-[11px] font-semibold text-gray-600">{line}</p>
          </div>
        </div>
        <ul className="mt-2 space-y-0.5">
          {PLUS_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12px] font-semibold">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#45D98B]">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className="mt-2.5 flex items-center justify-center gap-1 rounded-xl border-2 border-[#111] bg-[#FFD83D] py-1.5 text-[13px] font-black shadow-[0_2px_0_#111] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]"
        >
          {active ? 'Ver mi plan' : 'Probar gratis'} →
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-[22px] border-2 border-[#111] bg-[#FFE1DB] p-5 text-[#111] shadow-[0_3px_0_#111] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF]"
    >
      <Crown className="h-12 w-12 shrink-0 fill-[#FFD83D]" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[22px] font-black leading-tight">MONEO PLUS</span>
        <span className="block text-[15px] font-black">{line}</span>
        <span className="mt-1 block text-[12px] font-semibold text-gray-700">
          {active ? 'Gracias por apoyar MONEO.' : 'Aprovecha todas las funciones premium.'}
        </span>
      </span>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#111] text-white">
        <ChevronRight className="h-5 w-5" />
      </span>
    </Link>
  );
}
