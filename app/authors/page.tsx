import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import { INDEX_THRESHOLD } from '@/app/lib/authorHub'

export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

export const metadata: Metadata = {
  title: 'Browse by author — Sell Your Shelf',
  description:
    'Every author we currently hold five or more second-hand copies of. Free delivery when you spend £10 with one seller.',
  alternates: { canonical: 'https://www.sellyourshelf.com/authors' },
}

type Row = {
  slug: string
  display_name: string
  kind: string
  live_copies: number
  live_titles: number
}

/**
 * The index of author hubs.
 *
 * It exists because the hubs shipped with no way in. Book and listing pages
 * now link to the author they're by, but that only helps someone who already
 * landed on a book — there was no route for "show me who you have" and no
 * single crawl path to all of them. One page fixes both.
 *
 * Deliberately not paginated or filtered. At 162 entries the whole thing fits
 * in one scan, and every extra control is a place for a crawler to get lost.
 */
export default async function AuthorsIndex() {
  const { data, error } = await supabase
    .from('author_live_counts')
    .select('slug, display_name, kind, live_copies, live_titles')
    .gte('live_copies', INDEX_THRESHOLD)
    .order('display_name', { ascending: true })

  if (error) console.error('[authors index]', error.message)

  const rows = (data ?? []) as Row[]
  const authors = rows.filter((r) => r.kind !== 'publisher')
  const publishers = rows.filter((r) => r.kind === 'publisher')

  // Alphabetical sections, because this is a directory and people scan it by
  // letter. Anything not starting A–Z lands under # rather than inventing a
  // section per stray character.
  const letterOf = (name: string) => {
    const c = name.trim()[0]?.toUpperCase() ?? '#'
    return c >= 'A' && c <= 'Z' ? c : '#'
  }
  const sections = new Map<string, Row[]>()
  for (const a of authors) {
    const l = letterOf(a.display_name)
    sections.set(l, [...(sections.get(l) ?? []), a])
  }
  const letters = [...sections.keys()].sort()

  const totalCopies = rows.reduce((n, r) => n + r.live_copies, 0)

  return (
    <div className="sy-page">
      <SiteNav />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 64px' }}>
        <div className="sy-pagebar">
          <div className="sy-crumbs">
            <Link href="/">Home</Link>
            <span className="sy-crumb-sep">/</span>
            <span className="sy-crumb-here">Authors</span>
          </div>
        </div>

        <h1 className="sy-h2" style={{ marginBottom: 8 }}>Browse by author</h1>
        <p style={{ fontSize: 16, color: 'var(--color-ink-soft)', marginBottom: 32, maxWidth: '62ch' }}>
          {rows.length} authors and publishers we hold at least {INDEX_THRESHOLD} second-hand copies
          of right now — {totalCopies.toLocaleString('en-GB')} books in total. Everything is sold by
          someone clearing their shelves, and delivery is free when you spend £10 with one seller.
        </p>

        {letters.length > 0 && (
          <nav className="sy-azbar" aria-label="Jump to letter">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l}`} className="sy-azbar-link">{l}</a>
            ))}
          </nav>
        )}

        {letters.map((letter) => (
          <section key={letter} id={`letter-${letter}`} className="sy-azsection">
            <h2 className="sy-azletter">{letter}</h2>
            <ul className="sy-azlist">
              {(sections.get(letter) ?? []).map((a) => (
                <li key={a.slug}>
                  <Link href={`/author/${a.slug}`} className="sy-azitem">
                    <span className="sy-azname">{a.display_name}</span>
                    <span className="sy-azcount">
                      {a.live_copies} {a.live_copies === 1 ? 'copy' : 'copies'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {publishers.length > 0 && (
          <section className="sy-azsection" id="publishers">
            {/* Kept separate rather than filed under P. CGP Books is the
                biggest cluster on the site and the only one already ranking,
                because revision-guide buyers search by publisher — calling it
                an author would misrepresent what it is. */}
            <h2 className="sy-azletter">Publishers</h2>
            <ul className="sy-azlist">
              {publishers.map((p) => (
                <li key={p.slug}>
                  <Link href={`/publisher/${p.slug}`} className="sy-azitem">
                    <span className="sy-azname">{p.display_name}</span>
                    <span className="sy-azcount">
                      {p.live_copies} {p.live_copies === 1 ? 'copy' : 'copies'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rows.length === 0 && (
          <p style={{ fontSize: 16, color: 'var(--color-ink-soft)' }}>
            Nothing to list right now. <Link href="/new" className="sy-textlink">Browse what&apos;s in stock</Link>.
          </p>
        )}
      </div>

      <Footer />
    </div>
  )
}
