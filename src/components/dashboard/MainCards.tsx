'use client';
import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Lightbulb,
  MoreHorizontal,
  ScanLine,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import BrandLogo from '@/components/finance/BrandLogo';
import { findService } from '@/lib/brands';
import type { CategorySpend, BudgetRow } from '@/lib/dashboard';
import { MONTHS_SHORT, txDay } from '@/lib/dashboard';
import type { Transaction } from '@/lib/financeStore';
import {
  BAR_COLORS,
  CardHead,
  EmptyNote,
  SmallLink,
  TILE_COLORS,
  card,
  categoryIcon,
  interactive,
  moneyFormatter,
  type Money,
} from './ui';

// ── Patrimonio total ──────────────────────────────────────────────────────────

const HIDE_KEY = 'moneo:home:hide-amounts';

export function useHiddenAmounts(): [boolean, () => void] {
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setHidden((h) => {
      try {
        window.localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        // per-device convenience only
      }
      return !h;
    });
  return [hidden, toggle];
}

function MiniStat({
  icon: Icon,
  tile,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  tile: string;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/95 px-3 py-2.5 transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#111] motion-reduce:hover:translate-y-0"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[#111]"
        style={{ background: tile }}
      >
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[#111]/80">{label}</span>
        <span className="block truncate text-[17px] font-black tabular-nums">{value}</span>
      </span>
    </Link>
  );
}

export function NetWorthCard({
  netWorth,
  changePct,
  available,
  toPay,
  inGoals,
  money,
  hidden,
  onToggleHidden,
}: {
  netWorth: number;
  changePct: number | null;
  available: number;
  toPay: number;
  inGoals: number;
  money: Money;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const show = (n: number) => (hidden ? `${money(0).split(' ')[0]} ••••` : money(n));
  return (
    <section
      aria-label="Tu patrimonio total"
      className="relative mt-10 rounded-[24px] border-2 border-[#111] bg-[#FFD83D] p-5 shadow-[0_3px_0_#111] sm:p-6 lg:mt-12"
    >
      <Image
        src="/assets/images/home/monedas-patrimonio.webp"
        alt=""
        aria-hidden
        width={500}
        height={333}
        priority
        className="pointer-events-none absolute -right-3 -top-14 z-10 w-[168px] select-none drop-shadow-[0_6px_0_rgba(17,17,17,0.12)] sm:-top-16 sm:w-[270px] lg:-right-5 lg:-top-[86px] lg:w-[350px] xl:w-[390px]"
      />
      <div className="relative">
        <div className="relative z-20 flex items-center gap-2">
          <h2 className="text-[15px] font-black sm:text-[17px]">Tu patrimonio total</h2>
          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            aria-pressed={hidden}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111]"
          >
            {hidden ? (
              <EyeOff className="h-[18px] w-[18px]" />
            ) : (
              <Eye className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 pr-[40px] sm:pr-[230px] lg:pr-[310px] xl:pr-[350px]">
          <p className="whitespace-nowrap text-[34px] font-black leading-none tracking-tight tabular-nums sm:text-[52px]">
            {show(netWorth)}
          </p>
          {changePct !== null && !hidden && (
            <span className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[15px] font-black ${
                  changePct >= 0 ? 'bg-[#45D98B]' : 'bg-[#FF806E]'
                }`}
              >
                {changePct >= 0 ? (
                  <ArrowUp className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <ArrowDown className="h-4 w-4" strokeWidth={3} />
                )}
                {changePct >= 0 ? '+' : ''}
                {changePct}%
              </span>
              <span className="text-sm font-semibold text-[#111]/80">vs. mes anterior</span>
            </span>
          )}
        </div>
        <div className="relative z-20 mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:mr-[40px] xl:mr-[120px]">
          <MiniStat
            icon={Wallet}
            tile="#DCEBFF"
            label="Disponible"
            value={show(available)}
            href="/finanzas/cuentas"
          />
          <MiniStat
            icon={CalendarDays}
            tile="#FFE1DB"
            label="Por pagar"
            value={show(toPay)}
            href="/finanzas/pagos"
          />
          <MiniStat
            icon={Target}
            tile="#FFD6E8"
            label="En metas"
            value={show(inGoals)}
            href="/finanzas/ahorros"
          />
        </div>
      </div>
    </section>
  );
}

// ── Acciones rápidas ──────────────────────────────────────────────────────────

export type QuickAction = 'enviar' | 'recibir' | 'pagar' | 'transferir' | 'escanear' | 'mas';

const ACTIONS: { id: QuickAction; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'enviar', label: 'Enviar', icon: ArrowUp, color: '#45D98B' },
  { id: 'recibir', label: 'Recibir', icon: ArrowDown, color: '#FFD83D' },
  { id: 'pagar', label: 'Pagar', icon: FileText, color: '#B99CFF' },
  { id: 'transferir', label: 'Transferir', icon: ArrowLeftRight, color: '#75B8FF' },
  { id: 'escanear', label: 'Escanear', icon: ScanLine, color: '#FF806E' },
  { id: 'mas', label: 'Más', icon: MoreHorizontal, color: '#EDEDEA' },
];

export function QuickActions({ onAction }: { onAction: (a: QuickAction) => void }) {
  return (
    <nav aria-label="Acciones rápidas" className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-3">
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onAction(a.id)}
          className={`${card} ${interactive} flex min-h-[88px] flex-col items-center justify-center gap-2 px-2 py-3`}
        >
          <span
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#111]"
            style={{ background: a.color }}
          >
            <a.icon className="h-5 w-5" strokeWidth={2.6} />
          </span>
          <span className="text-[14px] font-bold">{a.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── Gastos del período ────────────────────────────────────────────────────────

export function SpendingCard({
  noun,
  periodLabel,
  total,
  changePct,
  compareLabel,
  categories,
  money,
  hidden,
  onPrev,
  onNext,
  canNext,
  onAdd,
}: {
  noun: string;
  periodLabel: string;
  total: number;
  changePct: number | null;
  compareLabel: string;
  categories: CategorySpend[];
  money: Money;
  hidden: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  canNext: boolean;
  onAdd: () => void;
}) {
  const max = Math.max(...categories.map((c) => c.amount), 1);
  const nav =
    'grid h-7 w-7 place-items-center rounded-full border-2 border-[#111] bg-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]';
  return (
    <section className={`${card} p-5`}>
      <CardHead
        icon={<CalendarDays className="h-5 w-5" strokeWidth={2.4} />}
        title={`Gastos ${noun}`}
        href="/finanzas/movimientos?tipo=gastos"
        right={
          <span className="hidden min-w-0 items-center gap-1.5 text-[13px] font-semibold text-gray-700 sm:flex">
            <span className="truncate whitespace-nowrap">{periodLabel}</span>
            {onPrev && (
              <>
                <button
                  type="button"
                  onClick={onPrev}
                  aria-label="Período anterior"
                  className={nav}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canNext}
                  aria-label="Período siguiente"
                  className={nav}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[34px] font-black leading-none tracking-tight tabular-nums">
          {hidden ? '••••' : money(total)}
        </p>
        {changePct !== null && (
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-black ${
              changePct > 0 ? 'bg-[#FFE1DB] text-[#C2321B]' : 'bg-[#DDF7E9] text-[#0B7A43]'
            }`}
          >
            {changePct > 0 ? (
              <ArrowUp className="h-4 w-4" strokeWidth={3} />
            ) : (
              <ArrowDown className="h-4 w-4" strokeWidth={3} />
            )}
            {Math.abs(changePct)}%
          </span>
        )}
        {changePct !== null && (
          <span className="text-[13px] font-semibold text-gray-600">{compareLabel}</span>
        )}
      </div>
      {categories.length === 0 ? (
        <div className="mt-4">
          <EmptyNote
            action={
              <button
                type="button"
                onClick={onAdd}
                className="rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-1.5 text-[13px] font-black shadow-[0_2px_0_#111]"
              >
                Registrar un gasto
              </button>
            }
          >
            Aún no hay gastos en este período.
          </EmptyNote>
        </div>
      ) : (
        <ul
          className="mt-5 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6"
          aria-label="Gastos por categoría"
        >
          {categories.map((c, i) => {
            const Icon = categoryIcon(c.category);
            return (
              <li key={c.category} className="flex min-w-0 flex-col items-center text-center">
                <div className="flex h-[96px] w-full items-end justify-center sm:h-[104px]">
                  <div
                    className="w-[70%] max-w-[58px] rounded-t-xl motion-safe:animate-slide-up"
                    style={{
                      height: `${Math.max((c.amount / max) * 100, 6)}%`,
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                    aria-hidden
                  />
                </div>
                <Icon className="mt-2 h-5 w-5" strokeWidth={2.4} aria-hidden />
                <span className="mt-1 text-[14px] font-black tabular-nums">
                  {hidden ? '••••' : money(c.amount, { decimals: false })}
                </span>
                <span className="w-full truncate text-xs font-semibold text-gray-600">
                  {c.category}
                </span>
                <span className="text-xs font-semibold text-gray-500">{Math.round(c.pct)}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Presupuesto ───────────────────────────────────────────────────────────────

export function BudgetCard({
  rows,
  money,
  hidden,
}: {
  rows: BudgetRow[];
  money: Money;
  hidden: boolean;
}) {
  const shown = [...rows].sort((a, b) => b.pct - a.pct).slice(0, 5);
  return (
    <section className={`${card} p-5`}>
      <CardHead title="Presupuesto" href="/finanzas/presupuesto" />
      {shown.length === 0 ? (
        <EmptyNote action={<SmallLink href="/finanzas/presupuesto">Crear presupuesto</SmallLink>}>
          Ponle un límite a tus categorías y MONEO te avisa antes de pasarte.
        </EmptyNote>
      ) : (
        <ul className="space-y-3.5">
          {shown.map((r, i) => {
            const Icon = categoryIcon(r.name);
            const over = r.pct >= 100;
            const color = over ? '#FF806E' : BAR_COLORS[i % 4];
            return (
              <li key={r.id} className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[#111]"
                  style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-bold">{r.name}</span>
                    <span className="shrink-0 text-[13px] tabular-nums">
                      <b>{hidden ? '••' : money(r.spent, { decimals: false })}</b>
                      <span className="text-gray-500">
                        {' '}
                        / {hidden ? '••' : money(r.budget, { decimals: false })}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F1F1EF]"
                      role="progressbar"
                      aria-valuenow={r.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${r.name}: ${r.pct}% usado`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(r.pct, 100)}%`, background: color }}
                      />
                    </div>
                    <span
                      className={`w-11 text-right text-xs font-black tabular-nums ${over ? 'text-[#C2321B]' : 'text-gray-600'}`}
                    >
                      {r.pct}%
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Movimientos recientes ─────────────────────────────────────────────────────

type TxTab = 'todos' | 'gastos' | 'ingresos' | 'transferencias' | 'suscripciones';
const TABS: { id: TxTab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'transferencias', label: 'Transferencias' },
  { id: 'suscripciones', label: 'Suscripciones' },
];

function timeLabel(t: Transaction, today: string, yesterday: string): string {
  const day = txDay(t);
  const d = new Date(`${day}T00:00:00`);
  const when =
    day === today
      ? 'Hoy'
      : day === yesterday
        ? 'Ayer'
        : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return t.time ? `${when}, ${t.time}` : when;
}

export function RecentTransactions({
  txs,
  subscriptionNames,
  baseCurrency,
  hidden,
  today,
  yesterday,
}: {
  txs: Transaction[];
  subscriptionNames: string[];
  baseCurrency: string;
  hidden: boolean;
  today: string;
  yesterday: string;
}) {
  const [tab, setTab] = useState<TxTab>('todos');
  const subs = useMemo(
    () => new Set(subscriptionNames.map((s) => s.toLowerCase())),
    [subscriptionNames]
  );
  const isSub = (t: Transaction) => /suscrip/i.test(t.category) || subs.has(t.name.toLowerCase());
  const list = txs
    .filter((t) => !(t.type === 'transferencia' && t.transferLeg === 'in'))
    .filter((t) =>
      tab === 'todos'
        ? true
        : tab === 'gastos'
          ? t.type === 'gasto'
          : tab === 'ingresos'
            ? t.type === 'ingreso'
            : tab === 'transferencias'
              ? t.type === 'transferencia'
              : isSub(t)
    )
    .slice(0, 5);

  return (
    <section className={`${card} p-5`}>
      <CardHead title="Movimientos recientes" href="/finanzas/movimientos" />
      <div
        role="tablist"
        aria-label="Filtrar movimientos"
        className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF] ${
              tab === t.id
                ? 'border-2 border-[#111] bg-[#FFD83D]'
                : 'border-2 border-transparent bg-[#F4F3EF] text-gray-700 hover:bg-[#ECEAE3]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyNote>
          No hay movimientos {tab === 'todos' ? 'en este período' : 'de este tipo en este período'}.
        </EmptyNote>
      ) : (
        <ul className="divide-y divide-[#111]/10">
          {list.map((t, i) => {
            const income = t.type === 'ingreso';
            const transfer = t.type === 'transferencia';
            const service = findService(t.name);
            const Icon = categoryIcon(transfer ? 'transferencia' : t.category);
            const chip = income
              ? 'Ingreso'
              : transfer
                ? 'Transferencia'
                : isSub(t)
                  ? 'Suscripción'
                  : t.category;
            const chipColor = income
              ? '#DDF7E9'
              : transfer
                ? '#DCEBFF'
                : isSub(t)
                  ? '#EDE5FF'
                  : TILE_COLORS[(i + 1) % TILE_COLORS.length];
            return (
              <li key={t.id}>
                <Link
                  href="/finanzas/movimientos"
                  className="flex items-center gap-3 rounded-xl py-2.5 hover:bg-[#FFF9EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]"
                >
                  {service ? (
                    <BrandLogo kind="subscription" name={t.name} size="sm" />
                  ) : (
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-[#111]"
                      style={{ background: income ? '#DDF7E9' : transfer ? '#DCEBFF' : '#FFF3B8' }}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{t.name}</span>
                    <span className="block text-xs font-medium text-gray-500">
                      {timeLabel(t, today, yesterday)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-right text-[14px] font-black tabular-nums ${income ? 'text-[#0B9A50]' : ''}`}
                  >
                    {hidden
                      ? '••••'
                      : `${income ? '+ ' : '- '}${moneyFormatter(t.currencyCode || baseCurrency)(Math.abs(t.originalAmount ?? t.amount))}`}
                  </span>
                  <span
                    className="hidden w-[104px] shrink-0 truncate rounded-lg px-2 py-1 text-center text-xs font-bold sm:block"
                    style={{ background: chipColor }}
                  >
                    {chip}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Consejo de hoy ────────────────────────────────────────────────────────────

export interface Advice {
  title: string;
  text: string;
  cta: string;
  href: string;
}

export function TodayAdvice({ tips }: { tips: Advice[] }) {
  const [i, setI] = useState(0);
  if (tips.length === 0) return null;
  const tip = tips[i % tips.length];
  const nav =
    'grid h-7 w-7 place-items-center rounded-full border-2 border-[#111] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]';
  return (
    <section className="relative overflow-hidden rounded-[22px] border-2 border-[#111] bg-[#EDE5FF] p-5 shadow-[0_3px_0_#111]">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-5 w-5" strokeWidth={2.4} aria-hidden />
        <h2 className="flex-1 text-[16px] font-black">Consejo de hoy</h2>
        {tips.length > 1 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            {(i % tips.length) + 1} de {tips.length}
            <button
              type="button"
              aria-label="Consejo anterior"
              className={nav}
              onClick={() => setI((v) => (v + tips.length - 1) % tips.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Siguiente consejo"
              className={nav}
              onClick={() => setI((v) => (v + 1) % tips.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>
      <div className="relative pr-[96px] sm:pr-[130px]">
        <p className="text-[18px] font-black leading-tight">{tip.title}</p>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-800">{tip.text}</p>
        <Link
          href={tip.href}
          className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#111] px-5 py-3 text-[13px] font-black text-white transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF]"
        >
          {tip.cta} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <Image
        src="/assets/images/home/monedas-patrimonio.webp"
        alt=""
        aria-hidden
        width={440}
        height={293}
        className="pointer-events-none absolute -bottom-3 -right-4 w-[140px] rotate-6 select-none sm:w-[180px]"
      />
    </section>
  );
}
