'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Flame, Info, Loader2, Lock, Trophy } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { publishCoronas } from '@/components/coronas/coronasStore';
import { useDataChanged } from '@/lib/dataSync';
import {
  ACHIEVEMENTS,
  awardLabel,
  levelFor,
  streakText,
  WAYS_TO_EARN,
  type CoronasSummary,
} from '@/lib/coronas';
import { coronasService, type CoronaEntry, type EarnedAchievement } from '@/lib/supabaseCoronas';

// Coronas: balance, level, streak, achievements, history and how to earn more.

function shortDate(ymd: string): string {
  const d = new Date(ymd.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

function expiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CoronasPage() {
  const [summary, setSummary] = useState<CoronasSummary | null>(null);
  const [history, setHistory] = useState<CoronaEntry[]>([]);
  const [earned, setEarned] = useState<EarnedAchievement[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await coronasService.sync();
      publishCoronas(s);
      const [h, a] = await Promise.all([coronasService.history(), coronasService.achievements()]);
      setSummary(s);
      setHistory(h);
      setEarned(a);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(load);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando" />
      </div>
    );
  }
  if (error || !summary) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <LoadError what="tus Coronas" error={error} onRetry={load} />
      </div>
    );
  }

  const lvl = levelFor(summary.lifetime);
  const earnedCodes = new Set(earned.map((a) => a.code));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 font-poppins text-[#111]">
      <div className="rounded-3xl border-[3px] border-black bg-[#FFD83D] p-5 shadow-[4px_4px_0_#111]">
        <p className="text-sm font-black">Tus Coronas</p>
        <div className="mt-1 flex items-end gap-2">
          <Crown className="mb-1 h-8 w-8" strokeWidth={2.5} aria-hidden />
          <span className="text-[44px] font-black leading-none">{summary.balance}</span>
        </div>
        <p className="mt-2 text-sm font-semibold">
          Se ganan con buenos hábitos con tu dinero. Pronto podrás canjearlas con negocios aliados.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-black bg-white p-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#111]/60">
              Nivel {lvl.current.level}
            </p>
            <p className="text-lg font-black">{lvl.current.name}</p>
            <div
              className="mt-2 h-3 overflow-hidden rounded-full border-2 border-black bg-[#FFF9EC]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(lvl.progress * 100)}
              aria-label="Avance al siguiente nivel"
            >
              <div className="h-full bg-[#2DD4BF]" style={{ width: `${lvl.progress * 100}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold text-[#111]/70">
              {lvl.next
                ? `Te faltan ${lvl.missing} para ${lvl.next.name}`
                : 'Llegaste al nivel más alto'}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-black bg-white p-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#111]/60">Racha</p>
            <p className="flex items-center gap-1 text-lg font-black">
              <Flame className="h-5 w-5 text-[#F97316]" strokeWidth={2.5} aria-hidden />
              {streakText(summary.streak)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#111]/70">
              {summary.registeredToday
                ? 'Hoy ya sumaste. Vuelve mañana para seguir.'
                : 'Registra un movimiento hoy para no perderla.'}
            </p>
          </div>
        </div>
      </div>

      <section className="mt-6" aria-labelledby="ganar">
        <h2 id="ganar" className="text-lg font-black">
          Cómo ganar Coronas
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {WAYS_TO_EARN.map((w) => (
            <li key={w.rule} className="flex gap-3 rounded-2xl border-2 border-black bg-white p-3">
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-xl border-2 border-black bg-[#FFD83D] text-sm font-black">
                {w.amount}
              </span>
              <div className="min-w-0">
                <p className="font-black">{w.title}</p>
                <p className="text-xs font-semibold text-[#111]/70">{w.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby="logros">
        <h2 id="logros" className="text-lg font-black">
          Logros
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const done = earnedCodes.has(a.code);
            return (
              <li
                key={a.code}
                className={`rounded-2xl border-2 border-black p-3 text-center ${done ? 'bg-[#DCFCE7]' : 'bg-white opacity-60'}`}
              >
                {done ? (
                  <Trophy className="mx-auto h-6 w-6" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Lock className="mx-auto h-6 w-6" strokeWidth={2.5} aria-hidden />
                )}
                <p className="mt-1 text-sm font-black">{a.title}</p>
                <p className="text-[11px] font-semibold text-[#111]/70">{a.detail}</p>
                <p className="mt-1 text-[11px] font-black">+{a.bonus}</p>
                <span className="sr-only">{done ? 'Desbloqueado' : 'Bloqueado'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby="historial">
        <h2 id="historial" className="text-lg font-black">
          Historial
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-black bg-white p-4 text-sm font-semibold">
            Aún no ganas Coronas. Registra tu primer movimiento de hoy y empieza tu racha.
          </p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-black/10 rounded-2xl border-2 border-black bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{awardLabel(h.rule, h.key)}</p>
                  <p className="text-xs font-semibold text-[#111]/60">
                    {shortDate(h.earnedOn)}
                    {new Date(h.expiresAt) <= new Date()
                      ? ' · vencida'
                      : ` · vence ${expiryDate(h.expiresAt)}`}
                  </p>
                </div>
                <span className="font-black">+{h.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex gap-3 rounded-2xl border-2 border-black bg-white p-4">
        <Info className="h-5 w-5 shrink-0" aria-hidden />
        <p className="text-xs font-semibold">
          Las Coronas no son dinero: no se cambian por efectivo ni se transfieren, y vencen a los 12
          meses de ganarlas. Tu nivel no baja aunque venzan. Más detalles en los{' '}
          <Link href="/terminos" className="underline">
            Términos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
