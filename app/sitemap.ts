import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAllPosts } from './lib/blog';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const revalidate = 3600; // regenerate sitemap every hour

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
      priority: 0.8,
    },
    {
      url: 'https://www.sellyourshelf.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://www.sellyourshelf.com/support',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://www.sellyourshelf.com/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://www.sellyourshelf.com/terms',
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
    priority: 0.7,
  }));

  // Active listings from Supabase
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

  // Seller profiles from Supabase
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

  return [...staticPages, ...blogPosts, ...listingPages, ...sellerPages];
}