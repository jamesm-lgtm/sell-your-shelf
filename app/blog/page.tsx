import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav from '../components/SiteNav';
import Footer from '../components/Footer';
import { SectionMark } from '../components/ui';
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

function formatDate(dateStr: string) {
  // timeZone pinned: server runs UTC, readers don't, and a date near a
  // month boundary would otherwise render differently on each side.
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function readingTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 250))} min read`;
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="sy-page">
      <SiteNav current="blog" />

      <div style={{ borderBottom: '1px solid var(--color-rule)', padding: '48px 0 36px' }}>
        <div className="sy-wrap">
          <h1 className="sy-h1" style={{ marginBottom: 12 }}>Blog</h1>
          <p className="sy-lede" style={{ maxWidth: 620 }}>
            Guides, tips and comparisons for selling second hand books in the UK.
          </p>
        </div>
      </div>

      <div className="sy-wrap" style={{ padding: '8px 32px 72px', maxWidth: 780 }}>
        {posts.length === 0 && (
          <p className="sy-prose" style={{ paddingTop: 32 }}>No posts yet. Check back soon.</p>
        )}

        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="sy-post-row"
          >
            {/* The category was eight tinted pastels — a colour system that
                existed only here. One mark, like every other section label
                on the site, with the reading time as its quiet companion. */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
              <SectionMark>{post.category}</SectionMark>
              <span style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>
                {readingTime(post.content)}
              </span>
            </div>
            <h2 className="sy-h3" style={{ marginBottom: 8 }}>{post.title}</h2>
            <p className="sy-prose" style={{ margin: '0 0 10px', maxWidth: 620 }}>
              {post.description}
            </p>
            <time style={{ fontSize: 13, color: 'var(--color-ink-faint)' }}>
              {formatDate(post.date)}
            </time>
          </Link>
        ))}
      </div>

      <Footer />
    </div>
  );
}
