'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Crown, Loader2, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { notifyAutoSuggestion } from '@/lib/dataSync';
import { MAIL_RETURN_MESSAGES, mailService, type MailStatus } from '@/lib/mailConnect';

// "Conectar Gmail": MONEO AUTO reads the bank emails straight from the user's Gmail
// (read-only), with no forwarding to set up. While Google has not verified the app, its
// consent screen shows an "unverified app" warning: a short guide explains how to continue.
// Hidden when the server is not configured.

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

const BTN =
  'flex items-center justify-center gap-2 rounded-xl border-[3px] border-black px-4 py-2.5 text-sm font-black shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50';

function GuideStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black text-sm font-black text-white">
        {n}
      </span>
      <span className="pt-0.5 text-sm text-gray-800">{children}</span>
    </li>
  );
}

function ConnectGuide({
  onClose,
  onContinue,
  busy,
}: {
  onClose: () => void;
  onContinue: () => void;
  busy: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-guide-title"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_rgba(0,0,0,1)] sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id="gmail-guide-title" className="text-lg font-black text-black">
            Así se conecta tu Gmail
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg border-2 border-black p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 rounded-2xl bg-[#FFF4CC] p-3 text-[13px] text-gray-900">
          MONEO+ está en <b>beta</b> y Google aún no termina de revisarla, por eso verás un aviso de
          &quot;app no verificada&quot;. Es normal: solo pedimos permiso de lectura.
        </p>
        <ol className="space-y-3">
          <GuideStep n={1}>Elige tu cuenta de Gmail.</GuideStep>
          <GuideStep n={2}>
            Verás el aviso &quot;Google no verificó esta app&quot;. Toca{' '}
            <b>Configuración avanzada</b> y luego el enlace de abajo,{' '}
            <b>Ir a moneo.plus (no seguro)</b>.
          </GuideStep>
          <GuideStep n={3}>
            Revisa que diga &quot;Ver mensajes de correo electrónico&quot; y toca <b>Continuar</b>.
            Si aparece una casilla, márcala.
          </GuideStep>
        </ol>
        <ul className="mt-4 space-y-1.5 rounded-2xl border-2 border-black p-3 text-[13px] text-gray-800">
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" /> Solo leemos los correos de
            BCP, BBVA, Interbank y Yape.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" /> No guardamos tus correos:
            solo el monto, el comercio y la fecha.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" /> No podemos enviar, borrar ni
            modificar nada. Desconéctalo cuando quieras.
          </li>
        </ul>
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          className={`${BTN} mt-5 w-full bg-[#FFD43B] text-black`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Entendido, conectar Gmail
        </button>
      </div>
    </div>
  );
}

export default function AutoGmailCard() {
  const toast = useToast();
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);

  const load = useCallback(async (syncNow: boolean) => {
    try {
      const s = await mailService.status();
      setStatus(s);
      if (syncNow && s.plus && s.connection?.status === 'active') {
        // Opening MONEO AUTO reads new emails right away (the server throttles it).
        const found = await mailService.sync().catch(() => 0);
        if (found > 0) {
          notifyAutoSuggestion();
          setStatus(await mailService.status());
        }
      }
    } catch {
      // The card simply stays hidden if the status cannot be read.
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    // Back from Google's consent screen: /finanzas/auto?correo=conectado|cancelado|…
    const params = new URLSearchParams(window.location.search);
    const result = params.get('correo');
    if (result) {
      const msg = MAIL_RETURN_MESSAGES[result] ?? MAIL_RETURN_MESSAGES.error;
      if (msg.ok) {
        toast.showSuccess(msg.text);
        notifyAutoSuggestion();
      } else {
        toast.showError(msg.text);
      }
      params.delete('correo');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    }
    load(!result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const connect = async () => {
    setBusy('connect');
    try {
      window.location.assign(await mailService.connectUrl());
    } catch (err) {
      toast.showError(err);
      setBusy(null);
      setGuide(false);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    try {
      const found = await mailService.sync();
      if (found > 0) notifyAutoSuggestion();
      toast.showSuccess(
        found > 0
          ? `Encontramos ${found} movimiento${found === 1 ? '' : 's'} nuevo${found === 1 ? '' : 's'}.`
          : 'Revisamos tu Gmail: no hay movimientos nuevos.'
      );
      setStatus(await mailService.status());
    } catch (err) {
      toast.showError(err);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar tu Gmail? MONEO AUTO dejará de leer tus correos.')) return;
    setBusy('disconnect');
    try {
      await mailService.disconnect();
      setStatus(await mailService.status());
      toast.showSuccess('Gmail desconectado.');
    } catch (err) {
      toast.showError(err);
    } finally {
      setBusy(null);
    }
  };

  if (!status?.configured) return null;
  const conn = status.connection;

  return (
    <section className="mb-6 rounded-3xl border-[3px] border-black bg-[#E0EDFF] p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border-2 border-black bg-white">
          <Mail className="h-5 w-5 text-black" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black text-black">Gmail automático</h2>
            <span className="rounded-full border-2 border-black bg-[#FFD43B] px-2 text-[11px] font-black">
              BETA
            </span>
          </div>

          {!status.plus && (
            <>
              <p className="mt-1 text-[13px] text-gray-800">
                {conn?.status === 'active'
                  ? `En pausa: ${conn.emailHint} sigue conectado, pero solo leemos tu Gmail con un plan pagado de MONEO PLUS.`
                  : 'Conecta tu Gmail y los avisos de BCP, BBVA, Interbank y Yape aparecerán aquí solos. Disponible con un plan pagado de MONEO PLUS (no incluido en la prueba gratis).'}
              </p>
              <Link
                href="/finanzas/plus"
                className={`${BTN} mt-3 inline-flex bg-[#FFD43B] text-black`}
              >
                <Crown className="h-4 w-4" /> Ver planes
              </Link>
            </>
          )}

          {status.plus && !conn && (
            <>
              <p className="mt-1 text-[13px] text-gray-800">
                Conecta tu Gmail y los movimientos de tus avisos de BCP, BBVA, Interbank y Yape
                aparecerán aquí solos. Sin reenvíos ni configuraciones.
              </p>
              <button
                type="button"
                onClick={() => setGuide(true)}
                className={`${BTN} mt-3 bg-[#FFD43B] text-black`}
              >
                <Mail className="h-4 w-4" /> Conectar Gmail
              </button>
            </>
          )}

          {status.plus && conn?.status === 'active' && (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-gray-800">
                <Check className="h-4 w-4 text-green-600" /> Conectado: <b>{conn.emailHint}</b>
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {conn.lastSyncAt ? `Revisado ${ago(conn.lastSyncAt)}` : 'Revisando…'} · se revisa
                cada 5 minutos
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={busy !== null}
                  className={`${BTN} bg-white text-black`}
                >
                  {busy === 'sync' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Revisar ahora
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy !== null}
                  className="rounded-xl px-3 py-2 text-sm font-black text-gray-700 underline disabled:opacity-50"
                >
                  Desconectar
                </button>
              </div>
            </>
          )}

          {status.plus && conn?.status === 'revoked' && (
            <>
              <p className="mt-1 text-[13px] text-gray-800">
                Se perdió el acceso a <b>{conn.emailHint}</b> (se retiró el permiso en Google).
                Vuelve a conectarlo para seguir recibiendo tus movimientos.
              </p>
              <button
                type="button"
                onClick={() => setGuide(true)}
                className={`${BTN} mt-3 bg-[#FFD43B] text-black`}
              >
                <Mail className="h-4 w-4" /> Volver a conectar
              </button>
            </>
          )}
        </div>
      </div>
      {guide && (
        <ConnectGuide
          busy={busy === 'connect'}
          onClose={() => setGuide(false)}
          onContinue={connect}
        />
      )}
    </section>
  );
}
