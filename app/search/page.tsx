import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

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

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const q = ((params.q as string) || '').trim()

  let books: BookResult[] = []

  if (q.length > 0) {
    const { data, error } = await supabase.rpc('search_books_fuzzy', {
      search_term: q,
      result_limit: 60,
    })

    if (!error && data) {
      books = data as BookResult[]
    }
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav />

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <span style={{ color: '#666' }}>Search</span>
          </div>
          {q ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
                Results for &ldquo;{q}&rdquo;
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                {books.length} {books.length === 1 ? 'book' : 'books'} found
              </div>
            </>
          ) : (
            <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A' }}>
              Search
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        {q.length === 0 ? (
          <p style={{ color: '#999', fontSize: 15, textAlign: 'center', paddingTop: 48 }}>
            Use the search bar above to find books by title or author.
          </p>
        ) : books.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <p style={{ color: '#999', fontSize: 15, marginBottom: 16 }}>
              No books found for &ldquo;{q}&rdquo;
            </p>
            <Link href="/new" style={{ color: '#2D4A3E', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              Browse all books →
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20,
          }}>
            {books.map((book) => {
              const slug = book.slug || generateSlug(book.title, book.author || '')
              return (
                <Link
                  key={book.book_id}
                  href={`/books/${slug}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    background: '#fff',
                    borderRadius: 10,
                    border: '0.5px solid #E5E3DF',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.15s',
                  }}>
                    {/* Cover */}
                    <div style={{
                      aspectRatio: '2/3',
                      background: '#2D4A3E',
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
                        color: '#1A1A1A',
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
                        color: '#666',
                        marginBottom: 8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {book.author}
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: '#2D4A3E',
                        fontWeight: 600,
                      }}>
                        {book.copy_count} {book.copy_count === 1 ? 'copy' : 'copies'} from £{Number(book.lowest_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Footer />

    </div>
  )
}
