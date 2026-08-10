import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAllPosts } from './lib/blog';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const revalidate = 3600; // regenerate sitemap every hour

function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Supabase caps every query at 1,000 rows by default. Anything that can
// exceed that (listings, books, sellers) must be fetched with .range()
// pages or the sitemap silently truncates — which is exactly what
// happened when active listings passed 1,000.
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://www.sellyourshelf.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://www.sellyourshelf.com/new',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://www.sellyourshelf.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: 'https://www.sellyourshelf.com/support',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: 'https://www.sellyourshelf.com/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: 'https://www.sellyourshelf.com/terms',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: 'https://www.sellyourshelf.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://www.sellyourshelf.com/contact',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: 'https://www.sellyourshelf.com/returns',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Blog posts
  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `https://www.sellyourshelf.com/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // One paged fetch of active listings feeds book pages, listing pages,
  // and the seller filter below.
  type BookSlugRef = { slug: string | null };
  type ActiveListingRow = {
    id: number;
    created_at: string;
    book_id: number | null;
    user_id: string | null;
    // supabase-js types embedded relations as arrays even for many-to-one,
    // where PostgREST actually returns an object — accept both shapes.
    books: BookSlugRef | BookSlugRef[] | null;
  };
  const bookSlugOf = (l: ActiveListingRow): string | null =>
    (Array.isArray(l.books) ? l.books[0]?.slug : l.books?.slug) ?? null;
  let activeListings: ActiveListingRow[] = [];
  try {
    activeListings = await fetchAllRows<ActiveListingRow>((from, to) =>
      supabase
        .from('listings')
        .select('id, created_at, book_id, user_id, books(slug)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(from, to)
    );
  } catch (e) {
    console.error('Sitemap: failed to fetch listings', e);
  }

  // Book aggregation pages — highest SEO value
  let bookPages: MetadataRoute.Sitemap = [];
  try {
    const bookIds = [...new Set(activeListings.map(l => l.book_id).filter(Boolean))];

    // Fetch book data in batches (.in() list, not row count, is the limit here)
    const batchSize = 500;
    const allBooks: any[] = [];
    for (let i = 0; i < bookIds.length; i += batchSize) {
      const batch = bookIds.slice(i, i + batchSize);
      const { data: books } = await supabase
        .from('books')
        .select('id, slug, title_normalized, author_normalized')
        .in('id', batch);
      if (books) allBooks.push(...books);
    }

    bookPages = allBooks
      .map((book) => {
        // Prefer the persisted slug — it's what listing-page canonicals
        // point at, and the sitemap must submit the same URL Google is
        // told is canonical. Generated slug is the fallback for books
        // the enrichment sweep hasn't reached yet.
        const slug = book.slug || generateSlug(
          book.title_normalized || '',
          book.author_normalized || ''
        );
        if (!slug) return null;
        return {
          url: `https://www.sellyourshelf.com/books/${slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.8,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;

    // Dedupe: distinct books can normalize to the same slug
    const seen = new Set<string>();
    bookPages = bookPages.filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });
  } catch (e) {
    console.error('Sitemap: failed to fetch books', e);
  }

  // Active listings — only those that self-canonicalise. Listings whose
  // book has a persisted slug canonicalise to the /books/ hub (see
  // app/listing/[id]/page.tsx generateMetadata); submitting them here
  // would just generate "Duplicate, submitted URL not selected as
  // canonical" noise in Search Console. As the enrichment sweep
  // populates book slugs, listings naturally migrate out of the sitemap
  // in favour of their hubs.
  const listingPages: MetadataRoute.Sitemap = activeListings
    .filter((listing) => !bookSlugOf(listing))
    .map((listing) => ({
      url: `https://www.sellyourshelf.com/listing/${listing.id}`,
      lastModified: new Date(listing.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  // Seller profiles — only sellers with at least one active listing.
  // (Previously all users with a username, which both hit the 1,000-row
  // cap and filled the sitemap with empty shelves.)
  let sellerPages: MetadataRoute.Sitemap = [];
  try {
    const sellerIds = [...new Set(activeListings.map(l => l.user_id).filter(Boolean))];

    const batchSize = 500;
    const sellers: Array<{ username: string | null; created_at: string }> = [];
    for (let i = 0; i < sellerIds.length; i += batchSize) {
      const batch = sellerIds.slice(i, i + batchSize);
      const { data } = await supabase
        .from('users')
        .select('username, created_at')
        .in('id', batch)
        .not('username', 'is', null);
      if (data) sellers.push(...data);
    }

    sellerPages = sellers
      .filter((s) => s.username)
      .map((seller) => ({
        url: `https://www.sellyourshelf.com/${seller.username}`,
        lastModified: new Date(seller.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
  } catch (e) {
    console.error('Sitemap: failed to fetch sellers', e);
  }

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = [
    'fiction', 'childrens', 'biography-memoir', 'crime-thriller', 'self-help',
    'history', 'reference-education', 'business-finance', 'literary-fiction',
    'travel', 'cookery-food', 'art-photography', 'science-nature', 'young-adult',
    'classic-fiction', 'historical-fiction', 'romance', 'sci-fi-fantasy',
    'comics-graphic-novels',
  ].map(slug => ({
    url: `https://www.sellyourshelf.com/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPosts, ...categoryPages, ...bookPages, ...listingPages, ...sellerPages];
}
