import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import ShareButton from '@/app/components/ShareButton'
import { BookCover, Price } from '@/app/components/ui'
import { INDEX_THRESHOLD, type AuthorHub as Hub } from '@/app/lib/authorHub'

/**
 * The author / publisher hub.
 *
 * Its job is deliberately narrow, because a fourth hub type next to
 * /books/[slug], /category and /[username] only earns its place if it answers
 * a question the others don't:
 *
 *   /books/[slug]   "I want this book."
 *   /author/[slug]  "I want more by this person."
 *   /category       neither — which is likely why it draws 164 impressions at
 *                   position 47.6 and zero clicks.
 *
 * So this page is an index of book pages, never a copy of them. Every title
 * links out to /books/[slug] and nothing restates what that page says. That
 * keeps the two from competing for the same query, which is the failure we
 * just spent a release unpicking when listing pages were canonicalised to book
 * pages that then ranked worse.
 *
 * ONE layout at every size, and it's the cover grid the rest of the site
 * browses in. It shipped with two text layouts — grouped by title above 15
 * copies, a flat list of copies below — which put 22 pages on one design and
 * 140 on another. Both were wrong anyway: books are browsed by cover here,
 * and a text list made this the only section that didn't.
 *
 * One card per TITLE rather than per copy. That's what keeps the page an
 * index of book pages instead of a second listings page — the card says "3
 * copies from £2.50" and links to /books/[slug], restating nothing.
 */
export default function AuthorHub({ hub }: { hub: Hub }) {
  const isPublisher = hub.kind === 'publisher'
  const base = isPublisher ? 'publisher' : 'author'
  const url = `https://www.sellyourshelf.com/${base}/${hub.slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Second-hand books by ${hub.displayName}`,
    url,
    ...(hub.liveCopies > 0 && {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: hub.titles.length,
        itemListElement: hub.titles.slice(0, 50).map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.title,
          ...(t.slug && { url: `https://www.sellyourshelf.com/books/${t.slug}` }),
        })),
      },
    }),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.sellyourshelf.com' },
      { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://www.sellyourshelf.com/new' },
      { '@type': 'ListItem', position: 3, name: hub.displayName, item: url },
    ],
  }

  return (
    <div className="sy-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <SiteNav />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 64px' }}>
        <div className="sy-pagebar">
          <div className="sy-crumbs">
            <Link href="/">Home</Link>
            <span className="sy-crumb-sep">/</span>
            <Link href="/authors">Authors</Link>
            <span className="sy-crumb-sep">/</span>
            <span className="sy-crumb-here sy-crumb-clip">{hub.displayName}</span>
          </div>
          {hub.liveCopies > 0 && (
            <ShareButton url={url} title={`Books by ${hub.displayName}`} kind="book" compact />
          )}
        </div>

        <h1 className="sy-h2" style={{ marginBottom: 8 }}>{hub.displayName}</h1>

        {hub.liveCopies > 0 ? (
          <p style={{ fontSize: 16, color: 'var(--color-ink-soft)', marginBottom: 28 }}>
            {hub.liveCopies} second-hand {hub.liveCopies === 1 ? 'copy' : 'copies'} across{' '}
            {hub.titles.length} {hub.titles.length === 1 ? 'title' : 'titles'}
            {hub.lowestPriceGbp != null && <>, from £{hub.lowestPriceGbp.toFixed(2)}</>}.
            {' '}Delivery is free when you spend £10 with one seller.
          </p>
        ) : (
          /* Inventory here churns by REMOVAL, not by selling — 1,137 listings
             removed against 40 sold. Removal is often reversible (the same
             seller relists), so this page keeps working and keeps its URL
             rather than 410-ing away a ranking for a condition that may last a
             week. It just tells the truth in the meantime. */
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 16, color: 'var(--color-ink-soft)', marginBottom: 14 }}>
              Nobody is selling {hub.displayName} on Sell Your Shelf right now. Shelves change daily,
              so it&apos;s worth looking again.
            </p>
            <Link href="/new" className="sy-textlink">Browse what&apos;s in stock</Link>
          </div>
        )}

        {/* The same cover grid the rest of the site browses in — .sy-grid and
            .sy-card are shared, so this matches /new, search and a shelf
            exactly rather than inventing a fourth way to show books. 95% of
            books with a live listing have a cover, and every title on the
            biggest hubs does, so a grid reads as covers rather than as gaps.

            One card per TITLE, not per copy: the card carries "3 copies from
            £2.50" and links to /books/[slug], which keeps this an index of
            book pages rather than a second listings page. */}
        <div className="sy-grid">
          {hub.titles.map((t) => {
            const card = (
              <>
                <BookCover book={{ title: t.title, cover: t.coverUrl, price: t.copies[0].priceGbp }} />
                <span className="sy-card-meta">
                  <span className="sy-card-title">{t.title}</span>
                  <span className="sy-card-foot">
                    <Price value={t.copies[0].priceGbp} />
                    <span className="sy-card-author">
                      {t.copies.length} {t.copies.length === 1 ? 'copy' : 'copies'}
                    </span>
                  </span>
                </span>
              </>
            )
            return t.slug ? (
              <Link key={t.bookId} href={`/books/${t.slug}`} className="sy-card">
                {card}
              </Link>
            ) : (
              <div key={t.bookId} className="sy-card">{card}</div>
            )
          })}
        </div>

        {hub.liveCopies > 0 && hub.liveCopies < INDEX_THRESHOLD && (
          /* Below the threshold the page still serves — anyone holding the
             link gets what's there — but it is noindex, so it can't drag a
             thin page into the results. See generateMetadata on the route. */
          <p style={{ fontSize: 13, color: 'var(--color-ink-faint)', marginTop: 28 }}>
            More {isPublisher ? 'titles' : 'books'} by {hub.displayName} appear here as sellers list them.
          </p>
        )}
      </div>

      <Footer />
    </div>
  )
}
