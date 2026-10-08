import Image from 'next/image';

// Cover of MONEO NEGOCIO: Moneo at the office. On phones the crop keeps him and the screen;
// wider screens show the whole scene. Not printed (reports stay on white paper).
export default function NegocioBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`paper-opaque relative aspect-[16/9] w-full overflow-hidden rounded-[22px] border-2 border-[#111] bg-[#111] shadow-[0_4px_0_#111] sm:aspect-[21/9] lg:aspect-[3/1] print:hidden ${className}`}
    >
      <Image
        src="/assets/images/onboarding/BANNER-negocios.jpg"
        alt="Moneo en su oficina revisando los ingresos y gastos de su negocio"
        fill
        priority
        sizes="(min-width: 1280px) 1100px, (min-width: 1024px) calc(100vw - 300px), 100vw"
        quality={85}
        className="object-cover object-[36%_center] sm:object-center"
      />
    </div>
  );
}
