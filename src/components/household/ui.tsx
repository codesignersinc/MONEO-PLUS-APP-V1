'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { HouseholdMember } from '@/lib/household';

// MONEO HOGAR building blocks on top of the Home language (dashboard/ui.tsx).

const MEMBER_COLORS = ['#75B8FF', '#FF806E', '#45D98B', '#B99CFF', '#FFD83D', '#2DD4BF'];

// Stable colour per member (order of arrival in the household).
export function memberColor(members: HouseholdMember[], id: string): string {
  const i = members.findIndex((m) => m.id === id);
  return MEMBER_COLORS[(i < 0 ? 0 : i) % MEMBER_COLORS.length];
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border-2 border-[#111] font-black text-[#111]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

// Bottom sheet on phones, centred dialog on desktop (same as the quick-add modal).
export function Sheet({
  title,
  onClose,
  children,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div className="relative mx-auto w-full max-w-md animate-slide-up rounded-t-[28px] border-[3px] border-black bg-[#FFF9EC] shadow-[6px_6px_0px_rgba(0,0,0,1)] lg:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-gray-300 lg:hidden" />
        <div className="sheet-max space-y-4 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[22px] font-black leading-tight text-[#111]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Cerrar"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-black bg-white text-black disabled:opacity-50"
            >
              <X className="h-5 w-5" strokeWidth={3} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Segmented choice (big tappable pills).
export function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: React.ReactNode; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[46px] flex-1 rounded-2xl border-2 px-3 py-2 text-[15px] font-black text-[#111] transition-transform active:scale-95 ${on ? 'border-[#111] bg-[#FFD83D] shadow-[0_3px_0_#111]' : 'border-[#111]/15 bg-white'}`}
          >
            {o.label}
            {o.hint && (
              <span className="block text-[11px] font-semibold text-[#111]/70">{o.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-black uppercase tracking-wide text-gray-600">{children}</p>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
      {children}
    </p>
  );
}
