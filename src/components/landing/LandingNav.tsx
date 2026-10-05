'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { track } from '@/lib/analytics';
import MoneoLogo from '@/components/ui/MoneoLogo';
import { btnPrimary } from './ui';

const LINKS = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#juntas', label: 'Juntas' },
  { href: '#seguridad', label: 'Seguridad' },
  { href: '#precios', label: 'Precios' },
  { href: '#preguntas', label: 'Preguntas' },
];

// Full MONEO logo (same SVG as the app sidebar), not the square icon.
export function Wordmark({ width = 120 }: { width?: number }) {
  return <MoneoLogo width={width} height={Math.round((width * 313.29) / 857.69)} />;
}

// Sticky top bar; on mobile the links live in a full-width drawer.
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onSection = (href: string) => {
    if (href === '#precios') track('pricing_click', { from: 'nav' });
    if (href === '#juntas') track('juntas_click', { from: 'nav' });
    setOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b-[3px] transition-colors ${
        scrolled || open ? 'border-[#111] bg-[#FFF9EC]' : 'border-transparent bg-[#FFF9EC]/90'
      }`}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a href="#inicio" className="text-[#111]" aria-label="MONEO, ir al inicio">
          <Wordmark />
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => onSection(l.href)}
                className="rounded-xl px-3 py-2 font-poppins text-[14px] font-bold text-[#111] hover:bg-[#FFD83D]/60"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            onClick={() => track('login_click', { from: 'nav' })}
            className="rounded-xl px-3 py-2 font-poppins text-[14px] font-bold text-[#111] hover:underline"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            onClick={() => track('register_click', { from: 'nav' })}
            className={`${btnPrimary} !px-4 !py-2 !text-[14px] !shadow-[3px_3px_0_#111]`}
          >
            Empezar gratis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="grid h-11 w-11 place-items-center rounded-xl border-[2.5px] border-[#111] bg-white shadow-[2px_2px_0_#111] lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div
          id="lp-mobile-menu"
          className="border-t-[3px] border-[#111] bg-[#FFF9EC] px-4 pb-6 pt-3 lg:hidden"
        >
          <ul className="grid gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => onSection(l.href)}
                  className="block rounded-xl px-3 py-3 font-poppins text-[17px] font-bold text-[#111] active:bg-[#FFD83D]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3">
            <Link
              href="/register"
              onClick={() => track('register_click', { from: 'nav_mobile' })}
              className={`${btnPrimary} w-full`}
            >
              Empezar gratis →
            </Link>
            <Link
              href="/login"
              onClick={() => track('login_click', { from: 'nav_mobile' })}
              className="block rounded-2xl border-[3px] border-[#111] bg-white py-3 text-center font-poppins text-[15px] font-extrabold text-[#111]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
