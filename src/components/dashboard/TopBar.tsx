'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  FileText,
  Landmark,
  LogOut,
  Plus,
  Search,
  Settings2,
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { MONTH_NAMES, type PeriodKind } from '@/lib/dashboard';

export type NewAction = 'gasto' | 'ingreso' | 'transferencia' | 'pago' | 'cuenta';

export interface PeriodState {
  kind: PeriodKind;
  offset: number; // 0 = current month / quarter / year; -1 = previous…
  custom: { from: string; to: string };
}

// Closes a popover on outside click / Escape.
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const menuCls =
  'absolute z-40 mt-2 min-w-[220px] overflow-hidden rounded-2xl border-2 border-[#111] bg-white py-1.5 shadow-[0_4px_0_#111] motion-safe:animate-fade-in';
const itemCls =
  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-bold hover:bg-[#FFF9EC] focus-visible:bg-[#FFF9EC] focus-visible:outline-none';

export function SearchBox({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        router.push(
          text ? `/finanzas/movimientos?q=${encodeURIComponent(text)}` : '/finanzas/movimientos'
        );
      }}
      className={`flex min-w-0 items-center gap-2.5 rounded-2xl border-2 border-[#111] bg-white px-4 ${compact ? 'h-11' : 'h-12'} focus-within:shadow-[0_3px_0_#111]`}
    >
      <Search className="h-5 w-5 shrink-0" strokeWidth={2.4} aria-hidden />
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar movimientos, cuentas, categorías..."
        aria-label="Buscar movimientos, cuentas y categorías"
        className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-gray-500"
      />
      {!compact && (
        <kbd className="hidden shrink-0 rounded-md border border-[#111]/20 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 2xl:block">
          Ctrl + K
        </kbd>
      )}
    </form>
  );
}

export function PeriodFilter({
  value,
  onChange,
  now,
}: {
  value: PeriodState;
  onChange: (v: PeriodState) => void;
  now: Date;
}) {
  const months = usePopover();
  const custom = usePopover();
  const [draft, setDraft] = useState(value.custom);
  const seg = (active: boolean) =>
    `flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF] ${
      active
        ? 'border-2 border-[#111] bg-[#FFD83D]'
        : 'border-2 border-transparent hover:bg-[#FFF9EC]'
    }`;
  const monthLabel = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const name = MONTH_NAMES[d.getMonth()];
    return `${name[0].toUpperCase()}${name.slice(1)} ${d.getFullYear()}`;
  };
  return (
    <div
      role="group"
      aria-label="Período"
      className="flex items-center gap-1 overflow-x-auto rounded-2xl border-2 border-[#111] bg-white p-1"
    >
      <div ref={months.ref} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={months.open}
          onClick={() => months.setOpen((o) => !o)}
          className={seg(value.kind === 'mes')}
        >
          {value.kind === 'mes' && value.offset !== 0 ? monthLabel(value.offset) : 'Este mes'}
          <ChevronDown className="h-4 w-4" />
        </button>
        {months.open && (
          <div role="menu" className={`${menuCls} left-0 max-h-72 overflow-y-auto`}>
            {Array.from({ length: 12 }, (_, i) => -i).map((off) => (
              <button
                key={off}
                type="button"
                role="menuitemradio"
                aria-checked={value.kind === 'mes' && value.offset === off}
                onClick={() => {
                  onChange({ ...value, kind: 'mes', offset: off });
                  months.setOpen(false);
                }}
                className={itemCls}
              >
                {off === 0 ? 'Este mes' : monthLabel(off)}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-pressed={value.kind === 'trimestre'}
        onClick={() => onChange({ ...value, kind: 'trimestre', offset: 0 })}
        className={seg(value.kind === 'trimestre')}
      >
        Últimos 3 meses
      </button>
      <button
        type="button"
        aria-pressed={value.kind === 'anio'}
        onClick={() => onChange({ ...value, kind: 'anio', offset: 0 })}
        className={seg(value.kind === 'anio')}
      >
        Este año
      </button>
      <div ref={custom.ref} className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={custom.open}
          onClick={() => {
            setDraft(value.custom);
            custom.setOpen((o) => !o);
          }}
          className={seg(value.kind === 'custom')}
        >
          <CalendarDays className="h-4 w-4" />
          Personalizado
        </button>
        {custom.open && (
          <div
            role="dialog"
            aria-label="Elegir fechas"
            className={`${menuCls} right-0 w-[260px] p-4`}
          >
            <label className="block text-xs font-black uppercase tracking-wide">
              Desde
              <input
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border-2 border-[#111] px-3 text-sm font-semibold"
              />
            </label>
            <label className="mt-3 block text-xs font-black uppercase tracking-wide">
              Hasta
              <input
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border-2 border-[#111] px-3 text-sm font-semibold"
              />
            </label>
            <button
              type="button"
              disabled={!draft.from || !draft.to}
              onClick={() => {
                onChange({ kind: 'custom', offset: 0, custom: draft });
                custom.setOpen(false);
              }}
              className="mt-4 h-11 w-full rounded-xl border-2 border-[#111] bg-[#FFD83D] text-sm font-black shadow-[0_2px_0_#111] disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const NEW_ITEMS: { id: NewAction; label: string; icon: React.ElementType; tile: string }[] = [
  { id: 'gasto', label: 'Gasto', icon: ArrowUp, tile: '#FFE1DB' },
  { id: 'ingreso', label: 'Ingreso', icon: ArrowDown, tile: '#DDF7E9' },
  { id: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight, tile: '#DCEBFF' },
  { id: 'pago', label: 'Pago', icon: FileText, tile: '#EDE5FF' },
  { id: 'cuenta', label: 'Agregar cuenta', icon: Landmark, tile: '#FFF3B8' },
];

export function NewMenu({ onSelect }: { onSelect: (a: NewAction) => void }) {
  const pop = usePopover();
  return (
    <div ref={pop.ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={pop.open}
        onClick={() => pop.setOpen((o) => !o)}
        className="flex h-12 items-center gap-2 rounded-2xl border-2 border-[#111] bg-[#FFD83D] pl-2 pr-3 text-[14px] font-black shadow-[0_3px_0_#111] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#111] bg-white">
          <Plus className="h-4 w-4" strokeWidth={3} />
        </span>
        Nuevo
        <ChevronDown className="h-4 w-4" />
      </button>
      {pop.open && (
        <div role="menu" className={`${menuCls} right-0`}>
          {NEW_ITEMS.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              onClick={() => {
                pop.setOpen(false);
                onSelect(it.id);
              }}
              className={itemCls}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-lg border-2 border-[#111]"
                style={{ background: it.tile }}
              >
                <it.icon className="h-4 w-4" strokeWidth={2.6} />
              </span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UserMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const pop = usePopover();
  const router = useRouter();
  return (
    <div ref={pop.ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={pop.open}
        onClick={() => pop.setOpen((o) => !o)}
        className="flex h-12 items-center gap-2 rounded-2xl pr-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF]"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#111] bg-[#2DD4BF] text-lg font-black">
          {name[0]?.toUpperCase() ?? 'U'}
        </span>
        <span className="hidden max-w-[140px] truncate text-[14px] font-black xl:block">
          {name}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {pop.open && (
        <div role="menu" className={`${menuCls} right-0`}>
          <button
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={() => router.push('/finanzas/configuracion')}
          >
            <Settings2 className="h-4 w-4" /> Configuración
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${itemCls} text-[#C2321B]`}
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  period,
  onPeriod,
  now,
  name,
  onNew,
  onSignOut,
}: {
  period: PeriodState;
  onPeriod: (v: PeriodState) => void;
  now: Date;
  name: string;
  onNew: (a: NewAction) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[300px] flex-1">
        <SearchBox />
      </div>
      <PeriodFilter value={period} onChange={onPeriod} now={now} />
      <NewMenu onSelect={onNew} />
      <div className="shrink-0">
        <NotificationBell />
      </div>
      <UserMenu name={name} onSignOut={onSignOut} />
    </div>
  );
}
