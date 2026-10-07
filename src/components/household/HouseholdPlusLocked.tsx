'use client';
import React from 'react';
import Link from 'next/link';
import { Crown, Lock, Users } from 'lucide-react';

// HOGAR feature that needs MONEO PLUS: it opens for the whole household as soon as one
// member has PLUS (own plan, trial or a Duo / Familiar seat).
export default function HouseholdPlusLocked({
  feature,
  description,
}: {
  feature: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border-[3px] border-[#111] bg-[#FFF9EC] p-6 text-center text-[#111] shadow-[4px_4px_0_#111]">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-[3px] border-[#111] bg-[#FFD83D]">
        <Lock className="h-7 w-7" strokeWidth={2.4} />
      </span>
      <p className="mt-4 text-2xl font-black">
        {feature} es de MONEO <span className="rounded bg-[#FFD83D] px-1">PLUS</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-700">{description}</p>
      <p className="mt-2 text-sm font-bold">
        Basta con que una persona del hogar tenga PLUS para que se abra para todos.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/finanzas/plus?pack=duo"
          className="inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#111] bg-[#FFD83D] px-4 py-2.5 text-sm font-black shadow-[3px_3px_0_#111]"
        >
          <Users className="h-4 w-4" /> Ver MONEO PLUS Duo
        </Link>
        <Link
          href="/finanzas/plus"
          className="inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-[#111] bg-white px-4 py-2.5 text-sm font-black"
        >
          <Crown className="h-4 w-4" /> Ver todos los planes
        </Link>
      </div>
    </section>
  );
}
