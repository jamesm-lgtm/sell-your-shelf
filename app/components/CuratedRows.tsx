import Link from 'next/link'
import { resolveBookCover, type ListingImageRow } from '@/app/lib/coverUrl'

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

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
          style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 0' }}
        >
          <div style={{ maxWidth: 840, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', margin: 0, fontFamily: 'Georgia, serif' }}>
                {row.label}
              </h2>
              <Link
                href={`/browse/${row.slug}`}
                style={{ fontSize: 13, color: '#2D4A3E', textDecoration: 'none', fontWeight: 500 }}
              >
                See all →
              </Link>
            </div>
            {row.description && (
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 12px', lineHeight: 1.4 }}>
                {row.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {row.listings.slice(0, 8).map(listing => {
                const coverUrl = resolveBookCover(listing.books, listing.listing_images);
                return (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  style={{ flexShrink: 0, width: 140, textDecoration: 'none' }}
                >
                  <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '2/3', background: '#2D4A3E', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={listing.books?.title ?? ''}
                          style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: 8, textAlign: 'center' }}>
                          {listing.books?.title ?? ''}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.books?.title ?? ''}
                      </div>
                      {listing.books?.author && (
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {listing.books.author}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#2D4A3E' }}>
                          £{Number(listing.asking_price_gbp).toFixed(2)}
                        </span>
                        <span style={{ fontSize: 10, color: '#666', background: '#F0EDE8', padding: '2px 6px', borderRadius: 4 }}>
                          {CONDITIONS[listing.condition] ?? listing.condition}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
