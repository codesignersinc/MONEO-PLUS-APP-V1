'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, X } from 'lucide-react';
import { usePlus } from '@/contexts/PlusContext';

// Once, when the free trial is over and no plan was bought: keep PLUS or stay in FREE.
const SEEN_KEY = 'moneo:trial-ended-seen';

export default function TrialEndedModal() {
  const { ent, plus, plansLive } = usePlus();
  const [open, setOpen] = useState(false);
  const ended = plansLive && ent?.kind === 'trial' && !plus;

  useEffect(() => {
    if (!ended) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === '1') return;
    } catch {
      // Storage blocked: show it (it can be closed).
    }
    setOpen(true);
  }, [ended]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-ended-title"
    >
      <div className="relative w-full max-w-md rounded-t-3xl border-[3px] border-[#111] bg-[#FFF9EC] p-6 text-center shadow-[6px_6px_0_#111] sm:rounded-3xl">
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-lg border-2 border-[#111] bg-white p-1"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-[3px] border-[#111] bg-[#FFD83D]">
          <Crown className="h-8 w-8" strokeWidth={2.2} />
        </span>
        <h2 id="trial-ended-title" className="mt-4 text-2xl font-black text-[#111]">
          Tu prueba de MONEO PLUS terminó
        </h2>
        <p className="mt-2 text-sm font-semibold text-gray-700">
          Tus datos siguen aquí. MONEO AUTO, la voz, el escaneo y los reportes avanzados vuelven
          apenas actives un plan.
        </p>
        <Link
          href="/finanzas/plus"
          onClick={close}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3 text-base font-black text-[#111] shadow-[3px_3px_0_#111]"
        >
          Mantener MONEO PLUS →
        </Link>
        <p className="mt-2 text-xs font-semibold text-gray-600">
          1 año por S/ 97.50 (S/ 8.13 al mes) · tarjeta, Yape o efectivo
        </p>
        <button
          type="button"
          onClick={close}
          className="mt-3 text-sm font-black text-gray-700 underline"
        >
          Seguir con MONEO FREE
        </button>
      </div>
    </div>
  );
}
