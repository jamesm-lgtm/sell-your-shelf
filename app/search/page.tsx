import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { formatCount } from '@/app/components/ui'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import EventTracker from '@/app/components/EventTracker'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams
  const q = (params.q as string) || ''
  return {
    title: q ? `"${q}" — Search — Sell Your Shelf` : 'Search — Sell Your Shelf',
    robots: { index: false },
  }
}

type BookResult = {
  book_id: number
  title: string
  author: string
  cover_url: string | null
  category: string | null
  slug: string | null
  lowest_price: number
  copy_count: number
  similarity_score: number
}

type BundleResult = {
  id: number
  name: string
  description: string | null
  sellerUsername: string
  memberCount: number
  covers: Array<string | null>
}

function BookCard({ book }: { book: BookResult }) {
  const slug = book.slug || generateSlug(book.title, book.author || '')
  return (
    <Link
      href={`/books/${slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        background: 'var(--color-sheet)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-rule)',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}>
        {/* Cover */}
        <div style={{
          aspectRatio: '2/3',
          background: 'var(--color-ground-raised)',
          position: 'relative',
        }}>
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
            }}>
              <span style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 11,
                textAlign: 'center',
                lineHeight: 1.4,
              }}>
                {book.title}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '12px 14px 14px' }}>
          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-ink)',
            lineHeight: 1.3,
            marginBottom: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as any,
          }}>
            {book.title}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--color-ink-soft)',
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {book.author}
          </div>
          {book.category && (
            <div style={{
              fontSize: 11,
              color: 'var(--color-ink-faint)',
              marginBottom: 6,
            }}>
              {book.category}
            </div>
          )}
          <div style={{
            fontSize: 13,
            color: 'var(--color-action)',
            fontWeight: 600,
          }}>
            {book.copy_count} {book.copy_count === 1 ? 'copy' : 'copies'} from £{Number(book.lowest_price).toFixed(2)}
          </div>
        </div>
      </div>
    </Link>
  )
}

function BookGrid({ books }: { books: BookResult[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 20,
    }}>
      {books.map((book) => (
        <BookCard key={book.book_id} book={book} />
      ))}
    </div>
  )
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const q = ((params.q as string) || '').trim()

  let books: BookResult[] = []
  let popularBooks: BookResult[] = []
  let bundles: BundleResult[] = []

  if (q.length > 0) {
    const { data, error } = await supabase.rpc('search_books_fuzzy', {
      search_term: q,
      result_limit: 60,
    })

    if (!error && data) {
      books = data as BookResult[]
    }

    // Search bundles by name or description. We escape % and _ to
    // prevent the user's literal characters from acting as wildcards.
    // Cheap ILIKE is fine at current bundle volume (well under a few
    // thousand active rows); revisit if it grows enough to need a
    // tsvector index.
    const escaped = q.replace(/[%_]/g, (m) => `\\${m}`)
    const { data: bundleRows } = await supabase
      .from('bundles')
      .select(
        `
        id,
        name,
        description,
        seller:users!inner ( username, deleted_at ),
        bundle_items (
          sort_order,
          listing:listings!inner (
            id, status,
            books ( cover_url, cover_url_hosted )
          )
        )
        `,
      )
      .eq('status', 'active')
      .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
      .limit(12)

    type RawBundleRow = {
      id: number
      name: string
      description: string | null
      seller: { username: string; deleted_at: string | null } | Array<{ username: string; deleted_at: string | null }> | null
      bundle_items: Array<{
        sort_order: number
        listing: {
          id: number
          status: string
          books: { cover_url: string | null; cover_url_hosted: string | null } | null
        } | Array<{
          id: number
          status: string
          books: { cover_url: string | null; cover_url_hosted: string | null } | null
        }> | null
      }>
    }
    for (const raw of (bundleRows ?? []) as unknown as RawBundleRow[]) {
      const seller = Array.isArray(raw.seller) ? raw.seller[0] : raw.seller
      if (!seller || seller.deleted_at) continue
      const sorted = [...raw.bundle_items].sort((a, b) => a.sort_order - b.sort_order)
      let stale = false
      const covers: Array<string | null> = []
      for (const it of sorted) {
        const l = Array.isArray(it.listing) ? it.listing[0] : it.listing
        if (!l || l.status !== 'active') { stale = true; break }
        covers.push(l.books?.cover_url_hosted || l.books?.cover_url || null)
      }
      if (stale || covers.length < 2) continue
      bundles.push({
        id: raw.id,
        name: raw.name,
        description: raw.description,
        sellerUsername: seller.username,
        memberCount: covers.length,
        covers,
      })
    }

    // If no results, fetch popular books as suggestions
    if (books.length === 0) {
      const { data: popular } = await supabase
        .from('browse_listings')
        .select('group_key, title, author, cover_url, category, price_from, copy_count')
        .gt('copy_count', 0)
        .order('copy_count', { ascending: false })
        .limit(6)

      if (popular) {
        popularBooks = popular.map((p: any, i: number) => ({
          book_id: i,
          title: p.title,
          author: p.author,
          cover_url: p.cover_url,
          category: p.category,
          slug: null,
          lowest_price: p.price_from,
          copy_count: p.copy_count,
          similarity_score: 0,
        }))
      }
    }
  }

  return (
    <div className="sy-page">

      <SiteNav />

      <div style={{ borderBottom: '1px solid var(--color-rule)', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/" style={{ color: 'var(--color-ink-faint)', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <span style={{ color: 'var(--color-ink)' }}>Search</span>
          </div>
          {q ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 4 }}>
                Results for &ldquo;{q}&rdquo;
              </div>
              <div style={{ fontSize: 15, color: 'var(--color-ink-soft)' }}>
                {formatCount(books.length)} {books.length === 1 ? 'book' : 'books'}
                {bundles.length > 0 ? ` · ${bundles.length} ${bundles.length === 1 ? 'bundle' : 'bundles'}` : ''}
                {' '}found
              </div>
            </>
          ) : (
            <div className="sy-h3">
              Search
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        {bundles.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--color-ink)',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}>
                            Bundles matching &ldquo;{q}&rdquo;
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}>
              {bundles.map((b) => (
                <Link
                  key={b.id}
                  href={`/bundle/${b.id}`}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--color-accent)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 3 }}>
                    {b.covers.slice(0, 4).map((c, i) => (
                      <div key={i} style={{
                        width: 36, height: 54,
                        background: 'var(--color-ground-raised)',
                        borderRadius: 2,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}>
                        {c ? <img src={c} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                    ))}
                    {b.memberCount > 4 && (
                      <div style={{
                        width: 36, height: 54,
                        border: '1px dashed var(--color-accent)',
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-ink-faint)',
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        +{b.memberCount - 4}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1F3329', lineHeight: 1.3 }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
                    {b.memberCount} books · @{b.sellerUsername}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        {q.length === 0 ? (
          <p style={{ color: 'var(--color-ink-faint)', fontSize: 15, textAlign: 'center', paddingTop: 48 }}>
            Use the search bar above to find books by title or author.
          </p>
        ) : books.length === 0 ? (
          <div>
            <div style={{ textAlign: 'center', paddingTop: 48, marginBottom: 40 }}>
              <p style={{ color: 'var(--color-ink-faint)', fontSize: 15, marginBottom: 8 }}>
                No books found for &ldquo;{q}&rdquo;
              </p>
              <Link href="/new" style={{ color: 'var(--color-action)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                Browse all books →
              </Link>
            </div>

            {popularBooks.length > 0 && (
              <div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--color-ink)',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-rule)',
                }}>
                  Popular right now
                </div>
                <BookGrid books={popularBooks} />
              </div>
            )}
          </div>
        ) : (
          <BookGrid books={books} />
        )}
      </div>

      {q.length > 0 && (
        <EventTracker
          eventName="search_performed"
          properties={{ query: q, results_count: books.length }}
        />
      )}

      <Footer />

    </div>
  )
}
