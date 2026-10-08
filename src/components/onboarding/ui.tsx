'use client';
import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import Glyph from '@/components/ui/Glyph';

// Building blocks of the onboarding (MONEO 3D retro pop): cream background, thick black
// outlines, hard shadows, big touch targets. Animations respect prefers-reduced-motion.

export const C = {
  cream: '#FFF9EC',
  yellow: '#FFD83D',
  black: '#111111',
  mint: '#45D98B',
  lilac: '#B99CFF',
  coral: '#FF806E',
  blue: '#75B8FF',
};

export function Shell({
  children,
  footer,
  onBack,
  progress,
  wide,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  progress?: { step: number; total: number };
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FFF9EC] font-poppins text-[#111111]">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 bg-[#FFF9EC]/95 backdrop-blur">
        <div
          className={`mx-auto flex h-16 w-full items-center gap-3 px-4 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Atrás"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[2.5px] border-black bg-white transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-1" />
          )}
          <MoneoLogo width={104} height={38} className="h-auto w-[96px]" />
          {progress && (
            <div className="ml-auto flex items-center gap-2">
              <div className="h-2.5 w-20 overflow-hidden rounded-full border-2 border-black bg-white sm:w-28">
                <div
                  className="h-full rounded-full bg-[#45D98B] transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${(progress.step / progress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs font-black tabular-nums">
                {progress.step}/{progress.total}
              </span>
            </div>
          )}
        </div>
      </header>
      <main
        className={`mx-auto w-full flex-1 px-4 pb-6 pt-2 motion-safe:animate-slide-up ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
      >
        {children}
      </main>
      {footer && (
        <div className="sticky bottom-0 z-20 border-t-2 border-black/10 bg-[#FFF9EC]/95 backdrop-blur">
          <div
            className={`mx-auto w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
          >
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5 mt-2">
      <h1 className="text-[28px] font-black leading-[1.1] tracking-tight sm:text-4xl">
        {children}
      </h1>
      {sub && <p className="mt-2 text-[15px] font-medium text-gray-700">{sub}</p>}
    </div>
  );
}

export function Highlight({
  children,
  color = C.yellow,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-block -rotate-1 rounded-lg px-2"
      style={{ background: color, boxDecorationBreak: 'clone' }}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = 'black',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'black' | 'yellow' | 'white';
  type?: 'button' | 'submit';
}) {
  const styles = {
    black: 'bg-[#111111] text-white',
    yellow: 'bg-[#FFD83D] text-black border-[3px] border-black shadow-[4px_4px_0_#111]',
    white: 'bg-white text-black border-[3px] border-black',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-black transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none ${styles}`}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-3 block min-h-[44px] text-sm font-bold text-gray-600 underline underline-offset-4 hover:text-black"
    >
      {children}
    </button>
  );
}

// Selectable card (multi or single choice).
export function OptionCard({
  selected,
  onClick,
  icon,
  label,
  hint,
  badge,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  /** Glyph key (or legacy emoji) for the tile. */
  icon?: string;
  label: string;
  hint?: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      aria-pressed={selected}
      className={`group flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-[3px] border-black p-3 text-left transition-all duration-150 disabled:opacity-40 motion-reduce:transition-none ${
        selected
          ? 'translate-x-[-2px] translate-y-[-2px] bg-[#FFD83D] shadow-[4px_4px_0_#111]'
          : 'bg-white shadow-[2px_2px_0_#111] hover:bg-[#FFFDF5]'
      }`}
    >
      {icon && (
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-black bg-[#FFF9EC] text-[#111]"
        >
          <Glyph name={icon} className="h-6 w-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-black leading-tight">{label}</span>
          {badge && (
            <span className="rounded-full border-2 border-black bg-[#B99CFF] px-2 py-0.5 text-[10px] font-black uppercase">
              {badge}
            </span>
          )}
        </span>
        {hint && <span className="mt-0.5 block text-[13px] font-medium text-gray-700">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-[2.5px] border-black transition-colors ${
          selected ? 'bg-black text-white' : 'bg-white text-transparent'
        }`}
      >
        <Check className={`h-4 w-4 ${selected ? 'motion-safe:animate-tick-up' : ''}`} />
      </span>
    </button>
  );
}

export function CheckRow({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-black bg-white px-4 py-3">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-[2.5px] border-black ${
          done ? 'bg-[#45D98B]' : 'bg-white'
        }`}
      >
        {done && <Check className="h-4 w-4 motion-safe:animate-tick-up" />}
      </span>
      <span className={`text-[15px] font-bold ${done ? '' : 'text-gray-500'}`}>{children}</span>
    </li>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-[5px] border-black border-t-[#FFD83D] motion-reduce:animate-none" />
      <p className="font-bold">{label}</p>
    </div>
  );
}
