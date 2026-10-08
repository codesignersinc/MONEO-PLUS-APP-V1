'use client';
import { PlusLocked } from '@/components/billing/PlusGate';
import ContextSwitch from '@/components/business/ContextSwitch';
import NegocioBanner from '@/components/business/NegocioBanner';
import { usePlus } from '@/contexts/PlusContext';

// MONEO NEGOCIO is included in paid MONEO PLUS (own plan or a Duo / Familiar seat); the free
// trial does not include it. Nothing is deleted while locked: it all comes back with PLUS.
export default function NegocioLayout({ children }: { children: React.ReactNode }) {
  const { business, ent } = usePlus();
  if (business) return <>{children}</>;
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-5 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <NegocioBanner className="mb-2" />
      <PlusLocked
        feature="MONEO NEGOCIO"
        description="Separa las finanzas de tu negocio de las personales: caja, cobros y pagos, clientes y proveedores, equipo y reportes en CSV y PDF."
      />
      <p className="text-center text-xs font-semibold text-[#111]/60">
        {ent?.kind === 'trial'
          ? 'La prueba gratis no incluye MONEO NEGOCIO: se activa con cualquier plan pagado.'
          : 'Se activa con cualquier plan pagado de MONEO PLUS. Si ya tenías un negocio, sus datos siguen guardados.'}
      </p>
    </div>
  );
}
