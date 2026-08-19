import Link from 'next/link'
import { resolveBookCover, type ListingImageRow } from '@/app/lib/coverUrl'
import { BookCard } from '@/app/components/ui'

type CuratedListing = {
  id: number
  asking_price_gbp: number
  condition: string
  books: { title: string; author: string | null; cover_url: string | null; cover_url_hosted?: string | null } | null
  listing_images?: ListingImageRow[] | null
}

type TagRow = {
  label: string
  slug: string
  description: string
  listings: CuratedListing[]
}

export default function CuratedRows({ rows }: { rows: TagRow[] }) {
  if (rows.length === 0) return null

  return (
    <div>
      {rows.map(row => (
        <section
          key={row.slug}
          style={{ padding: '44px 0 10px' }}
        >
          <div className="sy-wrap">
            <div className="sy-rail-head" style={{ marginBottom: 10 }}>
              <h2 className="sy-h3" style={{ margin: 0 }}>
                {row.label}
              </h2>
              <Link
                href={`/browse/${row.slug}`}
                style={{ fontSize: 14, color: 'var(--color-action)', textDecoration: 'none', fontWeight: 600 }}
              >
                See all →
              </Link>
            </div>
            {row.description && (
              <p style={{ fontSize: 15, color: 'var(--color-ink-soft)', margin: '10px 0 0', lineHeight: 1.5, maxWidth: 620 }}>
                {row.description}
              </p>
            )}
          </div>
          <div className="sy-rail">
              {row.listings.slice(0, 12).map(listing => (
                <div key={listing.id} className="sy-rail-item">
                  <BookCard
                    href={`/listing/${listing.id}`}
                    book={{
                      id: listing.id,
                      title: listing.books?.title ?? '',
                      author: listing.books?.author ?? null,
                      price: Number(listing.asking_price_gbp),
                      cover: resolveBookCover(listing.books, listing.listing_images),
                    }}
                  />
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
