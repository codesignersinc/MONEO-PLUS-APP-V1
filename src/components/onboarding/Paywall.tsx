'use client';
import React from 'react';
import Image from 'next/image';
import { Check, Crown, Infinity as InfinityIcon, Sprout } from 'lucide-react';
import {
  annualSavingsPercent,
  PLUS_BENEFITS,
  type BillingPlan,
  type PlanCode,
} from '@/lib/billing';

export function money(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PlanCard({
  selected,
  onSelect,
  tone,
  ribbon,
  icon,
  title,
  price,
  per,
  lines,
}: {
  selected: boolean;
  onSelect: () => void;
  tone: string;
  ribbon?: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  price: string;
  per?: string;
  lines: string[];
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative w-full rounded-3xl border-[3px] border-black p-4 pt-5 text-left transition-all duration-150 motion-reduce:transition-none ${
        selected
          ? 'translate-x-[-2px] translate-y-[-2px] shadow-[5px_5px_0_#111]'
          : 'shadow-[2px_2px_0_#111] opacity-90'
      }`}
      style={{ background: tone }}
    >
      {ribbon && (
        <span className="absolute -top-3 left-4 rounded-full border-2 border-black bg-black px-3 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
          {ribbon}
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-[2.5px] border-black bg-white">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black uppercase leading-tight">{title}</span>
          <span className="block">
            <span className="text-2xl font-black tabular-nums">{price}</span>
            {per && <span className="text-sm font-bold"> {per}</span>}
          </span>
        </span>
        <span
          aria-hidden
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-[3px] border-black ${
            selected ? 'bg-black text-white' : 'bg-white text-transparent'
          }`}
        >
          <Check className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-1.5 pl-14 text-[13px] font-semibold leading-snug text-gray-800">
        {lines.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </div>
    </button>
  );
}

function Benefits({ className }: { className: string }) {
  return (
    <ul className={`grid-cols-2 gap-x-3 gap-y-2 ${className}`}>
      {PLUS_BENEFITS.map((b) => (
        <li key={b} className="flex items-center gap-2 text-[13px] font-bold">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#45D98B]">
            <Check className="h-3 w-3" />
          </span>
          {b}
        </li>
      ))}
    </ul>
  );
}

export default function Paywall({
  plans,
  selected,
  onSelect,
  hadTrial,
}: {
  plans: BillingPlan[];
  selected: PlanCode | null;
  onSelect: (code: PlanCode) => void;
  hadTrial: boolean;
}) {
  const by = Object.fromEntries(plans.map((p) => [p.code, p])) as Partial<
    Record<PlanCode, BillingPlan>
  >;
  const monthly = by.plus_monthly;
  const yearly = by.plus_yearly;
  const lifetime = by.plus_lifetime;
  const founder = by.founder;
  const trial = (p?: BillingPlan) =>
    p && p.trialDays > 0 && !hadTrial ? `${p.trialDays} días gratis · ` : '';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
      <div className="lg:sticky lg:top-20">
        <div className="relative overflow-hidden rounded-[28px] border-[3px] border-black bg-[#FFF9EC] shadow-[6px_6px_0_#111]">
          <Image
            src="/assets/images/onboarding/moneo-plus.webp"
            alt="MONEO PLUS: controla tus gastos sin esfuerzo"
            width={859}
            height={941}
            priority
            className="h-auto max-h-[24vh] w-full object-cover object-[center_6%] lg:max-h-none"
          />
        </div>
        <Benefits className="mt-5 hidden lg:grid" />
      </div>

      <div role="radiogroup" aria-label="Planes de MONEO PLUS" className="space-y-4 pt-2">
        <div>
          <p className="text-3xl font-black leading-none">
            MONEO <span className="rounded-lg bg-[#FFD83D] px-1.5">PLUS</span>
          </p>
          <p className="mt-2 text-[15px] font-medium text-gray-700">
            Tu dinero, más simple. Ahora con todo el poder de MONEO.
          </p>
        </div>
        {yearly && (
          <PlanCard
            selected={selected === 'plus_yearly'}
            onSelect={() => onSelect('plus_yearly')}
            tone="#FFD83D"
            ribbon={
              <>
                ⭐ Más elegido
                {monthly && ` · Ahorra ${annualSavingsPercent(monthly.price, yearly.price)}%`}
              </>
            }
            icon={<Crown className="h-6 w-6" />}
            title="Plus anual"
            price={money(yearly.price)}
            per="/ año"
            lines={[`${trial(yearly)}Equivale a ${money(yearly.price / 12)}/mes`]}
          />
        )}
        {monthly && (
          <PlanCard
            selected={selected === 'plus_monthly'}
            onSelect={() => onSelect('plus_monthly')}
            tone="#DDF7E9"
            icon={<Sprout className="h-6 w-6" />}
            title="Plus mensual"
            price={money(monthly.price)}
            per="/ mes"
            lines={[`${trial(monthly)}Pago mes a mes`]}
          />
        )}
        {lifetime && (
          <PlanCard
            selected={selected === 'plus_lifetime'}
            onSelect={() => onSelect('plus_lifetime')}
            tone="#EDE5FF"
            ribbon="Para siempre"
            icon={<InfinityIcon className="h-6 w-6" />}
            title="Plus de por vida"
            price={money(lifetime.price)}
            lines={['Pago único · Sin renovaciones']}
          />
        )}
        {founder && (
          <PlanCard
            selected={selected === 'founder'}
            onSelect={() => onSelect('founder')}
            tone="#FFE1DB"
            ribbon="🐒 Precio fundador"
            icon={<span className="text-2xl">🐒</span>}
            title="Fundador de por vida"
            price={money(founder.price)}
            lines={['Pago único · Oferta de lanzamiento por tiempo limitado']}
          />
        )}
        <Benefits className="grid pt-2 lg:hidden" />
        <p className="text-center text-xs font-semibold text-gray-600">
          Pagos seguros con Mercado Pago · Precios en soles, IGV incluido · Cancela cuando quieras
        </p>
      </div>
    </div>
  );
}
