'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Bell, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  billingService,
  BillingError,
  entitlementService,
  hasPlusNow,
  plansService,
  type BillingPlan,
  type Entitlement,
} from '@/lib/billing';
import {
  clearLocal,
  EMPTY_STATE,
  FIRST_GOALS,
  GOALS,
  LEAKS,
  loadLocal,
  METHODS,
  NOTIFY_OPTIONS,
  onboardingService,
  saveLocal,
  type OnboardingState,
} from '@/lib/onboardingFlow';
import { accountsService } from '@/lib/supabaseFinance';
import { userSettingsService } from '@/lib/supabaseCurrency';
import { PERUVIAN_BANKS } from '@/lib/brands';
import { authErrorMessage } from '@/lib/authErrors';
import { getErrorMessage } from '@/lib/dataError';
import { markWelcomeSeen } from '@/lib/onboarding';
import { track } from '@/lib/analytics';
import { notifyDataChanged } from '@/lib/dataSync';
import BrandLogo from '@/components/finance/BrandLogo';
import Paywall, { money } from '@/components/onboarding/Paywall';
import {
  CheckRow,
  Highlight,
  OptionCard,
  PrimaryButton,
  Shell,
  Spinner,
  TextButton,
  Title,
} from '@/components/onboarding/ui';
import type { Account } from '@/lib/financeStore';

// New onboarding, "subscription first": a few questions → personalised preview → MONEO
// PLUS plans → account → Mercado Pago (trial or payment) → first real account → quick
// settings → the real dashboard. Each step lives in ?paso= so refresh / back work, and the
// answers persist (browser before sign-up, onboarding_profiles after).

type Step =
  | 'inicio'
  | 'objetivos'
  | 'fugas'
  | 'registro'
  | 'meta'
  | 'perfil'
  | 'planes'
  | 'cuenta'
  | 'pago'
  | 'confirmando'
  | 'activo'
  | 'dinero'
  | 'banco'
  | 'saldo'
  | 'otra'
  | 'ajustes'
  | 'listo';

const STEPS: Step[] = [
  'inicio',
  'objetivos',
  'fugas',
  'registro',
  'meta',
  'perfil',
  'planes',
  'cuenta',
  'pago',
  'confirmando',
  'activo',
  'dinero',
  'banco',
  'saldo',
  'otra',
  'ajustes',
  'listo',
];

// Steps that need a signed-in user.
const NEEDS_USER: Step[] = [
  'pago',
  'confirmando',
  'activo',
  'dinero',
  'banco',
  'saldo',
  'otra',
  'ajustes',
  'listo',
];

type AccountKind = 'banco' | 'credito' | 'digital' | 'efectivo';

const KINDS: { id: AccountKind; label: string; hint: string; emoji: string }[] = [
  { id: 'banco', label: 'Cuenta bancaria', hint: 'Ahorros o sueldo', emoji: '🏦' },
  { id: 'credito', label: 'Tarjeta', hint: 'Crédito o débito', emoji: '💳' },
  { id: 'digital', label: 'Billetera digital', hint: 'Yape, Plin…', emoji: '📱' },
  { id: 'efectivo', label: 'Efectivo', hint: 'Lo que tienes a la mano', emoji: '💵' },
];

interface BankChoice {
  id: string;
  name: string;
  color: string;
  bg: string;
  wallet?: boolean;
}

const BANKS: BankChoice[] = [
  ...PERUVIAN_BANKS.map((b) => ({ id: b.id, name: b.name, color: b.color, bg: b.bg })),
  { id: 'pichincha', name: 'Banco Pichincha', color: '#B38F00', bg: '#FFF7CC' },
  { id: 'yape', name: 'Yape', color: '#742284', bg: '#F1E6F5', wallet: true },
  { id: 'plin', name: 'Plin', color: '#0089B0', bg: '#E0F7FD', wallet: true },
];

// Where MONEO AUTO reads bank emails today (captures and voice work with any bank).
const AUTO_BANKS = ['bcp', 'bbva', 'interbank', 'yape'];

const CURRENCIES = [
  { code: 'PEN', label: 'Soles', symbol: 'S/' },
  { code: 'USD', label: 'Dólares', symbol: 'US$' },
  { code: 'EUR', label: 'Euros', symbol: '€' },
];

const KIND_ICON: Record<AccountKind, string> = {
  banco: '🏦',
  credito: '💳',
  digital: '📱',
  efectivo: '💵',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toggle<T>(list: T[], item: T, max: number): T[] {
  if (list.includes(item)) return list.filter((x) => x !== item);
  return list.length >= max ? list : [...list, item];
}

export default function EmpezarPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#FFF9EC]" />}>
      <Onboarding />
    </Suspense>
  );
}

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading, signUp, signIn, signInWithProvider } = useAuth();
  const raw = params.get('paso') as Step | null;
  const step: Step = raw && STEPS.includes(raw) ? raw : 'inicio';

  const [state, setState] = useState<OnboardingState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined);
  const plus = hasPlusNow(ent ?? null);

  const go = useCallback(
    (next: Step, replace = false) => {
      const url = `/empezar?paso=${next}`;
      if (replace) router.replace(url);
      else router.push(url);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    [router]
  );

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setState((s) => {
      const next = { ...s, ...patch };
      saveLocal(next);
      return next;
    });
  }, []);

  // Restore: browser state first, then the saved profile (other device), then where to go.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      let local = loadLocal();
      if (user) {
        try {
          const [profile, e] = await Promise.all([
            onboardingService.get(),
            entitlementService.get(),
          ]);
          if (cancelled) return;
          setEnt(e);
          if (profile?.completedAt && !['confirmando', 'activo'].includes(step)) {
            router.replace('/finanzas');
            return;
          }
          if (profile && local.goals.length === 0) local = { ...local, ...profile.state };
        } catch {
          setEnt(null);
        }
      } else {
        setEnt(null);
      }
      if (cancelled) return;
      setState(local);
      setReady(true);
      if (!params.get('paso') && local.step && local.step !== 'inicio')
        go(local.step as Step, true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    plansService
      .list()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  // Remember the step (browser + profile) so the flow resumes where it was left.
  const lastSaved = useRef('');
  useEffect(() => {
    if (!ready) return;
    if (step !== state.step) update({ step });
    if (user && lastSaved.current !== step) {
      lastSaved.current = step;
      onboardingService.save(user.id, { ...state, step }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready, user?.id]);

  // Guards: steps that need an account, and paid steps that PLUS users skip.
  useEffect(() => {
    if (!ready || authLoading) return;
    if (!user && NEEDS_USER.includes(step)) go('cuenta', true);
    else if (user && step === 'cuenta')
      go(state.plan && state.plan !== 'free' && !plus ? 'pago' : plus ? 'activo' : 'dinero', true);
    else if (plus && (step === 'planes' || step === 'pago')) go('activo', true);
  }, [ready, authLoading, user, step, plus, state.plan, go]);

  useEffect(() => {
    if (step === 'inicio') track('onboarding_started');
    if (step === 'planes') track('paywall_viewed');
  }, [step]);

  if (!ready || ent === undefined) {
    return (
      <Shell>
        <Spinner label="Preparando tu MONEO…" />
      </Shell>
    );
  }

  const back = (to: Step) => () => go(to, true);
  const selectedPlan = plans.find((p) => p.code === state.plan) ?? null;

  switch (step) {
    // ── 01 · Hero ───────────────────────────────────────────────────────────
    case 'inicio':
      return (
        <Shell
          footer={
            <>
              <PrimaryButton variant="yellow" onClick={() => go('objetivos')}>
                Comenzar <ArrowRight className="h-5 w-5" />
              </PrimaryButton>
              {!user && (
                <TextButton onClick={() => router.push('/login')}>Ya tengo cuenta</TextButton>
              )}
            </>
          }
        >
          <div className="flex flex-col items-center pt-4 text-center">
            <div className="relative w-full max-w-[340px] overflow-hidden rounded-[32px] border-[3px] border-black bg-[#FFD83D] shadow-[6px_6px_0_#111]">
              <Image
                src="/assets/images/landing/moneo-mascot.webp"
                alt="El mono de MONEO"
                width={520}
                height={520}
                priority
                className="h-auto w-full"
              />
            </div>
            <h1 className="mt-8 text-[40px] font-black leading-[1.02] tracking-tight sm:text-5xl">
              Tu dinero,
              <br />
              <Highlight>más simple.</Highlight>
            </h1>
            <p className="mt-4 max-w-sm text-base font-medium text-gray-700">
              Organiza tus cuentas, gastos, metas y pagos en un solo lugar.
            </p>
            <p className="mt-3 text-xs font-bold text-gray-500">Toma menos de 3 minutos</p>
          </div>
        </Shell>
      );

    // ── 02 · Objetivo ───────────────────────────────────────────────────────
    case 'objetivos':
      return (
        <Shell
          onBack={back('inicio')}
          progress={{ step: 1, total: 4 }}
          footer={
            <PrimaryButton disabled={state.goals.length === 0} onClick={() => go('fugas')}>
              Siguiente <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          }
        >
          <Title sub="Elige hasta 3. Lo usamos para personalizar tu MONEO.">
            ¿Qué quieres conseguir con MONEO?
          </Title>
          <div className="space-y-3">
            {GOALS.map((g) => (
              <OptionCard
                key={g.id}
                emoji={g.emoji}
                label={g.label}
                selected={state.goals.includes(g.id)}
                disabled={state.goals.length >= 3}
                onClick={() => {
                  update({ goals: toggle(state.goals, g.id, 3) });
                  track('goal_selected', { goal: g.id });
                }}
              />
            ))}
          </div>
        </Shell>
      );

    // ── 03 · Fugas ──────────────────────────────────────────────────────────
    case 'fugas':
      return (
        <Shell
          onBack={back('objetivos')}
          progress={{ step: 2, total: 4 }}
          footer={
            <PrimaryButton disabled={state.leaks.length === 0} onClick={() => go('registro')}>
              Siguiente <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          }
        >
          <Title sub="Elige hasta 3 categorías. Sin montos, solo para conocerte.">
            ¿En qué se te va más la plata?
          </Title>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LEAKS.map((l) => (
              <OptionCard
                key={l.id}
                emoji={l.emoji}
                label={l.label}
                selected={state.leaks.includes(l.id)}
                disabled={state.leaks.length >= 3}
                onClick={() => {
                  update({ leaks: toggle(state.leaks, l.id, 3) });
                  track('expense_category_selected', { category: l.id });
                }}
              />
            ))}
          </div>
        </Shell>
      );

    // ── 04 · Forma de registro ──────────────────────────────────────────────
    case 'registro':
      return (
        <Shell
          onBack={back('fugas')}
          progress={{ step: 3, total: 4 }}
          footer={
            <PrimaryButton disabled={state.methods.length === 0} onClick={() => go('meta')}>
              Siguiente <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          }
        >
          <Title sub="Tú eliges. MONEO se adapta a ti (puedes marcar varias).">
            ¿Cómo quieres registrar tus gastos?
          </Title>
          <div className="space-y-3">
            {METHODS.map((m) => (
              <OptionCard
                key={m.id}
                emoji={m.emoji}
                label={m.label}
                hint={m.hint}
                badge={m.plus ? 'Plus' : undefined}
                selected={state.methods.includes(m.id)}
                onClick={() => {
                  update({ methods: toggle(state.methods, m.id, 4) });
                  track('registration_method_selected', { method: m.id });
                }}
              />
            ))}
          </div>
        </Shell>
      );

    // ── 05 · Primera meta ───────────────────────────────────────────────────
    case 'meta':
      return (
        <Shell
          onBack={back('registro')}
          progress={{ step: 4, total: 4 }}
          footer={
            <PrimaryButton disabled={!state.firstGoal} onClick={() => go('perfil')}>
              Ver mi resultado <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          }
        >
          <Title sub="Tu primer objetivo. Después podrás crear más.">
            ¿Qué quieres lograr primero?
          </Title>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIRST_GOALS.map((g) => (
              <OptionCard
                key={g.id}
                emoji={g.emoji}
                label={g.label}
                selected={state.firstGoal === g.id}
                onClick={() => {
                  update({ firstGoal: g.id });
                  track('financial_goal_selected', { goal: g.id });
                }}
              />
            ))}
          </div>
        </Shell>
      );

    // ── 06 · Perfil personalizado ───────────────────────────────────────────
    case 'perfil': {
      const goal = GOALS.find((g) => g.id === state.goals[0]);
      const leak = LEAKS.find((l) => l.id === state.leaks[0]);
      const method = METHODS.find((m) => m.id === state.methods[0]);
      const first = FIRST_GOALS.find((g) => g.id === state.firstGoal);
      const rows = [
        { k: 'Tu prioridad', v: goal, color: '#FFD83D' },
        { k: 'Tu mayor fuga', v: leak, color: '#FF806E' },
        { k: 'Tu forma favorita', v: method, color: '#B99CFF' },
        { k: 'Tu primer objetivo', v: first, color: '#45D98B' },
      ];
      return (
        <Shell
          onBack={back('meta')}
          footer={
            <PrimaryButton variant="yellow" onClick={() => go(plus ? 'dinero' : 'planes')}>
              Ver mi experiencia MONEO <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          }
        >
          <Title sub="Con esto armamos tu MONEO. Mira lo que vamos a hacer por ti:">
            ¡Listo! Ya conocemos un poco mejor <Highlight>tu dinero.</Highlight>
          </Title>
          <ul className="space-y-3">
            {rows.map(
              (r, i) =>
                r.v && (
                  <li
                    key={r.k}
                    className="flex items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-3 shadow-[3px_3px_0_#111] motion-safe:animate-slide-up"
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-black text-2xl"
                      style={{ background: r.color }}
                    >
                      {r.v.emoji}
                    </span>
                    <span>
                      <span className="block text-xs font-black uppercase tracking-wide text-gray-500">
                        {r.k}
                      </span>
                      <span className="block text-base font-black">{r.v.label}</span>
                    </span>
                  </li>
                )
            )}
          </ul>
          <div className="mt-5 rounded-2xl border-[3px] border-black bg-[#FFD83D] p-4">
            <p className="flex items-center gap-2 font-black">
              <Sparkles className="h-5 w-5" /> Tu plan MONEO
            </p>
            <p className="mt-1 text-sm font-semibold">
              {leak
                ? `Vigilaremos tus gastos en ${leak.label.toLowerCase()}`
                : 'Ordenaremos tus gastos'}
              {method
                ? `, registrándolos ${method.id === 'voz' ? 'con tu voz' : method.id === 'auto' ? 'automáticamente' : method.id === 'scan' ? 'con MONEO SCAN' : 'como prefieras'}`
                : ''}
              {first ? `, y te acercaremos a «${first.label}».` : '.'}
            </p>
          </div>
        </Shell>
      );
    }

    // ── 07 · Planes ─────────────────────────────────────────────────────────
    case 'planes': {
      const code =
        (state.plan && state.plan !== 'free' ? state.plan : null) ??
        (plans.some((p) => p.code === 'plus_yearly') ? 'plus_yearly' : (plans[0]?.code ?? null));
      const chosen = plans.find((p) => p.code === code);
      const trial =
        chosen && chosen.kind === 'subscription' && chosen.trialDays > 0 && !ent?.hadTrial;
      return (
        <Shell
          wide
          onBack={back('perfil')}
          footer={
            <div className="mx-auto max-w-xl">
              <PrimaryButton
                variant="yellow"
                disabled={!chosen}
                onClick={() => {
                  if (!chosen) return;
                  update({ plan: chosen.code });
                  track('plan_selected', { plan: chosen.code });
                  go(user ? 'pago' : 'cuenta');
                }}
              >
                {trial
                  ? `Probar ${chosen!.trialDays} días gratis`
                  : chosen?.kind === 'one_time'
                    ? 'Comprar de por vida'
                    : 'Activar MONEO PLUS'}{' '}
                <ArrowRight className="h-5 w-5" />
              </PrimaryButton>
              {trial && (
                <p className="mt-2 text-center text-xs font-semibold text-gray-700">
                  Hoy pagas S/ 0. Luego {money(chosen!.price)}{' '}
                  {chosen!.intervalMonths === 12 ? 'al año' : 'al mes'}. Cancela cuando quieras.
                </p>
              )}
              <TextButton
                onClick={() => {
                  update({ plan: 'free' });
                  track('plan_selected', { plan: 'free' });
                  go(user ? 'dinero' : 'cuenta');
                }}
              >
                Seguir con MONEO FREE (con anuncios)
              </TextButton>
            </div>
          }
        >
          {plans.length === 0 ? (
            <Spinner label="Cargando planes…" />
          ) : (
            <Paywall
              plans={plans}
              selected={code}
              hadTrial={Boolean(ent?.hadTrial)}
              onSelect={(c) => update({ plan: c })}
            />
          )}
        </Shell>
      );
    }

    // ── 08 · Cuenta MONEO ───────────────────────────────────────────────────
    case 'cuenta':
      return (
        <AccountStep
          onBack={back(state.plan === 'free' ? 'planes' : 'planes')}
          paid={Boolean(state.plan && state.plan !== 'free')}
          onGoogle={() => {
            const next = state.plan && state.plan !== 'free' ? 'pago' : 'dinero';
            return signInWithProvider('google', `/empezar?paso=${next}`);
          }}
          onSignUp={async (name, email, password) => {
            await signUp(email, password, { fullName: name });
            track('account_created', { method: 'email' });
          }}
          onSignIn={async (email, password) => {
            await signIn(email, password);
          }}
        />
      );

    // ── 09 · Pago ───────────────────────────────────────────────────────────
    case 'pago':
      return (
        <PayStep
          plan={selectedPlan}
          hadTrial={Boolean(ent?.hadTrial)}
          onBack={back('planes')}
          onFree={() => {
            update({ plan: 'free' });
            go('dinero');
          }}
        />
      );

    // ── 10 · Confirmando el pago (vuelta de Mercado Pago) ───────────────────
    case 'confirmando':
      return (
        <ConfirmStep
          failed={/rejected|failure|null|cancel/i.test(
            `${params.get('collection_status') ?? ''}${params.get('status') ?? ''}`
          )}
          onActive={(e) => {
            setEnt(e);
            const plan = e.planCode;
            if (e.status === 'trialing') track('trial_started', { plan });
            else if (plan === 'founder') track('founder_purchased');
            else if (plan === 'plus_lifetime') track('lifetime_purchased');
            else track('subscription_started', { plan });
            go('activo', true);
          }}
          onRetry={() => go('planes', true)}
          onFree={() => {
            update({ plan: 'free' });
            go('dinero', true);
          }}
        />
      );

    // ── 11 · ¡MONEO PLUS activo! ────────────────────────────────────────────
    case 'activo':
      return (
        <Shell
          footer={
            <PrimaryButton variant="yellow" onClick={() => go('dinero')}>
              Configurar mi MONEO <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
          }
        >
          <div className="flex flex-col items-center pt-2 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full border-[3px] border-black bg-[#45D98B] text-4xl shadow-[4px_4px_0_#111] motion-safe:animate-tick-up">
              ✓
            </div>
            <h1 className="mt-5 text-[32px] font-black leading-tight">
              ¡MONEO <Highlight>PLUS</Highlight> está activo!
            </h1>
            <p className="mt-2 font-medium text-gray-700">
              Ahora vamos a configurar tu experiencia.
            </p>
            {ent && (
              <p className="mt-3 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold">
                {ent.lifetime
                  ? 'Plan de por vida · sin renovaciones'
                  : ent.status === 'trialing' && ent.trialEndsAt
                    ? `Prueba gratis hasta el ${fmtDate(new Date(ent.trialEndsAt))}`
                    : ent.currentPeriodEnd
                      ? `Próxima renovación: ${fmtDate(new Date(ent.currentPeriodEnd))}`
                      : 'Plan activo'}
              </p>
            )}
          </div>
          <ul className="mt-6 space-y-2.5">
            <CheckRow done>Plan activado</CheckRow>
            <CheckRow done>Tu experiencia personalizada</CheckRow>
            <CheckRow done={false}>Agregar tu primera cuenta</CheckRow>
            <CheckRow done={false}>Configurar alertas</CheckRow>
          </ul>
        </Shell>
      );

    // ── 12–15 · Primera cuenta ──────────────────────────────────────────────
    case 'dinero':
    case 'banco':
    case 'saldo':
    case 'otra':
      return <MoneySteps step={step} go={go} plus={plus} />;

    // ── 16 · Ajustes rápidos ────────────────────────────────────────────────
    case 'ajustes':
      return (
        <SettingsStep
          notify={state.notify}
          onBack={back('otra')}
          onDone={(notify) => {
            update({ notify });
            if (Object.values(notify).some(Boolean)) track('notifications_enabled');
            go('listo');
          }}
        />
      );

    // ── 17 · Todo listo ─────────────────────────────────────────────────────
    case 'listo':
      return (
        <DoneStep
          plus={plus}
          onFinish={async () => {
            if (user) {
              await onboardingService
                .save(user.id, { ...state, step: 'listo' }, true)
                .catch(() => {});
              await markWelcomeSeen(user.id).catch(() => {});
            }
            clearLocal();
            track('onboarding_completed', { plan: plus ? (ent?.planCode ?? 'plus') : 'free' });
            router.replace('/finanzas?bienvenida=1');
          }}
        />
      );
  }
}

// ── Cuenta MONEO (crear o entrar) ─────────────────────────────────────────────

function AccountStep({
  onBack,
  paid,
  onGoogle,
  onSignUp,
  onSignIn,
}: {
  onBack: () => void;
  paid: boolean;
  onGoogle: () => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'crear' | 'entrar'>('crear');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input =
    'min-h-[52px] w-full rounded-2xl border-[3px] border-black bg-white px-4 text-base font-semibold outline-none focus:shadow-[3px_3px_0_#111]';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'crear' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'crear') await onSignUp(name.trim(), email.trim(), password);
      else await onSignIn(email.trim(), password);
      // The guard moves on as soon as the session exists.
    } catch (err) {
      setError(
        authErrorMessage(
          err,
          mode === 'crear' ? 'No se pudo crear la cuenta.' : 'No se pudo iniciar sesión.'
        )
      );
      setBusy(false);
    }
  };

  return (
    <Shell onBack={onBack}>
      <Title
        sub={
          paid
            ? 'Tu plan queda guardado en tu cuenta: lo tendrás en cualquier dispositivo.'
            : 'Así podrás ver tus finanzas desde cualquier dispositivo.'
        }
      >
        {mode === 'crear' ? 'Primero, creemos tu cuenta MONEO.' : 'Entra a tu cuenta MONEO.'}
      </Title>
      <button
        type="button"
        onClick={() => {
          setBusy(true);
          onGoogle().catch((err) => {
            setError(authErrorMessage(err, 'No se pudo conectar con Google.'));
            setBusy(false);
          });
        }}
        disabled={busy}
        className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border-[3px] border-black bg-white text-base font-black shadow-[3px_3px_0_#111] disabled:opacity-50"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
          />
        </svg>
        Continuar con Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs font-bold text-gray-500">
        <span className="h-0.5 flex-1 bg-black/10" /> o con tu correo{' '}
        <span className="h-0.5 flex-1 bg-black/10" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'crear' && (
          <input
            className={input}
            placeholder="Tu nombre"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className={input}
          type="email"
          placeholder="tucorreo@gmail.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={input}
          type="password"
          placeholder={mode === 'crear' ? 'Crea una contraseña (6+ caracteres)' : 'Tu contraseña'}
          autoComplete={mode === 'crear' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-sm font-bold text-red-600">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {mode === 'crear' ? 'Crear mi cuenta' : 'Entrar'} <ArrowRight className="h-5 w-5" />
        </PrimaryButton>
      </form>
      <TextButton onClick={() => setMode((m) => (m === 'crear' ? 'entrar' : 'crear'))}>
        {mode === 'crear' ? 'Ya tengo cuenta: entrar' : 'No tengo cuenta: crearla'}
      </TextButton>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-gray-500">
        <Lock className="h-3.5 w-3.5" /> Al continuar aceptas los Términos y la Política de
        privacidad.
      </p>
    </Shell>
  );
}

// ── Pago con Mercado Pago ─────────────────────────────────────────────────────

function PayStep({
  plan,
  hadTrial,
  onBack,
  onFree,
}: {
  plan: BillingPlan | null;
  hadTrial: boolean;
  onBack: () => void;
  onFree: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);
  if (!plan) {
    return (
      <Shell onBack={onBack}>
        <Spinner label="Cargando tu plan…" />
      </Shell>
    );
  }
  const trial = plan.kind === 'subscription' && plan.trialDays > 0 && !hadTrial;
  const firstCharge = new Date(Date.now() + (trial ? plan.trialDays : 0) * 86400e3);
  const every = plan.intervalMonths === 12 ? 'año' : 'mes';

  const pay = async () => {
    setBusy(true);
    setError(null);
    track('checkout_started', { plan: plan.code });
    try {
      const { url } = await billingService.checkout(plan.code);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof BillingError ? err : new BillingError('unknown'));
      track('payment_failed', { plan: plan.code, stage: 'checkout' });
      setBusy(false);
    }
  };

  return (
    <Shell
      onBack={onBack}
      footer={
        <>
          <PrimaryButton variant="yellow" onClick={pay} disabled={busy}>
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {trial
              ? 'Comenzar mi prueba'
              : plan.kind === 'one_time'
                ? `Pagar ${money(plan.price)}`
                : `Suscribirme por ${money(plan.price)}`}
            <ArrowRight className="h-5 w-5" />
          </PrimaryButton>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600">
            <ShieldCheck className="h-4 w-4" /> Pagas en Mercado Pago. MONEO nunca ve ni guarda tu
            tarjeta.
          </p>
        </>
      }
    >
      <Title>Activa MONEO PLUS</Title>
      <div className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#111]">
        <p className="text-xs font-black uppercase tracking-wide text-gray-500">Tu plan</p>
        <p className="text-xl font-black">{plan.name}</p>
        <dl className="mt-4 space-y-3 text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-gray-600">Precio</dt>
            <dd className="font-black">
              {money(plan.price)}
              {plan.kind === 'subscription' ? ` / ${every}` : ' · pago único'}
              <span className="block text-right text-xs font-semibold text-gray-500">
                IGV incluido
              </span>
            </dd>
          </div>
          {trial && (
            <>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-gray-600">Prueba gratis</dt>
                <dd className="font-black">{plan.trialDays} días</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-[#DDF7E9] px-3 py-2">
                <dt className="font-bold">Hoy pagas</dt>
                <dd className="font-black">S/ 0.00</dd>
              </div>
            </>
          )}
          {plan.kind === 'subscription' && (
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-gray-600">Primer cobro</dt>
              <dd className="text-right font-black">
                {fmtDate(firstCharge)}
                <span className="block text-xs font-semibold text-gray-500">
                  luego cada {every}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </div>
      <ul className="mt-5 space-y-2 text-sm font-semibold text-gray-700">
        {trial && (
          <li>
            • Al terminar tu prueba se cobrará {money(plan.price)} y luego cada {every}, salvo que
            canceles antes.
          </li>
        )}
        {plan.kind === 'subscription' && <li>• Puedes cancelar cuando quieras desde MONEO.</li>}
        {plan.kind === 'one_time' && <li>• Un solo pago. Sin renovaciones ni cobros futuros.</li>}
        <li>• Te avisaremos antes de cada cobro.</li>
      </ul>
      {error && (
        <div role="alert" className="mt-5 rounded-2xl border-[3px] border-black bg-[#FFE1DB] p-4">
          <p className="font-black">{error.userMessage}</p>
          {error.code === 'payments-not-configured' && (
            <>
              <p className="mt-1 text-sm font-semibold">
                Mientras tanto puedes empezar gratis y activar PLUS después.
              </p>
              <PrimaryButton variant="white" onClick={onFree}>
                Empezar con MONEO FREE
              </PrimaryButton>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

// ── Confirmación del pago ─────────────────────────────────────────────────────

function ConfirmStep({
  failed,
  onActive,
  onRetry,
  onFree,
}: {
  failed: boolean;
  onActive: (e: Entitlement) => void;
  onRetry: () => void;
  onFree: () => void;
}) {
  const [phase, setPhase] = useState<'checking' | 'late' | 'failed'>(
    failed ? 'failed' : 'checking'
  );
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (phase === 'failed') {
      track('payment_failed', { stage: 'return' });
      return;
    }
    let stop = false;
    const started = Date.now();
    (async () => {
      await billingService.sync().catch(() => {});
      while (!stop && Date.now() - started < 40000) {
        const e = await entitlementService.get().catch(() => null);
        if (hasPlusNow(e) && !done.current) {
          done.current = true;
          onActive(e!);
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
        if (Date.now() - started > 12000) await billingService.sync().catch(() => {});
      }
      if (!stop) setPhase('late');
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (phase === 'checking') {
    return (
      <Shell>
        <Spinner label="Confirmando tu pago con Mercado Pago…" />
      </Shell>
    );
  }
  return (
    <Shell
      footer={
        <>
          {phase === 'late' && (
            <PrimaryButton
              variant="yellow"
              onClick={() => {
                setPhase('checking');
                setAttempt((a) => a + 1);
              }}
            >
              Ya pagué, verificar de nuevo
            </PrimaryButton>
          )}
          <div className="mt-2">
            <PrimaryButton variant="white" onClick={onRetry}>
              Elegir otro plan o método
            </PrimaryButton>
          </div>
          <TextButton onClick={onFree}>Seguir con MONEO FREE por ahora</TextButton>
        </>
      }
    >
      <Title
        sub={
          phase === 'failed'
            ? 'No se realizó ningún cobro. Puedes intentarlo de nuevo con otra tarjeta.'
            : 'Mercado Pago aún no nos confirma el pago. Si ya pagaste, se activará solo en unos minutos.'
        }
      >
        {phase === 'failed' ? 'El pago no se completó' : 'Estamos esperando la confirmación'}
      </Title>
    </Shell>
  );
}

// ── Primera cuenta ────────────────────────────────────────────────────────────

const ACCOUNT_DRAFT = 'moneo:onboarding:account';

interface Draft {
  kind: AccountKind;
  bank: BankChoice | null;
}

function MoneySteps({
  step,
  go,
  plus,
}: {
  step: Step;
  go: (s: Step, replace?: boolean) => void;
  plus: boolean;
}) {
  const [draft, setDraftState] = useState<Draft>({ kind: 'banco', bank: null });
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', currency: 'PEN', balance: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACCOUNT_DRAFT);
      if (raw) setDraftState(JSON.parse(raw));
    } catch {
      // ignore
    }
    accountsService
      .getAll()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const setDraft = (d: Draft) => {
    setDraftState(d);
    try {
      window.localStorage.setItem(ACCOUNT_DRAFT, JSON.stringify(d));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (step !== 'saldo') return;
    const base = draft.kind === 'efectivo' ? 'Efectivo' : (draft.bank?.name ?? 'Mi cuenta');
    setForm((f) => ({
      ...f,
      name:
        f.name ||
        (draft.kind === 'efectivo'
          ? 'Efectivo'
          : draft.kind === 'credito'
            ? `Tarjeta ${base}`
            : `${base} Principal`),
    }));
  }, [step, draft]);

  const first = accounts && accounts.length === 0;
  const progress = (n: number) => ({ step: n, total: 3 });

  if (step === 'dinero') {
    return (
      <Shell
        progress={progress(1)}
        footer={
          <>
            <PrimaryButton
              variant="yellow"
              onClick={() => {
                if (draft.kind === 'efectivo') go('saldo');
                else {
                  track('bank_selection_started', { kind: draft.kind });
                  go('banco');
                }
              }}
            >
              {first === false ? 'Agregar otra cuenta' : 'Agregar mi primera cuenta'}{' '}
              <ArrowRight className="h-5 w-5" />
            </PrimaryButton>
            {accounts && accounts.length > 0 && (
              <TextButton onClick={() => go('ajustes')}>Ya está, continuar</TextButton>
            )}
          </>
        }
      >
        <div className="mb-2 flex items-end gap-3">
          <Title sub="Registra dónde tienes tu dinero. Desde aquí, MONEO deja de ser una demo: es tu MONEO.">
            Empecemos por tu <Highlight color="#45D98B">dinero real.</Highlight>
          </Title>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={draft.kind === k.id}
              onClick={() => setDraft({ kind: k.id, bank: null })}
              className={`flex min-h-[120px] flex-col items-start justify-between rounded-3xl border-[3px] border-black p-4 text-left transition-all motion-reduce:transition-none ${
                draft.kind === k.id
                  ? 'translate-x-[-2px] translate-y-[-2px] bg-[#FFD83D] shadow-[4px_4px_0_#111]'
                  : 'bg-white shadow-[2px_2px_0_#111]'
              }`}
            >
              <span className="text-3xl">{k.emoji}</span>
              <span>
                <span className="block text-[15px] font-black leading-tight">{k.label}</span>
                <span className="block text-xs font-semibold text-gray-600">{k.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs font-semibold text-gray-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          MONEO no se conecta a tu banco ni te pide claves: tú registras tu saldo y MONEO hace el
          resto.
        </p>
      </Shell>
    );
  }

  if (step === 'banco') {
    const list = BANKS.filter((b) =>
      draft.kind === 'digital' ? b.wallet : draft.kind === 'credito' ? !b.wallet : !b.wallet
    ).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
    return (
      <Shell onBack={() => go('dinero', true)} progress={progress(1)}>
        <Title sub="Elige tu banco o billetera.">¿Dónde tienes tu dinero?</Title>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar banco…"
          className="mb-4 min-h-[52px] w-full rounded-2xl border-[3px] border-black bg-white px-4 text-base font-semibold outline-none"
        />
        <div className="space-y-2.5">
          {list.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setDraft({ ...draft, bank: b });
                track('bank_selected', { bank: b.id });
                go('saldo');
              }}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-3 text-left shadow-[2px_2px_0_#111] transition-transform active:scale-[0.99]"
            >
              <BrandLogo
                kind="account"
                name={b.name}
                institution={b.name}
                type={draft.kind}
                color={b.color}
              />
              <span className="flex-1 text-[15px] font-black">{b.name}</span>
              {AUTO_BANKS.includes(b.id) && (
                <span className="rounded-full border-2 border-black bg-[#B99CFF] px-2 py-0.5 text-[10px] font-black uppercase">
                  MONEO AUTO
                </span>
              )}
              <ArrowRight className="h-5 w-5" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDraft({
                ...draft,
                bank: {
                  id: 'otro',
                  name: query.trim() || 'Otra entidad',
                  color: '#111111',
                  bg: '#F3F4F6',
                },
              });
              go('saldo');
            }}
            className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-[3px] border-dashed border-black/50 text-sm font-black"
          >
            {query.trim() ? `Usar «${query.trim()}»` : 'Otra entidad'}
          </button>
        </div>
        <p className="mt-4 text-xs font-semibold text-gray-600">
          Registro manual: tú indicas tu saldo. «MONEO AUTO» marca los bancos cuyos avisos por
          correo MONEO puede leer{plus ? '' : ' (función PLUS)'}.
        </p>
      </Shell>
    );
  }

  if (step === 'saldo') {
    const cur = CURRENCIES.find((c) => c.code === form.currency)!;
    const save = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const balance = Math.round((parseFloat(form.balance.replace(',', '.')) || 0) * 100) / 100;
      setBusy(true);
      try {
        const bank = draft.kind === 'efectivo' ? null : draft.bank;
        await accountsService.create({
          name: form.name.trim() || 'Mi cuenta',
          type: draft.kind,
          institution: bank && bank.id !== 'otro' ? bank.name : (bank?.name ?? ''),
          balance,
          currency: form.currency,
          icon: KIND_ICON[draft.kind],
          color: bank?.color ?? '#16A34A',
          bgColor: bank?.bg ?? '#DCFCE7',
        });
        track(first ? 'first_account_created' : 'account_created', {
          kind: draft.kind,
          currency: form.currency,
        });
        notifyDataChanged();
        const list = await accountsService.getAll().catch(() => accounts ?? []);
        setAccounts(list);
        setForm({ name: '', currency: 'PEN', balance: '' });
        go('otra');
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    };
    return (
      <Shell
        onBack={() => go(draft.kind === 'efectivo' ? 'dinero' : 'banco', true)}
        progress={progress(2)}
      >
        <Title sub="Solo lo básico. Podrás editarla cuando quieras.">
          {first === false ? 'Agrega otra cuenta' : 'Agrega tu primera cuenta'}
        </Title>
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide">Nombre</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={40}
              className="min-h-[52px] w-full rounded-2xl border-[3px] border-black bg-white px-4 text-base font-semibold outline-none"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide">
              Moneda de la cuenta
            </span>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={form.currency === c.code}
                  onClick={() => setForm({ ...form, currency: c.code })}
                  className={`min-h-[52px] rounded-2xl border-[3px] border-black text-sm font-black ${
                    form.currency === c.code ? 'bg-black text-white' : 'bg-white'
                  }`}
                >
                  {c.code}
                  <span className="block text-[11px] font-semibold opacity-80">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide">
              Saldo actual
            </span>
            <div className="flex min-h-[64px] items-center gap-2 rounded-2xl border-[3px] border-black bg-white px-4 focus-within:shadow-[3px_3px_0_#111]">
              <span className="text-2xl font-black">{cur.symbol}</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={form.balance}
                onChange={(e) =>
                  setForm({ ...form, balance: e.target.value.replace(/[^\d.,]/g, '') })
                }
                className="w-full bg-transparent text-3xl font-black tabular-nums outline-none"
                autoFocus
              />
            </div>
            <span className="mt-1.5 block text-xs font-semibold text-gray-600">
              {draft.kind === 'credito'
                ? 'Si es tarjeta de crédito, pon lo disponible o 0; la deuda puedes anotarla luego en Deudas.'
                : 'Lo que tienes hoy. Desde aquí MONEO lo actualiza con tus movimientos.'}
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" variant="yellow" disabled={busy}>
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            Guardar cuenta <ArrowRight className="h-5 w-5" />
          </PrimaryButton>
        </form>
      </Shell>
    );
  }

  // 'otra'
  const last = accounts && accounts.length > 0 ? accounts[accounts.length - 1] : null;
  return (
    <Shell
      progress={progress(2)}
      footer={
        <>
          <PrimaryButton variant="yellow" onClick={() => go('ajustes')}>
            Ya está, continuar <ArrowRight className="h-5 w-5" />
          </PrimaryButton>
          <div className="mt-2">
            <PrimaryButton variant="white" onClick={() => go('dinero')}>
              Agregar otra cuenta
            </PrimaryButton>
          </div>
        </>
      }
    >
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-black bg-[#45D98B] text-3xl motion-safe:animate-tick-up">
          ✓
        </div>
        <h1 className="mt-4 text-[28px] font-black leading-tight">
          {accounts && accounts.length > 1
            ? '¡Perfecto! Otra cuenta lista.'
            : '¡Perfecto! Ya tienes tu primera cuenta.'}
        </h1>
        <p className="mt-1 font-medium text-gray-700">
          ¿Tienes otra cuenta? Puedes agregarla ahora o después.
        </p>
      </div>
      <ul className="mt-6 space-y-2.5">
        {(accounts ?? []).map((a) => (
          <li
            key={a.id}
            className={`flex items-center gap-3 rounded-2xl border-[3px] border-black bg-white p-3 ${a.id === last?.id ? 'shadow-[4px_4px_0_#111]' : ''}`}
          >
            <BrandLogo
              kind="account"
              name={a.name}
              institution={a.institution}
              type={a.type}
              color={a.color}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-black">{a.name}</span>
              <span className="block text-xs font-semibold text-gray-600">
                {a.institution || 'Efectivo'}
              </span>
            </span>
            <span className="font-black tabular-nums">
              {CURRENCIES.find((c) => c.code === a.currency)?.symbol ?? a.currency}{' '}
              {a.balance.toLocaleString('es-PE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

// ── Ajustes rápidos: moneda principal + alertas ───────────────────────────────

function SettingsStep({
  notify,
  onBack,
  onDone,
}: {
  notify: OnboardingState['notify'];
  onBack: () => void;
  onDone: (notify: OnboardingState['notify']) => void;
}) {
  const [base, setBase] = useState('PEN');
  const [prefs, setPrefs] = useState(notify);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    userSettingsService
      .get()
      .then((s) => setBase(s.baseCurrencyCode))
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await userSettingsService.upsert({ baseCurrencyCode: base });
      onDone(prefs);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Shell
      onBack={onBack}
      progress={{ step: 3, total: 3 }}
      footer={
        <PrimaryButton variant="yellow" onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          Guardar y terminar <ArrowRight className="h-5 w-5" />
        </PrimaryButton>
      }
    >
      <Title sub="Dos ajustes rápidos y listo.">Hagamos MONEO tuyo</Title>
      <p className="mb-2 text-xs font-black uppercase tracking-wide">Tu moneda principal</p>
      <p className="mb-3 text-[13px] font-semibold text-gray-600">
        En esta moneda verás tus totales. Cada cuenta mantiene su propia moneda.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            type="button"
            aria-pressed={base === c.code}
            onClick={() => setBase(c.code)}
            className={`min-h-[56px] rounded-2xl border-[3px] border-black text-sm font-black ${
              base === c.code ? 'bg-[#FFD83D] shadow-[3px_3px_0_#111]' : 'bg-white'
            }`}
          >
            {c.symbol} {c.code}
            <span className="block text-[11px] font-semibold opacity-80">{c.label}</span>
          </button>
        ))}
      </div>

      <p className="mb-2 mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-wide">
        <Bell className="h-4 w-4" /> ¿Quieres que MONEO te avise?
      </p>
      <ul className="divide-y-2 divide-black/10 rounded-2xl border-[3px] border-black bg-white">
        {NOTIFY_OPTIONS.map((o) => (
          <li key={o.id}>
            <label className="flex min-h-[60px] cursor-pointer items-center gap-3 px-4 py-2">
              <span className="flex-1">
                <span className="block text-[15px] font-black">{o.label}</span>
                <span className="block text-xs font-semibold text-gray-600">{o.hint}</span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={prefs[o.id]}
                onChange={(e) => setPrefs({ ...prefs, [o.id]: e.target.checked })}
              />
              <span
                aria-hidden
                className="relative h-8 w-14 shrink-0 rounded-full border-[3px] border-black bg-gray-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border-2 after:border-black after:bg-white after:transition-transform peer-checked:bg-[#45D98B] peer-checked:after:translate-x-6 peer-focus-visible:ring-2 peer-focus-visible:ring-black motion-reduce:after:transition-none"
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-semibold text-gray-600">
        Por ahora los avisos aparecen dentro de MONEO. Cuando instales la app, te pediremos permiso
        para enviarlos a tu celular.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-red-600">
          {error}
        </p>
      )}
    </Shell>
  );
}

// ── Todo listo ────────────────────────────────────────────────────────────────

function DoneStep({ plus, onFinish }: { plus: boolean; onFinish: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    accountsService
      .getAll()
      .then((a) => setCount(a.length))
      .catch(() => setCount(null));
  }, []);
  const items = useMemo(
    () => [
      { done: true, label: plus ? 'MONEO PLUS activo' : 'MONEO FREE activo' },
      {
        done: Boolean(count),
        label: count
          ? `${count} ${count === 1 ? 'cuenta agregada' : 'cuentas agregadas'}`
          : 'Cuenta pendiente',
      },
      { done: true, label: 'Moneda principal configurada' },
      { done: true, label: 'Alertas configuradas' },
      { done: true, label: 'Tu experiencia personalizada' },
    ],
    [plus, count]
  );
  return (
    <Shell
      footer={
        <PrimaryButton
          variant="yellow"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onFinish().catch(() => setBusy(false));
          }}
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          Ir a mi MONEO <ArrowRight className="h-5 w-5" />
        </PrimaryButton>
      }
    >
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="relative w-full max-w-[260px] overflow-hidden rounded-[28px] border-[3px] border-black bg-[#FFD83D] shadow-[6px_6px_0_#111]">
          <Image
            src="/assets/images/onboarding/moneo-hola.webp"
            alt="El mono de MONEO te saluda"
            width={394}
            height={700}
            className="h-56 w-full object-cover object-top"
          />
        </div>
        <h1 className="mt-6 text-[34px] font-black leading-tight">
          ¡Tu MONEO <Highlight>está listo!</Highlight>
        </h1>
        <p className="mt-1 font-medium text-gray-700">Tu dinero está listo para empezar.</p>
      </div>
      <ul className="mt-6 space-y-2.5">
        {items.map((i) => (
          <CheckRow key={i.label} done={i.done}>
            {i.label}
          </CheckRow>
        ))}
      </ul>
    </Shell>
  );
}
