import type { GlyphKey } from '@/lib/glyphs';

// Country landings of the waiting list (docs/global-core.md, step 4): moneo.plus/es,
// /us, /au, /ae, /sg. Peru is the main landing at /. Copy lives here until the i18n
// system (step 7) takes it over.

export type MarketSlug = 'es' | 'us' | 'au' | 'ae' | 'sg';
export type WillingToPay = 'free' | 'low' | 'mid' | 'high';

export interface MarketCopy {
  pill: string;
  title: [string, string];
  subtitle: string;
  bullets: string[];
  examplesTitle: string;
  examples: { label: string; amount: number; icon: GlyphKey }[];
  featuresTitle: string;
  features: { title: string; text: string; icon: GlyphKey }[];
  formTitle: string;
  formText: string;
  emailLabel: string;
  emailPlaceholder: string;
  payQuestion: string;
  payOptions: Record<WillingToPay, string>;
  submit: string;
  sending: string;
  consent: string;
  privacy: string;
  done: string;
  doneText: string;
  error: string;
  invalidEmail: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  peruLink: string;
}

export interface Market {
  slug: MarketSlug;
  country: string;
  countryName: string;
  locale: string;
  /** hreflang / OpenGraph locale (es-ES → es_ES). */
  ogLocale: string;
  currency: string;
  lang: 'es' | 'en';
  metaTitle: string;
  metaDescription: string;
  copy: MarketCopy;
}

const ES_FAQ_BASE = (pais: string) => [
  {
    q: '¿Cuándo llega MONEO?',
    a: `Estamos preparando MONEO para ${pais}. Quienes estén en la lista lo prueban primero y les escribimos un solo correo cuando esté listo.`,
  },
  {
    q: '¿Tengo que conectar mi banco?',
    a: 'No. Registras tus movimientos en segundos y MONEO hace las cuentas. Tus claves bancarias nunca pasan por MONEO.',
  },
  {
    q: '¿Cuánto costará?',
    a: 'Habrá un plan gratis para siempre. Tu respuesta a «¿cuánto pagarías?» nos ayuda a fijar un precio justo.',
  },
];

const EN_FAQ_BASE = (country: string) => [
  {
    q: 'When is MONEO coming?',
    a: `We are getting MONEO ready for ${country}. People on the list try it first, and we send a single email when it is ready.`,
  },
  {
    q: 'Do I have to connect my bank?',
    a: 'No. You log your spending in seconds and MONEO does the maths. Your banking passwords never go through MONEO.',
  },
  {
    q: 'How much will it cost?',
    a: 'There will be a free-forever plan. Your answer to “how much would you pay?” helps us set a fair price.',
  },
];

const ES_COMMON = {
  bullets: ['Gratis para empezar', 'Sin conectar tu banco', 'En tu moneda'],
  examplesTitle: 'Así se ve tu mes',
  formTitle: 'Únete a la lista de espera',
  emailLabel: 'Tu correo',
  emailPlaceholder: 'tu@correo.com',
  payQuestion: '¿Cuánto pagarías al mes por MONEO PLUS?',
  submit: 'Quiero probarlo primero',
  sending: 'Enviando…',
  consent:
    'Solo te escribiremos para avisarte cuando MONEO llegue. Puedes pedir que te borremos cuando quieras.',
  privacy: 'Política de privacidad',
  done: '¡Ya estás en la lista!',
  doneText: 'Te escribiremos cuando MONEO esté listo. Gracias por ayudarnos a llegar.',
  error: 'No pudimos guardar tu correo. Inténtalo de nuevo en un momento.',
  invalidEmail: 'Revisa tu correo: parece incompleto.',
  faqTitle: 'Preguntas frecuentes',
  peruLink: '¿Estás en Perú? MONEO ya está disponible',
};

const EN_COMMON = {
  bullets: ['Free to start', 'No bank connection needed', 'In your currency'],
  examplesTitle: 'Your month at a glance',
  formTitle: 'Join the waiting list',
  emailLabel: 'Your email',
  emailPlaceholder: 'you@email.com',
  payQuestion: 'How much would you pay per month for MONEO PLUS?',
  submit: 'Get early access',
  sending: 'Sending…',
  consent: 'We will only email you to say MONEO has arrived. Ask us to delete you at any time.',
  privacy: 'Privacy policy (Spanish)',
  done: 'You are on the list!',
  doneText: 'We will email you when MONEO is ready. Thanks for helping us get there.',
  error: 'We could not save your email. Please try again in a moment.',
  invalidEmail: 'Check your email: it looks incomplete.',
  faqTitle: 'Frequently asked questions',
  peruLink: 'In Peru? MONEO is already available',
};

export const MARKETS: Record<MarketSlug, Market> = {
  es: {
    slug: 'es',
    country: 'ES',
    countryName: 'España',
    locale: 'es-ES',
    ogLocale: 'es_ES',
    currency: 'EUR',
    lang: 'es',
    metaTitle: 'MONEO España — Tu dinero, más simple.',
    metaDescription:
      'Controla tus gastos, cuentas y metas en un solo lugar. MONEO llega pronto a España: únete a la lista de espera.',
    copy: {
      ...ES_COMMON,
      pill: 'Llega pronto · España',
      title: ['Tu dinero,', 'más simple.'],
      subtitle:
        'Controla tus gastos, tus cuentas y tus metas en un solo lugar. MONEO llega pronto a España: apúntate y sé de los primeros en probarlo.',
      examples: [
        { label: 'Supermercado', amount: -63.8, icon: 'cart' },
        { label: 'Café', amount: -2.4, icon: 'coffee' },
        { label: 'Alquiler', amount: -850, icon: 'home' },
        { label: 'Nómina', amount: 1890, icon: 'briefcase' },
      ],
      featuresTitle: 'Todo tu dinero, sin hojas de cálculo',
      features: [
        {
          title: 'Registra en segundos',
          text: 'Apunta un gasto en dos toques y MONEO ordena el resto por categoría.',
          icon: 'zap',
        },
        {
          title: 'Presupuesto y metas',
          text: 'Pon un límite a cada categoría y ahorra para lo que de verdad quieres.',
          icon: 'target',
        },
        {
          title: 'Piso compartido o en pareja',
          text: 'MONEO HOGAR reparte los gastos comunes sin que nadie vea tus cuentas.',
          icon: 'home',
        },
      ],
      formText: 'Déjanos tu correo y te avisamos cuando MONEO esté listo en España.',
      payOptions: {
        free: 'Solo lo usaría gratis',
        low: 'Hasta 2,99 €',
        mid: 'De 3 € a 5,99 €',
        high: '6 € o más',
      },
      faq: ES_FAQ_BASE('España'),
    },
  },
  us: {
    slug: 'us',
    country: 'US',
    countryName: 'Estados Unidos',
    locale: 'es-US',
    ogLocale: 'es_US',
    currency: 'USD',
    lang: 'es',
    metaTitle: 'MONEO en Estados Unidos — Tu dinero, más simple.',
    metaDescription:
      'La app de finanzas personales en español: gastos, cuentas, metas y tandas. Únete a la lista de espera de MONEO en Estados Unidos.',
    copy: {
      ...ES_COMMON,
      pill: 'Llega pronto · Estados Unidos',
      title: ['Tu dinero, en español', 'y más simple.'],
      subtitle:
        'Controla tus gastos, tus cuentas, tus metas y tus tandas en un solo lugar, en tu idioma. Únete a la lista y pruébalo antes que nadie.',
      examples: [
        { label: 'Supermercado', amount: -86.2, icon: 'cart' },
        { label: 'Gasolina', amount: -42.5, icon: 'car' },
        { label: 'Renta', amount: -1450, icon: 'home' },
        { label: 'Pago semanal', amount: 980, icon: 'briefcase' },
      ],
      featuresTitle: 'Hecho para cómo manejas tu dinero',
      features: [
        {
          title: 'Registra en segundos',
          text: 'Apunta un gasto en dos toques y MONEO ordena el resto por categoría.',
          icon: 'zap',
        },
        {
          title: 'Tandas sin enredos',
          text: 'Organiza tu tanda: turnos, aportes y quién ya pagó, todo claro para el grupo.',
          icon: 'users',
        },
        {
          title: 'Metas para tu familia',
          text: 'Ahorra para lo importante y comparte los gastos de la casa con MONEO HOGAR.',
          icon: 'piggy',
        },
      ],
      formText: 'Déjanos tu correo y te avisamos cuando MONEO esté listo en Estados Unidos.',
      payOptions: {
        free: 'Solo lo usaría gratis',
        low: 'Hasta $2.99',
        mid: 'De $3 a $5.99',
        high: '$6 o más',
      },
      faq: ES_FAQ_BASE('Estados Unidos'),
    },
  },
  au: {
    slug: 'au',
    country: 'AU',
    countryName: 'Australia',
    locale: 'en-AU',
    ogLocale: 'en_AU',
    currency: 'AUD',
    lang: 'en',
    metaTitle: 'MONEO Australia — Your money, made simple.',
    metaDescription:
      'Track your spending, accounts and goals in one place. MONEO is coming to Australia: join the waiting list.',
    copy: {
      ...EN_COMMON,
      pill: 'Coming soon · Australia',
      title: ['Your money,', 'made simple.'],
      subtitle:
        'Track your spending, accounts and savings goals in one place. MONEO is coming to Australia: join the list and be among the first to try it.',
      examples: [
        { label: 'Groceries', amount: -84.2, icon: 'cart' },
        { label: 'Coffee', amount: -5.5, icon: 'coffee' },
        { label: 'Rent', amount: -2400, icon: 'home' },
        { label: 'Salary', amount: 3150, icon: 'briefcase' },
      ],
      featuresTitle: 'All your money, no spreadsheets',
      features: [
        {
          title: 'Log in seconds',
          text: 'Add an expense in two taps and MONEO sorts the rest by category.',
          icon: 'zap',
        },
        {
          title: 'Budgets and goals',
          text: 'Set a limit for each category and save for what really matters.',
          icon: 'target',
        },
        {
          title: 'Share the house',
          text: 'MONEO HOGAR splits shared bills with your partner or flatmates — nobody sees your accounts.',
          icon: 'home',
        },
      ],
      formText: 'Leave your email and we will let you know when MONEO is ready in Australia.',
      payOptions: {
        free: 'I would only use it free',
        low: 'Up to A$3.99',
        mid: 'A$4 to A$7.99',
        high: 'A$8 or more',
      },
      faq: EN_FAQ_BASE('Australia'),
    },
  },
  ae: {
    slug: 'ae',
    country: 'AE',
    countryName: 'United Arab Emirates',
    locale: 'en-AE',
    ogLocale: 'en_AE',
    currency: 'AED',
    lang: 'en',
    metaTitle: 'MONEO UAE — Your money, made simple.',
    metaDescription:
      'Track your spending, accounts and goals in one place, in more than one currency. MONEO is coming to the UAE: join the waiting list.',
    copy: {
      ...EN_COMMON,
      pill: 'Coming soon · UAE',
      title: ['Your money,', 'made simple.'],
      subtitle:
        'Track your spending, accounts and savings goals in one place — in dirhams and the currencies you send home. Join the list and try it first.',
      examples: [
        { label: 'Groceries', amount: -186, icon: 'cart' },
        { label: 'Coffee', amount: -18, icon: 'coffee' },
        { label: 'Rent', amount: -6500, icon: 'home' },
        { label: 'Salary', amount: 14500, icon: 'briefcase' },
      ],
      featuresTitle: 'Built for life in more than one currency',
      features: [
        {
          title: 'Log in seconds',
          text: 'Add an expense in two taps and MONEO sorts the rest by category.',
          icon: 'zap',
        },
        {
          title: 'Many currencies',
          text: 'Keep accounts in dirhams, dollars or your home currency and see one total.',
          icon: 'exchange',
        },
        {
          title: 'Goals that add up',
          text: 'Save for the trip home, the emergency fund or the next big step.',
          icon: 'target',
        },
      ],
      formText: 'Leave your email and we will let you know when MONEO is ready in the UAE.',
      payOptions: {
        free: 'I would only use it free',
        low: 'Up to AED 9',
        mid: 'AED 10 to AED 19',
        high: 'AED 20 or more',
      },
      faq: EN_FAQ_BASE('the UAE'),
    },
  },
  sg: {
    slug: 'sg',
    country: 'SG',
    countryName: 'Singapore',
    locale: 'en-SG',
    ogLocale: 'en_SG',
    currency: 'SGD',
    lang: 'en',
    metaTitle: 'MONEO Singapore — Your money, made simple.',
    metaDescription:
      'Track your spending, accounts and goals in one place. MONEO is coming to Singapore: join the waiting list.',
    copy: {
      ...EN_COMMON,
      pill: 'Coming soon · Singapore',
      title: ['Your money,', 'made simple.'],
      subtitle:
        'Track your spending, accounts and savings goals in one place. MONEO is coming to Singapore: join the list and be among the first to try it.',
      examples: [
        { label: 'Groceries', amount: -64.8, icon: 'cart' },
        { label: 'Kopi', amount: -1.8, icon: 'coffee' },
        { label: 'Ride', amount: -14.2, icon: 'taxi' },
        { label: 'Salary', amount: 5200, icon: 'briefcase' },
      ],
      featuresTitle: 'All your money, no spreadsheets',
      features: [
        {
          title: 'Log in seconds',
          text: 'Add an expense in two taps and MONEO sorts the rest by category.',
          icon: 'zap',
        },
        {
          title: 'Budgets and goals',
          text: 'Set a limit for each category and save for what really matters.',
          icon: 'target',
        },
        {
          title: 'Many currencies',
          text: 'Keep accounts in more than one currency and see one total.',
          icon: 'exchange',
        },
      ],
      formText: 'Leave your email and we will let you know when MONEO is ready in Singapore.',
      payOptions: {
        free: 'I would only use it free',
        low: 'Up to S$3.99',
        mid: 'S$4 to S$7.99',
        high: 'S$8 or more',
      },
      faq: EN_FAQ_BASE('Singapore'),
    },
  },
};

export const MARKET_SLUGS = Object.keys(MARKETS) as MarketSlug[];

export function isMarketSlug(value: string): value is MarketSlug {
  return (MARKET_SLUGS as string[]).includes(value);
}

/** Landing for a country code (from the IP), if it has one. */
export function marketForCountry(code: string | null | undefined): Market | null {
  if (!code) return null;
  return Object.values(MARKETS).find((m) => m.country === code.toUpperCase()) ?? null;
}

/** "€63.80"-style amount in the market's own locale and currency. */
export function marketMoney(amount: number, market: Market): string {
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** hreflang alternates shared by the main landing and every country landing. */
export function landingAlternates(): Record<string, string> {
  const langs: Record<string, string> = { 'es-PE': '/', 'x-default': '/' };
  for (const m of Object.values(MARKETS)) langs[m.locale] = `/${m.slug}`;
  return langs;
}

/** Clean a UTM value from the URL: short, printable, or undefined. */
export function cleanUtm(value: string | null | undefined): string | undefined {
  const v = (value ?? '').trim().slice(0, 100);
  return v && /^[\w .:/@+-]+$/.test(v) ? v : undefined;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** Same rule as join_waitlist() in the database. */
export function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e);
}
