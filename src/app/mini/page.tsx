'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Target,
} from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import LoadError from '@/components/ui/LoadError';
import AddTransactionModal from '@/components/finance/AddTransactionModal';
import { moneyFormatter } from '@/components/dashboard/ui';
import { companionService, type CompanionSummary } from '@/lib/supabaseCompanion';
import { dueLabel, safeToSpendHint } from '@/lib/companion';
import { useDataChanged } from '@/lib/dataSync';

// MONEO Mini: a compact view of the user's money for a small window on the laptop (or a
// phone). Everything comes from MONEO Core (moneo_summary), the same numbers as Inicio.
// Amounts start hidden (it lives on screen all day); the eye shows them on this device.

type Tab = 'gasto' | 'ingreso' | 'transferencia';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const HIDE_KEY = 'moneo:mini:hide-amounts';
const MASK = '••••••';
const REFRESH_MS = 60_000;

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) !== '0';
  } catch {
    return true;
  }
}

function openFull(path = '/finanzas') {
  window.open(path, 'moneo-full');
}

export default function MiniPage() {
  const [data, setData] = useState<CompanionSummary | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [modal, setModal] = useState<Tab | null>(null);
  const [install, setInstall] = useState<InstallPromptEvent | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    companionService
      .summary()
      .then((s) => {
        setData(s);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useDataChanged(load);
  useEffect(() => {
    setHidden(readHidden());
    load();
    // Fresh numbers when the window comes back and every minute while visible.
    const onFocus = () => document.visibilityState === 'visible' && load();
    const id = window.setInterval(onFocus, REFRESH_MS);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  // Installed as its own app: a compact window the first time.
  useEffect(() => {
    if (!window.matchMedia('(display-mode: standalone)').matches) return;
    try {
      if (localStorage.getItem('moneo:mini:sized')) return;
      localStorage.setItem('moneo:mini:sized', '1');
      window.resizeTo(420, 780);
    } catch {
      // the browser decides the size
    }
  }, []);

  // Desktop Chrome/Edge: "Instalar MONEO Mini" (captured early by register-sw.js).
  useEffect(() => {
    const w = window as Window & { __moneoInstallPrompt?: InstallPromptEvent | null };
    if (w.__moneoInstallPrompt) setInstall(w.__moneoInstallPrompt);
    const onAvailable = () => setInstall(w.__moneoInstallPrompt ?? null);
    window.addEventListener('moneo:install-available', onAvailable);
    return () => window.removeEventListener('moneo:install-available', onAvailable);
  }, []);

  const toggleHidden = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        // per-device convenience only
      }
      return !h;
    });

  const money = useMemo(() => moneyFormatter(data?.currency ?? 'PEN'), [data?.currency]);
  const show = (n: number, opts?: { sign?: boolean }) => (hidden ? MASK : money(n, opts));

  const runInstall = async () => {
    if (!install) return;
    await install.prompt();
    await install.userChoice.catch(() => null);
    setInstall(null);
  };

  return (
    <main className="min-h-screen bg-[#070E14] p-3 font-poppins text-[#111] sm:flex sm:items-start sm:justify-center sm:p-6">
      <div className="mx-auto w-full max-w-[420px] rounded-[28px] border-2 border-black bg-[#FFF9EC] p-4 shadow-[4px_4px_0_#FFD83D]">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <MoneoLogo width={104} height={38} />
          <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#FFD83D]">
            Mini
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <IconButton label={hidden ? 'Mostrar montos' : 'Ocultar montos'} onClick={toggleHidden}>
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </IconButton>
            <IconButton label="Actualizar" onClick={load}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </IconButton>
            <IconButton label="Abrir MONEO completo" onClick={() => openFull()}>
              <ExternalLink className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {error && !data ? (
          <LoadError what="tu resumen" error={error} onRetry={load} />
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : (
          <div className="space-y-3">
            {/* Puedes gastar hoy */}
            <section className="rounded-3xl border-2 border-black bg-[#FFD83D] p-4 shadow-[0_3px_0_#111]">
              <p className="flex items-center gap-1.5 text-sm font-black">
                Puedes gastar hoy
                <span
                  title="Estimado: tu disponible, menos tus pagos pendientes y el aporte del mes a tus metas, repartido en los días que faltan."
                  className="cursor-help"
                >
                  <Info className="h-3.5 w-3.5" />
                </span>
              </p>
              <p className="mt-1 text-[38px] font-black leading-none tracking-tight">
                {show(data.safeToSpend.today)}
              </p>
              <p className="mt-2 text-xs font-bold text-[#111]/75">
                aprox. · {safeToSpendHint(data.safeToSpend)}
              </p>
              {data.spentToday > 0 && (
                <p className="mt-0.5 text-xs font-bold text-[#111]/75">
                  Hoy ya gastaste {show(data.spentToday)}
                </p>
              )}
            </section>

            {/* Totals */}
            <section className="grid grid-cols-3 gap-2">
              <Stat
                label="Patrimonio"
                value={show(data.netWorth)}
                hint={pctHint(data.netWorthPct)}
              />
              <Stat label="Disponible" value={show(data.available)} />
              <Stat label="Por pagar" value={show(data.committed)} hint="este mes" />
            </section>

            {/* Quick actions */}
            <section className="grid grid-cols-3 gap-2">
              <Action label="Gasto" tone="#FF806E" onClick={() => setModal('gasto')}>
                <Minus className="h-5 w-5" strokeWidth={3} />
              </Action>
              <Action label="Ingreso" tone="#45D98B" onClick={() => setModal('ingreso')}>
                <Plus className="h-5 w-5" strokeWidth={3} />
              </Action>
              <Action label="Transferir" tone="#75B8FF" onClick={() => setModal('transferencia')}>
                <ArrowLeftRight className="h-5 w-5" strokeWidth={2.6} />
              </Action>
            </section>

            {/* Next payment + goal */}
            <section className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openFull('/finanzas/pagos')}
                className="rounded-2xl border-2 border-black bg-white p-3 text-left"
              >
                <p className="flex items-center gap-1 text-xs font-black">
                  <CalendarClock className="h-3.5 w-3.5" /> Próximo pago
                </p>
                {data.nextPayment ? (
                  <>
                    <p className="mt-1 truncate text-sm font-bold">{data.nextPayment.name}</p>
                    <p className="text-base font-black">{show(data.nextPayment.amount)}</p>
                    <p
                      className={`text-xs font-bold ${
                        dueLabel(data.nextPayment.date, data.asOf, data.nextPayment.overdue) ===
                        'Vencido'
                          ? 'text-[#B42318]'
                          : 'text-gray-600'
                      }`}
                    >
                      {dueLabel(data.nextPayment.date, data.asOf, data.nextPayment.overdue)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-gray-600">Nada pendiente 🎉</p>
                )}
              </button>
              <button
                type="button"
                onClick={() => openFull('/finanzas/ahorros')}
                className="rounded-2xl border-2 border-black bg-white p-3 text-left"
              >
                <p className="flex items-center gap-1 text-xs font-black">
                  <Target className="h-3.5 w-3.5" /> Mi meta
                </p>
                {data.mainGoal ? (
                  <>
                    <p className="mt-1 truncate text-sm font-bold">
                      {data.mainGoal.icon ? `${data.mainGoal.icon} ` : ''}
                      {data.mainGoal.name}
                    </p>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-black bg-[#F1ECE0]">
                      <div
                        className="h-full rounded-full bg-[#45D98B]"
                        style={{ width: `${Math.max(3, data.mainGoal.pct)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs font-black">{data.mainGoal.pct}%</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-gray-600">Crea tu primera meta</p>
                )}
              </button>
            </section>

            {/* Recent movements */}
            <section className="rounded-2xl border-2 border-black bg-white p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-black">Movimientos recientes</p>
                <button
                  type="button"
                  onClick={() => openFull('/finanzas/movimientos')}
                  className="text-xs font-black text-[#2563EB]"
                >
                  Ver todos →
                </button>
              </div>
              {data.recent.length === 0 ? (
                <p className="py-3 text-xs font-semibold text-gray-600">
                  Aún no tienes movimientos. Registra tu primer gasto.
                </p>
              ) : (
                <ul className="divide-y divide-black/10">
                  {data.recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-2.5 py-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F4F1EA] text-base">
                        {r.icon ||
                          (r.type === 'ingreso' ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{r.name}</span>
                        <span className="block text-[11px] font-semibold text-gray-500">
                          {when(r.date)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-sm font-black ${!hidden && r.amount >= 0 ? 'text-[#15803D]' : ''}`}
                      >
                        {hidden ? MASK : moneyFormatter(r.currency)(r.amount, { sign: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {install && (
              <button
                type="button"
                onClick={runInstall}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black bg-white py-2.5 text-sm font-black"
              >
                <Download className="h-4 w-4" /> Instalar MONEO Mini en este equipo
              </button>
            )}
          </div>
        )}
      </div>

      <AddTransactionModal
        isOpen={modal !== null}
        initialTab={modal ?? undefined}
        onClose={() => setModal(null)}
        onSaved={load}
      />
    </main>
  );
}

function pctHint(pct: number | null): string | undefined {
  if (pct === null) return undefined;
  return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% este mes`;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border-2 border-black bg-white"
    >
      {children}
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border-2 border-black bg-white px-2.5 py-2">
      <p className="truncate text-[11px] font-bold text-gray-600">{label}</p>
      <p className="truncate text-[15px] font-black leading-tight">{value}</p>
      {hint && <p className="truncate text-[10px] font-bold text-gray-500">{hint}</p>}
    </div>
  );
}

function Action({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border-2 border-black bg-white py-2.5 text-sm font-black shadow-[0_2px_0_#111] active:translate-y-0.5 active:shadow-none"
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-full border-2 border-black"
        style={{ background: tone }}
      >
        {children}
      </span>
      {label}
    </button>
  );
}
