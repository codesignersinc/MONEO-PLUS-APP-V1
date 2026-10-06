'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/finance/BrandLogo';
import { autoService, type AutoSuggestion } from '@/lib/supabaseAuto';
import { notifyAutoSuggestion } from '@/lib/dataSync';
import { formatCurrency } from '@/lib/currency';

const BANK_LABEL: Record<string, string> = {
  bcp: 'BCP',
  bbva: 'BBVA',
  interbank: 'Interbank',
  yape: 'Yape',
  plin: 'Plin',
  scotiabank: 'Scotiabank',
  otro: 'Manual',
};

const TYPE_LABEL: Record<string, string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Transferencia',
};

// Listens (Supabase Realtime) for new MONEO AUTO suggestions while the user is anywhere in
// /finanzas: the inbox refreshes instantly and, outside it, a centered pop-up shows the
// detected movement with a button to review it. Also refreshes when the app comes back to
// the foreground, in case the socket was asleep (mobile background tabs).
export default function AutoLiveListener() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const userId: string | undefined = user?.id;
  // Movements detected since the pop-up opened (newest first).
  const [detected, setDetected] = useState<AutoSuggestion[]>([]);

  useEffect(() => {
    if (!userId) return;
    const stop = autoService.watch(userId, (s) => {
      notifyAutoSuggestion();
      if (
        s.source === 'email' &&
        s.status === 'pendiente' &&
        pathRef.current !== '/finanzas/auto'
      ) {
        setDetected((prev) => (prev.some((p) => p.id === s.id) ? prev : [s, ...prev]));
      }
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') notifyAutoSuggestion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [userId]);

  // Reaching the inbox (by the button or the menu) means the user has seen them.
  useEffect(() => {
    if (pathname === '/finanzas/auto') setDetected([]);
  }, [pathname]);

  const open = detected.length > 0;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDetected([]);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const latest = detected[0];
  const more = detected.length - 1;
  const close = () => setDetected([]);
  const goToInbox = () => {
    setDetected([]);
    router.push('/finanzas/auto');
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-live-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div className="animate-slide-up relative w-full max-w-sm rounded-[28px] border-[3px] border-black bg-[#FEF8EA] p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)]">
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border-[2.5px] border-black bg-white hover:bg-gray-50"
        >
          <X className="h-4 w-4 text-black" />
        </button>

        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-black bg-[#FFDF32]">
          <Sparkles className="h-7 w-7 text-black" />
        </div>
        <h2
          id="auto-live-title"
          className="mt-4 text-center font-poppins text-xl font-black text-black"
        >
          {detected.length > 1
            ? `${detected.length} movimientos detectados`
            : 'Nuevo movimiento detectado'}
        </h2>
        <p className="mt-1 text-center font-sans text-sm font-medium text-gray-700">
          MONEO AUTO recibió un aviso de tu banco. Revísalo para registrarlo.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border-[2.5px] border-black bg-white p-3.5">
          <BrandLogo
            kind="account"
            name={BANK_LABEL[latest.bank] ?? latest.bank}
            institution={BANK_LABEL[latest.bank] ?? latest.bank}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-poppins text-[15px] font-black text-black">
              {latest.merchant || BANK_LABEL[latest.bank]}
            </p>
            <p className="font-sans text-xs font-semibold text-gray-600">
              {TYPE_LABEL[latest.type] ?? latest.type} · {BANK_LABEL[latest.bank] ?? latest.bank}
            </p>
          </div>
          <p
            className={`shrink-0 font-poppins text-base font-black ${latest.type === 'ingreso' ? 'text-green-600' : 'text-black'}`}
          >
            {latest.type === 'ingreso' ? '+' : '−'}
            {formatCurrency(latest.amount, latest.currency)}
          </p>
        </div>
        {more > 0 && (
          <p className="mt-2 text-center font-sans text-xs font-semibold text-gray-600">
            y {more} {more === 1 ? 'movimiento más' : 'movimientos más'} por revisar
          </p>
        )}

        <button
          type="button"
          onClick={goToInbox}
          autoFocus
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 font-poppins text-base font-black text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Ir a MONEO AUTO <ArrowRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={close}
          className="mx-auto mt-3 block font-sans text-sm font-semibold text-gray-600 underline underline-offset-4 hover:text-black"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
