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

  // Book aggregation pages — highest SEO value
  let bookPages: MetadataRoute.Sitemap = [];
  try {
    // Get all book_ids that have active listings
    const { data: activeListings } = await supabase
      .from('listings')
      .select('book_id')
      .eq('status', 'active')
      .not('book_id', 'is', null);

    if (activeListings) {
      const bookIds = [...new Set(activeListings.map(l => l.book_id))];

      // Fetch book data in batches (Supabase max 1000 per query)
      const batchSize = 500;
      const allBooks: any[] = [];
      for (let i = 0; i < bookIds.length; i += batchSize) {
        const batch = bookIds.slice(i, i + batchSize);
        const { data: books } = await supabase
          .from('books')
          .select('id, title_normalized, author_normalized')
          .in('id', batch);
        if (books) allBooks.push(...books);
      }

      bookPages = allBooks
        .map((book) => {
          const slug = generateSlug(
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
    }
  } catch (e) {
    console.error('Sitemap: failed to fetch books', e);
  }

  // Active listings
  let listingPages: MetadataRoute.Sitemap = [];
  try {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (listings) {
      listingPages = listings.map((listing) => ({
        url: `https://www.sellyourshelf.com/listing/${listing.id}`,
        lastModified: new Date(listing.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (e) {
    console.error('Sitemap: failed to fetch listings', e);
  }

  // Seller profiles
  let sellerPages: MetadataRoute.Sitemap = [];
  try {
    const { data: sellers } = await supabase
      .from('users')
      .select('username, created_at')
      .not('username', 'is', null);

    if (sellers) {
      sellerPages = sellers.map((seller) => ({
        url: `https://www.sellyourshelf.com/${seller.username}`,
        lastModified: new Date(seller.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }));
    }
  } catch (e) {
    console.error('Sitemap: failed to fetch sellers', e);
  }

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = [
    'fiction', 'childrens', 'biography-memoir', 'self-help', 'history',
    'reference-education', 'business-finance', 'travel', 'cookery-food',
    'art-photography', 'science-nature', 'young-adult', 'comics-graphic-novels',
    'sci-fi-fantasy', 'crime-thriller',
  ].map(slug => ({
    url: `https://www.sellyourshelf.com/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPosts, ...categoryPages, ...bookPages, ...listingPages, ...sellerPages];
}
