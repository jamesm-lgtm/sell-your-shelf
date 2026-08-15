import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Transactional and private routes. None of these can rank, and
        // crawling them wastes budget that belongs on book pages — the
        // checkout route also fires a checkout_started analytics event on
        // mount, so crawlers were manufacturing hundreds of phantom
        // checkout starts (173 in 30 days, vs ~16 real ones).
        disallow: [
          '/checkout',
          '/basket',
          '/order',
          '/orders',
          '/auth',
          '/admin',
          '/preferences',
          '/delete-account',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://www.sellyourshelf.com/sitemap.xml',
  };
}