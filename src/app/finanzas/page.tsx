'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { loadFinanceData } from '@/lib/supabaseFinance';
import type { FinanceData } from '@/lib/financeStore';
import { pagosService, type PagoEntry } from '@/lib/supabaseObligations';
import { useAuth } from '@/contexts/AuthContext';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getRateFromMap } from '@/lib/currency';
import NotificationBell from '@/components/notifications/NotificationBell';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { useDataChanged } from '@/lib/dataSync';
import WelcomeModal from '@/components/finance/WelcomeModal';
import AddTransactionModal from '@/components/finance/AddTransactionModal';
import { RegionConfirm } from '@/components/region/Region';
import { hasSeenWelcome, markWelcomeSeen } from '@/lib/onboarding';
import { ONBOARDING_V2 } from '@/lib/onboardingFlow';
import { usePlus } from '@/contexts/PlusContext';
import { track } from '@/lib/analytics';
import {
  MONTH_NAMES,
  MONTHS_SHORT,
  budgetProgress,
  buildPeriod,
  categoryBreakdown,
  inRange,
  mainGoal,
  pctChange,
  periodTotals,
  spendingInsight,
  upcomingPayments,
  ymd,
  type Period,
} from '@/lib/dashboard';
import { moneyFormatter } from '@/components/dashboard/ui';
import {
  BudgetCard,
  NetWorthCard,
  QuickActions,
  RecentTransactions,
  SpendingCard,
  TodayAdvice,
  useHiddenAmounts,
  type Advice,
  type QuickAction,
} from '@/components/dashboard/MainCards';
import {
  MainGoal,
  MoneoInsight,
  PeriodSummary,
  PlusCard,
  UpcomingPayments,
} from '@/components/dashboard/RailCards';
import {
  PeriodFilter,
  TopBar,
  type NewAction,
  type PeriodState,
} from '@/components/dashboard/TopBar';

// Home of MONEO: everything comes from the user's real data (accounts, movements,
// budgets, goals, payments, subscriptions). Nothing here writes balances.

type TxTab = 'gasto' | 'ingreso' | 'transferencia';

// Desktop and mobile have different compositions; only one is mounted at a time.
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

function shiftedPeriod(p: PeriodState, now: Date): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p.kind === 'mes') return buildPeriod('mes', new Date(y, m + p.offset, 15));
  if (p.kind === 'trimestre') return buildPeriod('trimestre', new Date(y, m + 3 * p.offset, 15));
  if (p.kind === 'anio') return buildPeriod('anio', new Date(y + p.offset, 5, 15));
  return buildPeriod('custom', now, p.custom);
}

function periodLabel(p: Period): string {
  const f = new Date(`${p.from}T00:00:00`);
  const t = new Date(`${p.to}T00:00:00`);
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  if (p.kind === 'mes') return `${cap(MONTH_NAMES[f.getMonth()])} ${f.getFullYear()}`;
  if (p.kind === 'anio') return String(f.getFullYear());
  if (p.kind === 'trimestre')
    return `${MONTHS_SHORT[f.getMonth()]} – ${MONTHS_SHORT[t.getMonth()]} ${t.getFullYear()}`;
  return `${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} – ${t.getDate()} ${MONTHS_SHORT[t.getMonth()]}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const [data, setData] = useState<FinanceData | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pagos, setPagos] = useState<PagoEntry[]>([]);
  const [pagosError, setPagosError] = useState(false);
  const { ent, plansLive } = usePlus();
  const [hidden, toggleHidden] = useHiddenAmounts();
  const isDesktop = useIsDesktop();
  const [modalTab, setModalTab] = useState<TxTab | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [now] = useState(() => new Date());
  const [periodState, setPeriodState] = useState<PeriodState>({
    kind: 'mes',
    offset: 0,
    custom: { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) },
  });

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([loadFinanceData(), userSettingsService.get(), exchangeRatesService.getRatesMap()])
      .then(([d, settings, rates]) => {
        setData(d);
        setBaseCurrency(settings.baseCurrencyCode);
        setRatesMap(rates);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(err);
      });
    setPagosError(false);
    pagosService
      .getAll()
      .then(setPagos)
      .catch(() => setPagosError(true));
  }, []);

  useDataChanged(load);
  useEffect(() => {
    load();
  }, [load]);

  // One-time welcome for new users without accounts; closing it marks it as seen.
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  const showWelcome =
    !welcomeClosed && !!user && !!data && data.accounts.length === 0 && !hasSeenWelcome(user);
  const closeWelcome = useCallback(
    (goToAccounts: boolean) => {
      setWelcomeClosed(true);
      if (user) markWelcomeSeen(user.id).catch((err) => console.error(err));
      if (goToAccounts)
        router.push(ONBOARDING_V2 ? '/empezar?paso=dinero' : '/finanzas/cuentas?nueva=1');
    },
    [user, router]
  );

  // Arrival from the onboarding (/finanzas?bienvenida=1): a small contextual welcome.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('bienvenida') !== '1') return;
    setArrived(true);
    track('dashboard_first_view');
    router.replace('/finanzas');
  }, [router]);

  const period = useMemo(() => shiftedPeriod(periodState, now), [periodState, now]);
  const money = useMemo(() => moneyFormatter(baseCurrency), [baseCurrency]);

  const view = useMemo(() => {
    if (!data) return null;
    const today = ymd(now);
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const toBase = (amount: number, currency: string) =>
      amount * getRateFromMap(ratesMap, currency || 'PEN', baseCurrency);

    // Balances (current, not period-dependent).
    const accountsTotal = data.accounts.reduce((s, a) => s + toBase(a.balance, a.currency), 0);
    const available = data.accounts
      .filter((a) => a.type !== 'credito' && a.type !== 'inversion')
      .reduce((s, a) => s + toBase(a.balance, a.currency), 0);
    const investments = data.investments.reduce((s, i) => s + i.shares * i.price, 0);
    const debts = data.debts.reduce((s, d) => s + d.balance, 0);
    const netWorth = accountsTotal + investments - debts;
    const inGoals = data.savingsGoals.reduce((s, g) => s + g.current, 0);

    // Change since the start of this month: this month's net cash flow.
    const month = buildPeriod('mes', now);
    const monthTotals = periodTotals(
      data.transactions,
      month.from,
      month.to,
      baseCurrency,
      ratesMap
    );
    const startWorth = netWorth - monthTotals.balance;
    const netWorthPct =
      data.transactions.length > 0 && startWorth > 0
        ? Math.round((monthTotals.balance / startWorth) * 100)
        : null;

    const upcoming = upcomingPayments(pagos, data.subscriptions, today);
    const toPay = upcoming.filter((u) => u.date <= month.to).reduce((s, u) => s + u.amount, 0);

    const totals = periodTotals(data.transactions, period.from, period.to, baseCurrency, ratesMap);
    const prevTotals = periodTotals(
      data.transactions,
      period.prevFrom,
      period.prevTo,
      baseCurrency,
      ratesMap
    );
    const categories = categoryBreakdown(
      data.transactions,
      period.from,
      period.to,
      baseCurrency,
      ratesMap
    );
    const prevCategories = categoryBreakdown(
      data.transactions,
      period.prevFrom,
      period.prevTo,
      baseCurrency,
      ratesMap,
      50
    );
    const budget = budgetProgress(
      data.budgetCategories,
      data.transactions,
      month.from,
      month.to,
      baseCurrency,
      ratesMap
    );
    const recent = [...data.transactions]
      .filter((t) => inRange(t, period.from, period.to))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const goal = mainGoal(data.savingsGoals);
    const insight = spendingInsight(
      categoryBreakdown(data.transactions, period.from, period.to, baseCurrency, ratesMap, 50),
      prevCategories,
      { expense: totals.expense, prevExpense: prevTotals.expense },
      period.noun,
      (n) => money(n)
    );

    const activeSubs = data.subscriptions.filter((s) => s.active);
    const tips: Advice[] = [];
    if (activeSubs.length > 0) {
      const subTotal = activeSubs.reduce((s, x) => s + x.amount, 0);
      tips.push({
        title: 'Organiza tus suscripciones',
        text: `Tienes ${activeSubs.length} ${activeSubs.length === 1 ? 'suscripción activa' : 'suscripciones activas'} que suman ${money(subTotal)} al mes. ¿Realmente las usas todas?`,
        cta: 'Ver mis suscripciones',
        href: '/finanzas/suscripciones',
      });
    }
    const over = budget.find((b) => b.pct >= 100);
    if (over) {
      tips.push({
        title: `${over.name} llegó a su límite`,
        text: `Ya usaste ${over.pct}% de tu presupuesto de ${over.name.toLowerCase()} este mes. Revisa qué gastos puedes mover al próximo.`,
        cta: 'Ver mi presupuesto',
        href: '/finanzas/presupuesto',
      });
    } else if (data.budgetCategories.length === 0) {
      tips.push({
        title: 'Ponle un límite a tus gastos',
        text: `Crea un presupuesto${categories[0] && categories[0].category !== 'Otros' ? ` para ${categories[0].category.toLowerCase()}` : ''} y MONEO te avisa antes de pasarte.`,
        cta: 'Crear presupuesto',
        href: '/finanzas/presupuesto',
      });
    }
    if (!goal) {
      tips.push({
        title: 'Empieza tu primera meta',
        text: 'Un fondo de emergencia, un viaje o tu casa: ponle nombre y monto, y mira cómo avanza.',
        cta: 'Crear mi meta',
        href: '/finanzas/ahorros',
      });
    } else if (goal.target > goal.current) {
      tips.push({
        title: `Sigue con «${goal.name}»`,
        text: `Te faltan ${money(goal.target - goal.current)} para lograrla. Cada aporte cuenta.`,
        cta: 'Ver mis metas',
        href: '/finanzas/ahorros',
      });
    }
    tips.push({
      title: 'Registra sin escribir',
      text: 'Sube la captura de tu Yape o de tu banco, o dicta tu gasto: MONEO AUTO lo convierte en movimiento.',
      cta: 'Probar MONEO AUTO',
      href: '/finanzas/auto',
    });

    return {
      today,
      yesterday: ymd(yest),
      netWorth,
      netWorthPct,
      available,
      toPay,
      inGoals,
      upcoming,
      totals,
      spendPct: pctChange(totals.expense, prevTotals.expense),
      categories,
      budget,
      recent,
      goal,
      insight,
      tips: tips.slice(0, 3),
      subscriptionNames: data.subscriptions.map((s) => s.name),
    };
  }, [data, pagos, period, baseCurrency, ratesMap, now, money]);

  if (loadError)
    return (
      <div className="mx-auto max-w-md px-4 py-10 lg:px-8">
        <LoadError what="tus finanzas" error={loadError} onRetry={load} />
      </div>
    );

  if (!data || !view)
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#FFF9EC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-black border-t-transparent motion-reduce:animate-none" />
          <p className="text-sm font-bold text-gray-600">Cargando tus finanzas...</p>
        </div>
      </div>
    );

  const fullName: string = user?.user_metadata?.full_name || '';
  const raw = fullName.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'Usuario';
  const displayName = raw.charAt(0).toUpperCase() + raw.slice(1);

  const onNew = (a: NewAction) => {
    if (a === 'pago') router.push('/finanzas/pagos');
    else if (a === 'cuenta') router.push('/finanzas/cuentas?nueva=1');
    else setModalTab(a);
  };
  const onQuick = (a: QuickAction) => {
    if (a === 'enviar') setModalTab('gasto');
    else if (a === 'recibir') setModalTab('ingreso');
    else if (a === 'transferir') setModalTab('transferencia');
    else if (a === 'pagar') router.push('/finanzas/pagos');
    else if (a === 'escanear') router.push('/finanzas/auto');
    else setMoreOpen((o) => !o);
  };
  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch (err) {
      toast.showError(err);
    }
  };
  const step = (d: number) => setPeriodState((p) => ({ ...p, offset: Math.min(p.offset + d, 0) }));
  const canShift = periodState.kind !== 'custom';

  const hero = (
    <NetWorthCard
      netWorth={view.netWorth}
      changePct={view.netWorthPct}
      available={view.available}
      toPay={view.toPay}
      inGoals={view.inGoals}
      money={money}
      hidden={hidden}
      onToggleHidden={toggleHidden}
    />
  );
  const quick = (
    <div>
      <QuickActions onAction={onQuick} />
      {moreOpen && (
        <nav
          aria-label="Más acciones"
          className="mt-2.5 flex flex-wrap gap-2 rounded-2xl border-2 border-[#111] bg-white p-3 motion-safe:animate-fade-in"
        >
          {[
            ['Agregar cuenta', '/finanzas/cuentas?nueva=1'],
            ['Cambiar moneda', '/finanzas/convertir'],
            ['Movimientos', '/finanzas/movimientos'],
            ['Juntas', '/finanzas/juntas'],
            ['Deudas', '/finanzas/deudas'],
            ['Reportes', '/finanzas/reportes'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border-2 border-[#111] bg-[#FFF9EC] px-3 py-2 text-[13px] font-bold hover:bg-[#FFD83D]"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
  const spending = (
    <SpendingCard
      noun={period.noun}
      periodLabel={periodLabel(period)}
      total={view.totals.expense}
      changePct={view.spendPct}
      compareLabel={period.compareLabel}
      categories={view.categories}
      money={money}
      hidden={hidden}
      onPrev={canShift ? () => step(-1) : undefined}
      onNext={canShift ? () => step(1) : undefined}
      canNext={periodState.offset < 0}
      onAdd={() => setModalTab('gasto')}
    />
  );
  const budget = <BudgetCard rows={view.budget} money={money} hidden={hidden} />;
  const movements = (
    <RecentTransactions
      txs={view.recent}
      subscriptionNames={view.subscriptionNames}
      baseCurrency={baseCurrency}
      hidden={hidden}
      today={view.today}
      yesterday={view.yesterday}
    />
  );
  const advice = <TodayAdvice tips={view.tips} />;
  const payments = (
    <UpcomingPayments
      rows={view.upcoming}
      today={view.today}
      money={money}
      hidden={hidden}
      error={pagosError}
      onRetry={load}
    />
  );
  const goal = <MainGoal goal={view.goal} money={money} hidden={hidden} />;
  const summary = (
    <PeriodSummary
      noun={period.noun}
      income={view.totals.income}
      expense={view.totals.expense}
      money={money}
      hidden={hidden}
    />
  );
  const insight = <MoneoInsight insight={view.insight} />;
  const plus = plansLive && ent !== undefined ? <PlusCard ent={ent} variant="rail" /> : null;

  return (
    <>
      {arrived && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-[55] mx-auto max-w-sm rounded-3xl border-[3px] border-black bg-[#FFD83D] p-4 shadow-[5px_5px_0_#111] motion-safe:animate-slide-up lg:bottom-8"
        >
          <button
            type="button"
            onClick={() => setArrived(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-white text-sm font-black"
          >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <p className="pr-8 font-poppins text-lg font-black">¡Bienvenido a tu MONEO!</p>
          <p className="mt-1 text-sm font-semibold">
            Este es tu dinero. Registra tu primer movimiento con el botón «+».
          </p>
        </div>
      )}
      {showWelcome && (
        <WelcomeModal onStart={() => closeWelcome(true)} onLater={() => closeWelcome(false)} />
      )}
      <AddTransactionModal
        isOpen={modalTab !== null}
        initialTab={modalTab ?? undefined}
        onClose={() => setModalTab(null)}
      />

      <div className="min-h-screen bg-[#FFF9EC] font-poppins text-[#111]">
        {/* ── Desktop ── */}
        {isDesktop ? (
          <div className="mx-auto max-w-[1480px] px-6 py-5">
            <TopBar
              period={periodState}
              onPeriod={setPeriodState}
              now={now}
              name={displayName}
              onNew={onNew}
              onSignOut={handleSignOut}
            />
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
              <div className="min-w-0 space-y-5">
                <div>
                  <h1 className="text-[34px] font-black leading-tight tracking-tight">
                    Hola, {displayName}
                  </h1>
                  <p className="text-[17px] font-medium text-[#111]/80">Tu dinero, más simple.</p>
                </div>
                <RegionConfirm />
                {hero}
                {quick}
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  {spending}
                  {budget}
                </div>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  {movements}
                  {advice}
                </div>
              </div>
              <aside
                aria-label="Resumen"
                className="grid min-w-0 content-start gap-5 lg:grid-cols-2 xl:grid-cols-1"
              >
                {payments}
                {goal}
                {summary}
                {insight}
                {plus}
              </aside>
            </div>
          </div>
        ) : (
          /* ── Mobile / tablet ── */
          <div className="px-4 pb-28 pt-5">
            <header className="mb-4 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[#111] bg-[#2DD4BF] text-lg font-black">
                {displayName[0]}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[19px] font-black leading-tight">
                  Hola, {displayName}
                </h1>
                <p className="text-xs font-medium text-[#111]/70">Tu dinero, más simple.</p>
              </div>
              <Link
                href="/finanzas/movimientos"
                aria-label="Buscar movimientos"
                className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#111] bg-white"
              >
                <Search className="h-5 w-5" />
              </Link>
              <NotificationBell />
            </header>
            <div className="mb-4">
              <PeriodFilter value={periodState} onChange={setPeriodState} now={now} />
            </div>
            <div className="space-y-4">
              <RegionConfirm />
              {hero}
              {quick}
              {spending}
              {budget}
              <div className="grid gap-4 md:grid-cols-2">
                {goal}
                {summary}
              </div>
              {payments}
              {movements}
              {insight}
              {advice}
              {plus}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
