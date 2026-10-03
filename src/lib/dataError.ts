// ─── Data errors ──────────────────────────────────────────────────────────────
// Normalizes Supabase/PostgREST/network failures into a single error type so the
// UI can tell "the request failed" apart from "the request worked and returned
// nothing" (empty state).

export type DataErrorKind =
  | 'network'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'unknown';

const USER_MESSAGES: Record<DataErrorKind, string> = {
  network: 'No hay conexión. Revisa tu internet e intenta de nuevo.',
  auth: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  permission: 'No tienes permiso para realizar esta acción.',
  not_found: 'No encontramos el registro. Puede que ya no exista.',
  validation: 'Algunos datos no son válidos. Revísalos e intenta de nuevo.',
  conflict: 'Ya existe un registro con esos datos.',
  unknown: 'Ocurrió un error inesperado. Intenta de nuevo.',
};

export class DataError extends Error {
  readonly kind: DataErrorKind;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(kind: DataErrorKind, cause?: unknown, userMessage?: string) {
    super(userMessage ?? USER_MESSAGES[kind]);
    this.name = 'DataError';
    this.kind = kind;
    this.userMessage = userMessage ?? USER_MESSAGES[kind];
    this.cause = cause;
  }
}

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

function classify(error: unknown): DataErrorKind {
  if (error instanceof TypeError) return 'network';
  if (!error || typeof error !== 'object') return 'unknown';

  const { code, message, status } = error as ErrorLike;
  const codeStr = typeof code === 'string' ? code : '';
  const msg = typeof message === 'string' ? message : '';

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'network';
  }
  if (codeStr === '42501') return 'permission';
  if (codeStr === 'PGRST116') return 'not_found';
  if (codeStr === '23505') return 'conflict';
  if (codeStr.startsWith('23') || codeStr.startsWith('22')) return 'validation';
  if (
    codeStr === 'PGRST301' ||
    codeStr === 'PGRST302' ||
    status === 401 ||
    /jwt|not authenticated|auth session missing|refresh token/i.test(msg)
  ) {
    return 'auth';
  }
  if (status === 403) return 'permission';
  return 'unknown';
}

/** Converts any thrown value or Supabase `error` object into a DataError. */
export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;
  return new DataError(classify(error), error);
}

/** Message safe to show to the user for any caught value. */
export function getErrorMessage(error: unknown): string {
  return toDataError(error).userMessage;
}

/**
 * UPDATE/DELETE blocked by RLS (or targeting a missing row) do not return an
 * error from PostgREST — they affect zero rows. Call this on the rows returned
 * by `.select('id')` to surface that case.
 */
export function assertAffected(rows: unknown[] | null | undefined): void {
  if (!rows || rows.length === 0) {
    throw new DataError(
      'not_found',
      undefined,
      'No se pudo guardar el cambio. Puede que el registro ya no exista o no tengas permiso.'
    );
  }
}

/** Throws a DataError when the current user is not authenticated. */
export function authRequired(): DataError {
  return new DataError('auth');
}
