import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/finanzas', '/admin', '/mini', '/auth', '/api', '/empezar', '/plus'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
