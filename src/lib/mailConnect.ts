import { createClient } from '@/lib/supabase/client';
import { DataError } from '@/lib/dataError';

// MONEO AUTO: direct Gmail connection (read-only OAuth). Everything goes through the
// `mail-oauth` Edge Function: the tokens never reach the browser and only bank emails are
// read. The function answers errors as { error: code } with a non-2xx status.

export interface MailConnection {
  provider: 'google' | 'microsoft';
  emailHint: string;
  status: 'active' | 'revoked';
  lastSyncAt: string | null;
  lastFoundAt: string | null;
  lastError: string | null;
}

export interface MailStatus {
  configured: boolean;
  connection: MailConnection | null;
}

const MESSAGES: Record<string, string> = {
  'beta-full':
    'Los cupos de la beta de Gmail están llenos. Te avisaremos cuando se abran más; mientras, usa capturas o pega el texto.',
  'not-configured': 'La conexión con Gmail se activa muy pronto.',
  'not-connected': 'Conecta tu Gmail primero.',
};

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await createClient().functions.invoke('mail-oauth', { body });
  if (error) {
    let code: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      code = ((await ctx?.json()) as { error?: string } | undefined)?.error;
    } catch {
      // not JSON: network failure
    }
    if (code === 'unauthorized') throw new DataError('auth', error);
    if (code && MESSAGES[code]) throw new DataError('validation', error, MESSAGES[code]);
    throw new DataError(code ? 'unknown' : 'network', error);
  }
  return (data ?? {}) as Record<string, unknown>;
}

// Result of the return from Google's consent screen (?correo=…).
export const MAIL_RETURN_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: 'Gmail conectado. Revisaremos los correos de tu banco.' },
  cancelado: { ok: false, text: 'No se conectó Gmail: cancelaste el permiso.' },
  permiso: {
    ok: false,
    text: 'Falta el permiso para leer tus correos: marca la casilla de Gmail al conectar.',
  },
  error: { ok: false, text: 'No pudimos conectar Gmail. Intenta de nuevo.' },
};

export const mailService = {
  async status(): Promise<MailStatus> {
    const data = await invoke({ action: 'status' });
    return {
      configured: data.configured === true,
      connection: (data.connection as MailConnection | null) ?? null,
    };
  },

  // URL of Google's consent screen; the browser is sent there.
  async connectUrl(): Promise<string> {
    const data = await invoke({ action: 'connect' });
    if (typeof data.url !== 'string') throw new DataError('unknown');
    return data.url;
  },

  // Reads new bank emails now (at most once a minute). Returns how many were found.
  async sync(): Promise<number> {
    const data = await invoke({ action: 'sync' });
    return Number(data.found ?? 0);
  },

  async disconnect(): Promise<void> {
    await invoke({ action: 'disconnect' });
  },
};
