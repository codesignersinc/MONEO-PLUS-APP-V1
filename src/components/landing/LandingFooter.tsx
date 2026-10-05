import React from 'react';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { Wordmark } from './LandingNav';

type FooterLink = { label: string; href?: string };

// Links without href are pages that don't exist yet: shown as text, never as dead links.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Producto',
    links: [
      { label: 'Funciones', href: '#funciones' },
      { label: 'Juntas', href: '#juntas' },
      { label: 'Precios', href: '#precios' },
      { label: 'MONEO AUTO · pronto' },
    ],
  },
  {
    title: 'Compañía',
    links: [{ label: 'Sobre MONEO · pronto' }, { label: 'Blog · pronto' }],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacidad', href: '/privacidad' },
      { label: 'Términos', href: '/terminos' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Preguntas frecuentes', href: '#preguntas' },
      { label: 'Iniciar sesión', href: '/login' },
      { label: 'Crear cuenta', href: '/register' },
    ],
  },
];

const SOCIAL_LABELS: Record<keyof typeof SITE.social, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

export default function LandingFooter() {
  const social = (Object.keys(SITE.social) as (keyof typeof SITE.social)[])
    .map((k) => ({ label: SOCIAL_LABELS[k], href: SITE.social[k] }))
    .filter((s): s is { label: string; href: string } => !!s.href);

  return (
    <footer className="border-t-[3px] border-[#111] bg-[#FFF9EC] text-[#111]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
          <div className="col-span-2 lg:col-span-1">
            <Wordmark width={150} />
            <p className="mt-3 max-w-xs font-sans text-[14px] leading-relaxed text-[#444]">
              {SITE.tagline} Gastos, cuentas, metas y juntas en un solo lugar.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="font-poppins text-[13px] font-extrabold uppercase tracking-wide">
                {col.title}
              </h2>
              <ul className="mt-3 grid gap-2 font-sans text-[14px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href ? (
                      <Link href={l.href} className="text-[#333] hover:text-[#111] hover:underline">
                        {l.label}
                      </Link>
                    ) : (
                      <span className="text-[#888]">{l.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label="Redes sociales">
            <h2 className="font-poppins text-[13px] font-extrabold uppercase tracking-wide">
              Social
            </h2>
            <ul className="mt-3 grid gap-2 font-sans text-[14px]">
              {social.length ? (
                social.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#333] hover:text-[#111] hover:underline"
                    >
                      {s.label}
                    </a>
                  </li>
                ))
              ) : (
                <li className="text-[#888]">Muy pronto</li>
              )}
            </ul>
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t-2 border-[#111] pt-6 font-sans text-[13px] text-[#444] sm:flex-row sm:justify-between">
          <p>© 2026 MONEO. Todos los derechos reservados.</p>
          <p>Hecho con ❤️ en Perú.</p>
        </div>
      </div>
    </footer>
  );
}
