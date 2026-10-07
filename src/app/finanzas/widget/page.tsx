'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, Loader2, ShieldCheck } from 'lucide-react';
import { getErrorMessage } from '@/lib/dataError';
import { isAndroidApp } from '@/lib/appShell';
import {
  androidDeviceName,
  androidLinkIntent,
  companionDevicesService,
} from '@/lib/supabaseCompanion';

// Widget de MONEO para Android. The widget opens this page (inside the app) to be linked:
// a device token is created and handed to the app through an intent only our package can
// receive. Elsewhere it explains how to add the widget.

export default function WidgetPage() {
  const [inApp, setInApp] = useState(false);
  const [state, setState] = useState<'idle' | 'linking' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setInApp(isAndroidApp() || /Android/i.test(navigator.userAgent));
  }, []);

  const link = async () => {
    setError('');
    setState('linking');
    try {
      const { token } = await companionDevicesService.link(
        androidDeviceName(navigator.userAgent),
        'android'
      );
      window.location.href = androidLinkIntent(token);
      setState('done');
    } catch (e) {
      setError(getErrorMessage(e));
      setState('idle');
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 text-[#111]">
      <Link
        href="/finanzas/configuracion"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> Configuración
      </Link>

      <div className="rounded-3xl border-[3px] border-black bg-[#FFD83D] p-5 shadow-[4px_4px_0_#111]">
        <p className="text-sm font-black">Widget de MONEO</p>
        <h1 className="mt-1 text-[26px] font-black leading-tight">Tu dinero, siempre a la vista</h1>
        <p className="mt-2 text-sm font-semibold">
          Mira cuánto puedes gastar hoy, tu próximo pago y tu meta desde la pantalla de inicio, sin
          abrir la app.
        </p>
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border-2 border-black bg-white p-4">
        <ShieldCheck className="h-5 w-5 shrink-0" />
        <p className="text-sm font-semibold">
          El widget empieza con los montos ocultos y solo puede ver tu resumen, nunca tus
          movimientos ni tus cuentas. Lo puedes desvincular cuando quieras en Configuración.
        </p>
      </div>

      {state === 'done' ? (
        <div className="mt-4 flex gap-3 rounded-2xl border-2 border-black bg-[#DCFCE7] p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#15803D]" />
          <p className="text-sm font-bold">
            ¡Listo! Vuelve a tu pantalla de inicio: el widget se actualiza en unos segundos.
          </p>
        </div>
      ) : inApp ? (
        <>
          <button
            type="button"
            onClick={link}
            disabled={state === 'linking'}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-[#111] py-3.5 text-base font-black text-white shadow-[0_4px_0_#FFD83D] disabled:opacity-60"
          >
            {state === 'linking' && <Loader2 className="h-5 w-5 animate-spin" />}
            Conectar el widget
          </button>
          {error && (
            <p className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
              {error}
            </p>
          )}
        </>
      ) : null}

      <section className="mt-6 rounded-2xl border-2 border-black bg-white p-4">
        <h2 className="text-base font-black">Cómo agregarlo</h2>
        <ol className="mt-2 space-y-2 text-sm font-semibold">
          <li>1. Instala la app MONEO+ en tu Android.</li>
          <li>2. Mantén presionada tu pantalla de inicio y toca «Widgets».</li>
          <li>3. Busca MONEO+ y arrastra el tamaño que prefieras.</li>
          <li>4. Toca «Conectar» en el widget y confirma aquí.</li>
        </ol>
        <p className="mt-3 text-xs font-semibold text-gray-600">
          En la laptop puedes usar MONEO Mini desde el menú lateral. Los widgets de iPhone y Windows
          llegan más adelante.
        </p>
      </section>
    </div>
  );
}
