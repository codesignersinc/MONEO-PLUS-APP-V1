'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, Check, ChevronDown, Plus, User } from 'lucide-react';
import { businessIdFromPath, lastBusinessId, rememberBusiness } from '@/lib/business';
import { useNegocio } from './useNegocio';

// Personal | Negocio switch (docs/moneo-negocio.md, decision 6). Personal is /finanzas;
// a business lives under /finanzas/negocio/<id>. It renders nothing while the beta is off.

export default function ContextSwitch({ className = '' }: { className?: string }) {
  const { enabled, businesses } = useNegocio();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentId = businessIdFromPath(pathname);
  const inBusiness = pathname.startsWith('/finanzas/negocio');
  const current = businesses.find((b) => b.id === currentId) ?? null;

  useEffect(() => {
    if (currentId) rememberBusiness(currentId);
  }, [currentId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!enabled) return null;

  const goBusiness = () => {
    if (inBusiness && businesses.length > 1) {
      setOpen((o) => !o);
      return;
    }
    if (inBusiness) return;
    const last = lastBusinessId();
    const target = businesses.find((b) => b.id === last) ?? businesses[0];
    router.push(target ? `/finanzas/negocio/${target.id}` : '/finanzas/negocio');
  };

  const seg = (active: boolean) =>
    `flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF] ${
      active
        ? 'paper-opaque border-2 border-[#111] bg-[#111] text-white'
        : 'border-2 border-transparent text-[#111] hover:bg-[#FFF9EC]'
    }`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        role="group"
        aria-label="Contexto"
        className="flex items-center gap-1 rounded-2xl border-2 border-[#111] bg-white p-1"
      >
        <button
          type="button"
          aria-pressed={!inBusiness}
          onClick={() => !inBusiness || router.push('/finanzas')}
          className={seg(!inBusiness)}
        >
          <User className="h-4 w-4 shrink-0" strokeWidth={2.5} /> Personal
        </button>
        <button
          type="button"
          aria-pressed={inBusiness}
          aria-haspopup={inBusiness && businesses.length > 1 ? 'menu' : undefined}
          aria-expanded={inBusiness && businesses.length > 1 ? open : undefined}
          onClick={goBusiness}
          className={seg(inBusiness)}
        >
          <Briefcase className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span className="truncate">{inBusiness && current ? current.name : 'Negocio'}</span>
          {inBusiness && businesses.length > 1 && <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
      </div>
      {open && (
        <div
          role="menu"
          className="paper-opaque absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl border-2 border-[#111] bg-white p-1.5 shadow-[0_4px_0_#111]"
        >
          {businesses.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitemradio"
              aria-checked={b.id === currentId}
              onClick={() => {
                setOpen(false);
                router.push(`/finanzas/negocio/${b.id}`);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[#FFF9EC]"
            >
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              {b.id === currentId && <Check className="h-4 w-4" strokeWidth={2.5} />}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push('/finanzas/negocio?nuevo=1');
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-[#111]/10 px-3 py-2 text-left text-sm font-bold hover:bg-[#FFF9EC]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Agregar negocio
          </button>
        </div>
      )}
    </div>
  );
}
