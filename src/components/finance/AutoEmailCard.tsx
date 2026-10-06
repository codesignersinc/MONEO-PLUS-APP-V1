'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, Loader2, Mail, Monitor } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addressService,
  BANK_EMAIL_FILTER,
  BANK_SENDER_KEYS,
  gmailLink,
  mailProviderOf,
  OUTLOOK_RULES_URL,
  type AutoAddress,
  type MailProvider,
} from '@/lib/supabaseAuto';
import { getErrorMessage } from '@/lib/dataError';

// "Correo automático": a guided set-up so the user's mailbox forwards only bank notices to
// their private MONEO address. The mailbox (Gmail / Outlook / other) is detected from the
// sign-up email and can be changed; each step has a button that opens the exact settings
// screen. Hidden until NEXT_PUBLIC_AUTO_EMAIL_ENABLED=true.
export const AUTO_EMAIL_ENABLED = process.env.NEXT_PUBLIC_AUTO_EMAIL_ENABLED === 'true';

const MAILBOX_KEY = 'moneo-auto-mailbox';

const PROVIDERS: { id: MailProvider; label: string }[] = [
  { id: 'gmail', label: 'Gmail' },
  { id: 'outlook', label: 'Outlook / Hotmail' },
  { id: 'otro', label: 'Otro' },
];

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

function readMailbox(): string | null {
  try {
    return localStorage.getItem(MAILBOX_KEY);
  } catch {
    return null;
  }
}

function saveMailbox(email: string) {
  try {
    localStorage.setItem(MAILBOX_KEY, email);
  } catch {
    // Storage blocked: the sign-up email is used next time.
  }
}

function CopyButton({ value, label, big }: { value: string; label: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked: the text is selectable anyway.
        }
      }}
      aria-label={label}
      className={
        big
          ? 'flex items-center justify-center gap-2 rounded-xl border-[3px] border-black bg-white px-4 py-2.5 text-sm font-black shadow-[3px_3px_0px_rgba(0,0,0,1)]'
          : 'flex shrink-0 items-center gap-1 rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-black'
      }
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copiado' : big ? label : 'Copiar'}
    </button>
  );
}

function OpenButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-xl border-[3px] border-black bg-[#FFD43B] px-4 py-2.5 text-sm font-black text-black shadow-[3px_3px_0px_rgba(0,0,0,1)]"
    >
      {children} <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border-2 border-black bg-white p-3">
      <div className="flex items-center gap-2">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${done ? 'bg-green-500 text-white' : 'bg-black text-white'}`}
        >
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <span className="font-black text-black">{title}</span>
      </div>
      <div className="mt-2 space-y-2 pl-9 text-[13px] text-gray-800">{children}</div>
    </li>
  );
}

export default function AutoEmailCard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<AutoAddress | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The mailbox where the bank notices arrive (defaults to the sign-up email).
  const [mailbox, setMailbox] = useState('');
  const [provider, setProvider] = useState<MailProvider>('gmail');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const email = readMailbox() || user?.email || '';
    setMailbox(email);
    setProvider(mailProviderOf(email));
  }, [user?.email]);

  const load = useCallback(() => {
    addressService
      .get()
      .then(setInfo)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (AUTO_EMAIL_ENABLED) load();
  }, [load]);

  const gmailCodeReceived = Boolean(
    info?.gmailCodeAt && Date.now() - new Date(info.gmailCodeAt).getTime() < 7 * 86400e3
  );
  const working = Boolean(
    info?.lastReceivedAt &&
    (!info.gmailCodeAt ||
      new Date(info.lastReceivedAt).getTime() - new Date(info.gmailCodeAt).getTime() > 30e3)
  );

  // While the user is setting it up, watch for Gmail's confirmation and the first email.
  useEffect(() => {
    if (!open || !info || working) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 5000);
    return () => clearInterval(id);
  }, [open, info, working, load]);

  if (!AUTO_EMAIL_ENABLED) return null;

  const activate = async (regenerate = false) => {
    if (
      regenerate &&
      !window.confirm(
        'Se creará una dirección nueva y la actual dejará de recibir correos. ¿Continuar?'
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await addressService.create(regenerate);
      setOpen(true);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const changeMailbox = (email: string) => {
    setMailbox(email);
    setProvider(mailProviderOf(email));
    saveMailbox(email.trim());
  };

  const address = info?.address ?? '';

  return (
    <section className="mb-6 rounded-3xl border-[3px] border-black bg-[#E0EDFF] p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <Mail className="h-5 w-5 shrink-0" />
        <span className="flex-1">
          <span className="block font-black text-black">Correo automático</span>
          <span className="block text-xs text-gray-700">
            {info
              ? info.lastReceivedAt
                ? `Activo · último correo ${ago(info.lastReceivedAt)}`
                : 'Activo · esperando tu primer correo'
              : 'Los avisos de tu banco llegan solos a tu bandeja'}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm text-black">
          {error && (
            <p role="alert" className="font-semibold text-red-600">
              {error}
            </p>
          )}

          {/* Mailbox where the bank notices arrive */}
          <div className="rounded-2xl border-2 border-black bg-white p-3">
            <p className="text-xs font-black uppercase tracking-wide text-gray-600">
              Correo donde te llegan los avisos del banco
            </p>
            {editing || !mailbox ? (
              <form
                className="mt-1.5 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditing(false);
                }}
              >
                <input
                  type="email"
                  value={mailbox}
                  onChange={(e) => changeMailbox(e.target.value)}
                  placeholder="tucorreo@gmail.com"
                  autoFocus={editing}
                  className="min-w-0 flex-1 rounded-xl border-2 border-black px-3 py-2 text-sm font-semibold"
                />
                <button
                  type="submit"
                  className="rounded-xl border-2 border-black bg-black px-3 text-sm font-black text-white"
                >
                  Listo
                </button>
              </form>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-bold">{mailbox}</span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs font-bold text-gray-600 underline"
                >
                  Cambiar
                </button>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  aria-pressed={provider === p.id}
                  className={`rounded-full border-2 border-black px-3 py-1 text-xs font-black ${provider === p.id ? 'bg-black text-white' : 'bg-white text-black'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {info === null && (
            <>
              <p className="text-gray-700">
                Conecta tu correo una sola vez y los avisos de tu banco (BCP, BBVA, Interbank, Yape)
                aparecerán solos en «Por revisar». No leemos tu bandeja: solo recibimos los avisos
                de tu banco.
              </p>
              <button
                type="button"
                onClick={() => activate()}
                disabled={busy}
                className="w-full rounded-xl border-[3px] border-black bg-[#FFD43B] px-4 py-3 font-black shadow-[3px_3px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {busy ? 'Preparando…' : 'Conectar mi correo'}
              </button>
            </>
          )}

          {info && working && (
            <p className="flex items-center gap-2 rounded-2xl border-2 border-black bg-[#D9F99D] p-3 font-bold">
              <Check className="h-5 w-5 shrink-0" /> ¡Conectado! Los avisos de tu banco llegarán
              solos.
            </p>
          )}

          {info && provider !== 'otro' && (
            <p className="flex items-start gap-2 text-xs font-semibold text-gray-700">
              <Monitor className="mt-0.5 h-4 w-4 shrink-0" />
              Hazlo desde una computadora: la app de {provider === 'gmail'
                ? 'Gmail'
                : 'Outlook'}{' '}
              del celular no tiene esta opción. Solo se hace una vez.
            </p>
          )}

          {info && provider === 'gmail' && (
            <ol className="space-y-2">
              <Step n={1} done={gmailCodeReceived} title="Autoriza a MONEO en Gmail">
                <p>
                  Copia tu dirección MONEO, abre Gmail y toca{' '}
                  <b>«Añadir una dirección de reenvío»</b>. Pégala y toca <b>Siguiente</b> →{' '}
                  <b>Continuar</b>.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CopyButton value={address} label="1. Copiar mi dirección" big />
                  <OpenButton href={gmailLink(mailbox, 'settings/fwdandpop')}>
                    2. Abrir Gmail
                  </OpenButton>
                </div>
              </Step>
              <Step n={2} done={working} title="Confirma con el código">
                {gmailCodeReceived ? (
                  <>
                    <p>
                      Gmail envió este código. Pégalo en Gmail donde dice{' '}
                      <b>«Código de verificación»</b> y toca <b>Verificar</b>:
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <b className="font-poppins text-2xl tracking-[0.2em]">{info.gmailCode}</b>
                      <CopyButton value={info.gmailCode ?? ''} label="Copiar código" big />
                    </div>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Esperando el código de Gmail…
                    aparecerá aquí solo.
                  </p>
                )}
              </Step>
              <Step n={3} done={working} title="Reenvía solo los avisos del banco">
                <p>
                  Abre la búsqueda de tu banco en Gmail, toca el ícono <b>de opciones</b> a la
                  derecha de la barra de búsqueda → <b>Crear filtro</b> → marca{' '}
                  <b>«Reenviarlo a»</b>, elige tu dirección MONEO y toca <b>Crear filtro</b>.
                </p>
                <OpenButton
                  href={gmailLink(mailbox, `search/${encodeURIComponent(BANK_EMAIL_FILTER)}`)}
                >
                  Abrir búsqueda en Gmail
                </OpenButton>
              </Step>
            </ol>
          )}

          {info && provider === 'outlook' && (
            <ol className="space-y-2">
              <Step n={1} done={working} title="Crea una regla en Outlook">
                <p>
                  Abre las reglas y toca <b>«Agregar nueva regla»</b> (nombre: MONEO).
                </p>
                <OpenButton href={OUTLOOK_RULES_URL}>Abrir reglas de Outlook</OpenButton>
              </Step>
              <Step n={2} done={working} title="Elige los bancos">
                <p>
                  Condición <b>«La dirección del remitente incluye»</b> y agrega uno por uno:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BANK_SENDER_KEYS.map((k) => (
                    <span
                      key={k}
                      className="flex items-center gap-1 rounded-lg border-2 border-black bg-gray-50 py-0.5 pl-2 pr-0.5"
                    >
                      <code className="text-xs font-bold">{k}</code>
                      <CopyButton value={k} label={`Copiar ${k}`} />
                    </span>
                  ))}
                </div>
              </Step>
              <Step n={3} done={working} title="Reenvía a MONEO">
                <p>
                  Acción <b>«Reenviar a»</b>, pega tu dirección MONEO y toca <b>Guardar</b>.
                </p>
                <CopyButton value={address} label="Copiar mi dirección" big />
              </Step>
            </ol>
          )}

          {info && provider === 'otro' && (
            <ol className="space-y-2">
              <Step n={1} done={working} title="Reenvía los avisos de tu banco">
                <p>
                  En la configuración de tu correo crea una regla de <b>reenvío automático</b> para
                  los correos de tu banco ({BANK_SENDER_KEYS.join(', ')}) hacia tu dirección MONEO.
                  También puedes reenviar un aviso a mano cuando quieras.
                </p>
                <CopyButton value={address} label="Copiar mi dirección" big />
              </Step>
            </ol>
          )}

          {info && (
            <>
              <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-black/40 px-3 py-2">
                <span className="text-xs font-bold text-gray-600">Tu dirección MONEO:</span>
                <code className="min-w-0 flex-1 break-all text-[12px] font-bold">{address}</code>
              </div>
              {!working && (
                <p className="text-xs text-gray-700">
                  Para probar, reenvía cualquier aviso de tu banco a tu dirección MONEO: aparecerá
                  en «Por revisar» al instante.
                </p>
              )}
              <p className="text-[11px] text-gray-600">
                Solo aceptamos correos de BCP, BBVA, Interbank y Yape. No guardamos el correo: solo
                el monto, comercio, fecha y últimos 4 dígitos.
              </p>
              <button
                type="button"
                onClick={() => activate(true)}
                disabled={busy}
                className="text-xs font-bold text-gray-600 underline"
              >
                Generar una dirección nueva
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
