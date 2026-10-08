'use client';
import React, { useRef, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { PagoEntry } from '@/lib/supabaseObligations';
import Glyph from '@/components/ui/Glyph';

// A payment in the list. Its actions open BELOW the row: on hover with a mouse (desktop)
// and with a tap on touch screens, so they are always reachable on the phone too.

const ACTION =
  'relative flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-[3px] border-[#111] px-1 py-2 text-center text-[11.5px] font-black leading-tight text-[#111] shadow-[0_3px_0_#111] transition-transform [hyphens:auto] active:translate-y-0.5 disabled:opacity-50 sm:min-h-[92px] sm:px-1.5 sm:text-[13px]';

export default function PagoRow({
  entry,
  open,
  onOpenChange,
  overdue,
  dateLabel,
  amountSlot,
  onTogglePaid,
  onEdit,
  onReschedule,
  onDelete,
}: {
  entry: PagoEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overdue: boolean;
  dateLabel: string;
  // The amount (it can be edited inline): taps on it never toggle the row.
  amountSlot: React.ReactNode;
  onTogglePaid: () => void;
  onEdit: () => void;
  onReschedule: (date: string) => Promise<void> | void;
  onDelete: () => void;
}) {
  const dateInput = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busyDate, setBusyDate] = useState(false);
  const paid = entry.status === 'pagado';

  // Only real hover (mouse); touch screens fire mouseenter on tap too.
  const canHover = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const enter = () => {
    if (!canHover()) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => onOpenChange(true), 120);
  };
  const leave = () => {
    if (!canHover()) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => onOpenChange(false), 180);
  };

  const pickDate = () => {
    const el = dateInput.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`transition-colors ${open ? 'relative z-10 -mx-1 rounded-[22px] border-[3px] border-[#111] bg-[#FFF4CC] shadow-[0_3px_0_#111]' : ''}`}
    >
      {/* A div (not a button): the amount inside is its own button. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenChange(!open);
          }
        }}
        aria-expanded={open}
        aria-label={`${entry.name}: ${open ? 'ocultar' : 'ver'} opciones`}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[20px] px-3 py-3 text-left sm:gap-3 sm:px-4 sm:py-3.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[2px] border-black bg-white text-[#111] sm:h-11 sm:w-11">
          <Glyph name={entry.categoryIcon} fallback="receipt" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={`min-w-0 truncate text-[14px] font-black sm:text-[15px] ${paid ? 'text-gray-400 line-through' : 'text-black'}`}
            >
              {entry.name}
            </span>
            {entry.isRecurring && (
              <RefreshCw className="h-3.5 w-3.5 shrink-0 text-blue-500" strokeWidth={2.2} />
            )}
            {paid && (
              <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px] font-black text-green-700">
                Pagado
              </span>
            )}
            {overdue && (
              <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px] font-black text-red-600">
                Vencido
              </span>
            )}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className="truncate rounded-full border-[1.5px] border-black bg-white px-2 py-0.5 text-[11px] font-bold text-gray-600 sm:text-xs">
              {entry.category}
            </span>
            {entry.paymentDate && (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-gray-600 sm:text-xs">
                <Calendar className="h-3.5 w-3.5" strokeWidth={1.9} />
                {dateLabel}
              </span>
            )}
          </span>
        </span>
        <span
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {amountSlot}
        </span>
        {open ? (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFD83D] sm:h-8 sm:w-8">
            <ChevronDown className="h-5 w-5 rotate-180" strokeWidth={2.6} />
          </span>
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-[#111]" strokeWidth={2.4} />
        )}
      </div>

      {open && (
        <div className="grid grid-cols-4 gap-1.5 px-2 pb-2.5 animate-fade-in sm:gap-2 sm:px-3 sm:pb-3">
          <button
            type="button"
            onClick={onTogglePaid}
            className={`${ACTION} ${paid ? 'bg-white' : 'bg-[#9EF0C4]'}`}
          >
            {paid ? (
              <RotateCcw className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.4} />
            ) : (
              <CircleCheckBig className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.4} />
            )}
            {paid ? 'Marcar pendiente' : 'Marcar como pagado'}
          </button>
          <button type="button" onClick={onEdit} className={`${ACTION} bg-[#FFD83D]`}>
            <PencilLine className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.4} />
            Editar detalles
          </button>
          <button
            type="button"
            onClick={pickDate}
            disabled={paid || busyDate}
            title={paid ? 'Ya está pagado' : undefined}
            className={`${ACTION} bg-[#D9C9FF]`}
          >
            <CalendarClock className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.4} />
            {/* Soft hyphen: on narrow phones the word splits instead of overflowing. */}
            <span>Repro&shy;gramar fecha</span>
            <input
              ref={dateInput}
              type="date"
              tabIndex={-1}
              aria-hidden
              value={entry.paymentDate || ''}
              onChange={async (e) => {
                const v = e.target.value;
                if (!v || v === entry.paymentDate) return;
                setBusyDate(true);
                try {
                  await onReschedule(v);
                } finally {
                  setBusyDate(false);
                }
              }}
              className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
            />
          </button>
          <button type="button" onClick={onDelete} className={`${ACTION} bg-[#FF9C8F]`}>
            <Trash2 className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.4} />
            Eliminar pago
          </button>
        </div>
      )}
    </div>
  );
}
