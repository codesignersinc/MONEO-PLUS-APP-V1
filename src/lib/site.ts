// Public site configuration for the landing page. Leave a value as null until it is
// real: the landing hides or marks as "Próximamente" anything that is not available.
export const SITE = {
  url: 'https://moneo.plus',
  name: 'MONEO',
  tagline: 'Tu dinero, más simple.',
  description:
    'MONEO te ayuda a controlar tus gastos, ingresos, cuentas, presupuesto, metas y ahorro en un solo lugar.',
  // Google Play listing URL once the Android app is published.
  googlePlayUrl: null as string | null,
  // Social profiles (Instagram, TikTok, YouTube, LinkedIn) once they exist.
  social: {
    instagram: null as string | null,
    tiktok: null as string | null,
    youtube: null as string | null,
    linkedin: null as string | null,
  },
};

// Where "Crear cuenta / Comenzar" leads: the new onboarding (/empezar) once
// NEXT_PUBLIC_ONBOARDING_V2=true, otherwise the classic sign-up form.
export const SIGNUP_HREF =
  process.env.NEXT_PUBLIC_ONBOARDING_V2 === 'true' ? '/empezar' : '/register';
