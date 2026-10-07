'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Smartphone } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { companionDevicesService, type CompanionDevice } from '@/lib/supabaseCompanion';

// Configuración → "Widgets y dispositivos": what is linked to MONEO Companion, with a way to
// cut any device off at once (a lost phone, a sold laptop).

function ago(iso: string | null): string {
  if (!iso) return 'Aún no se ha usado';
  const d = new Date(iso);
  return `Último uso: ${d.toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

export default function CompanionDevices() {
  const toast = useToast();
  const [devices, setDevices] = useState<CompanionDevice[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    companionDevicesService
      .list()
      .then((d) => {
        setDevices(d);
        setError('');
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const revoke = async (d: CompanionDevice) => {
    if (!window.confirm(`¿Desvincular «${d.name}»? Su widget dejará de mostrar tus datos.`)) return;
    setBusy(d.id);
    try {
      await companionDevicesService.revoke(d.id);
      toast.showSuccess('Dispositivo desvinculado.');
      load();
    } catch (e) {
      toast.showError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 bg-[#C084FC] border-[3px] border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#000]">
          <Smartphone className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-black text-black uppercase tracking-wide">
          Widgets y dispositivos
        </p>
      </div>
      <p className="mb-4 text-xs font-semibold text-gray-600">
        Equipos con el widget de MONEO. Solo pueden ver tu resumen, nunca tus movimientos.
      </p>
      {error ? (
        <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
          {error}
        </p>
      ) : !devices ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : devices.length === 0 ? (
        <p className="text-sm font-semibold text-gray-700">Ningún dispositivo vinculado.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border-[3px] border-black bg-[#FFF9EC] px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-black">{d.name}</span>
                <span className="block text-[11px] font-semibold text-gray-600">
                  {ago(d.lastSeenAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revoke(d)}
                disabled={busy === d.id}
                className="shrink-0 rounded-lg border-2 border-black bg-[#FEE2E2] px-2.5 py-1 text-xs font-black text-black disabled:opacity-50"
              >
                {busy === d.id ? 'Desvinculando…' : 'Desvincular'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/finanzas/widget"
        className="mt-3 flex items-center gap-2 rounded-xl border-[3px] border-black bg-white px-3 py-3 text-sm font-black text-black shadow-[3px_3px_0px_#000]"
      >
        <span className="text-xl">📲</span> Agregar el widget a tu celular
        <ChevronRight className="ml-auto h-4 w-4" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
