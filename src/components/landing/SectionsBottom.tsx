import React from 'react';
import Image from 'next/image';
import {
  Bell,
  Camera,
  Home,
  KeyRound,
  Check,
  Landmark,
  Laptop,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  Plane,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UserCheck,
  Users,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import { FaqItem, Reveal, TrackLink } from './client';
import { GooglePlayBadge, WebBadge } from './PlayBadge';
import { C, Phone, SectionTitle, SoonBadge, Star, btnPrimary } from './ui';
import { SIGNUP_HREF } from '@/lib/site';
import { ONBOARDING_V2 } from '@/lib/onboardingFlow';
import PricingPlus from './PricingPlus';

const wrap = 'mx-auto max-w-6xl px-4 sm:px-6';

// ─── MONEO AUTO ───────────────────────────────────────────────────────────────

const SOURCES: { label: string; icon: LucideIcon }[] = [
  { label: 'Notificaciones', icon: Bell },
  { label: 'Voz', icon: Mic },
  { label: 'Foto', icon: Camera },
  { label: 'Correo', icon: Mail },
  { label: 'WhatsApp', icon: MessageCircle },
];

export function Auto() {
  return (
    <section
      aria-labelledby="lp-auto"
      className="relative overflow-hidden bg-[#111] py-20 text-white lg:py-28"
    >
      <div className={`${wrap} grid items-center gap-14 lg:grid-cols-2`}>
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-white bg-[#FFD83D] px-3 py-1 font-poppins text-[11px] font-extrabold uppercase tracking-wide text-[#111]">
            MONEO AUTO · Próximamente
          </span>
          <h2
            id="lp-auto"
            className="mt-4 font-poppins text-[34px] font-extrabold leading-[1.05] tracking-tight sm:text-[44px] lg:text-[52px]"
          >
            Tu dinero se registra <span className="text-[#FFD83D]">contigo.</span>
          </h2>
          <p className="mt-4 max-w-xl font-sans text-[17px] leading-relaxed text-white/80 sm:text-lg">
            Estamos construyendo MONEO AUTO: detectará tus gastos a partir de las notificaciones de
            tu banco y te propondrá registrarlos. Tú decides siempre: registrar, editar o ignorar.
          </p>
          <ul className="mt-7 flex flex-wrap gap-2">
            {SOURCES.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/80 px-3.5 py-1.5 font-poppins text-[13px] font-bold"
              >
                <Icon className="h-4 w-4 text-[#FFD83D]" aria-hidden="true" /> {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-sans text-[13px] text-white/60">
            Todas estas fuentes están en desarrollo. Nada se registra sin tu confirmación.
          </p>
          <TrackLink
            href="/register?ref=auto"
            event="auto_click"
            eventProps={{ cta: 'quiero_ser_primero' }}
            className={`${btnPrimary} mt-8 !shadow-[4px_4px_0_#FFF]`}
          >
            Quiero ser de los primeros →
          </TrackLink>
          <p className="mt-3 font-sans text-[13px] text-white/60">
            Crea tu cuenta gratis y te avisaremos cuando MONEO AUTO esté listo.
          </p>
        </Reveal>

        <Reveal delay={120} className="relative flex justify-center">
          <Phone className="!shadow-[8px_8px_0_#FFD83D]">
            <div className="space-y-3 px-3 pb-6 pt-3">
              <div className="rounded-2xl border-2 border-[#111] bg-white p-3 shadow-[2px_2px_0_#111]">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/images/bcp-1790986661188.jpg"
                    alt=""
                    width={24}
                    height={24}
                    loading="lazy"
                    className="h-6 w-6 rounded-md border border-[#111] object-contain"
                  />
                  <span className="text-[11px] font-bold">BCP · ahora</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-snug">
                  Consumo de <b>S/ 85.90</b> en <b>WONG</b> con tu tarjeta.
                </p>
              </div>
              <p className="text-center text-[18px]" aria-hidden="true">
                ↓
              </p>
              <div className="rounded-2xl border-2 border-[#111] bg-[#FFF9EC] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#666]">
                  Gasto detectado
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-[#111] bg-[#FF806E]">
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex-1">
                    <p className="font-poppins text-[14px] font-extrabold">Wong</p>
                    <p className="text-[11px] text-[#555]">Alimentación</p>
                  </div>
                  <p className="whitespace-nowrap font-poppins text-[14px] font-extrabold">
                    -S/ 85.90
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                  <span className="rounded-lg border-2 border-[#111] bg-[#45D98B] py-1.5 text-center">
                    Registrar
                  </span>
                  <span className="rounded-lg border-2 border-[#111] bg-white py-1.5 text-center">
                    Editar
                  </span>
                  <span className="rounded-lg border-2 border-[#111] bg-white py-1.5 text-center">
                    Ignorar
                  </span>
                </div>
              </div>
            </div>
          </Phone>
          <div className="absolute -bottom-6 left-0 h-24 w-24 overflow-hidden rounded-3xl border-[3px] border-white bg-[#FFD83D] sm:left-6 sm:h-28 sm:w-28">
            <Image
              src="/assets/images/landing/moneo-mascot.webp"
              alt=""
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <Star className="lp-float absolute right-2 top-0 h-10 w-10 sm:right-10" />
        </Reveal>
      </div>
    </section>
  );
}

// ─── Voz + Scan ───────────────────────────────────────────────────────────────

export function VozScan() {
  const cards = [
    {
      key: 'voice',
      event: 'voice_click' as const,
      icon: Mic,
      color: C.mint,
      title: 'MONEO VOZ',
      quote: '“Gasté 25 soles en taxi”',
      text: 'Dilo en voz alta y MONEO lo convierte en un gasto con monto y categoría.',
    },
    {
      key: 'scan',
      event: 'scan_click' as const,
      icon: ScanLine,
      color: C.coral,
      title: 'MONEO SCAN',
      quote: 'Foto a la boleta → gasto listo',
      text: 'Toma una foto a tu boleta o recibo y MONEO lee el comercio y el total.',
    },
  ];
  return (
    <section aria-labelledby="lp-vozscan" className="py-20 lg:py-28">
      <div className={wrap}>
        <Reveal>
          <SectionTitle
            id="lp-vozscan"
            kicker="Lo que viene"
            kickerColor={C.lilac}
            title="Registrar será tan fácil como hablar."
            align="center"
          />
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {cards.map(({ key, event, icon: Icon, color, title, quote, text }, i) => (
            <Reveal key={key} delay={i * 100}>
              <TrackLink
                href="/register?ref=auto"
                event={event}
                className="block h-full rounded-[28px] border-[3px] border-[#111] p-6 shadow-[6px_6px_0_#111] transition-transform hover:-translate-y-1 sm:p-8"
                style={{ background: color }}
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-[#111] bg-white">
                    <Icon className="h-7 w-7 text-[#111]" aria-hidden="true" />
                  </span>
                  <SoonBadge />
                </div>
                <h3 className="mt-5 font-poppins text-[26px] font-extrabold text-[#111]">
                  {title}
                </h3>
                <p className="mt-3 inline-block rounded-2xl border-[2.5px] border-[#111] bg-white px-4 py-2 font-poppins text-[15px] font-bold text-[#111]">
                  {quote}
                </p>
                <p className="mt-4 font-sans text-[16px] leading-relaxed text-[#111]">{text}</p>
              </TrackLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Metas ────────────────────────────────────────────────────────────────────

const GOALS: { name: string; target: string; pct: number; icon: LucideIcon; color: string }[] = [
  { name: 'Viaje a Europa', target: 'S/ 4,800', pct: 60, icon: Plane, color: C.blue },
  { name: 'Laptop', target: 'S/ 1,200', pct: 30, icon: Laptop, color: C.lilac },
  { name: 'Emergencia', target: 'S/ 2,000', pct: 15, icon: Umbrella, color: C.coral },
  { name: 'Casa propia', target: 'S/ 50,000', pct: 15, icon: Home, color: C.mint },
];

export function Metas() {
  return (
    <section
      aria-labelledby="lp-metas"
      className="border-y-[3px] border-[#111] bg-[#FFD83D] py-20 lg:py-28"
    >
      <div className={wrap}>
        <Reveal>
          <SectionTitle
            id="lp-metas"
            kicker="Metas"
            kickerColor="#fff"
            title="Ponle nombre a tus sueños."
            subtitle="Crea metas de ahorro, aporta cuando puedas y mira cómo avanzan."
          />
        </Reveal>
        <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {GOALS.map(({ name, target, pct, icon: Icon, color }, i) => (
            <li key={name} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <Reveal delay={i * 80} className="h-full">
                <div className="h-full rounded-3xl border-[3px] border-[#111] bg-white p-5 shadow-[5px_5px_0_#111]">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl border-[2.5px] border-[#111]"
                    style={{ background: color }}
                  >
                    <Icon className="h-6 w-6 text-[#111]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-poppins text-[18px] font-extrabold text-[#111]">
                    {name}
                  </h3>
                  <p className="font-poppins text-[22px] font-extrabold text-[#111]">{target}</p>
                  <div className="mt-4 flex items-center justify-between font-sans text-[13px] font-medium text-[#444]">
                    <span>Avance</span>
                    <span className="font-poppins font-extrabold text-[#111]">{pct}%</span>
                  </div>
                  <div
                    className="mt-1.5 h-4 overflow-hidden rounded-full border-[2.5px] border-[#111] bg-[#FFF9EC]"
                    role="progressbar"
                    aria-label={`Avance de ${name}`}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Hecho para Perú ──────────────────────────────────────────────────────────

export function Peru() {
  const items: [React.ReactNode, string, string][] = [
    ['S/', 'Soles primero', 'Tu moneda base es el sol; también manejas dólares y otras monedas.'],
    [
      <Landmark key="bank" className="h-5 w-5" aria-hidden="true" />,
      'Tus bancos de siempre',
      'Organiza tus cuentas de BCP, Interbank, BBVA, Scotiabank, Yape, Plin y más.',
    ],
    [
      <Users key="juntas" className="h-5 w-5" aria-hidden="true" />,
      'Juntas',
      'La forma peruana de ahorrar en grupo, ahora ordenada.',
    ],
    ['ES', 'En español', 'Todo en nuestro idioma, sin términos complicados.'],
  ];
  return (
    <section aria-labelledby="lp-peru" className="py-20 lg:py-28">
      <div className={wrap}>
        <Reveal>
          <SectionTitle
            id="lp-peru"
            kicker="Perú"
            kickerColor={C.coral}
            title="Hecho para Perú. Pensado para ti."
            subtitle="MONEO no se conecta a tu banco: tú registras tus cuentas y movimientos, y tus claves bancarias nunca pasan por aquí."
            align="center"
          />
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([icon, title, text], i) => (
            <li key={title}>
              <Reveal delay={i * 70} className="h-full">
                <div className="h-full rounded-3xl border-[3px] border-[#111] bg-white p-5 shadow-[4px_4px_0_#111]">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border-[2.5px] border-[#111] bg-[#FFF9EC] font-poppins text-[18px] font-extrabold">
                    {icon}
                  </span>
                  <h3 className="mt-4 font-poppins text-[17px] font-extrabold text-[#111]">
                    {title}
                  </h3>
                  <p className="mt-2 font-sans text-[14px] leading-relaxed text-[#444]">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Seguridad ────────────────────────────────────────────────────────────────

const SECURITY: { title: string; text: string; icon: LucideIcon }[] = [
  {
    title: 'Sin claves bancarias',
    text: 'No te pedimos usuario ni clave de tu banco. Nunca.',
    icon: KeyRound,
  },
  {
    title: 'Tus datos son tuyos',
    text: 'Cada cuenta solo puede ver su propia información.',
    icon: UserCheck,
  },
  { title: 'Conexión cifrada', text: 'Toda la comunicación viaja por HTTPS.', icon: Lock },
  {
    title: 'Sin venta de datos',
    text: 'No vendemos tu información ni la usamos para publicidad.',
    icon: ShieldCheck,
  },
  {
    title: 'Elimina tu cuenta',
    text: 'Desde Configuración borras tu cuenta y tus datos cuando quieras.',
    icon: Trash2,
  },
];

export function Security() {
  return (
    <section
      id="seguridad"
      aria-labelledby="lp-security"
      className="scroll-mt-20 border-y-[3px] border-[#111] bg-[#45D98B] py-20 lg:py-28"
    >
      <div className={`${wrap} grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center`}>
        <Reveal>
          <SectionTitle
            id="lp-security"
            kicker="Seguridad"
            kickerColor="#fff"
            title="Tu información, protegida."
            subtitle="Construimos MONEO pensando primero en tu privacidad."
          />
        </Reveal>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SECURITY.map(({ title, text, icon: Icon }, i) => (
            <li key={title} className={i === SECURITY.length - 1 ? 'sm:col-span-2' : ''}>
              <Reveal delay={i * 60} className="h-full">
                <div className="flex h-full gap-4 rounded-3xl border-[3px] border-[#111] bg-white p-5 shadow-[4px_4px_0_#111]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-[2.5px] border-[#111] bg-[#FFD83D]">
                    <Icon className="h-5 w-5 text-[#111]" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-poppins text-[16px] font-extrabold text-[#111]">{title}</h3>
                    <p className="mt-1 font-sans text-[14px] leading-relaxed text-[#444]">{text}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Precios ──────────────────────────────────────────────────────────────────

export function Pricing() {
  // With MONEO PLUS live the free plan and PLUS are shown side by side (PLUS price from the
  // live plans); before that, everything is free.
  const included = [
    'Cuentas, gastos, ingresos y transferencias',
    'Presupuesto, metas y deudas',
    'Pagos, suscripciones y calendario',
    'Juntas con sorteo de turnos',
    ONBOARDING_V2 ? 'MONEO HOGAR y multimoneda' : 'Multimoneda y reportes',
  ];
  return (
    <section id="precios" aria-labelledby="lp-pricing" className="scroll-mt-20 py-20 lg:py-28">
      <div className={wrap}>
        <Reveal>
          <SectionTitle
            id="lp-pricing"
            kicker="Precios"
            kickerColor={C.yellow}
            title="Empieza gratis."
            subtitle={
              ONBOARDING_V2
                ? 'MONEO es gratis para siempre. Cuando quieras más, MONEO PLUS. Sin letra chica.'
                : 'Hoy todas las funciones disponibles son gratuitas. Sin tarjeta, sin letra chica.'
            }
            align="center"
          />
        </Reveal>
        <Reveal
          delay={100}
          className={`mx-auto mt-12 grid gap-8 ${ONBOARDING_V2 ? 'max-w-4xl md:grid-cols-2' : 'max-w-md'}`}
        >
          <div className="relative rounded-[32px] border-[3px] border-[#111] bg-white p-7 shadow-[8px_8px_0_#111] sm:p-9">
            <span className="absolute -top-4 left-7 rounded-full border-[2.5px] border-[#111] bg-[#45D98B] px-3 py-1 font-poppins text-[12px] font-extrabold uppercase">
              {ONBOARDING_V2 ? 'Gratis' : 'Plan actual'}
            </span>
            <p className="font-poppins text-[20px] font-extrabold text-[#111]">MONEO</p>
            <p className="mt-1 font-poppins text-[56px] font-extrabold leading-none text-[#111]">
              S/ 0
            </p>
            <p className="mt-1 font-sans text-[14px] text-[#555]">Gratis para empezar</p>
            <ul className="mt-6 grid gap-2.5 font-sans text-[15px] text-[#111]">
              {included.map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#111] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <TrackLink
              href={SIGNUP_HREF}
              event="pricing_click"
              eventProps={{ plan: 'gratis' }}
              className={`${btnPrimary} mt-8 w-full`}
            >
              Crear cuenta gratis →
            </TrackLink>
          </div>
          {ONBOARDING_V2 && <PricingPlus />}
        </Reveal>
      </div>
    </section>
  );
}

// ─── Testimonios ──────────────────────────────────────────────────────────────

export function Testimonials() {
  return (
    <section aria-labelledby="lp-testimonials" className="pb-20 lg:pb-28">
      <div className={wrap}>
        <Reveal className="rounded-[32px] border-[3px] border-dashed border-[#111] bg-[#FFF9EC] px-6 py-12 text-center">
          <h2
            id="lp-testimonials"
            className="font-poppins text-[26px] font-extrabold text-[#111] sm:text-[32px]"
          >
            Próximamente: historias reales.
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-sans text-[16px] leading-relaxed text-[#444]">
            Pronto compartiremos experiencias de personas que ya usan MONEO para ordenar su dinero.
            ¿Quieres ser una de ellas?
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS: [string, string][] = [
  [
    '¿Qué es MONEO?',
    'Es una app de finanzas personales para registrar tus gastos, ingresos, cuentas, presupuesto, metas, deudas y juntas en un solo lugar.',
  ],
  [
    '¿Cuánto cuesta?',
    ONBOARDING_V2
      ? 'MONEO es gratis: cuentas, gastos, presupuesto, metas, deudas, juntas y MONEO HOGAR. MONEO PLUS suma MONEO AUTO, voz, escaneo, reportes avanzados y más, y puedes probarlo gratis.'
      : 'Empezar es gratis. Hoy todas las funciones disponibles se pueden usar sin pagar y sin registrar una tarjeta.',
  ],
  [
    '¿MONEO se conecta a mi banco?',
    'No. MONEO no se conecta a ningún banco ni te pide tus claves. Tú registras tus cuentas y movimientos.',
  ],
  [
    '¿Mis datos están seguros?',
    'Tu información viaja cifrada por HTTPS y cada usuario solo puede acceder a sus propios datos. No vendemos tu información.',
  ],
  [
    '¿Puedo usar dólares u otras monedas?',
    'Sí. Tu moneda base es el sol, pero puedes tener cuentas en dólares u otras monedas; cada movimiento guarda el tipo de cambio que usaste.',
  ],
  [
    '¿Cómo funcionan las juntas?',
    'Creas la junta, agregas a los integrantes, defines el aporte y la frecuencia, registras quién pagó en cada ciclo y sorteas los turnos.',
  ],
  [
    '¿Qué es MONEO AUTO?',
    'Es una función en desarrollo que detectará gastos a partir de las notificaciones de tu banco para que los confirmes con un toque. Aún no está disponible.',
  ],
  [
    '¿Hay app para Android?',
    'La app en Google Play llegará pronto. Mientras tanto, puedes abrir MONEO en Chrome y usar “Agregar a la pantalla principal” para tenerla como app.',
  ],
  [
    '¿Puedo usarlo en la computadora?',
    'Sí. MONEO funciona en el navegador de tu computadora, tablet o celular con la misma cuenta.',
  ],
  [
    '¿Cómo elimino mi cuenta?',
    'En Configuración encontrarás la opción para eliminar tu cuenta junto con todos tus datos.',
  ],
];

export function Faq() {
  return (
    <section
      id="preguntas"
      aria-labelledby="lp-faq"
      className="scroll-mt-20 border-t-[3px] border-[#111] bg-white py-20 lg:py-28"
    >
      <div className={`${wrap} grid gap-10 lg:grid-cols-[0.8fr_1.2fr]`}>
        <Reveal>
          <SectionTitle
            id="lp-faq"
            kicker="Preguntas"
            kickerColor={C.blue}
            title="Preguntas frecuentes"
            subtitle="Lo que más nos preguntan antes de empezar."
          />
        </Reveal>
        <div className="grid gap-3">
          {FAQS.map(([q, a]) => (
            <FaqItem key={q} q={q}>
              {a}
            </FaqItem>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA final ────────────────────────────────────────────────────────────────

export function FinalCta() {
  return (
    <section aria-labelledby="lp-final" className="bg-[#FFF9EC] px-4 py-16 sm:px-6 lg:py-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border-[3px] border-[#111] bg-[#111] px-6 py-14 text-white shadow-[10px_10px_0_#FFD83D] sm:px-12 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2
              id="lp-final"
              className="font-poppins text-[44px] font-extrabold leading-none tracking-tight sm:text-[64px]"
            >
              Empieza <span className="text-[#FFD83D]">hoy.</span>
            </h2>
            <p className="mt-4 max-w-lg font-sans text-[17px] leading-relaxed text-white/80 sm:text-lg">
              Crea tu cuenta gratis en un minuto y toma el control de tu dinero.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <WebBadge />
              <GooglePlayBadge />
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-[32px] border-[3px] border-white bg-[#FFD83D] sm:w-72">
            <Image
              src="/assets/images/landing/moneo-mascot.webp"
              alt="Moneo, la mascota de MONEO"
              fill
              sizes="288px"
              className="object-cover"
            />
          </div>
        </div>
        <Star className="lp-float absolute right-6 top-6 h-10 w-10" />
      </div>
    </section>
  );
}
