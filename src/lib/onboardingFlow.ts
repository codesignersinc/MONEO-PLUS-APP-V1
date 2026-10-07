import { createClient } from '@/lib/supabase/client';
import { toDataError } from '@/lib/dataError';
import type { PlanCode } from '@/lib/billing';

// New onboarding (/empezar): answers, chosen plan and current step. Before the account
// exists they live only in this browser (no personal or financial data); once signed in
// they are saved to onboarding_profiles so the flow resumes on any device.

export const ONBOARDING_V2 = process.env.NEXT_PUBLIC_ONBOARDING_V2 === 'true';

export const GOALS = [
  { id: 'entender', label: 'Entender mejor mi dinero', emoji: '🔍' },
  { id: 'gastar_menos', label: 'Gastar menos', emoji: '✂️' },
  { id: 'ahorrar', label: 'Ahorrar para algo', emoji: '🐷' },
  { id: 'deudas', label: 'Ordenar mis deudas', emoji: '🧾' },
  { id: 'crecer', label: 'Hacer crecer mi dinero', emoji: '📈' },
  { id: 'menos_estres', label: 'Vivir con menos estrés financiero', emoji: '😌' },
] as const;

export const LEAKS = [
  { id: 'comida', label: 'Comida y delivery', emoji: '🍔' },
  { id: 'cafes', label: 'Cafés y gustos', emoji: '☕' },
  { id: 'compras', label: 'Compras', emoji: '🛍️' },
  { id: 'suscripciones', label: 'Suscripciones', emoji: '📺' },
  { id: 'salidas', label: 'Salidas y entretenimiento', emoji: '🎉' },
  { id: 'transporte', label: 'Transporte', emoji: '🚕' },
  { id: 'casa', label: 'Casa y servicios', emoji: '🏠' },
  { id: 'deudas', label: 'Deudas y cuotas', emoji: '💳' },
  { id: 'online', label: 'Compras online', emoji: '📦' },
] as const;

export const METHODS = [
  {
    id: 'voz',
    label: 'Háblale a MONEO',
    hint: '«Gasté S/35 en un taxi.»',
    emoji: '🎙️',
    plus: true,
  },
  {
    id: 'auto',
    label: 'Automáticamente',
    hint: 'MONEO detecta tus movimientos.',
    emoji: '⚡',
    plus: true,
  },
  { id: 'texto', label: 'Escribiéndolo', hint: 'Tú registras el gasto.', emoji: '✍️', plus: false },
  {
    id: 'scan',
    label: 'Escaneándolo',
    hint: 'MONEO SCAN lee tus comprobantes.',
    emoji: '📸',
    plus: true,
  },
] as const;

export const FIRST_GOALS = [
  { id: 'ahorrar_1000', label: 'Ahorrar S/1,000', emoji: '💰' },
  { id: 'viajar', label: 'Viajar', emoji: '✈️' },
  { id: 'casa', label: 'Comprar una casa', emoji: '🏡' },
  { id: 'auto', label: 'Comprar un auto', emoji: '🚗' },
  { id: 'emergencia', label: 'Crear un fondo de emergencia', emoji: '🛟' },
  { id: 'deuda', label: 'Pagar una deuda', emoji: '⛓️' },
  { id: 'invertir', label: 'Empezar a invertir', emoji: '🌱' },
  { id: 'otra', label: 'Otra meta', emoji: '⭐' },
] as const;

export const NOTIFY_OPTIONS = [
  { id: 'gastos', label: 'Gastos detectados', hint: 'Cuando MONEO AUTO encuentra un movimiento.' },
  { id: 'pagos', label: 'Pagos y suscripciones', hint: 'Antes de que venza un pago.' },
  { id: 'presupuestos', label: 'Presupuestos', hint: 'Si te acercas a tu límite.' },
  { id: 'metas', label: 'Metas', hint: 'Tus avances y logros.' },
  { id: 'consejos', label: 'Consejos y oportunidades', hint: 'Ideas para ahorrar más.' },
  { id: 'seguridad', label: 'Seguridad', hint: 'Accesos y cambios en tu cuenta.' },
] as const;

export type GoalId = (typeof GOALS)[number]['id'];
export type LeakId = (typeof LEAKS)[number]['id'];
export type MethodId = (typeof METHODS)[number]['id'];
export type FirstGoalId = (typeof FIRST_GOALS)[number]['id'];
export type NotifyId = (typeof NOTIFY_OPTIONS)[number]['id'];

export interface OnboardingState {
  goals: GoalId[];
  leaks: LeakId[];
  methods: MethodId[];
  firstGoal: FirstGoalId | null;
  // null = not chosen yet; 'trial' = 7 days of PLUS without card; 'free' = MONEO FREE.
  plan: PlanCode | 'free' | 'trial' | null;
  notify: Record<NotifyId, boolean>;
  step: string;
}

export const EMPTY_STATE: OnboardingState = {
  goals: [],
  leaks: [],
  methods: [],
  firstGoal: null,
  plan: null,
  notify: {
    gastos: true,
    pagos: true,
    presupuestos: true,
    metas: true,
    consejos: false,
    seguridad: true,
  },
  step: 'inicio',
};

const KEY = 'moneo:onboarding:v1';

export function loadLocal(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return { ...EMPTY_STATE, ...parsed, notify: { ...EMPTY_STATE.notify, ...parsed.notify } };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveLocal(state: OnboardingState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the flow still works, it just won't resume after a reload.
  }
}

export function clearLocal(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export interface OnboardingProfile {
  state: Partial<OnboardingState>;
  completedAt: string | null;
}

export const onboardingService = {
  async get(): Promise<OnboardingProfile | null> {
    const { data, error } = await createClient()
      .from('onboarding_profiles')
      .select('*')
      .maybeSingle();
    if (error) throw toDataError(error);
    if (!data) return null;
    return {
      completedAt: data.completed_at,
      state: {
        goals: data.goals ?? [],
        leaks: data.leak_categories ?? [],
        methods: data.capture_methods ?? [],
        firstGoal: data.first_goal,
        notify: { ...EMPTY_STATE.notify, ...(data.notify_prefs ?? {}) },
        step: data.step ?? undefined,
      },
    };
  },

  async save(userId: string, state: OnboardingState, completed = false): Promise<void> {
    const { error } = await createClient()
      .from('onboarding_profiles')
      .upsert(
        {
          user_id: userId,
          goals: state.goals,
          leak_categories: state.leaks,
          capture_methods: state.methods,
          first_goal: state.firstGoal,
          notify_prefs: state.notify,
          step: state.step,
          ...(completed ? { completed_at: new Date().toISOString() } : {}),
        },
        { onConflict: 'user_id' }
      );
    if (error) throw toDataError(error);
  },
};
