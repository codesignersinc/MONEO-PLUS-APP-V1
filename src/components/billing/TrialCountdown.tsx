'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Crown } from 'lucide-react';
import { usePlus } from '@/contexts/PlusContext';
import { trialDaysLeft } from '@/lib/billing';

// Floating countdown of the free trial (bottom right; above the bottom bar on mobile).
// The bar empties as days pass and turns coral with a heartbeat in the last 3 days.
// It can be minimized; it opens again the next day.

const TRIAL_DAYS = 14;
const MIN_KEY = 'moneo:trial-countdown-min';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function TrialCountdown() {
  const { ent, plansLive } = usePlus();
  const pathname = usePathname();
  const [minimized, setMinimized] = useState(true);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // On phones it starts as the small bubble (it would cover the content); tap to open.
    const phone = window.matchMedia('(max-width: 1023px)').matches;
    try {
      setMinimized(phone || localStorage.getItem(MIN_KEY) === today());
    } catch {
      setMinimized(phone);
    }
  }, []);

  const days = plansLive ? trialDaysLeft(ent ?? null) : null;
  const pct = days === null ? 0 : Math.max(4, Math.min(100, (days / TRIAL_DAYS) * 100));

  // The bar fills up to the remaining share once it appears (animated).
  useEffect(() => {
    if (days === null || minimized) return;
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [days, minimized, pct]);

  // Not on the plans page itself, where it would cover the checkout.
  if (days === null || pathname.startsWith('/finanzas/plus')) return null;
  const urgent = days < 3;
  const label =
    days === 0
      ? 'Último día de prueba'
      : `Te ${days === 1 ? 'queda 1 día' : `quedan ${days} días`}`;

  const minimize = () => {
    setMinimized(true);
    setWidth(0);
    try {
      localStorage.setItem(MIN_KEY, today());
    } catch {
      // Storage blocked: it stays minimized until the page reloads.
    }
  };

  const position = 'fixed bottom-[92px] right-3 z-40 lg:bottom-6 lg:right-6';

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => {
          setMinimized(false);
          try {
            localStorage.removeItem(MIN_KEY);
          } catch {
            // ignore
          }
        }}
        aria-label={`MONEO PLUS de prueba: ${label}`}
        className={`${position} grid h-12 w-12 place-items-center rounded-full border-[3px] border-[#111] text-[15px] font-black text-[#111] shadow-[0_3px_0_#111] ${urgent ? 'bg-[#FF806E] motion-safe:animate-heartbeat' : 'bg-[#FFD83D]'}`}
      >
        {days === 0 ? '!' : days}
      </button>
    );
  }

  return (
    <div
      className={`${position} w-[min(300px,calc(100vw-24px))] motion-safe:animate-slide-up`}
      role="status"
    >
      <div
        className={`relative rounded-[20px] border-[3px] border-[#111] p-3 shadow-[0_4px_0_#111] ${urgent ? 'bg-[#FFE1DB]' : 'bg-white'}`}
      >
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimizar"
          className="absolute right-2 top-2 rounded-lg p-1 text-gray-600 hover:bg-black/5"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2.5 pr-6">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#111] ${urgent ? 'bg-[#FF806E] motion-safe:animate-heartbeat' : 'bg-[#FFD83D]'}`}
          >
            <Crown className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-600">
              MONEO PLUS de prueba
            </p>
            <p className="text-[15px] font-black leading-tight text-[#111]">{label}</p>
          </div>
        </div>
        <div
          className="mt-2.5 h-3 overflow-hidden rounded-full border-2 border-[#111] bg-[#F1EDE3]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TRIAL_DAYS}
          aria-valuenow={days}
          aria-label="Días de prueba restantes"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-out motion-safe:animate-bar-shine ${urgent ? 'bg-[#FF806E]' : 'bg-[#FFD83D]'}`}
            style={{
              width: `${width}%`,
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 7px, transparent 7px 14px)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>
        <Link
          href="/finanzas/plus"
          className="mt-2.5 flex items-center justify-center gap-1 rounded-xl border-2 border-[#111] bg-[#111] py-2 text-[13px] font-black text-white hover:-translate-y-px"
        >
          {urgent ? 'No pierdas PLUS · Elegir plan' : 'Mantener MONEO PLUS'} →
        </Link>
      </div>
    </div>
  );
}
