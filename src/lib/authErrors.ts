// Spanish messages for Supabase Auth errors shown in the login/register/recovery forms.
const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [
    /email not confirmed/i,
    'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  ],
  [/user already registered|already been registered/i, 'Ya existe una cuenta con ese correo.'],
  [
    /password should be at least|password.*(short|characters)/i,
    'La contraseña debe tener al menos 6 caracteres.',
  ],
  [
    /same.*password|different from the old password/i,
    'La nueva contraseña debe ser distinta de la anterior.',
  ],
  [
    /unable to validate email|invalid email|email address .* is invalid/i,
    'Ingresa un correo válido.',
  ],
  [
    /rate limit|too many requests|security purposes/i,
    'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  ],
  [
    /provider is not enabled|unsupported provider/i,
    'Este método de acceso todavía no está disponible.',
  ],
  [/auth session missing|session.*(expired|not found)/i, 'El enlace expiró. Solicita uno nuevo.'],
  [/failed to fetch|network/i, 'No hay conexión. Revisa tu internet e intenta de nuevo.'],
];

export function authErrorMessage(
  err: unknown,
  fallback = 'Ocurrió un error. Intenta de nuevo.'
): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  // Sign-up email checks (src/lib/emailCheck.ts, and the database hook, whose messages start
  // with "MONEO: ") are already written for the person.
  if (err instanceof Error && err.name === 'SignupEmailError') return msg;
  const own = msg.match(/MONEO: (.+)$/);
  if (own) return own[1];
  for (const [re, text] of MESSAGES) if (re.test(msg)) return text;
  return fallback;
}
