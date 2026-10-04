import type { Metadata } from 'next';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { TrackView } from '@/components/landing/client';
import {
  Features,
  Hero,
  Juntas,
  Problem,
  Solution,
  ValueBar,
} from '@/components/landing/SectionsTop';
import {
  Auto,
  Faq,
  FinalCta,
  Metas,
  Peru,
  Pricing,
  Security,
  Testimonials,
  VozScan,
} from '@/components/landing/SectionsBottom';
import { SITE } from '@/lib/site';

// Public landing of moneo.plus. Signed-in users never see it: the middleware sends
// them to /finanzas.

const TITLE = 'MONEO — Tu dinero, más simple.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { absolute: TITLE },
  description: SITE.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE.url,
    siteName: SITE.name,
    locale: 'es_PE',
    title: TITLE,
    description: SITE.description,
    images: [
      {
        url: '/assets/images/landing/og-moneo.jpg',
        width: 1200,
        height: 630,
        alt: 'MONEO — Tu dinero, más simple.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: SITE.description,
    images: ['/assets/images/landing/og-moneo.jpg'],
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFF9EC] text-[#111]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-[#111] focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <TrackView />
      <LandingNav />
      <main id="contenido">
        <Hero />
        <ValueBar />
        <Problem />
        <Solution />
        <Features />
        <Juntas />
        <Auto />
        <VozScan />
        <Metas />
        <Peru />
        <Security />
        <Pricing />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
