import type { Metadata } from 'next';
import Link from 'next/link';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import SiteNav from '../../components/SiteNav';
import Footer from '../../components/Footer';
import BlogCTA from '../../components/BlogCTA';
import { SectionMark } from '../../components/ui';
import { getAllPosts, getPostBySlug } from '../../lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — Sell Your Shelf`,
    description: post.description,
    keywords: post.keywords?.split(',').map((k: string) => k.trim()),
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://www.sellyourshelf.com/blog/${slug}`,
      siteName: 'Sell Your Shelf',
      locale: 'en_GB',
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `https://www.sellyourshelf.com/blog/${slug}`,
    },
  };
}

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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <div className="sy-page">
        <SiteNav current="blog" />
        <div className="sy-wrap" style={{ padding: '96px 32px', textAlign: 'center' }}>
          <h1 className="sy-h2" style={{ marginBottom: 12 }}>Post not found</h1>
          <Link href="/blog" className="sy-cta sy-cta-quiet" style={{ display: 'inline-flex' }}>
            Back to all posts
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const allPosts = getAllPosts();
  const related = allPosts.filter((p) => p.slug !== slug).slice(0, 3);

  // FAQ schema for posts that contain an FAQ section
  const faqMatches = post.content.match(/###\s*(.+?)\n([\s\S]*?)(?=###|\n##|$)/g);
  const faqSection = post.content.includes('## FAQ') || post.content.includes('## Frequently');
  let faqSchema = null;

  if (faqSection && faqMatches) {
    const faqStart = post.content.indexOf('## FAQ') !== -1
      ? post.content.indexOf('## FAQ')
      : post.content.indexOf('## Frequently');

    if (faqStart !== -1) {
      const faqContent = post.content.slice(faqStart);
      const qaPairs = [...faqContent.matchAll(/###\s*(.+?)\n([\s\S]*?)(?=###|$)/g)];

      if (qaPairs.length > 0) {
        faqSchema = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: qaPairs.map(([, question, answer]) => ({
            '@type': 'Question',
            name: question.trim(),
            acceptedAnswer: {
              '@type': 'Answer',
              text: answer.trim(),
            },
          })),
        };
      }
    }
  }

  return (
    <div className="sy-page">
      <SiteNav current="blog" />

      {/* Article schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            author: {
              '@type': 'Person',
              name: post.author,
            },
            publisher: {
              '@type': 'Organization',
              name: 'Sell Your Shelf Limited',
              url: 'https://www.sellyourshelf.com',
            },
            mainEntityOfPage: `https://www.sellyourshelf.com/blog/${slug}`,
          }),
        }}
      />

      {/* FAQ schema if applicable */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <article className="sy-article">
        <Link href="/blog" className="sy-backlink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 19l-7-7 7-7" />
          </svg>
          All posts
        </Link>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '28px 0 14px' }}>
          <SectionMark>{post.category}</SectionMark>
          <span style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>{readingTime(post.content)}</span>
        </div>

        {/* Hero scale belongs to a full-width page; in a 680px reading
            column it wraps to four lines. Same step as the shelf name. */}
        <h1 className="sy-h2" style={{ marginBottom: 14 }}>{post.title}</h1>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 14, color: 'var(--color-ink-faint)',
            paddingBottom: 32, marginBottom: 36,
            borderBottom: '1px solid var(--color-rule)',
          }}
        >
          <span>{post.author}</span>
          <span aria-hidden>·</span>
          <time>{formatDate(post.date)}</time>
        </div>

        <div className="prose-sys">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* CTA */}
        <BlogCTA slug={post.slug} />
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="sy-article" style={{ paddingTop: 0, paddingBottom: 80 }}>
          <div style={{ paddingTop: 40, borderTop: '1px solid var(--color-rule)' }}>
            <h2 className="sy-h3" style={{ marginBottom: 4 }}>More from the blog</h2>
            {related.map((r) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} className="sy-post-row">
                <h3 className="sy-h3" style={{ fontSize: 17, marginBottom: 6 }}>{r.title}</h3>
                <p className="sy-prose" style={{ margin: 0 }}>{r.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}