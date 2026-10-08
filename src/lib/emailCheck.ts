// Sign-up only accepts real-looking email addresses. The same rules run in the database
// (hook_before_user_created → signup_email_problem), so they cannot be skipped; this copy gives
// the message before the request and adds what SQL cannot: typo suggestions and a DNS check.

/** Domains reserved for examples/tests or that never receive mail. */
const RESERVED = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.pe',
  'prueba.com',
  'prueba.pe',
  'dominio.com',
  'asdf.com',
]);
const RESERVED_TLDS = /\.(test|example|invalid|localhost|local|lan|internal)$/;

/** Disposable inbox services (the most used ones). */
export const DISPOSABLE = new Set([
  'mailinator.com',
  'yopmail.com',
  'yopmail.net',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'sharklasers.com',
  'grr.la',
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  'tempmailo.com',
  'trashmail.com',
  'getnada.com',
  'nada.email',
  'maildrop.cc',
  'dispostable.com',
  'fakeinbox.com',
  'mintemail.com',
  'mohmal.com',
  'emailondeck.com',
  'throwawaymail.com',
  'moakt.com',
  'spamgourmet.com',
  'mailnesia.com',
  'tempail.com',
  'burnermail.io',
  'inboxkitten.com',
  'mail.tm',
  'mail.gw',
  'tmpmail.org',
  'tmail.ws',
  'emailfake.com',
]);

/** Frequent typos of the big providers → the right domain. */
const TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.es': 'gmail.com',
  'gmail.pe': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'iclud.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

const SYNTAX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/**
 * Why this address cannot be used to sign up, or null when it looks real. Keep in sync with
 * public.signup_email_problem() in the database.
 */
export function signupEmailProblem(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!SYNTAX.test(email) || email.includes('..')) return 'Ingresa un correo válido.';
  const [local, domain] = email.split('@');
  const fix = TYPOS[domain];
  if (fix) return `¿Quisiste decir ${local}@${fix}?`;
  if (RESERVED.has(domain) || RESERVED_TLDS.test(domain)) {
    return 'Usa tu correo real: lo necesitas para recuperar tu cuenta.';
  }
  if (DISPOSABLE.has(domain)) {
    return 'No aceptamos correos temporales. Usa tu correo personal.';
  }
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Gmail: 6–30 letters, digits or dots (dots and +tags do not count).
    const name = local.split('+')[0].replace(/\./g, '');
    if (!/^[a-z0-9]{6,30}$/.test(name)) return 'Ese correo de Gmail no existe. Revísalo.';
  }
  return null;
}

/**
 * Whether the domain can receive mail (MX or A record), asked to Google's public DNS. Fails
 * open: a network problem never blocks a sign-up.
 */
export async function domainReceivesMail(email: string): Promise<boolean> {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  const ask = async (type: 'MX' | 'A') => {
    const r = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!r.ok) throw new Error('dns');
    const j = (await r.json()) as { Status: number; Answer?: unknown[] };
    return j.Status === 0 && (j.Answer?.length ?? 0) > 0;
  };
  try {
    return (await ask('MX')) || (await ask('A'));
  } catch {
    return true;
  }
}

/** Thrown before calling Supabase; the forms show its message as is. */
export class SignupEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignupEmailError';
  }
}

/** Throws SignupEmailError when the address cannot be used to sign up. */
export async function assertSignupEmail(email: string): Promise<void> {
  const problem = signupEmailProblem(email);
  if (problem) throw new SignupEmailError(problem);
  if (!(await domainReceivesMail(email))) {
    throw new SignupEmailError('Ese dominio no recibe correos. Revisa tu correo.');
  }
}
