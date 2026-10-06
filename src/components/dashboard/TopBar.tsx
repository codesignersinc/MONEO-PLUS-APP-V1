'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Popover state + the element it hangs from.
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return { open, setOpen, ref };
}

// Menus and the date picker render in a layer of their own (portal), so a scrolling or
// clipped container (the period pills scroll sideways on phones) never cuts them.
// Desktop: dropdown under the button, kept inside the screen. Phone: bottom sheet.
function FloatingPanel({
  open,
  anchor,
  onClose,
  align = 'left',
  label,
  role = 'menu',
  width = 240,
  children,
}: {
  open: boolean;
  anchor: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  align?: 'left' | 'right';
  label: string;
  role?: 'menu' | 'dialog';
  width?: number;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      setSheet(window.innerWidth < 640);
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const raw = align === 'right' ? r.right - width : r.left;
      setPos({
        top: r.bottom + 8,
        left: Math.max(12, Math.min(raw, window.innerWidth - width - 12)),
      });
    };
    place();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchor, align, width]);

  if (!open || !pos || typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-[70] ${sheet ? 'bg-black/30' : ''}`}
      />
      <div
        role={role}
        aria-label={label}
        className={`fixed z-[71] overflow-auto border-2 border-[#111] bg-white font-poppins text-[#111] shadow-[0_4px_0_#111] motion-safe:animate-fade-in ${
          sheet
            ? 'inset-x-0 bottom-0 max-h-[80vh] rounded-t-[24px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-2'
            : 'max-h-[70vh] rounded-2xl py-1.5'
        }`}
        style={sheet ? undefined : { top: pos.top, left: pos.left, width }}
      >
        {sheet && <div aria-hidden className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#111]/20" />}
        {children}
      </div>
    </>,
    document.body
  );
}

const itemCls =
  'flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-bold hover:bg-[#FFF9EC] focus-visible:bg-[#FFF9EC] focus-visible:outline-none';
const dateCls =
  'mt-1 block h-12 w-full min-w-0 appearance-none rounded-xl border-2 border-[#111] bg-white px-3 text-left text-[15px] font-semibold normal-case tracking-normal text-[#111] [&::-webkit-date-and-time-value]:text-left';

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
      className="flex items-center gap-1 overflow-x-auto rounded-2xl border-2 border-[#111] bg-white p-1 [scrollbar-width:none]"
    >
      <div ref={months.ref} className="shrink-0">
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
      </div>
      <FloatingPanel
        open={months.open}
        anchor={months.ref}
        onClose={() => months.setOpen(false)}
        label="Elegir mes"
      >
        {Array.from({ length: 12 }, (_, i) => -i).map((off) => {
          const active = value.kind === 'mes' && value.offset === off;
          return (
            <button
              key={off}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => {
                onChange({ ...value, kind: 'mes', offset: off });
                months.setOpen(false);
              }}
              className={`${itemCls} ${active ? 'bg-[#FFD83D] hover:bg-[#FFD83D]' : ''}`}
            >
              {off === 0 ? 'Este mes' : monthLabel(off)}
            </button>
          );
        })}
      </FloatingPanel>
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
      <div ref={custom.ref} className="shrink-0">
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
      </div>
      <FloatingPanel
        open={custom.open}
        anchor={custom.ref}
        onClose={() => custom.setOpen(false)}
        align="right"
        role="dialog"
        label="Elegir fechas"
        width={290}
      >
        <div className="px-4 pb-2 pt-2">
          <p className="mb-3 text-[16px] font-black">Período personalizado</p>
          <label className="block text-xs font-black uppercase tracking-wide">
            Desde
            <input
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className={dateCls}
            />
          </label>
          <label className="mt-3 block text-xs font-black uppercase tracking-wide">
            Hasta
            <input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              className={dateCls}
            />
          </label>
          <button
            type="button"
            disabled={!draft.from || !draft.to}
            onClick={() => {
              onChange({ kind: 'custom', offset: 0, custom: draft });
              custom.setOpen(false);
            }}
            className="mt-4 h-12 w-full rounded-xl border-2 border-[#111] bg-[#FFD83D] text-sm font-black shadow-[0_2px_0_#111] disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </FloatingPanel>
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
    <div ref={pop.ref} className="shrink-0">
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
      <FloatingPanel
        open={pop.open}
        anchor={pop.ref}
        onClose={() => pop.setOpen(false)}
        align="right"
        label="Nuevo"
      >
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
      </FloatingPanel>
    </div>
  );
}

export function UserMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const pop = usePopover();
  const router = useRouter();
  return (
    <div ref={pop.ref} className="shrink-0">
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
      <FloatingPanel
        open={pop.open}
        anchor={pop.ref}
        onClose={() => pop.setOpen(false)}
        align="right"
        label="Tu cuenta"
      >
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
      </FloatingPanel>
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
