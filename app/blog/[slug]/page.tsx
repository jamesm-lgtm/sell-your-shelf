import type { Metadata } from 'next';
import Link from 'next/link';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import SiteNav from '../../components/SiteNav';
import Footer from '../../components/Footer';
import BlogCTA from '../../components/BlogCTA';
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
        <SiteNav current="blog" />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            Post not found
          </h1>
          <Link href="/blog" className="text-sm font-medium hover:underline" style={{ color: '#2D4A3E' }}>
            &larr; Back to blog
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  const allPosts = getAllPosts();
  const related = allPosts.filter((p) => p.slug !== slug).slice(0, 3);
  const colours = categoryColours[post.category] ?? { bg: '#f0f0f0', text: '#666' };

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
    <main className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
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

      <article className="max-w-2xl mx-auto px-6 pt-12 pb-16">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All posts
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-block px-2.5 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: colours.bg, color: colours.text }}
          >
            {post.category}
          </span>
          <span className="text-xs text-gray-400">{readingTime(post.content)}</span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl text-gray-900 leading-tight tracking-tight mb-4"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {post.title}
        </h1>

        {/* Byline */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-10 pb-10" style={{ borderBottom: '1px solid #F0EDE8' }}>
          <span>{post.author}</span>
          <span>·</span>
          <time>{formatDate(post.date)}</time>
        </div>

        {/* Content */}
        <div className="prose-sys">
  <MarkdownRenderer content={post.content} />
</div>

        {/* CTA */}
        <BlogCTA />
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="max-w-2xl mx-auto px-6 pb-24">
          <div className="pt-10" style={{ borderTop: '1px solid #F0EDE8' }}>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">More from the blog</h2>
            <div className="space-y-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="block group"
                >
                  <h3 className="font-medium text-gray-900 group-hover:text-[#2D4A3E] transition-colors">
                    {r.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">{r.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}