'use client';
import React, { useEffect } from 'react';
import Image from 'next/image';
import { ArrowRight, Landmark, Target, Wallet, X, type LucideIcon } from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';

const STEPS: { title: string; text: string; icon: LucideIcon; bg: string; badge: string }[] = [
  {
    title: 'Registra tus cuentas',
    text: 'Agrega tus cuentas bancarias, billeteras digitales y efectivo.',
    icon: Landmark,
    bg: 'bg-[#E3F7EC]',
    badge: 'bg-[#16A34A] text-white',
  },
  {
    title: 'Añade tus ingresos',
    text: 'Sueldo, negocio, trabajos u otras fuentes.',
    icon: Wallet,
    bg: 'bg-[#FFF3C4]',
    badge: 'bg-[#FFD43B] text-black',
  },
  {
    title: 'Empieza a ver tu panorama',
    text: 'Tu saldo, gastos, metas y mucho más en un solo lugar.',
    icon: Target,
    bg: 'bg-[#EEE6FF]',
    badge: 'bg-[#7C3AED] text-white',
  },
];

interface Props {
  onStart: () => void;
  onLater: () => void;
}

// Shown once to new users on their first dashboard visit: invites them to start by
// registering their accounts.
export default function WelcomeModal({ onStart, onLater }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onLater();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onLater]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onLater} />
      <div className="animate-slide-up relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-[3px] border-black bg-[#FFFBEF] shadow-[8px_8px_0px_rgba(0,0,0,1)] sm:max-w-[920px] sm:flex-row sm:rounded-[28px]">
        <button
          onClick={onLater}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-black bg-white hover:bg-gray-50"
        >
          <X className="h-5 w-5 text-black" />
        </button>

        {/* Mascot panel: a short banner on phones, a full-height column from sm up. */}
        <div className="relative h-44 shrink-0 overflow-hidden bg-[#FCD91F] sm:h-auto sm:w-[40%]">
          <div className="absolute -right-24 top-1/3 hidden h-[28rem] w-[28rem] rounded-full bg-[#FFF3B0] opacity-70 sm:block" />
          <Image
            src="/assets/images/onboarding/moneo-hola.webp"
            alt="Moneo, la mascota de MONEO, te da la bienvenida"
            fill
            priority
            sizes="(min-width: 640px) 370px, 100vw"
            className="object-contain object-bottom sm:object-cover sm:object-center"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-9 sm:py-9">
          <h2 id="welcome-title" className="pr-10">
            <span className="block font-poppins text-2xl font-black text-black sm:text-[32px]">
              Bienvenido a
            </span>
            <span className="mt-1 block">
              <MoneoLogo width={200} height={73} className="h-auto w-[170px] sm:w-[240px]" />
            </span>
          </h2>
          <p className="mt-3 font-sans text-[15px] font-medium leading-relaxed text-gray-800 sm:text-base">
            Para empezar, registra tus cuentas y fuentes de ingreso. Así podrás ver todo tu dinero
            en un solo lugar.
          </p>

          <ol className="mt-5 space-y-3">
            {STEPS.map(({ title, text, icon: Icon, bg, badge }, i) => (
              <li
                key={title}
                className={`flex items-center gap-3 rounded-2xl p-3.5 sm:gap-4 ${bg}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${badge}`}
                >
                  {i + 1}
                </span>
                <Icon
                  className="h-8 w-8 shrink-0 text-black"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block font-poppins text-[15px] font-black text-black sm:text-base">
                    {title}
                  </span>
                  <span className="block font-sans text-[13px] font-medium leading-snug text-gray-700 sm:text-sm">
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <button
            onClick={onStart}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 font-poppins text-base font-black text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Comenzar ahora <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={onLater}
            className="mx-auto mt-3 block font-sans text-sm font-semibold text-gray-600 underline underline-offset-4 hover:text-black"
          >
            Lo hago más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
