'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Mail, RefreshCw } from 'lucide-react';
import { addressService, BANK_EMAIL_FILTER, type AutoAddress } from '@/lib/supabaseAuto';
import { getErrorMessage } from '@/lib/dataError';

// "Correo automático": the user's private forwarding address and the Gmail steps to
// forward only bank notices to it. Hidden until NEXT_PUBLIC_AUTO_EMAIL_ENABLED=true
// (the inbound domain auto.moneo.plus must be live first).
export const AUTO_EMAIL_ENABLED = process.env.NEXT_PUBLIC_AUTO_EMAIL_ENABLED === 'true';

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
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
      className="flex shrink-0 items-center gap-1 rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-black"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export default function AutoEmailCard() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<AutoAddress | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    addressService
      .get()
      .then(setInfo)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (AUTO_EMAIL_ENABLED) load();
  }, [load]);

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

  const recentCode =
    info?.gmailCode &&
    info.gmailCodeAt &&
    Date.now() - new Date(info.gmailCodeAt).getTime() < 48 * 3600e3
      ? info.gmailCode
      : null;

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
          {info === null && (
            <>
              <p className="text-gray-700">
                Te damos una dirección privada. Reenvía ahí los correos de tu banco (BCP, BBVA,
                Interbank, Yape) y aparecerán en «Por revisar» para que solo los apruebes. No leemos
                tu bandeja: solo recibimos los correos que tú reenvías.
              </p>
              <button
                type="button"
                onClick={() => activate()}
                disabled={busy}
                className="rounded-xl border-[3px] border-black bg-[#FFD43B] px-4 py-2 font-black shadow-[3px_3px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {busy ? 'Creando…' : 'Activar mi dirección'}
              </button>
            </>
          )}
          {info && (
            <>
              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-wide">Tu dirección</p>
                <div className="flex items-center gap-2 rounded-xl border-2 border-black bg-white px-3 py-2">
                  <code className="min-w-0 flex-1 break-all text-[13px] font-bold">
                    {info.address}
                  </code>
                  <CopyButton value={info.address} label="Copiar dirección" />
                </div>
              </div>

              <ol className="list-decimal space-y-2 pl-5 text-[13px] text-gray-800">
                <li>
                  En Gmail (computadora):{' '}
                  <b>
                    ⚙️ → Ver toda la configuración → Reenvío y correo POP/IMAP → Añadir una
                    dirección de reenvío
                  </b>
                  , y pega tu dirección.
                </li>
                <li>
                  Gmail enviará un código de confirmación a tu dirección de MONEO.{' '}
                  {recentCode ? (
                    <span className="inline-flex items-center gap-2">
                      Tu código: <b className="text-base tracking-widest">{recentCode}</b>
                      <CopyButton value={recentCode} label="Copiar código" />
                    </span>
                  ) : (
                    <span>
                      Aparecerá aquí.{' '}
                      <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-1 font-bold underline"
                      >
                        <RefreshCw className="h-3 w-3" /> Actualizar
                      </button>
                    </span>
                  )}
                </li>
                <li>
                  Crea un filtro: en la búsqueda de Gmail pega esto, toca <b>Crear filtro</b> y
                  marca <b>Reenviarlo a</b> tu dirección de MONEO.
                  <div className="mt-1 flex items-center gap-2 rounded-xl border-2 border-black bg-white px-3 py-2">
                    <code className="min-w-0 flex-1 break-all text-[12px]">
                      {BANK_EMAIL_FILTER}
                    </code>
                    <CopyButton value={BANK_EMAIL_FILTER} label="Copiar filtro" />
                  </div>
                </li>
              </ol>
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
