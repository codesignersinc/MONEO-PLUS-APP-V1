// Coronas: MONEO+'s reward for good money habits (gamification phase 1). The database grants
// them (coronas_sync, migration 20261023120000); this file only describes them for the UI.
// Coronas are not money, cannot be exchanged for cash and expire 12 months after being earned.

export type CoronaRule =
  | 'registro_dia'
  | 'racha_7'
  | 'pago_a_tiempo'
  | 'aporte_meta'
  | 'presupuesto_mes'
  | 'junta_completa'
  | 'auto_confirmada'
  | 'logro';

export interface CoronaAward {
  rule: CoronaRule;
  key: string;
  amount: number;
}

export interface CoronasSummary {
  balance: number;
  lifetime: number;
  streak: number;
  registeredToday: boolean;
  startedOn: string;
  today: string;
  new: CoronaAward[];
}

export const RULE_LABELS: Record<CoronaRule, string> = {
  registro_dia: 'Registraste tus movimientos del día',
  racha_7: 'Completaste 7 días seguidos',
  pago_a_tiempo: 'Pagaste a tiempo',
  aporte_meta: 'Aportaste a una meta',
  presupuesto_mes: 'Cumpliste tu presupuesto del mes',
  junta_completa: 'Completaste una junta',
  auto_confirmada: 'Confirmaste un movimiento de MONEO AUTO',
  logro: 'Desbloqueaste un logro',
};

/** How to earn more, in the order shown on the Coronas screen. */
export const WAYS_TO_EARN: { rule: CoronaRule; amount: string; title: string; detail: string }[] = [
  {
    rule: 'registro_dia',
    amount: '+1',
    title: 'Registra tu día',
    detail: 'Anota al menos un movimiento hoy. Cuenta el día en que lo registras.',
  },
  {
    rule: 'racha_7',
    amount: '+5',
    title: 'Racha de 7 días',
    detail: 'Cada 7 días seguidos registrando.',
  },
  {
    rule: 'pago_a_tiempo',
    amount: '+2',
    title: 'Paga a tiempo',
    detail: 'Marca como pagado un pago antes de que venza (hasta 2 por día).',
  },
  {
    rule: 'aporte_meta',
    amount: '+2',
    title: 'Aporta a una meta',
    detail: 'Sube el monto de una de tus metas (1 vez por semana).',
  },
  {
    rule: 'presupuesto_mes',
    amount: '+10',
    title: 'Cumple tu presupuesto',
    detail: 'Termina el mes sin pasarte en ninguna categoría y registrando al menos 10 días.',
  },
  {
    rule: 'junta_completa',
    amount: '+10',
    title: 'Completa una junta',
    detail: 'Una junta finalizada con al menos 3 participantes con cuenta.',
  },
  {
    rule: 'auto_confirmada',
    amount: '+1',
    title: 'Confirma MONEO AUTO',
    detail: 'Registra un movimiento que MONEO AUTO detectó (hasta 2 por día).',
  },
];

export interface Achievement {
  code: string;
  title: string;
  detail: string;
  bonus: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { code: 'primer_registro', title: 'Primer paso', detail: 'Tu primer día registrado', bonus: 3 },
  { code: 'racha_7', title: 'Una semana', detail: 'Racha de 7 días', bonus: 5 },
  { code: 'racha_30', title: 'Imparable', detail: 'Racha de 30 días', bonus: 15 },
  { code: 'pago_puntual', title: 'Puntual', detail: 'Tu primer pago a tiempo', bonus: 3 },
  { code: 'pagos_10', title: 'Cero moras', detail: '10 pagos a tiempo', bonus: 10 },
  {
    code: 'meta_cumplida',
    title: 'Meta cumplida',
    detail: 'Llegaste al 100% de una meta',
    bonus: 10,
  },
  { code: 'presupuesto', title: 'En control', detail: 'Un mes dentro del presupuesto', bonus: 5 },
  { code: 'junta', title: 'Buen juntero', detail: 'Completaste una junta', bonus: 5 },
];

export interface Level {
  level: number;
  name: string;
  /** Lifetime Coronas needed to reach it. */
  from: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Semilla', from: 0 },
  { level: 2, name: 'Brote', from: 20 },
  { level: 3, name: 'Ahorrador', from: 60 },
  { level: 4, name: 'Estratega', from: 150 },
  { level: 5, name: 'Maestro', from: 300 },
  { level: 6, name: 'Leyenda', from: 600 },
];

export interface LevelProgress {
  current: Level;
  next: Level | null;
  /** 0–1 towards the next level (1 at the last level). */
  progress: number;
  /** Coronas left for the next level (0 at the last level). */
  missing: number;
}

/** Level from lifetime Coronas (expired ones still count: the level never goes down). */
export function levelFor(lifetime: number): LevelProgress {
  const total = Math.max(0, Math.floor(lifetime));
  let i = 0;
  while (i + 1 < LEVELS.length && total >= LEVELS[i + 1].from) i++;
  const current = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  if (!next) return { current, next, progress: 1, missing: 0 };
  return {
    current,
    next,
    progress: (total - current.from) / (next.from - current.from),
    missing: next.from - total,
  };
}

/** Short toast text for the Coronas just earned, or null when there are none. */
export function awardsMessage(awards: CoronaAward[]): string | null {
  const total = awards.reduce((s, a) => s + a.amount, 0);
  if (total <= 0) return null;
  const first = awards[0];
  const reason =
    awards.length === 1
      ? RULE_LABELS[first.rule]
      : awards.some((a) => a.rule === 'logro')
        ? 'Desbloqueaste un logro'
        : RULE_LABELS[first.rule];
  return `+${total} ${total === 1 ? 'Corona' : 'Coronas'} · ${reason}`;
}

/** Label for a ledger row in the history. */
export function awardLabel(rule: CoronaRule, key: string): string {
  if (rule === 'logro') {
    const code = key.startsWith('logro:') ? key.slice(6) : key;
    const a = ACHIEVEMENTS.find((x) => x.code === code);
    return a ? `Logro: ${a.title}` : RULE_LABELS.logro;
  }
  return RULE_LABELS[rule] ?? 'Coronas';
}

/** «1 día» / «5 días». */
export function streakText(days: number): string {
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}
