'use client';
import Link from 'next/link';
import { Crown, Flame } from 'lucide-react';
import { streakText } from '@/lib/coronas';
import { useCoronas } from './coronasStore';

/** Coronas balance and streak; opens the Coronas screen. Hidden until the first sync. */
export default function CoronasChip({ className = '' }: { className?: string }) {
  const c = useCoronas();
  if (!c) return null;
  return (
    <Link
      href="/finanzas/coronas"
      aria-label={`${c.balance} Coronas, racha de ${streakText(c.streak)}`}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-[#111] bg-[#FFD83D] px-2.5 lg:h-11 lg:gap-2 lg:px-3 text-sm font-black shadow-[2px_2px_0_#111] transition active:translate-y-px ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        <Crown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        {c.balance}
      </span>
      <span
        className={`inline-flex items-center gap-1 ${c.registeredToday ? '' : 'text-[#111]/50'}`}
      >
        <Flame className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        {c.streak}
      </span>
    </Link>
  );
}
