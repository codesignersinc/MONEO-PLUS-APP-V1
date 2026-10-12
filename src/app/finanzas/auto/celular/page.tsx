'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, CheckCircle2, ChevronLeft, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import PlusGate from '@/components/billing/PlusGate';
import { getErrorMessage } from '@/lib/dataError';
import { isAndroidApp } from '@/lib/appShell';
import {
  ANDROID_AUTO_OFF_INTENT,
  androidAutoIntent,
  androidDeviceName,
  companionDevicesService,
} from '@/lib/supabaseCompanion';

// MONEO AUTO on Android: the consent screen Google Play requires before asking for Android's
// "Acceso a notificaciones" (prominent disclosure). It says exactly what is read, what is sent
// and what is kept, and only then links the phone (create_companion_auto_device) and hands the
// token to the app (AutoLinkActivity), which opens Android's own permission screen.

const BANKS = ['Yape', 'BCP', 'Interbank', 'BBVA'];

export default function AutoCelularPage() {
  return (
    <PlusGate
      feature="MONEO AUTO"
      description="Tus gastos se anotan solos cuando tu banco te avisa en el celular."
    >
      <AutoCelular />
    </PlusGate>
  );
}

function AutoCelular() {
  const [android, setAndroid] = useState(false);
  const [state, setState] = useState<'idle' | 'linking' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setAndroid(isAndroidApp() || /Android/i.test(navigator.userAgent));
  }, []);

  const enable = async () => {
    setError('');
    setState('linking');
    try {
      const { token } = await companionDevicesService.linkAuto(
        androidDeviceName(navigator.userAgent)
      );
      window.location.href = androidAutoIntent(token);
      setState('done');
    } catch (e) {
      setError(getErrorMessage(e));
      setState('idle');
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 text-[#111]">
      <Link
        href="/finanzas/auto"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> MONEO AUTO
      </Link>

      <div className="rounded-3xl border-[3px] border-black bg-[#FFD83D] p-5 shadow-[4px_4px_0_#111]">
        <p className="text-sm font-black">MONEO AUTO en tu celular</p>
        <h1 className="mt-1 text-[26px] font-black leading-tight">
          Tus gastos se anotan solos cuando tu banco te avisa
        </h1>
        <p className="mt-2 text-sm font-semibold">
          Cuando te llega «Yapeaste S/ 18» o «Consumo de S/ 45 en Tambo», MONEO te avisa «Gasto
          detectado» y lo registras con un toque.
        </p>
      </div>

      <section className="mt-4 rounded-2xl border-2 border-black bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-black">
          <BellRing className="h-5 w-5" aria-hidden /> Qué lee MONEO+ y qué hace con eso
        </h2>
        <ul className="mt-2 space-y-2 text-sm font-semibold">
          <li>
            • Para funcionar, MONEO+ necesita el permiso de Android <b>«Acceso a notificaciones»</b>
            . Con él lee <b>solo</b> las notificaciones de las apps de {BANKS.join(', ')}. Las de
            las demás apps (WhatsApp, correo, redes) se ignoran sin leerlas.
          </li>
          <li>
            • El título y el texto de cada aviso de tu banco se envían cifrados a MONEO+ para
            detectar el monto, la moneda, el comercio o la persona, la fecha y la hora.
          </li>
          <li>
            • <b>No guardamos el texto del aviso.</b> Solo queda la sugerencia en MONEO AUTO, y nada
            se registra sin que lo confirmes.
          </li>
          <li>• No lee códigos de seguridad, números completos de tarjeta ni tus claves.</li>
        </ul>
      </section>

      <div className="mt-4 flex gap-3 rounded-2xl border-2 border-black bg-white p-4">
        <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
        <p className="text-sm font-semibold">
          Puedes apagarlo cuando quieras: aquí abajo, quitando el permiso en los ajustes de Android
          o desvinculando el celular en Configuración → Widgets y dispositivos. Más detalles en la{' '}
          <Link href="/privacidad" className="underline">
            Política de privacidad
          </Link>
          .
        </p>
      </div>

      {state === 'done' ? (
        <div className="mt-4 flex gap-3 rounded-2xl border-2 border-black bg-[#DCFCE7] p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#15803D]" aria-hidden />
          <p className="text-sm font-bold">
            Casi listo: en la pantalla de Android que se abrió, activa <b>MONEO+</b> en «Acceso a
            notificaciones». Desde tu próximo aviso del banco, MONEO te lo sugiere aquí.
          </p>
        </div>
      ) : android ? (
        <>
          <button
            type="button"
            onClick={enable}
            disabled={state === 'linking'}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-[#111] py-3.5 text-base font-black text-white shadow-[0_4px_0_#FFD83D] disabled:opacity-60"
          >
            {state === 'linking' && <Loader2 className="h-5 w-5 animate-spin" />}
            Aceptar y activar
          </button>
          <p className="mt-2 text-center text-xs font-semibold text-gray-600">
            Al aceptar, Android te pedirá el permiso «Acceso a notificaciones».
          </p>
          {error && (
            <p className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
              {error}
            </p>
          )}
          <a
            href={ANDROID_AUTO_OFF_INTENT}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-black bg-white py-3 text-sm font-black"
          >
            <EyeOff className="h-4 w-4" aria-hidden /> Apagar MONEO AUTO en este celular
          </a>
        </>
      ) : (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-black bg-white p-4 text-sm font-semibold">
          Esto funciona en la app MONEO+ para Android. Ábrela en tu celular y entra a MONEO AUTO →
          «Activar en mi celular». En la computadora puedes reenviar los correos de tu banco o
          conectar tu Gmail.
        </p>
      )}
    </div>
  );
}
