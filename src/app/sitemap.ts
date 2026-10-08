import type { MetadataRoute } from 'next';
import { landingAlternates, MARKET_SLUGS } from '@/lib/markets';
import { SITE } from '@/lib/site';

// Public pages only: the app (/finanzas, /admin, /mini…) needs a session.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(landingAlternates()).map(([lang, path]) => [lang, `${SITE.url}${path}`])
  );
  return [
    { url: SITE.url, changeFrequency: 'weekly', priority: 1, alternates: { languages } },
    ...MARKET_SLUGS.map((slug) => ({
      url: `${SITE.url}/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      alternates: { languages },
    })),
    { url: `${SITE.url}/privacidad`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE.url}/terminos`, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
