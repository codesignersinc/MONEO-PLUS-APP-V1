'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { track } from '@/lib/analytics';
import { marketForCountry, type Market, type MarketSlug } from '@/lib/markets';

export function MarketView({ slug }: { slug: MarketSlug }) {
  useEffect(() => {
    track('market_view', { market: slug });
  }, [slug]);
  return null;
}

export function MarketPeruLink({ slug, label }: { slug: MarketSlug; label: string }) {
  return (
    <Link
      href="/"
      hrefLang="es-PE"
      onClick={() => track('market_peru_click', { market: slug })}
      className="inline-flex items-center gap-1.5 font-poppins text-sm font-extrabold underline"
    >
      {label} <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
    </Link>
  );
}

const BANNER: Record<'es' | 'en', (m: Market) => string> = {
  es: (m) => `¿Estás en ${m.countryName}? Mira MONEO para tu país`,
  en: (m) => `In ${m.countryName}? See MONEO for your country`,
};

/**
 * On the Peru landing: a small bar for visitors whose IP is in a waiting-list country,
 * pointing to their landing. Never redirects on its own.
 */
export function MarketBanner() {
  const [market, setMarket] = useState<Market | null>(null);
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)moneo_geo=([A-Z]{2})/);
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem('moneo_market_banner') === '0';
    } catch {
      // Storage blocked: show it.
    }
    if (!dismissed) setMarket(marketForCountry(m?.[1]));
  }, []);
  if (!market) return null;
  return (
    <div className="paper-opaque relative z-50 flex items-center justify-center gap-3 bg-[#111] px-10 py-2.5 text-center font-poppins text-[13px] font-bold text-white">
      <Link
        href={`/${market.slug}`}
        hrefLang={market.locale}
        onClick={() => track('market_banner_click', { market: market.slug })}
        className="inline-flex items-center gap-1.5 underline"
      >
        {BANNER[market.lang](market)} <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </Link>
      <button
        type="button"
        aria-label={market.lang === 'es' ? 'Cerrar' : 'Close'}
        onClick={() => {
          try {
            sessionStorage.setItem('moneo_market_banner', '0');
          } catch {
            // Ignore.
          }
          setMarket(null);
        }}
        className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/40"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
