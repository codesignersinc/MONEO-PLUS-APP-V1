'use client';
import React from 'react';
import Link from 'next/link';
import { Crown, Lock } from 'lucide-react';
import { usePlus } from '@/contexts/PlusContext';

// Shows `children` to MONEO PLUS users (trial included) and a locked card to FREE users.
// The data of the feature is never deleted: it comes back as soon as PLUS is active again.
export default function PlusGate({
  feature,
  description,
  children,
  compact,
}: {
  feature: string;
  description: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { plus } = usePlus();
  if (plus) return <>{children}</>;
  return <PlusLocked feature={feature} description={description} compact={compact} />;
}

export function PlusLocked({
  feature,
  description,
  compact,
}: {
  feature: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border-[3px] border-[#111] bg-[#FFF9EC] shadow-[4px_4px_0_#111] ${compact ? 'mb-4 p-4' : 'mx-auto my-6 max-w-xl p-6 text-center'}`}
    >
      <div className={compact ? 'flex items-start gap-3' : ''}>
        <span
          className={`grid shrink-0 place-items-center rounded-full border-[3px] border-[#111] bg-[#FFD83D] ${compact ? 'h-10 w-10' : 'mx-auto h-16 w-16'}`}
        >
          <Lock className={compact ? 'h-5 w-5' : 'h-7 w-7'} strokeWidth={2.4} />
        </span>
        <div className={compact ? 'min-w-0' : 'mt-4'}>
          <p className={`font-black text-[#111] ${compact ? 'text-base' : 'text-2xl'}`}>
            {feature} es de MONEO <span className="rounded bg-[#FFD83D] px-1">PLUS</span>
          </p>
          <p className={`mt-1 font-semibold text-gray-700 ${compact ? 'text-[13px]' : 'text-sm'}`}>
            {description}
          </p>
          <Link
            href="/finanzas/plus"
            className={`mt-3 inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#111] bg-[#FFD83D] px-4 py-2.5 text-sm font-black text-[#111] shadow-[3px_3px_0_#111] hover:-translate-y-0.5 ${compact ? '' : 'w-full sm:w-auto'}`}
          >
            <Crown className="h-4 w-4" /> Activar MONEO PLUS
          </Link>
          <p className="mt-2 text-xs font-semibold text-gray-600">
            Desde S/ 8.13 al mes · paga con tarjeta, Yape o efectivo.
          </p>
        </div>
      </div>
    </section>
  );
}
