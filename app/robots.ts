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
        //
        // /checkout and /basket are deliberately NOT listed. They already send
        // `noindex, nofollow`, and a disallowed URL is never fetched, so the
        // noindex is never read: Google keeps indexing the URL from links and
        // has no instruction to drop it. That is why 40 checkout URLs were
        // still drawing impressions (332 in 28 days) months after the noindex
        // went on. Let them be crawled so the noindex can be obeyed; once they
        // have dropped out of the index they can go back in this list.
        disallow: [
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