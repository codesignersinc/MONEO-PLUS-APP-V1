import React from 'react';
import Image from 'next/image';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CircleDollarSign,
  Coins,
  CreditCard,
  Globe2,
  HandCoins,
  PiggyBank,
  Plane,
  Receipt,
  Sparkles,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Reveal, TrackLink } from './client';
import { SIGNUP_HREF } from '@/lib/site';
import {
  C,
  Coin,
  Phone,
  Pill,
  SectionTitle,
  Squiggle,
  Star,
  Sticker,
  btnPrimary,
  btnSecondary,
} from './ui';

const wrap = 'mx-auto max-w-6xl px-4 sm:px-6';

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden scroll-mt-20">
      <div
        className={`${wrap} grid items-center gap-10 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-14`}
      >
        <div className="relative z-10">
          <Pill color={C.mint}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Finanzas personales · Perú
          </Pill>
          <h1 className="mt-5 font-poppins text-[46px] font-extrabold leading-[0.98] tracking-tight text-[#111] sm:text-[64px] lg:text-[76px]">
            Tu dinero,{' '}
            <span className="relative inline-block">
              <span className="relative z-10">más simple.</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 z-0 h-4 rounded-full bg-[#FFD83D] sm:h-5"
              />
            </span>
          </h1>
          <p className="mt-5 max-w-xl font-sans text-[18px] font-normal leading-relaxed text-[#333] sm:text-[20px]">
            Controla tus gastos, ingresos, cuentas, metas y juntas en un solo lugar. Sin hojas de
            cálculo, sin enredos: solo claridad para decidir mejor.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <TrackLink
              href={SIGNUP_HREF}
              event="hero_cta_click"
              eventProps={{ cta: 'empezar_gratis' }}
              className={btnPrimary}
            >
              Empezar gratis →
            </TrackLink>
            <TrackLink
              href="/login"
              event="hero_cta_click"
              eventProps={{ cta: 'probar_web' }}
              className={btnSecondary}
            >
              Probar en la web →
            </TrackLink>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-sans text-[14px] font-medium text-[#333]">
            {['Gratis', 'En soles y otras monedas', 'Sin conectar tu banco'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <Star className="lp-float absolute -left-3 top-2 z-20 h-10 w-10 sm:-left-6" />
          <Star
            className="lp-float-slow absolute -right-2 bottom-24 z-20 h-8 w-8"
            color={C.lilac}
          />
          <div className="relative overflow-hidden rounded-[32px] border-[3px] border-[#111] bg-[#FFD83D] shadow-[8px_8px_0_#111]">
            <Image
              src="/assets/images/landing/moneo-hero.webp"
              alt="Moneo, la mascota de MONEO, revisa sus finanzas en el celular relajado en un puf"
              width={900}
              height={554}
              priority
              sizes="(min-width: 1024px) 560px, 92vw"
              className="h-auto w-full"
            />
          </div>
          <Sticker className="lp-float absolute -bottom-6 left-2 z-20 sm:-left-6" color="#fff">
            <p className="font-sans text-[11px] font-medium text-[#555]">Disponible hoy</p>
            <p className="font-poppins text-[20px] font-extrabold text-[#111]">S/ 1,250.00</p>
          </Sticker>
          <Sticker
            className="lp-float-slow absolute -top-4 right-3 z-20 sm:-right-4"
            color={C.mint}
          >
            <p className="flex items-center gap-1 font-poppins text-[13px] font-extrabold text-[#111]">
              <Target className="h-4 w-4" aria-hidden="true" /> Meta al 60%
            </p>
          </Sticker>
        </div>
      </div>
    </section>
  );
}

// ─── Value bar ────────────────────────────────────────────────────────────────

const VALUES: { label: string; icon: LucideIcon; color: string }[] = [
  { label: 'Gastos', icon: Receipt, color: C.coral },
  { label: 'Cuentas', icon: Wallet, color: C.blue },
  { label: 'Metas', icon: Target, color: C.mint },
  { label: 'Juntas', icon: Users, color: C.lilac },
  { label: 'Automatización con IA', icon: Sparkles, color: C.yellow },
];

export function ValueBar() {
  return (
    <section
      aria-labelledby="lp-value"
      className="border-y-[3px] border-[#111] bg-[#111] text-white"
    >
      <div
        className={`${wrap} flex flex-col gap-5 py-7 lg:flex-row lg:items-center lg:justify-between`}
      >
        <h2
          id="lp-value"
          className="font-poppins text-[24px] font-extrabold leading-tight sm:text-[28px]"
        >
          De la confusión <span className="text-[#FFD83D]">a la claridad.</span>
        </h2>
        <ul className="flex flex-wrap gap-2">
          {VALUES.map(({ label, icon: Icon, color }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border-2 border-white px-3.5 py-1.5 font-poppins text-[13px] font-bold"
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-[#111]"
                style={{ background: color }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {label}
              {label.startsWith('Automatización') && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  Pronto
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────

const LEAKS = [
  { name: 'Yape', amount: 'S/ 35.00', color: C.lilac, rot: '-rotate-3' },
  { name: 'Wong', amount: 'S/ 120.00', color: C.coral, rot: 'rotate-2' },
  { name: 'Netflix', amount: 'S/ 54.90', color: C.blue, rot: '-rotate-2' },
  { name: 'Uber', amount: 'S/ 28.00', color: C.mint, rot: 'rotate-3' },
];

export function Problem() {
  return (
    <section aria-labelledby="lp-problem" className="py-20 lg:py-28">
      <div className={`${wrap} grid items-center gap-12 lg:grid-cols-2`}>
        <Reveal>
          <SectionTitle
            id="lp-problem"
            kicker="El problema"
            kickerColor={C.coral}
            title="¿A dónde se fue mi plata?"
            subtitle="Un Yape por aquí, el súper por allá, la suscripción que olvidaste… Cuando los gastos están regados en apps, tarjetas y efectivo, fin de mes siempre llega antes."
          />
          <p className="mt-6 inline-flex items-center gap-2 font-poppins text-[16px] font-bold text-[#111]">
            <Squiggle className="h-5 w-14" /> Te pasa a ti y a casi todos.
          </p>
        </Reveal>
        <Reveal delay={120} className="relative mx-auto w-full max-w-[460px]">
          <div className="relative rounded-[28px] border-[3px] border-[#111] bg-white p-5 shadow-[8px_8px_0_#111] sm:p-7">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-[3px] border-[#111] bg-[#FFD83D]">
                <Image
                  src="/assets/images/landing/moneo-mascot.webp"
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-poppins text-[18px] font-extrabold text-[#111]">Esta semana…</p>
                <p className="font-sans text-[14px] text-[#555]">Gastos sueltos que no anotaste</p>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {LEAKS.map((l) => (
                <li
                  key={l.name}
                  className={`${l.rot} rounded-2xl border-[2.5px] border-[#111] p-3 shadow-[3px_3px_0_#111]`}
                  style={{ background: l.color }}
                >
                  <p className="font-poppins text-[14px] font-extrabold text-[#111]">{l.name}</p>
                  <p className="font-poppins text-[20px] font-extrabold text-[#111]">-{l.amount}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between rounded-2xl border-[2.5px] border-dashed border-[#111] px-4 py-3">
              <span className="font-sans text-[14px] font-medium text-[#333]">
                Total sin control
              </span>
              <span className="font-poppins text-[22px] font-extrabold text-[#E5484D]">
                -S/ 237.90
              </span>
            </div>
          </div>
          <Coin className="lp-float absolute -right-4 -top-6 h-14 w-14" />
          <span className="lp-float-slow absolute -left-5 bottom-10 grid h-12 w-12 place-items-center rounded-full border-[3px] border-[#111] bg-[#FFD83D] font-poppins text-2xl font-extrabold shadow-[3px_3px_0_#111]">
            ?
          </span>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Solution ─────────────────────────────────────────────────────────────────

export function Solution() {
  return (
    <section
      aria-labelledby="lp-solution"
      className="border-y-[3px] border-[#111] bg-[#75B8FF] py-20 lg:py-28"
    >
      <div className={`${wrap} grid items-center gap-14 lg:grid-cols-2`}>
        <Reveal className="order-2 flex justify-center lg:order-1">
          <div className="relative">
            <Phone>
              <div className="space-y-3 px-4 pb-6 pt-4">
                <p className="font-poppins text-[15px] font-extrabold">Hola</p>
                <div className="rounded-2xl border-2 border-[#111] bg-[#FFD83D] p-4">
                  <p className="text-[11px] font-medium">Disponible hoy</p>
                  <p className="font-poppins text-[26px] font-extrabold leading-tight">S/ 1,250</p>
                </div>
                <div className="flex items-center justify-between rounded-2xl border-2 border-[#111] bg-white p-3">
                  <span className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#45D98B]">
                      <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Ingreso
                  </span>
                  <span className="font-poppins text-[14px] font-extrabold text-[#138A4D]">
                    + S/ 2,800
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border-2 border-[#111] bg-white p-3">
                  <span className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FF806E]">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Gasto
                  </span>
                  <span className="font-poppins text-[14px] font-extrabold text-[#C2362B]">
                    - S/ 85.90
                  </span>
                </div>
                <div className="rounded-2xl border-2 border-[#111] bg-white p-3">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span className="flex items-center gap-2">
                      <Plane className="h-4 w-4" aria-hidden="true" /> Meta: Viaje a Europa
                    </span>
                    <span>60%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full border-2 border-[#111] bg-[#FFF9EC]">
                    <div className="h-full w-[60%] bg-[#B99CFF]" />
                  </div>
                </div>
              </div>
            </Phone>
            <Star className="lp-float absolute -right-8 top-10 h-10 w-10" />
          </div>
        </Reveal>
        <Reveal delay={100} className="order-1 lg:order-2">
          <SectionTitle
            kicker="La solución"
            kickerColor={C.yellow}
            title="Todo tu dinero, en una sola pantalla."
            subtitle="Registra cada movimiento en segundos, mira cuánto tienes disponible en todas tus cuentas y sigue tus metas sin perder la cuenta."
          />
          <ul className="mt-7 grid gap-3 font-sans text-[16px] text-[#111]">
            {[
              'Saldo real de todas tus cuentas, en soles y otras monedas',
              'Ingresos, gastos y transferencias bien separados',
              'Recordatorios de pagos y suscripciones',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-[#111] bg-[#FFF9EC]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES: { title: string; text: string; icon: LucideIcon; color: string }[] = [
  {
    title: 'Gastos e ingresos',
    text: 'Registra movimientos con categoría, cuenta y nota en segundos.',
    icon: Receipt,
    color: C.coral,
  },
  {
    title: 'Cuentas y tarjetas',
    text: 'Bancos, efectivo, billeteras digitales y tarjetas con su saldo al día.',
    icon: Wallet,
    color: C.blue,
  },
  {
    title: 'Transferencias',
    text: 'Mueve dinero entre tus cuentas sin duplicar gastos ni ingresos.',
    icon: HandCoins,
    color: C.mint,
  },
  {
    title: 'Presupuesto',
    text: 'Ponle límite a cada categoría y mira cuánto te queda.',
    icon: BarChart3,
    color: C.yellow,
  },
  {
    title: 'Metas de ahorro',
    text: 'Ahorra para lo que quieres con avance visual y fecha objetivo.',
    icon: Target,
    color: C.lilac,
  },
  {
    title: 'Pagos y suscripciones',
    text: 'Recibos, servicios y suscripciones con recordatorio de vencimiento.',
    icon: Bell,
    color: C.coral,
  },
  {
    title: 'Deudas',
    text: 'Registra préstamos y tarjetas, abona en partes y mira cuánto falta.',
    icon: CreditCard,
    color: C.blue,
  },
  {
    title: 'Multimoneda',
    text: 'Soles, dólares y más, con el tipo de cambio guardado en cada movimiento.',
    icon: Globe2,
    color: C.mint,
  },
  {
    title: 'Reportes',
    text: 'Entiende en qué se va tu plata mes a mes con gráficos simples.',
    icon: CircleDollarSign,
    color: C.yellow,
  },
  {
    title: 'Calendario',
    text: 'Todos tus pagos e ingresos del mes en una sola vista.',
    icon: CalendarDays,
    color: C.lilac,
  },
];

export function Features() {
  return (
    <section id="funciones" aria-labelledby="lp-features" className="scroll-mt-20 py-20 lg:py-28">
      <div className={wrap}>
        <Reveal>
          <SectionTitle
            id="lp-features"
            kicker="Funciones"
            kickerColor={C.mint}
            title="Todo lo que necesitas. Nada que te enrede."
            subtitle="Funciones pensadas para el día a día en Perú, listas para usar hoy."
          />
        </Reveal>
        <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {FEATURES.map(({ title, text, icon: Icon, color }, i) => (
            <li key={title} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <Reveal delay={(i % 5) * 60} className="h-full">
                <TrackLink
                  href={SIGNUP_HREF}
                  event="feature_click"
                  eventProps={{ feature: title }}
                  className="group flex h-full flex-col rounded-3xl border-[3px] border-[#111] bg-white p-5 shadow-[4px_4px_0_#111] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_#111]"
                >
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl border-[2.5px] border-[#111]"
                    style={{ background: color }}
                  >
                    <Icon className="h-6 w-6 text-[#111]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-poppins text-[17px] font-extrabold leading-snug text-[#111]">
                    {title}
                  </h3>
                  <p className="mt-2 font-sans text-[14px] leading-relaxed text-[#444]">{text}</p>
                </TrackLink>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Juntas ───────────────────────────────────────────────────────────────────

const MEMBERS = [
  { initial: 'A', color: C.coral },
  { initial: 'L', color: C.blue },
  { initial: 'M', color: C.mint },
  { initial: 'R', color: C.lilac },
  { initial: 'S', color: C.yellow },
];

export function Juntas() {
  return (
    <section
      id="juntas"
      aria-labelledby="lp-juntas"
      className="scroll-mt-20 border-y-[3px] border-[#111] bg-[#B99CFF] py-20 lg:py-28"
    >
      <div className={`${wrap} grid items-center gap-12 lg:grid-cols-2`}>
        <Reveal>
          <SectionTitle
            id="lp-juntas"
            kicker="Juntas"
            kickerColor={C.yellow}
            title="La junta de siempre, ahora sin cuaderno."
            subtitle="Arma tu junta con amigos o familia, define el aporte y la frecuencia, registra quién ya pagó y haz el sorteo de turnos dentro de MONEO."
          />
          <ul className="mt-7 grid gap-3 font-sans text-[16px] text-[#111]">
            {[
              'Integrantes y turnos claros',
              'Control de aportes por ciclo',
              'Sorteo transparente de turnos',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <Coins className="h-5 w-5" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
          <TrackLink
            href={SIGNUP_HREF}
            event="juntas_click"
            eventProps={{ from: 'section' }}
            className={`${btnPrimary} mt-8`}
          >
            Crear mi junta →
          </TrackLink>
        </Reveal>

        <Reveal delay={120} className="relative mx-auto mt-10 w-full max-w-[440px] lg:mt-0">
          <div className="rounded-[28px] border-[3px] border-[#111] bg-white p-6 shadow-[8px_8px_0_#111]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-sans text-[12px] font-medium uppercase tracking-wide text-[#666]">
                  Junta
                </p>
                <h3 className="font-poppins text-[24px] font-extrabold text-[#111]">
                  Viaje a Cusco
                </h3>
              </div>
              <span className="rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-1.5 text-center font-poppins leading-tight">
                <span className="block text-[10px] font-bold uppercase">Próximo sorteo</span>
                <span className="block text-[16px] font-extrabold">15 OCT</span>
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                ['Integrantes', '8'],
                ['Aporte mensual', 'S/ 250'],
                ['Fondo', 'S/ 2,000'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border-2 border-[#111] bg-[#FFF9EC] px-2 py-3">
                  <dt className="font-sans text-[11px] text-[#555]">{k}</dt>
                  <dd className="font-poppins text-[17px] font-extrabold text-[#111]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-center">
              {MEMBERS.map((m, i) => (
                <span
                  key={m.initial}
                  className="grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-[#111] font-poppins text-[14px] font-extrabold text-[#111]"
                  style={{ background: m.color, marginLeft: i ? -10 : 0 }}
                  aria-hidden="true"
                >
                  {m.initial}
                </span>
              ))}
              <span className="-ml-2.5 grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-[#111] bg-[#111] font-poppins text-[12px] font-extrabold text-white">
                +3
              </span>
              <span className="ml-3 font-sans text-[13px] text-[#555]">5 de 8 ya aportaron</span>
            </div>
            <div className="mt-5">
              <div className="flex justify-between font-sans text-[13px] font-medium text-[#333]">
                <span>Aportes del mes</span>
                <span className="font-poppins font-extrabold">S/ 1,250 / S/ 2,000</span>
              </div>
              <div className="mt-2 h-4 overflow-hidden rounded-full border-[2.5px] border-[#111] bg-[#FFF9EC]">
                <div className="h-full w-[62.5%] bg-[#45D98B]" />
              </div>
            </div>
          </div>
          <div className="absolute -top-20 right-4 h-24 w-24 overflow-hidden rounded-3xl border-[3px] border-[#111] bg-[#FFD83D] shadow-[4px_4px_0_#111] sm:-right-6">
            <Image
              src="/assets/images/landing/moneo-mascot.webp"
              alt=""
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <PiggyBank
            className="lp-float absolute -bottom-8 -left-6 h-12 w-12 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] p-2 shadow-[3px_3px_0_#111]"
            aria-hidden="true"
          />
        </Reveal>
      </div>
    </section>
  );
}
