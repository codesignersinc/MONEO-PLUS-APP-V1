'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import ContextSwitch from '@/components/business/ContextSwitch';
import NegocioBanner from '@/components/business/NegocioBanner';
import { negocioChanged, useNegocio } from '@/components/business/useNegocio';
import { BUSINESS_KINDS, lastBusinessId } from '@/lib/business';
import { businessService } from '@/lib/supabaseBusiness';

// MONEO NEGOCIO entry: opens the last business, or asks for the first one (beta).
function NegocioIndex() {
  const { enabled, businesses, loaded } = useNegocio();
  const router = useRouter();
  const params = useSearchParams();
  const adding = params.get('nuevo') === '1';
  const toast = useToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded || adding || businesses.length === 0) return;
    const last = lastBusinessId();
    const target = businesses.find((b) => b.id === last) ?? businesses[0];
    router.replace(`/finanzas/negocio/${target.id}`);
  }, [loaded, adding, businesses, router]);

  if (!loaded || (!adding && businesses.length > 0)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#111]" />
      </div>
    );
  }
  if (!enabled) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <p className="rounded-2xl border-2 border-[#111] bg-white p-5 text-center text-sm font-bold text-[#111]">
          MONEO NEGOCIO está en beta y todavía no está disponible para tu cuenta.
        </p>
      </div>
    );
  }

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const b = await businessService.create(name, kind);
      negocioChanged();
      router.replace(`/finanzas/negocio/${b.id}`);
    } catch (e) {
      toast.showError(e);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 text-[#111]">
      <ContextSwitch className="mb-6 lg:hidden" />
      <NegocioBanner className="mb-6" />
      <div className="rounded-3xl border-[3px] border-[#111] bg-[#FFD83D] p-6 shadow-[5px_5px_0_#111]">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border-[3px] border-[#111] bg-white shadow-[3px_3px_0_#111]">
          <Briefcase className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <p className="mt-4 text-xs font-black uppercase tracking-wide">MONEO NEGOCIO · beta</p>
        <h1 className="mt-1 text-[28px] font-black leading-tight">
          Las finanzas de tu negocio, sin complicarte
        </h1>
        <p className="mt-2 text-sm font-semibold">
          Separa el dinero de tu negocio del personal y mira cuánto entra, cuánto sale y cómo
          cerrarás el mes. Tus cuentas personales nunca se mezclan.
        </p>
      </div>

      <div className="mt-5 space-y-4 rounded-3xl border-2 border-[#111] bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase tracking-wide">
            Nombre del negocio
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Ej. Codesigners"
            className="w-full rounded-xl border-2 border-[#111] bg-white px-3 py-3 text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide">
            Rubro (opcional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {BUSINESS_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(kind === k ? null : k)}
                className={`rounded-xl border-2 border-[#111] px-3 py-1.5 text-xs font-bold ${
                  kind === k ? 'paper-opaque bg-[#111] text-white' : 'bg-white'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={saving || !name.trim()}
          className="paper-opaque flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#111] py-3.5 text-base font-black text-white shadow-[0_4px_0_#FFD83D] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-5 w-5 animate-spin" />}
          Crear mi negocio
        </button>
        {businesses.length > 0 && (
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full text-center text-sm font-bold underline"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

export default function NegocioPage() {
  return (
    <Suspense fallback={null}>
      <NegocioIndex />
    </Suspense>
  );
}
