'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, ShieldCheck, Smartphone, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  BillingError,
  billingService,
  paymentsService,
  rejectionMessage,
  type BillingPlan,
  type CardData,
  type PayMethod,
  type PayResult,
} from '@/lib/billing';
import { track } from '@/lib/analytics';
import { formatMoney } from '@/lib/format';

// Checkout inside MONEO with the official Mercado Pago SDK: the card is typed in Mercado
// Pago's secure fields (Card Payment Brick) and Yape in its own form; both only hand us a
// one-use token. MONEO never sees nor stores card data. PLUS is granted by the server when
// Mercado Pago approves the payment.
//   Subscriptions (monthly / yearly) → card only (they renew).
//   Passes and lifetime → card, Yape or PagoEfectivo (paid once).

interface MercadoPagoSdk {
  bricks(): {
    create(
      kind: 'cardPayment',
      container: string,
      settings: Record<string, unknown>
    ): Promise<{ unmount(): void }>;
  };
  yape(options: { otp: string; phoneNumber: string }): { create(): Promise<{ id: string }> };
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoSdk;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error('sdk'));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

let mpInstance: { key: string; mp: MercadoPagoSdk } | null = null;

async function getMp(): Promise<MercadoPagoSdk> {
  const key = await paymentsService.publicKey();
  if (!key) throw new BillingError('payments-not-configured');
  await loadSdk();
  if (!mpInstance || mpInstance.key !== key) {
    mpInstance = { key, mp: new window.MercadoPago!(key, { locale: 'es-PE' }) };
  }
  return mpInstance.mp;
}

const money = (n: number) => formatMoney(n);

const TAB =
  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-sm font-black transition-colors';

export default function CheckoutPanel({
  plan,
  trial,
  onApproved,
}: {
  plan: BillingPlan;
  // The subscription starts with its free days (nothing is charged today).
  trial: boolean;
  onApproved: () => void;
}) {
  const subscription = plan.kind === 'subscription';
  const [method, setMethod] = useState<PayMethod>('card');
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subscription) setMethod('card');
    setResult(null);
    setError('');
  }, [plan.code, subscription]);

  const handle = useCallback(
    (r: PayResult) => {
      setResult(r);
      if (r.status === 'approved') {
        track('payment_approved', { plan: plan.code, method });
        onApproved();
      } else if (r.status === 'rejected') {
        track('payment_failed', { plan: plan.code, stage: method });
        setError(rejectionMessage(r.detail));
      }
    },
    [onApproved, plan.code, method]
  );

  const fail = (err: unknown) => {
    if (typeof err === 'string') return setError(err);
    const e = err instanceof BillingError ? err : new BillingError('unknown');
    setError(e.userMessage);
  };

  return (
    <div className="rounded-3xl border-[3px] border-[#111] bg-white p-4 shadow-[4px_4px_0_#111] sm:p-5">
      {!subscription && (
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Medio de pago">
          {(
            [
              ['card', 'Tarjeta', CreditCard],
              ['yape', 'Yape', Smartphone],
              ['pagoefectivo', 'Efectivo', Store],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={method === id}
              onClick={() => {
                setMethod(id);
                setError('');
                setResult(null);
              }}
              className={`${TAB} ${method === id ? 'border-[#111] bg-[#FFD83D] text-[#111]' : 'border-gray-200 bg-white text-gray-600'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {result?.status === 'approved' ? (
        <p className="rounded-2xl bg-[#DDF7E9] p-4 text-center font-black text-[#067647]">
          ¡Listo! MONEO PLUS está activo.
        </p>
      ) : method === 'card' ? (
        <CardForm
          plan={plan}
          trial={trial}
          onResult={handle}
          onError={fail}
          onReset={() => setError('')}
        />
      ) : method === 'yape' ? (
        <YapeForm plan={plan} onResult={handle} onError={fail} />
      ) : (
        <CashForm plan={plan} result={result} onResult={handle} onError={fail} />
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-2xl bg-[#FFE1DB] p-3 text-sm font-black text-[#B42318]"
        >
          {error}
        </p>
      )}
      {result?.status !== 'approved' && <RedirectFallback plan={plan} />}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-gray-600">
        <ShieldCheck className="h-4 w-4 shrink-0" /> Procesado por Mercado Pago. MONEO nunca ve ni
        guarda tu tarjeta.
      </p>
    </div>
  );
}

function CardForm({
  plan,
  trial,
  onResult,
  onError,
  onReset,
}: {
  plan: BillingPlan;
  trial: boolean;
  onResult: (r: PayResult) => void;
  onError: (e: unknown) => void;
  onReset: () => void;
}) {
  const { user } = useAuth();
  const containerId = `card-brick-${plan.code}`;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const handlers = useRef({ onResult, onError, onReset });
  handlers.current = { onResult, onError, onReset };

  useEffect(() => {
    let controller: { unmount(): void } | null = null;
    let cancelled = false;
    setReady(false);
    setLoadError('');
    (async () => {
      try {
        const mp = await getMp();
        if (cancelled) return;
        controller = await mp.bricks().create('cardPayment', containerId, {
          initialization: { amount: plan.price, payer: { email: user?.email ?? '' } },
          customization: {
            paymentMethods: { maxInstallments: 1 },
            visual: { hideFormTitle: true, style: { theme: 'default' } },
          },
          callbacks: {
            onReady: () => !cancelled && setReady(true),
            onError: () => {
              // Field validation messages are shown by the brick itself.
            },
            onSubmit: async (data: {
              token: string;
              payment_method_id: string;
              issuer_id?: string;
              installments?: number;
              payer?: { identification?: { type: string; number: string } };
            }) => {
              handlers.current.onReset();
              const card: CardData = {
                token: data.token,
                paymentMethodId: data.payment_method_id,
                issuerId: data.issuer_id,
                installments: data.installments,
                identification: data.payer?.identification,
              };
              try {
                handlers.current.onResult(await paymentsService.pay(plan.code, 'card', card));
              } catch (err) {
                handlers.current.onError(err);
              }
            },
          },
        });
        if (cancelled) controller.unmount();
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof BillingError
              ? err.userMessage
              : 'No pudimos cargar el formulario de pago. Revisa tu conexión.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      controller?.unmount();
    };
  }, [plan.code, plan.price, containerId, user?.email]);

  return (
    <div>
      {plan.kind === 'subscription' && (
        <p className="mb-3 rounded-2xl bg-[#FFF4CC] p-3 text-[13px] font-semibold text-gray-900">
          {trial
            ? `Hoy no se cobra nada. Al terminar tus ${plan.trialDays} días gratis se cobrará ${money(plan.price)} y luego ${plan.intervalMonths === 12 ? 'cada año' : 'cada mes'}. Cancela cuando quieras.`
            : `Se cobrará ${money(plan.price)} hoy y luego ${plan.intervalMonths === 12 ? 'cada año' : 'cada mes'}. Cancela cuando quieras.`}
        </p>
      )}
      {loadError ? (
        <p className="rounded-2xl bg-[#FFE1DB] p-3 text-sm font-black text-[#B42318]">
          {loadError}
        </p>
      ) : (
        <>
          {!ready && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando pago seguro…
            </p>
          )}
          <div id={containerId} />
        </>
      )}
    </div>
  );
}

function YapeForm({
  plan,
  onResult,
  onError,
}: {
  plan: BillingPlan;
  onResult: (r: PayResult) => void;
  onError: (e: unknown) => void;
}) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const validPhone = /^9\d{8}$|^1{8}\d$/.test(phone);
  const validOtp = /^\d{6}$/.test(otp);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validPhone || !validOtp) return;
    setBusy(true);
    try {
      const mp = await getMp();
      const token = await mp.yape({ otp, phoneNumber: phone }).create();
      onResult(await paymentsService.pay(plan.code, 'yape', { token: token.id }));
      setOtp('');
    } catch (err) {
      // An invalid or expired approval code fails while creating the token.
      onError(
        err instanceof BillingError
          ? err
          : 'Yape no aceptó el código. Genera uno nuevo en la app y vuelve a intentarlo.'
      );
    } finally {
      setBusy(false);
    }
  };

  const input =
    'mt-1.5 min-h-[50px] w-full rounded-2xl border-[3px] border-[#111] bg-white px-4 text-lg font-black tracking-wider text-[#111] outline-none focus:ring-2 focus:ring-[#75B8FF]';
  return (
    <form onSubmit={submit} className="space-y-3">
      <ol className="space-y-1 rounded-2xl bg-[#F3EEFF] p-3 text-[13px] font-semibold text-gray-900">
        <li>1. Abre Yape y toca el menú → «Código de aprobación».</li>
        <li>2. Escribe aquí tu celular y ese código de 6 dígitos.</li>
      </ol>
      <label className="block text-xs font-black uppercase tracking-wide text-[#111]">
        Celular de Yape
        <input
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={9}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="9XXXXXXXX"
          className={input}
        />
      </label>
      <label className="block text-xs font-black uppercase tracking-wide text-[#111]">
        Código de aprobación
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          className={input}
        />
      </label>
      <button
        type="submit"
        disabled={busy || !validPhone || !validOtp}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#7B2CBF] py-3 text-base font-black text-white shadow-[3px_3px_0_#111] disabled:opacity-50"
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />} Pagar {money(plan.price)} con Yape
      </button>
    </form>
  );
}

function CashForm({
  plan,
  result,
  onResult,
  onError,
}: {
  plan: BillingPlan;
  result: PayResult | null;
  onResult: (r: PayResult) => void;
  onError: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (result?.status === 'pending') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-base font-black text-[#111]">Tu código de pago está listo</p>
        <p className="text-sm font-semibold text-gray-700">
          Págalo en agentes, bodegas o tu banca por internet (PagoEfectivo) en las próximas 48 h.
          MONEO PLUS se activa solo cuando se confirme el pago.
        </p>
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3 text-base font-black text-[#111] shadow-[3px_3px_0_#111]"
          >
            Ver mi código de pago <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-[#E0EDFF] p-3 text-[13px] font-semibold text-gray-900">
        Genera un código y págalo en efectivo en agentes y bodegas, o desde tu banca por internet.
        Se activa al confirmarse el pago (puede tardar unas horas).
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            onResult(await paymentsService.pay(plan.code, 'pagoefectivo'));
          } catch (err) {
            onError(err);
          } finally {
            setBusy(false);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3 text-base font-black text-[#111] shadow-[3px_3px_0_#111] disabled:opacity-50"
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />} Generar código de {money(plan.price)}
      </button>
    </div>
  );
}

// Backup: pay on Mercado Pago's own page (its checkout also offers Yape and saved cards).
function RedirectFallback({ plan }: { plan: BillingPlan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            track('checkout_started', { plan: plan.code, method: 'redirect' });
            window.location.href = (await billingService.checkout(plan.code)).url;
          } catch (err) {
            setError(
              err instanceof BillingError
                ? err.userMessage
                : new BillingError('unknown').userMessage
            );
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1.5 text-[13px] font-black text-gray-700 underline disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        ¿Problemas? Pagar en la página de Mercado Pago <ExternalLink className="h-3.5 w-3.5" />
      </button>
      {error && <p className="mt-1 text-xs font-black text-[#B42318]">{error}</p>}
    </div>
  );
}
