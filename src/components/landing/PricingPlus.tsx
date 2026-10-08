'use client';
import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { PLUS_BENEFITS, cheapestMonthly, plansService } from '@/lib/billing';
import { moneyFormatter } from '@/components/dashboard/ui';
import { TrackLink } from './client';
import { btnPrimary } from './ui';
import { SIGNUP_HREF } from '@/lib/site';

// MONEO PLUS card of the landing pricing: the price comes from the live plans (billing_plans),
// never typed in the page, so it always matches the checkout.
export default function PricingPlus() {
  const [from, setFrom] = useState<{ amount: number; currency: string } | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    plansService
      .list()
      .then((plans) => {
        setFrom(cheapestMonthly(plans));
        const trial = plans.find((p) => p.kind === 'trial') ?? plans.find((p) => p.trialDays > 0);
        setTrialDays(trial ? trial.trialDays || null : null);
      })
      .catch(() => setFrom(null));
  }, []);

  return (
    <div className="relative rounded-[32px] border-[3px] border-[#111] bg-[#FFD83D] p-7 shadow-[8px_8px_0_#111] sm:p-9">
      <span className="absolute -top-4 left-7 rounded-full border-[2.5px] border-[#111] bg-[#111] px-3 py-1 font-poppins text-[12px] font-extrabold uppercase text-[#FFD83D]">
        Más completo
      </span>
      <p className="font-poppins text-[20px] font-extrabold text-[#111]">MONEO PLUS</p>
      <p className="mt-1 font-poppins text-[15px] font-bold text-[#111]">{from ? 'Desde' : ' '}</p>
      <p className="font-poppins text-[44px] font-extrabold leading-none text-[#111]">
        {from ? moneyFormatter(from.currency)(from.amount) : '…'}
        <span className="ml-1 text-[16px] font-bold">/ mes</span>
      </p>
      <p className="mt-1 font-sans text-[14px] text-[#111]/75">
        {trialDays ? `Pruébalo ${trialDays} días gratis` : 'Pruébalo gratis'}
      </p>
      <ul className="mt-6 grid gap-2.5 font-sans text-[15px] text-[#111]">
        {[
          'Todo lo de MONEO',
          ...PLUS_BENEFITS.filter((b) => b !== 'Funciones premium futuras'),
        ].map((t) => (
          <li key={t} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#111] text-[#FFD83D]">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <TrackLink
        href={SIGNUP_HREF}
        event="pricing_click"
        eventProps={{ plan: 'plus' }}
        className={`${btnPrimary} mt-8 w-full`}
      >
        Probar MONEO PLUS →
      </TrackLink>
    </div>
  );
}
