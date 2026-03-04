import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getAllPosts } from '../lib/blog';

export const metadata: Metadata = {
  title: 'Blog — Sell Your Shelf',
  description:
    'Guides, tips, and comparisons for selling second hand books in the UK.',
  openGraph: {
    title: 'Blog — Sell Your Shelf',
    description:
      'Guides, tips, and comparisons for selling second hand books in the UK.',
    url: 'https://www.sellyourshelf.com/blog',
    siteName: 'Sell Your Shelf',
    locale: 'en_GB',
    type: 'website',
  },
};

const categoryColours: Record<string, { bg: string; text: string }> = {
  'Selling Guides': { bg: 'rgba(45, 74, 62, 0.1)', text: '#2D4A3E' },
  Comparisons: { bg: 'rgba(45, 62, 74, 0.1)', text: '#2D3E4A' },
  Valuation: { bg: 'rgba(74, 62, 45, 0.1)', text: '#4A3E2D' },
  Product: { bg: 'rgba(62, 45, 74, 0.1)', text: '#3E2D4A' },
  Textbooks: { bg: 'rgba(74, 45, 62, 0.1)', text: '#4A2D3E' },
  Decluttering: { bg: 'rgba(45, 74, 66, 0.1)', text: '#2D4A42' },
  'Cash Focus': { bg: 'rgba(45, 74, 62, 0.1)', text: '#2D4A3E' },
  Buyer: { bg: 'rgba(62, 62, 74, 0.1)', text: '#3E3E4A' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function readingTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 250))} min read`;
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <Header />

      <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
        <div className="mb-10">
          <h1
            className="text-4xl text-gray-900 mb-3 tracking-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Blog
          </h1>
          <p className="text-gray-500 text-lg">
            Guides, tips, and comparisons for selling second hand books in the
            UK.
          </p>
        </div>

        {posts.length === 0 && (
          <p className="text-gray-400">No posts yet. Check back soon.</p>
        )}

        <div>
          {posts.map((post) => {
            const colours = categoryColours[post.category] ?? {
              bg: '#f0f0f0',
              text: '#666',
            };

            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block py-7 group"
                style={{ borderBottom: '1px solid #F0EDE8' }}
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <span
                    className="inline-block px-2.5 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: colours.bg, color: colours.text }}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {readingTime(post.content)}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#2D4A3E] transition-colors mb-2 leading-snug">
                  {post.title}
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-3">
                  {post.description}
                </p>
                <time className="text-xs text-gray-400">
                  {formatDate(post.date)}
                </time>
              </Link>
            );
          })}
        </div>
      </div>

      <Footer />
    </main>
  );
}