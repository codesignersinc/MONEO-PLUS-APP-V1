'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import LoadError from '@/components/ui/LoadError';
import { useAuth } from '@/contexts/AuthContext';
import { adminService, type AdminUserRow } from '@/lib/supabaseAdmin';

const DAY = 24 * 60 * 60 * 1000;

type Status = 'nuevo' | 'activo' | 'inactivo' | 'sin-uso';

const STATUS: Record<Status, { label: string; cls: string }> = {
  nuevo: { label: 'Nuevo', cls: 'bg-[#75B8FF]' },
  activo: { label: 'Activo', cls: 'bg-[#45D98B]' },
  inactivo: { label: 'Inactivo', cls: 'bg-[#FFD43B]' },
  'sin-uso': { label: 'Sin uso', cls: 'bg-gray-200' },
};

function totalRecords(u: AdminUserRow): number {
  return (
    u.cuentas +
    u.gastos +
    u.ingresos +
    u.transferencias +
    u.pagos +
    u.cobros +
    u.suscripciones +
    u.deudas +
    u.metas +
    u.juntasOrganiza
  );
}

// Activity at a glance: new (< 7 days), active (a movement in the last 14 days),
// registered something but idle, or nothing registered yet.
function statusOf(u: AdminUserRow, now: number): Status {
  if (now - new Date(u.createdAt).getTime() < 7 * DAY) return 'nuevo';
  if (u.ultimoMovimiento && now - new Date(u.ultimoMovimiento).getTime() < 14 * DAY)
    return 'activo';
  return totalRecords(u) > 0 ? 'inactivo' : 'sin-uso';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl ${className} border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl border-2 border-black ${color}`}>
        <Icon className="h-4 w-4 text-black" />
      </span>
      <p className="mt-3 text-3xl font-black text-black">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{label}</p>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
        value > 0 ? 'border-black bg-white text-black' : 'border-gray-200 bg-gray-50 text-gray-400'
      }`}
    >
      {label} <span className="font-black">{value}</span>
    </span>
  );
}

function Counts({ u }: { u: AdminUserRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Count label="Cuentas" value={u.cuentas} />
      <Count label="Gastos" value={u.gastos} />
      <Count label="Ingresos" value={u.ingresos + u.cobros} />
      <Count label="Pagos" value={u.pagos} />
      <Count label="Suscr." value={u.suscripciones} />
      <Count label="Deudas" value={u.deudas} />
      <Count label="Metas" value={u.metas} />
      <Count label="Juntas" value={u.juntasOrganiza + u.juntasParticipa} />
    </div>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Status | 'todos'>('todos');

  const load = useCallback(() => {
    setError(null);
    adminService
      .isAdmin()
      .then(async (ok) => {
        setIsAdmin(ok);
        if (ok) setUsers(await adminService.getUsers());
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  const now = Date.now();
  const rows = useMemo(
    () => (users ?? []).map((u) => ({ u, status: statusOf(u, now) })),
    [users, now]
  );
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    ({ u, status }) =>
      (filter === 'todos' || status === filter) &&
      (!q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
  );

  const kpis = {
    total: rows.length,
    nuevos: rows.filter(({ u }) => now - new Date(u.createdAt).getTime() < 7 * DAY).length,
    activos: rows.filter(
      ({ u }) => u.ultimoMovimiento && now - new Date(u.ultimoMovimiento).getTime() < 14 * DAY
    ).length,
    conCuentas: rows.filter(({ u }) => u.cuentas > 0).length,
    juntas: rows.filter(({ u }) => u.juntasOrganiza + u.juntasParticipa > 0).length,
  };

  if (!authLoading && !user) {
    return (
      <Centered>
        <p className="font-bold">Inicia sesión para continuar.</p>
        <Link href="/login" className="mt-3 inline-block font-black underline">
          Ir a iniciar sesión
        </Link>
      </Centered>
    );
  }
  if (error) {
    return (
      <Centered>
        <LoadError what="el panel" error={error} onRetry={load} />
      </Centered>
    );
  }
  if (isAdmin === false) {
    return (
      <Centered>
        <ShieldAlert className="mx-auto h-10 w-10 text-black" />
        <p className="mt-3 text-lg font-black">No tienes acceso a esta sección.</p>
        <Link href="/finanzas" className="mt-3 inline-block font-black underline">
          Volver a MONEO
        </Link>
      </Centered>
    );
  }
  if (!users) {
    return (
      <Centered>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-poppins text-black">
      <header className="sticky top-[env(safe-area-inset-top)] z-10 border-b-[3px] border-black bg-[#FFF9EC]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MoneoLogo width={104} height={38} />
            <span className="rounded-full border-2 border-black bg-[#FFD43B] px-2.5 py-0.5 text-xs font-black uppercase">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="grid h-10 w-10 place-items-center rounded-xl border-[2.5px] border-black bg-white"
              aria-label="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href="/finanzas"
              className="hidden items-center gap-1.5 rounded-xl border-[2.5px] border-black bg-white px-3 py-2 text-sm font-black sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a la app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-black sm:text-3xl">Usuarios registrados</h1>
        <p className="mt-1 font-sans text-sm text-gray-600">
          Solo se muestran conteos de registros: nunca montos ni detalles financieros.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi icon={Users} label="Usuarios" value={kpis.total} color="bg-[#FFD43B]" />
          <Kpi icon={UserPlus} label="Nuevos (7 días)" value={kpis.nuevos} color="bg-[#75B8FF]" />
          <Kpi
            icon={Activity}
            label="Activos (14 días)"
            value={kpis.activos}
            color="bg-[#45D98B]"
          />
          <Kpi
            icon={WalletCards}
            label="Con cuentas"
            value={kpis.conCuentas}
            color="bg-[#FF806E]"
          />
          <Kpi
            icon={UsersRound}
            label="Usan Juntas"
            value={kpis.juntas}
            color="bg-[#B99CFF]"
            className="col-span-2 md:col-span-1"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o correo"
              className="w-full rounded-xl border-[2.5px] border-black bg-white py-2.5 pl-9 pr-3 font-sans text-sm outline-none"
            />
          </label>
          <div className="flex gap-1.5 overflow-x-auto">
            {(['todos', 'nuevo', 'activo', 'inactivo', 'sin-uso'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-xl border-2 border-black px-3 py-2 text-xs font-black ${
                  filter === f ? 'bg-black text-white' : 'bg-white'
                }`}
              >
                {f === 'todos' ? 'Todos' : STATUS[f].label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 font-sans text-xs text-gray-500">
          {visible.length} de {rows.length} usuarios
        </p>

        {/* Desktop table */}
        <div className="mt-2 hidden overflow-hidden rounded-2xl border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b-[3px] border-black bg-[#FFF9EC] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3">Último acceso</th>
                <th className="px-4 py-3">Registros</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ u, status }) => (
                <tr key={u.userId} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-black">{u.fullName || 'Sin nombre'}</p>
                    <p className="font-sans text-xs text-gray-600">{u.email}</p>
                    {u.provider !== 'email' && (
                      <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 text-[10px] font-bold uppercase text-gray-600">
                        {u.provider}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-sans">{fmtDate(u.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-sans">
                    {fmtDate(u.lastSignInAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Counts u={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet cards */}
        <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:hidden">
          {visible.map(({ u, status }) => (
            <li
              key={u.userId}
              className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-black">{u.fullName || 'Sin nombre'}</p>
                  <p className="truncate font-sans text-xs text-gray-600">{u.email}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <p className="mt-2 font-sans text-xs text-gray-500">
                Registro {fmtDate(u.createdAt)} · Último acceso {fmtDate(u.lastSignInAt)}
              </p>
              <div className="mt-3">
                <Counts u={u} />
              </div>
            </li>
          ))}
        </ul>

        {visible.length === 0 && (
          <p className="mt-6 text-center font-sans text-sm text-gray-500">
            No hay usuarios que coincidan.
          </p>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border-2 border-black px-2.5 py-0.5 text-[11px] font-black ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] p-6 text-center font-poppins text-black">
      <div>{children}</div>
    </div>
  );
}
