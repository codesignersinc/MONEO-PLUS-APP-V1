'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Repeat,
  Scale,
  Settings,
  Sparkles,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import {
  card,
  categoryIcon,
  BAR_COLORS,
  EmptyNote,
  moneyFormatter,
} from '@/components/dashboard/ui';
import { todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import {
  annualProjection,
  averageMonthly,
  budgetProgress,
  budgetsCrossing,
  categoryTotals,
  changePct,
  emergencyFundTarget,
  topInsight,
  type HouseholdBudget,
  householdShares,
  inMonth,
  latestRecurring,
  monthKey,
  monthLabel,
  monthSummary,
  settleUp,
  shiftMonth,
  upcomingPayments,
  type HouseholdExpense,
  type HouseholdSettlement,
  type SplitMethod,
} from '@/lib/household';
import {
  householdBudgetsService,
  householdExpensesService,
  householdGoalsService,
  householdService,
  householdSettlementsService,
  type HouseholdGoal,
  type MyHousehold,
} from '@/lib/supabaseHousehold';
import { getCurrencyInfo } from '@/lib/currency';
import BudgetTab from '@/components/household/BudgetTab';
import GoalsTab, { type GoalDraft } from '@/components/household/GoalsTab';
import SimulatorTab from '@/components/household/SimulatorTab';
import HouseholdPlusLocked from '@/components/household/HouseholdPlusLocked';
import { Avatar, Choice, memberColor } from '@/components/household/ui';
import ExpenseSheet from '@/components/household/ExpenseSheet';
import InviteSheet from '@/components/household/InviteSheet';
import SettingsSheet from '@/components/household/SettingsSheet';
import SettleSheet from '@/components/household/SettleSheet';

type Tab = 'resumen' | 'gastos' | 'presupuesto' | 'metas' | 'pagos' | 'simulador' | 'movimientos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'presupuesto', label: 'Presupuesto' },
  { id: 'metas', label: 'Metas' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'simulador', label: 'Simulador' },
  { id: 'movimientos', label: 'Movimientos' },
];

const STATUS_LABEL: Record<HouseholdSettlement['status'], string> = {
  proposed: 'Pendiente',
  deferred: 'Para el próximo mes',
  waived: 'Sin compensación',
  settled: 'Saldada',
};

function fmtDay(ymd: string) {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
  });
}

export default function HouseholdView({
  data,
  onReload,
  onGone,
}: {
  data: MyHousehold;
  onReload: () => void;
  onGone: () => void;
}) {
  const { household, members, me } = data;
  const toast = useToast();
  const money = useMemo(() => moneyFormatter(household.baseCurrency), [household.baseCurrency]);
  const nameOf = useCallback(
    (id: string) => members.find((m) => m.id === id)?.displayName ?? '—',
    [members]
  );
  const active = members.filter((m) => m.status === 'active');
  const isOwner = me.role === 'owner';

  const [tab, setTab] = useState<Tab>('resumen');
  const [month, setMonth] = useState(monthKey(todayLocal()));
  const [expenses, setExpenses] = useState<HouseholdExpense[] | null>(null);
  const [recurring, setRecurring] = useState<HouseholdExpense[]>([]);
  const [settlements, setSettlements] = useState<HouseholdSettlement[]>([]);
  const [budgets, setBudgets] = useState<HouseholdBudget[]>([]);
  const [goals, setGoals] = useState<HouseholdGoal[]>([]);
  // PLUS for the whole household when one member has it (undefined while loading).
  const [hasPlus, setHasPlus] = useState<boolean | undefined>(undefined);
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [sheet, setSheet] = useState<
    | null
    | { kind: 'expense'; expense?: HouseholdExpense; prefill?: Partial<HouseholdExpense> }
    | { kind: 'invite' }
    | { kind: 'settings' }
    | { kind: 'settle'; settlement: HouseholdSettlement; side: 'pay' | 'receive' }
  >(null);
  const [personTab, setPersonTab] = useState<string>(me.id);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    // A year of history (Movimientos) is enough for the views of this phase.
    const from = `${shiftMonth(monthKey(todayLocal()), -12)}-01`;
    Promise.all([
      householdExpensesService.list(household.id, from),
      householdExpensesService.recurring(household.id),
      householdSettlementsService.list(household.id, from),
      householdBudgetsService.list(household.id),
      householdGoalsService.list(household.id),
    ])
      .then(([e, r, s, b, g]) => {
        setExpenses(e);
        setRecurring(r);
        setSettlements(s);
        setBudgets(b);
        setGoals(g);
      })
      .catch(setLoadError);
    householdService
      .hasPlus(household.id)
      .then(setHasPlus)
      .catch(() => setHasPlus(false));
  }, [household.id]);

  useEffect(() => {
    load();
  }, [load]);

  // After a new expense: tell the household once when a budget crosses 80%.
  const afterSave = async () => {
    setSheet(null);
    const thisMonth = monthKey(todayLocal());
    const before = budgetProgress(budgets, inMonth(expenses ?? [], thisMonth));
    load();
    try {
      const fresh = await householdExpensesService.list(household.id, `${thisMonth}-01`);
      for (const b of budgetsCrossing(before, budgetProgress(budgets, fresh))) {
        householdService.notify(
          household.id,
          'household_budget',
          `Presupuesto de ${b.category} al ${b.pct >= 100 ? '100' : '80'}%`,
          `El hogar ya usó el ${b.pct}% del presupuesto de ${b.category} de este mes.`
        );
      }
    } catch {
      // the notice is a courtesy
    }
  };

  const monthExpenses = useMemo(() => inMonth(expenses ?? [], month), [expenses, month]);
  const prevExpenses = useMemo(
    () => inMonth(expenses ?? [], shiftMonth(month, -1)),
    [expenses, month]
  );
  const summary = useMemo(() => monthSummary(monthExpenses, members), [monthExpenses, members]);
  const prevTotal = prevExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const change = changePct(summary.total, prevTotal);
  const period = `${month}-01`;
  const monthSettlements = settlements.filter((s) => s.period === period);
  const pendingTransfers = settleUp(summary, monthSettlements);
  const cats = categoryTotals(monthExpenses);
  const upcoming = upcomingPayments(latestRecurring(recurring), todayLocal());
  const sym = getCurrencyInfo(household.baseCurrency).symbol;
  const insight = topInsight(monthExpenses);
  const projection = annualProjection(monthExpenses);
  const suggestedEmergency = emergencyFundTarget(
    averageMonthly(expenses ?? [], monthKey(todayLocal())),
    household.emergencyMonths
  );
  const mainGoal = goals.find((g) => g.saved < g.targetAmount) ?? goals[0] ?? null;

  const canEdit = (e: HouseholdExpense) => isOwner || e.createdBy === me.userId;

  const propose = async (
    from: string,
    to: string,
    amount: number,
    status: 'proposed' | 'deferred' | 'waived'
  ) => {
    setBusy(true);
    try {
      await householdSettlementsService.propose(household.id, period, from, to, amount, status);
      track('household_settlement_created', { status });
      if (status === 'proposed') {
        householdService.notify(
          household.id,
          'household_settlement',
          'Compensación pendiente',
          `${me.displayName} registró una compensación del hogar para ${monthLabel(month)}.`
        );
      }
      load();
    } catch (err) {
      toast.showError(err);
    } finally {
      setBusy(false);
    }
  };

  const setMethod = async (method: SplitMethod) => {
    try {
      await householdService.update(household.id, { splitMethod: method });
      onReload();
    } catch (err) {
      toast.showError(err);
    }
  };

  // ---------- Pieces ----------

  const monthNav = (
    <div className="flex items-center gap-1 rounded-2xl border-2 border-[#111] bg-white px-1 py-1">
      <button
        type="button"
        onClick={() => setMonth((m) => shiftMonth(m, -1))}
        aria-label="Mes anterior"
        className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[#FFF9EC]"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[124px] text-center text-[14px] font-black capitalize">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => setMonth((m) => shiftMonth(m, 1))}
        disabled={month >= monthKey(todayLocal())}
        aria-label="Mes siguiente"
        className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[#FFF9EC] disabled:opacity-30"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );

  const hero = (
    <section
      aria-label="Gasto mensual del hogar"
      className="relative mt-8 rounded-[24px] border-2 border-[#111] bg-[#FFD83D] p-5 shadow-[0_3px_0_#111] sm:p-6"
    >
      <Image
        src="/assets/images/home/monedas-patrimonio.webp"
        alt=""
        aria-hidden
        width={500}
        height={333}
        className="pointer-events-none absolute -right-3 -top-12 z-10 w-[150px] select-none sm:w-[210px]"
      />
      <h2 className="pr-[130px] text-[15px] font-black sm:pr-[190px] sm:text-[17px]">
        Gasto mensual del hogar
      </h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 pr-[40px]">
        <p className="whitespace-nowrap text-[34px] font-black leading-none tracking-tight tabular-nums sm:text-[48px]">
          {money(summary.total)}
        </p>
        {change !== null && (
          <span className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[15px] font-black ${change <= 0 ? 'bg-[#45D98B]' : 'bg-[#FF806E]'}`}
            >
              {change > 0 ? (
                <ArrowUp className="h-4 w-4" strokeWidth={3} />
              ) : (
                <ArrowDown className="h-4 w-4" strokeWidth={3} />
              )}
              {change > 0 ? '+' : ''}
              {change}%
            </span>
            <span className="text-sm font-semibold text-[#111]/80">vs. mes anterior</span>
          </span>
        )}
      </div>
      <div
        className={`relative z-20 mt-5 grid gap-2.5 ${summary.members.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}
      >
        {summary.members.map((m) => (
          <div key={m.memberId} className="min-w-0 rounded-2xl bg-white/95 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Avatar
                name={nameOf(m.memberId)}
                color={memberColor(members, m.memberId)}
                size={28}
              />
              <span className="truncate text-[13px] font-black">{nameOf(m.memberId)}</span>
            </div>
            <p className="mt-1 truncate text-[17px] font-black tabular-nums">{money(m.paid)}</p>
            <p className="text-xs font-semibold text-[#111]/70">{m.paidPct}% del total pagado</p>
          </div>
        ))}
      </div>
    </section>
  );

  const methodName: Record<SplitMethod, string> = {
    equal: '50/50',
    income: 'según ingresos',
    custom: 'personalizado',
  };

  const difference = monthExpenses.length > 0 && (
    <section className={`${card} p-5`} aria-label="Diferencia">
      <div className="mb-3 flex items-center gap-2">
        <Scale className="h-5 w-5" />
        <h2 className="text-[17px] font-black">Diferencia del mes</h2>
      </div>
      {pendingTransfers.length === 0 ? (
        <p className="text-[15px] font-bold text-[#111]">
          {monthSettlements.some((s) => s.status === 'proposed')
            ? 'La compensación está registrada: falta que cada persona la confirme.'
            : `✅ Están al día con lo acordado en ${monthLabel(month)}.`}
        </p>
      ) : (
        <div className="space-y-4">
          {pendingTransfers.map((t) => (
            <div key={`${t.from}-${t.to}`} className="space-y-3">
              <p className="text-[15px] font-bold text-[#111]">
                {nameOf(t.to)} aporta <b>{money(t.amount)}</b> más de lo acordado.
              </p>
              <p className="text-[14px] font-semibold text-[#111]/80">
                Para equilibrar ({methodName[household.splitMethod]} y los repartos de cada gasto),{' '}
                {nameOf(t.from)} debería compensar {money(t.amount)}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => propose(t.from, t.to, t.amount, 'proposed')}
                  className="rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-2 text-[13px] font-black shadow-[0_2px_0_#111]"
                >
                  Registrar compensación
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => propose(t.from, t.to, t.amount, 'deferred')}
                  className="rounded-xl border-2 border-[#111] bg-white px-3 py-2 text-[13px] font-black"
                >
                  Dejar para el próximo mes
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => propose(t.from, t.to, t.amount, 'waived')}
                  className="rounded-xl border-2 border-[#111]/30 bg-white px-3 py-2 text-[13px] font-black"
                >
                  Sin compensación
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs font-semibold text-gray-600">
            Nada se cobra solo: una compensación se registra y cada persona confirma con su propia
            cuenta.
          </p>
        </div>
      )}
      {monthSettlements.length > 0 && (
        <ul className="mt-4 space-y-2 border-t-2 border-[#111]/10 pt-3">
          {monthSettlements.map((s) => {
            const open = s.status === 'proposed' || s.status === 'deferred';
            const iPay = s.fromMember === me.id && !s.paidAt && open;
            const iReceive = s.toMember === me.id && !s.receivedAt && open;
            return (
              <li key={s.id} className="rounded-2xl bg-[#FFF9EC] px-3 py-2">
                <p className="text-[14px] font-bold">
                  {nameOf(s.fromMember)} → {nameOf(s.toMember)} · {money(s.amount)}
                </p>
                <p className="text-xs font-semibold text-gray-600">
                  {STATUS_LABEL[s.status]}
                  {s.status !== 'settled' && s.paidAt && ' · pago confirmado'}
                  {s.status !== 'settled' && s.receivedAt && ' · recepción confirmada'}
                </p>
                {(iPay || iReceive) && (
                  <button
                    type="button"
                    onClick={() =>
                      setSheet({ kind: 'settle', settlement: s, side: iPay ? 'pay' : 'receive' })
                    }
                    className="mt-2 rounded-xl border-2 border-[#111] bg-[#45D98B] px-3 py-1.5 text-[13px] font-black"
                  >
                    {iPay ? 'Confirmar que pagué' : 'Confirmar que recibí'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const shares = householdShares(household.splitMethod, members);
  const splitCard = (
    <section className={`${card} p-5`} aria-label="¿Cómo repartir los gastos?">
      <h2 className="mb-1 text-[17px] font-black">¿Cómo repartir los gastos?</h2>
      <p className="mb-3 text-[13px] font-semibold text-gray-600">
        Es el reparto que se propone en cada gasto compartido.
        {!isOwner && ' Solo quien administra el hogar lo cambia.'}
      </p>
      <Choice
        label="Método de reparto"
        value={household.splitMethod}
        onChange={(v) => isOwner && setMethod(v)}
        options={[
          { value: 'equal', label: '50 / 50', hint: 'Ambos aportan lo mismo' },
          { value: 'income', label: 'Proporcional', hint: 'Según sus ingresos' },
          { value: 'custom', label: 'Personalizado', hint: 'El % que prefieran' },
        ]}
      />
      {household.splitMethod !== 'equal' && <IncomeOrCustom data={data} onSaved={onReload} />}
      {shares.ok && household.splitMethod !== 'equal' && (
        <p className="mt-3 text-[14px] font-bold">
          Reparto:{' '}
          {shares.shares
            .map((s) => `${nameOf(s.memberId)} ${Math.round(s.percentage * 10) / 10}%`)
            .join(' · ')}
        </p>
      )}
    </section>
  );

  const categoriesCard = (
    <section className={`${card} p-5`} aria-label="Gastos del hogar por categoría">
      <h2 className="mb-3 text-[17px] font-black">Gastos del hogar por categoría</h2>
      {cats.length === 0 ? (
        <EmptyNote>Agreguen su primer gasto compartido.</EmptyNote>
      ) : (
        <ul className="space-y-2.5">
          {cats.map((c, i) => {
            const Icon = categoryIcon(c.category);
            const pct = summary.total > 0 ? (c.total / summary.total) * 100 : 0;
            return (
              <li key={c.category}>
                <div className="flex items-center gap-2 text-[14px] font-bold">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{c.category}</span>
                  <span className="tabular-nums">{money(c.total)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#F1EDE3]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(3, pct)}%`,
                      background: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const upcomingCard = (
    <section className={`${card} p-5`} aria-label="Próximos pagos del hogar">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-5 w-5" />
        <h2 className="text-[17px] font-black">Próximos pagos del hogar</h2>
      </div>
      {upcoming.length === 0 ? (
        <EmptyNote>Marca un gasto como “Se repite” y aparecerá aquí.</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((e) => {
            const late = (e.nextDate ?? '') < todayLocal();
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-[#FFF9EC] px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-black">{e.name}</span>
                  <span
                    className={`block text-xs font-semibold ${late ? 'text-[#B42318]' : 'text-gray-600'}`}
                  >
                    {late ? 'Venció el ' : ''}
                    {fmtDay(e.nextDate ?? '')} · {nameOf(e.paidBy)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[14px] font-black tabular-nums">
                    {money(e.baseAmount)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSheet({
                        kind: 'expense',
                        prefill: { ...e, expenseDate: e.nextDate ?? todayLocal() },
                      })
                    }
                    className="text-xs font-black text-[#2F62F0] underline"
                  >
                    Registrar pago
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const insightCard = insight && (
    <section className={`${card} p-5`} aria-label="Insight de MONEO">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        <h2 className="text-[17px] font-black">Insight de MONEO</h2>
      </div>
      <p className="text-[15px] font-bold">
        Su hogar gasta {money(insight.monthly)} al mes en {insight.category.toLowerCase()} (
        {insight.pct}% del mes).
      </p>
      <p className="mt-1 text-[14px] font-semibold text-gray-700">
        Reducir 10% liberaría aproximadamente {money(insight.tenPercent)} al mes.
      </p>
      <button
        type="button"
        onClick={() => {
          setGoalDraft({
            kind: 'other',
            name: `Ahorro en ${insight.category.toLowerCase()}`,
            target: String(Math.round(insight.tenPercent * 12)),
          });
          setTab('metas');
        }}
        className="mt-3 rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-2 text-[13px] font-black shadow-[0_2px_0_#111]"
      >
        Crear meta
      </button>
    </section>
  );

  const projectionCard = projection.total > 0 && (
    <section className={`${card} p-5`} aria-label="Proyección anual">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-5 w-5" />
        <h2 className="text-[17px] font-black">Proyección anual</h2>
      </div>
      <p className="text-[13px] font-semibold text-gray-600">
        Si cada mes fuera como {monthLabel(month)}:
      </p>
      <p className="text-[28px] font-black tabular-nums">{money(projection.total)}</p>
      <ul className="mt-2 space-y-1">
        {projection.byCategory.slice(0, 5).map((c) => (
          <li key={c.category} className="flex justify-between text-[13px] font-bold">
            <span>{c.category}</span>
            <span className="tabular-nums">{money(c.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  const goalMini = mainGoal && (
    <button
      type="button"
      onClick={() => setTab('metas')}
      className={`${card} block w-full p-5 text-left`}
      aria-label="Meta del hogar"
    >
      <p className="text-[13px] font-black text-gray-600">Meta del hogar</p>
      <p className="mt-1 truncate text-[16px] font-black">
        {mainGoal.emoji} {mainGoal.name}
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[#111] bg-[#F1EDE3]">
        <div
          className="h-full bg-[#45D98B]"
          style={{
            width: `${Math.max(2, Math.min(100, (mainGoal.saved / mainGoal.targetAmount) * 100))}%`,
          }}
        />
      </div>
      <p className="mt-1 text-[13px] font-bold">
        {money(mainGoal.saved)} de {money(mainGoal.targetAmount)}
      </p>
    </button>
  );

  const plusGate = (feature: string, description: string, node: React.ReactNode) =>
    hasPlus === undefined ? (
      <p className="py-10 text-center text-sm font-bold text-gray-600">Cargando…</p>
    ) : hasPlus ? (
      node
    ) : (
      <HouseholdPlusLocked feature={feature} description={description} />
    );

  const expenseRow = (e: HouseholdExpense) => (
    <li key={e.id}>
      <button
        type="button"
        onClick={() => setSheet({ kind: 'expense', expense: e })}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[#FFF9EC]"
      >
        <span title={`Pagó ${nameOf(e.paidBy)}`} className="shrink-0">
          <Avatar name={nameOf(e.paidBy)} color={memberColor(members, e.paidBy)} size={34} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-[14px] font-black">
            {e.name}
            {e.isRecurring && <Repeat className="h-3.5 w-3.5 shrink-0" aria-label="Se repite" />}
          </span>
          <span className="block truncate text-xs font-semibold text-gray-600">
            {e.category} · {fmtDay(e.expenseDate)} ·{' '}
            {e.responsibility === 'shared'
              ? active.length === 2
                ? 'Ambos'
                : 'Todos'
              : `Para ${nameOf(e.splits[0]?.memberId ?? '')}`}
          </span>
        </span>
        <span className="text-right text-[14px] font-black tabular-nums">
          {money(e.baseAmount)}
          {e.currencyCode !== household.baseCurrency && (
            <span className="block text-[11px] font-semibold text-gray-500">
              {e.currencyCode} {e.amount.toFixed(2)}
            </span>
          )}
        </span>
      </button>
    </li>
  );

  const addButton = (
    <button
      type="button"
      onClick={() => setSheet({ kind: 'expense' })}
      className="flex h-12 items-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] px-4 text-[15px] font-black shadow-[0_3px_0_#111] active:translate-y-0.5"
    >
      <Plus className="h-5 w-5" strokeWidth={3} /> Agregar gasto
    </button>
  );

  // Gastos por persona: what each one paid; "Ambos" = shared responsibility.
  const personList =
    personTab === 'shared'
      ? monthExpenses.filter((e) => e.responsibility === 'shared')
      : monthExpenses.filter((e) => e.paidBy === personTab);

  // ---------- Layout ----------

  if (loadError) {
    return <LoadError what="los gastos del hogar" error={loadError} onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] font-black leading-tight sm:text-[32px]">
            {household.name}
          </h1>
          <p className="truncate text-[15px] font-semibold text-[#111]/70">
            {household.subtitle || active.map((m) => m.displayName).join(' + ')}
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => setSheet({ kind: 'invite' })}
            className="flex h-11 items-center gap-2 rounded-2xl border-2 border-[#111] bg-white px-3 text-[14px] font-black shadow-[0_2px_0_#111]"
          >
            <UserPlus className="h-5 w-5" /> <span className="hidden sm:inline">Invitar</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setSheet({ kind: 'settings' })}
          aria-label="Configuración del hogar"
          className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-[#111] bg-white shadow-[0_2px_0_#111]"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <nav
        aria-label="Secciones del hogar"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`h-11 shrink-0 rounded-2xl border-2 px-4 text-[14px] font-black ${tab === t.id ? 'border-[#111] bg-[#111] text-white' : 'border-[#111]/15 bg-white text-[#111]'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active.length === 1 && isOwner && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-[#111] bg-white px-4 py-3">
          <p className="min-w-0 flex-1 text-[14px] font-bold">
            Invita a las personas con las que compartes gastos.
          </p>
          <button
            type="button"
            onClick={() => setSheet({ kind: 'invite' })}
            className="rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-2 text-[13px] font-black"
          >
            Invitar →
          </button>
        </div>
      )}

      {expenses === null ? (
        <p className="py-10 text-center text-sm font-bold text-gray-600">Cargando el hogar…</p>
      ) : tab === 'resumen' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {monthNav}
            {addButton}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
            <div className="min-w-0 space-y-4">
              {hero}
              {difference}
              {categoriesCard}
              {insightCard}
            </div>
            <aside className="min-w-0 space-y-4">
              {splitCard}
              {upcomingCard}
              {hasPlus && goalMini}
              {projectionCard}
            </aside>
          </div>
        </>
      ) : tab === 'gastos' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {monthNav}
            {addButton}
          </div>
          <section className={`${card} p-4`} aria-label="Gastos por persona">
            <h2 className="mb-3 text-[17px] font-black">Gastos por persona</h2>
            <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
              {[
                ...active.map((m) => ({ id: m.id, label: m.displayName })),
                { id: 'shared', label: active.length === 2 ? 'Ambos' : 'Todos' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonTab(p.id)}
                  className={`h-10 shrink-0 rounded-xl border-2 px-3 text-[13px] font-black ${personTab === p.id ? 'border-[#111] bg-[#FFD83D]' : 'border-[#111]/15 bg-white'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {personList.length === 0 ? (
              <EmptyNote>Sin gastos en {monthLabel(month)}.</EmptyNote>
            ) : (
              <>
                <ul className="divide-y-2 divide-[#111]/5">{personList.map(expenseRow)}</ul>
                <p className="mt-2 text-right text-[14px] font-black">
                  Total: {money(personList.reduce((s, e) => s + e.baseAmount, 0))}
                </p>
              </>
            )}
          </section>
          {categoriesCard}
        </div>
      ) : tab === 'presupuesto' ? (
        <div className="space-y-4">
          <div className="flex justify-start">{monthNav}</div>
          <BudgetTab
            householdId={household.id}
            budgets={budgets}
            monthExpenses={monthExpenses}
            month={month}
            money={money}
            currencySymbol={sym}
            onChanged={load}
          />
        </div>
      ) : tab === 'metas' ? (
        plusGate(
          'Metas del hogar',
          'Fondo de emergencia, viaje o casa, con los aportes de cada persona.',
          <GoalsTab
            household={household}
            members={members}
            me={me}
            goals={goals}
            money={money}
            currencySymbol={sym}
            suggestedEmergency={suggestedEmergency}
            draft={goalDraft}
            onDraftUsed={() => setGoalDraft(null)}
            onChanged={load}
          />
        )
      ) : tab === 'simulador' ? (
        plusGate(
          'El simulador de ahorro',
          'Prueba recortes en los gastos del hogar y mira cuánto ahorrarían al mes y al año.',
          <div className="space-y-4">
            <div className="flex justify-start">{monthNav}</div>
            <SimulatorTab
              householdId={household.id}
              me={me}
              monthExpenses={monthExpenses}
              money={money}
            />
          </div>
        )
      ) : tab === 'pagos' ? (
        <div className="space-y-4">
          {upcomingCard}
          <section className={`${card} p-4`} aria-label="Gastos que se repiten">
            <h2 className="mb-3 text-[17px] font-black">Gastos que se repiten</h2>
            {latestRecurring(recurring).length === 0 ? (
              <EmptyNote>Aún no hay gastos que se repitan.</EmptyNote>
            ) : (
              <ul className="divide-y-2 divide-[#111]/5">
                {latestRecurring(recurring).map(expenseRow)}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">{addButton}</div>
          <section className={`${card} p-4`} aria-label="Movimientos del hogar">
            <h2 className="mb-3 text-[17px] font-black">Movimientos del hogar</h2>
            {(expenses ?? []).length === 0 ? (
              <EmptyNote>Agreguen su primer gasto compartido.</EmptyNote>
            ) : (
              <ul className="divide-y-2 divide-[#111]/5">{(expenses ?? []).map(expenseRow)}</ul>
            )}
          </section>
          {settlements.length > 0 && (
            <section className={`${card} p-4`} aria-label="Compensaciones">
              <h2 className="mb-3 text-[17px] font-black">Compensaciones</h2>
              <ul className="space-y-2">
                {settlements.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 text-[14px] font-bold"
                  >
                    <span className="min-w-0 truncate">
                      {nameOf(s.fromMember)} → {nameOf(s.toMember)}
                      <span className="block text-xs font-semibold capitalize text-gray-600">
                        {monthLabel(s.period.slice(0, 7))} · {STATUS_LABEL[s.status]}
                      </span>
                    </span>
                    <span className="tabular-nums">{money(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {sheet?.kind === 'expense' && (
        <ExpenseSheet
          household={household}
          members={members}
          me={me}
          expense={sheet.expense ?? null}
          prefill={sheet.prefill ?? null}
          canDelete={!!sheet.expense && canEdit(sheet.expense)}
          onClose={() => setSheet(null)}
          onSaved={afterSave}
        />
      )}
      {sheet?.kind === 'invite' && (
        <InviteSheet
          household={household}
          inviterName={me.displayName}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'settings' && (
        <SettingsSheet
          household={household}
          members={members}
          me={me}
          onClose={() => setSheet(null)}
          onChanged={() => {
            setSheet(null);
            onReload();
          }}
          onGone={onGone}
        />
      )}
      {sheet?.kind === 'settle' && (
        <SettleSheet
          household={household}
          settlement={sheet.settlement}
          side={sheet.side}
          myName={me.displayName}
          otherName={nameOf(
            sheet.side === 'pay' ? sheet.settlement.toMember : sheet.settlement.fromMember
          )}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            toast.showSuccess('Compensación confirmada.');
            load();
          }}
        />
      )}
    </div>
  );
}

// Declared incomes (proportional) or custom percentages, inside the split card.
function IncomeOrCustom({ data, onSaved }: { data: MyHousehold; onSaved: () => void }) {
  const { household, members, me } = data;
  const toast = useToast();
  const active = members.filter((m) => m.status === 'active');
  const income = household.splitMethod === 'income';
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      active.map((m) => [m.id, String((income ? m.declaredIncome : m.customPct) ?? '')])
    )
  );
  const [saving, setSaving] = useState(false);
  const editable = (id: string) => (income ? id === me.id : me.role === 'owner');

  const save = async () => {
    setSaving(true);
    try {
      for (const m of active) {
        if (!editable(m.id)) continue;
        const v = values[m.id]?.trim();
        const n = v === '' || v === undefined ? null : Number(v);
        if (n !== null && (!isFinite(n) || n < 0 || (!income && n > 100))) {
          throw new Error(income ? 'Ingresa un monto válido.' : 'Cada porcentaje va de 0 a 100.');
        }
        await householdService.updateMember(
          m.id,
          income ? { declaredIncome: n } : { customPct: n }
        );
      }
      onSaved();
    } catch (err) {
      toast.showError(
        err instanceof Error && !('kind' in err) ? err.message : getErrorMessage(err)
      );
    } finally {
      setSaving(false);
    }
  };

  const sum = active.reduce((s, m) => s + (Number(values[m.id]) || 0), 0);

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[13px] font-semibold text-gray-600">
        {income
          ? 'Cada persona declara el monto con el que participa. Lo ve todo el hogar; MONEO no lee tus ingresos privados.'
          : `Porcentaje de cada persona (suman ${Math.round(sum * 10) / 10}%; deben sumar 100%).`}
      </p>
      {active.map((m) => (
        <label key={m.id} className="flex items-center gap-2 text-[14px] font-bold">
          <span className="min-w-0 flex-1 truncate">{m.displayName}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={values[m.id] ?? ''}
            disabled={!editable(m.id)}
            onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
            placeholder={income ? 'Ingreso mensual' : '%'}
            className="h-11 w-36 rounded-xl border-2 border-[#111] bg-white px-3 text-[16px] font-black disabled:border-[#111]/20 disabled:bg-[#F7F7F5]"
          />
        </label>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-2 text-[13px] font-black shadow-[0_2px_0_#111] disabled:opacity-60"
      >
        {saving ? 'Guardando…' : income ? 'Guardar mi ingreso' : 'Guardar porcentajes'}
      </button>
    </div>
  );
}
