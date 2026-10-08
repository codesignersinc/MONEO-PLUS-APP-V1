import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketLanding from '@/components/landing/market/MarketLanding';
import { isMarketSlug, landingAlternates, MARKET_SLUGS, MARKETS } from '@/lib/markets';
import { SITE } from '@/lib/site';

// Country landings with the waiting list: /es, /us, /au, /ae, /sg (docs/global-core.md,
// step 4). Any other single-segment path that is not a real page stays a 404.

export const dynamicParams = false;

export function generateStaticParams() {
  return MARKET_SLUGS.map((market) => ({ market }));
}

type Params = { params: Promise<{ market: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { market: slug } = await params;
  if (!isMarketSlug(slug)) return {};
  const m = MARKETS[slug];
  return {
    metadataBase: new URL(SITE.url),
    title: { absolute: m.metaTitle },
    description: m.metaDescription,
    alternates: { canonical: `/${slug}`, languages: landingAlternates() },
    openGraph: {
      type: 'website',
      url: `${SITE.url}/${slug}`,
      siteName: SITE.name,
      locale: m.ogLocale,
      title: m.metaTitle,
      description: m.metaDescription,
      images: [{ url: '/assets/images/landing/og-moneo.jpg', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: m.metaTitle,
      description: m.metaDescription,
      images: ['/assets/images/landing/og-moneo.jpg'],
    },
  };
}

export default async function MarketPage({ params }: Params) {
  const { market: slug } = await params;
  if (!isMarketSlug(slug)) notFound();
  return <MarketLanding market={MARKETS[slug]} />;
}
