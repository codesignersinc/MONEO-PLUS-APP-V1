import Link from 'next/link';
import { Check } from 'lucide-react';
import { GlyphTile } from '@/components/ui/Glyph';
import { Wordmark } from '@/components/landing/LandingNav';
import { Pill, C } from '@/components/landing/ui';
import { MarketView, MarketPeruLink } from './client';
import WaitlistForm from './WaitlistForm';
import { marketMoney, type Market } from '@/lib/markets';

const wrap = 'mx-auto max-w-6xl px-4 sm:px-6';
const TILE = [C.mint, C.yellow, C.lilac, C.blue];

// Country landing with the waiting list (moneo.plus/es, /us, /au, /ae, /sg).
export default function MarketLanding({ market }: { market: Market }) {
  const t = market.copy;
  return (
    <div lang={market.locale} className="min-h-screen text-[#111]">
      <MarketView slug={market.slug} />
      <header className={`${wrap} flex items-center justify-between py-5`}>
        <Link href={`/${market.slug}`} aria-label="MONEO">
          <Wordmark />
        </Link>
        <a
          href="#lista"
          className="rounded-xl border-[3px] border-[#111] bg-[#FFD83D] px-4 py-2 font-poppins text-sm font-extrabold shadow-[3px_3px_0_#111]"
        >
          {t.submit}
        </a>
      </header>

      <main>
        <section
          className={`${wrap} grid items-start gap-10 pb-16 pt-6 lg:grid-cols-[1.1fr_1fr] lg:pt-12`}
        >
          <div>
            <Pill color={C.mint}>{t.pill}</Pill>
            <h1 className="mt-5 font-poppins text-[44px] font-extrabold leading-[0.98] tracking-tight sm:text-[60px] lg:text-[70px]">
              {t.title[0]}{' '}
              <span className="relative inline-block">
                <span className="relative z-10">{t.title[1]}</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 z-0 h-4 rounded-full bg-[#FFD83D] sm:h-5"
                />
              </span>
            </h1>
            <p className="mt-5 max-w-xl font-sans text-[18px] leading-relaxed text-[#333] sm:text-[20px]">
              {t.subtitle}
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-sans text-[14px] font-medium text-[#333]">
              {t.bullets.map((b) => (
                <li key={b} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-8 max-w-md rounded-3xl border-[3px] border-[#111] bg-white p-5 shadow-[6px_6px_0_#111]">
              <p className="font-poppins text-sm font-extrabold">{t.examplesTitle}</p>
              <ul className="mt-3 divide-y divide-[#111]/10">
                {t.examples.map((ex, i) => (
                  <li key={ex.label} className="flex items-center gap-3 py-2.5">
                    <GlyphTile name={ex.icon} color={TILE[i % TILE.length]} size="sm" />
                    <span className="flex-1 font-poppins text-[15px] font-bold">{ex.label}</span>
                    <span
                      className={`font-poppins text-[15px] font-extrabold tabular-nums ${
                        ex.amount < 0 ? 'text-[#111]' : 'text-[#15803D]'
                      }`}
                    >
                      {ex.amount > 0 ? '+' : ''}
                      {marketMoney(ex.amount, market)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            id="lista"
            className="scroll-mt-6 rounded-[32px] border-[3px] border-[#111] bg-[#FFF9EC] p-6 shadow-[8px_8px_0_#111] sm:p-8"
          >
            <h2 className="font-poppins text-[28px] font-extrabold leading-tight">{t.formTitle}</h2>
            <p className="mb-5 mt-2 font-sans text-[15px] text-[#333]">{t.formText}</p>
            <WaitlistForm slug={market.slug} />
          </div>
        </section>

        <section className={`${wrap} pb-16`}>
          <h2 className="font-poppins text-[30px] font-extrabold leading-tight sm:text-[38px]">
            {t.featuresTitle}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {t.features.map((f, i) => (
              <div
                key={f.title}
                className="rounded-3xl border-[3px] border-[#111] bg-white p-5 shadow-[4px_4px_0_#111]"
              >
                <GlyphTile name={f.icon} color={TILE[i % TILE.length]} size="lg" />
                <h3 className="mt-4 font-poppins text-lg font-extrabold">{f.title}</h3>
                <p className="mt-1 font-sans text-[15px] leading-relaxed text-[#333]">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${wrap} pb-20`}>
          <h2 className="font-poppins text-[26px] font-extrabold">{t.faqTitle}</h2>
          <div className="mt-4 space-y-3">
            {t.faq.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border-[3px] border-[#111] bg-white px-5 py-4"
              >
                <summary className="cursor-pointer list-none font-poppins text-[16px] font-extrabold">
                  {f.q}
                </summary>
                <p className="mt-2 font-sans text-[15px] leading-relaxed text-[#333]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer
        className={`${wrap} flex flex-col gap-3 border-t-2 border-[#111]/15 py-8 sm:flex-row sm:items-center sm:justify-between`}
      >
        <MarketPeruLink slug={market.slug} label={t.peruLink} />
        <nav className="flex gap-4 font-sans text-sm font-semibold">
          <Link href="/privacidad" className="underline">
            {t.privacy}
          </Link>
          <span>© MONEO</span>
        </nav>
      </footer>
    </div>
  );
}
