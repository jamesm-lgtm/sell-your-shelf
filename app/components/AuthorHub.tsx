import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import ShareButton from '@/app/components/ShareButton'
import { Price, ConditionMarker } from '@/app/components/ui'
import {
  GROUPING_THRESHOLD,
  INDEX_THRESHOLD,
  type AuthorHub as Hub,
} from '@/app/lib/authorHub'

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
 */
export default function AuthorHub({ hub }: { hub: Hub }) {
  const isPublisher = hub.kind === 'publisher'
  const base = isPublisher ? 'publisher' : 'author'
  const url = `https://www.sellyourshelf.com/${base}/${hub.slug}`

  // Above ~15 copies a flat list stops being useful: David Walliams has 137
  // copies across 57 titles, and a reader wants "Gangsta Granny, four copies
  // from £2.50", not 137 undifferentiated cards. Below it, grouping just adds
  // a layer over a list that was already readable.
  const grouped = hub.liveCopies > GROUPING_THRESHOLD

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
            <Link href="/new">Browse</Link>
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
              so it's worth looking again.
            </p>
            <Link href="/new" className="sy-textlink">Browse what's in stock</Link>
          </div>
        )}

        {grouped ? (
          <div className="sy-authorgroups">
            {hub.titles.map((t) => (
              <section key={t.bookId} className="sy-authorgroup">
                <div className="sy-authorgroup-head">
                  <div>
                    <h2 className="sy-h3" style={{ marginBottom: 2 }}>
                      {t.slug ? (
                        <Link href={`/books/${t.slug}`}>{t.title}</Link>
                      ) : (
                        t.title
                      )}
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--color-ink-faint)' }}>
                      {t.copies.length} {t.copies.length === 1 ? 'copy' : 'copies'} from{' '}
                      £{t.copies[0].priceGbp.toFixed(2)}
                    </p>
                  </div>
                  {t.slug && (
                    <Link href={`/books/${t.slug}`} className="sy-textlink" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                      See all →
                    </Link>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <ul className="sy-authorlist">
            {hub.titles.flatMap((t) =>
              t.copies.map((c) => (
                <li key={c.listingId} className="sy-authorlist-row">
                  <Link href={`/listing/${c.listingId}`} className="sy-authorlist-main">
                    <span className="sy-authorlist-title">{t.title}</span>
                    <span className="sy-authorlist-meta">
                      <ConditionMarker condition={c.condition} />
                      {c.sellerUsername && <span>@{c.sellerUsername}</span>}
                    </span>
                  </Link>
                  <Price value={c.priceGbp} />
                </li>
              )),
            )}
          </ul>
        )}

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
