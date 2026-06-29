import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import { resolveBookCover } from '@/app/lib/coverUrl'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SERIF = "var(--font-serif)"

// Browse-by-category chips, in the order specified by the redesign,
// wired to the existing /category/[slug] routes.
const CATEGORY_CHIPS: Array<{ slug: string; name: string }> = [
  { slug: 'fiction', name: 'Fiction' },
  { slug: 'crime-thriller', name: 'Crime & Thriller' },
  { slug: 'self-help', name: 'Self-Help' },
  { slug: 'childrens', name: "Children's" },
  { slug: 'sci-fi-fantasy', name: 'Sci-Fi & Fantasy' },
  { slug: 'biography-memoir', name: 'Biography & Memoir' },
  { slug: 'history', name: 'History' },
  { slug: 'romance', name: 'Romance' },
  { slug: 'cookery-food', name: 'Cookery & Food' },
  { slug: 'literary-fiction', name: 'Literary Fiction' },
  { slug: 'young-adult', name: 'Young Adult' },
  { slug: 'travel', name: 'Travel' },
  { slug: 'reference-education', name: 'Reference & Education' },
  { slug: 'business-finance', name: 'Business & Finance' },
  { slug: 'classic-fiction', name: 'Classic Fiction' },
  { slug: 'art-photography', name: 'Art & Photography' },
]

// Condition chip palette (matches the redesign tokens).
const CONDITION_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  like_new: { label: 'Like New', bg: '#DCFCE7', color: '#166534' },
  very_good: { label: 'Very Good', bg: '#DBEAFE', color: '#1E40AF' },
  good: { label: 'Good', bg: '#FEF9C3', color: '#854D0E' },
  acceptable: { label: 'Acceptable', bg: '#F0EDE8', color: '#666666' },
}

// Brand cover swatches — used for the phone-mockup mini covers and as a
// fallback when a listing has no cover image.
const SWATCHES = [
  '#2D4A3E', '#8a4b2f', '#21304a', '#C9A24B', '#b9542f', '#1F3329',
  '#3f6f6a', '#5a6b8f', '#334155', '#6b3b2f', '#a8693f', '#caa64b',
]

// Layout-reference fallback. Only rendered if the marketplace returns no
// live listings (e.g. empty staging DB) so the section never looks broken.
const SAMPLE_BOOKS = [
  { title: 'Atomic Habits', author: 'James Clear', price: 6.5, condition: 'like_new' },
  { title: 'The Psychology of Money', author: 'Morgan Housel', price: 5.75, condition: 'very_good' },
  { title: 'Piranesi', author: 'Susanna Clarke', price: 6.0, condition: 'very_good' },
  { title: 'Intermezzo', author: 'Sally Rooney', price: 3.0, condition: 'very_good' },
  { title: 'Crying in H Mart', author: 'Michelle Zauner', price: 4.2, condition: 'very_good' },
  { title: 'The Midnight Library', author: 'Matt Haig', price: 4.5, condition: 'good' },
  { title: 'Convenience Store Woman', author: 'Sayaka Murata', price: 8.0, condition: 'very_good' },
  { title: 'Educated', author: 'Tara Westover', price: 5.5, condition: 'like_new' },
  { title: 'Deep Work', author: 'Cal Newport', price: 4.25, condition: 'very_good' },
  { title: 'The Mountains Sing', author: 'Quế Mai', price: 5.0, condition: 'good' },
  { title: 'Sapiens', author: 'Y. N. Harari', price: 6.0, condition: 'good' },
  { title: 'Normal People', author: 'Sally Rooney', price: 4.25, condition: 'good' },
]

type LiveListing = {
  id: number
  title: string
  author: string | null
  price: number
  condition: string
  cover: string | null
}

function ConditionChip({ condition }: { condition: string }) {
  const c = CONDITION_CHIP[condition] ?? CONDITION_CHIP.good
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

export default async function Home() {
  // Freshest active listings with a usable cover, for the live grid + phone.
  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, author, asking_price_gbp, condition, books(cover_url, cover_url_hosted), listing_images(url, sort_order)')
    .eq('status', 'active')
    .not('book_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40)

  type RawListingRow = {
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    books: { cover_url: string | null; cover_url_hosted?: string | null } | null
    listing_images: Array<{ url: string; sort_order: number }> | null
  }

  const liveBooks: LiveListing[] = ((recentListings ?? []) as unknown as RawListingRow[])
    .map((l) => ({
      id: l.id,
      title: l.title,
      author: l.author,
      price: Number(l.asking_price_gbp),
      condition: l.condition,
      cover: resolveBookCover(l.books, l.listing_images),
    }))
    .filter((l) => l.cover)

  const gridBooks = liveBooks.slice(0, 12)
  const phoneBooks = liveBooks.slice(0, 3)
  const usingSample = gridBooks.length === 0

  return (
    <main style={{ background: '#FAF8F5', color: '#1A1A1A', overflow: 'hidden' }}>
      <style>{`
        @keyframes syssPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes syssScan { 0% { top: 6% } 100% { top: 90% } }

        .syss-hero-grid { display: grid; grid-template-columns: 1.08fr .92fr; gap: 44px; align-items: center; }
        .syss-hero-h1 { font-size: 76px; }
        .syss-stat-row { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; }
        .syss-stat { padding: 30px 16px; border-right: 1px solid rgba(250,248,245,.14); }
        .syss-stat:last-child { border-right: none; }
        .syss-steps { display: grid; grid-template-columns: repeat(3, 1fr); }
        .syss-step { padding: 36px 32px; border-right: 1px solid #E5E3DF; }
        .syss-step:last-child { border-right: none; }
        .syss-mkt-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; }

        .syss-card { display: block; text-decoration: none; color: inherit; background: #fff; border: 1px solid #E5E3DF; border-radius: 14px; overflow: hidden; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .syss-card:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(31,51,41,.16); border-color: #D8D5CF; }
        .syss-chip { transition: background .15s ease, border-color .15s ease; }
        .syss-chip:hover { background: #FAF8F5; border-color: #D8D5CF; }
        .syss-pill { transition: border-color .15s ease, background .15s ease; }
        .syss-pill:hover { border-color: #D8D5CF; }

        @media (max-width: 900px) {
          .syss-hero-grid { grid-template-columns: 1fr; gap: 36px; }
          .syss-hero-h1 { font-size: 52px; }
        }
        @media (max-width: 1000px) { .syss-mkt-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px) {
          .syss-steps { grid-template-columns: 1fr; }
          .syss-step { border-right: none; border-bottom: 1px solid #E5E3DF; }
          .syss-step:last-child { border-bottom: none; }
        }
        @media (max-width: 600px) {
          .syss-stat-row { grid-template-columns: 1fr; }
          .syss-stat { border-right: none; border-bottom: 1px solid rgba(250,248,245,.14); }
          .syss-stat:last-child { border-bottom: none; }
        }
        @media (max-width: 560px) {
          .syss-mkt-grid { grid-template-columns: repeat(2, 1fr); }
          .syss-hero-h1 { font-size: 42px; }
        }
      `}</style>

      {/* ===== HERO (dark scan) ===== */}
      <div style={{ background: '#2D4A3E', color: '#FAF8F5', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 76% 28%, #3B5249, transparent 52%)', opacity: 0.7 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <SiteNav />
        </div>

        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '62px 40px 0' }} className="syss-hero-grid">
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: 'rgba(250,248,245,.12)', color: '#FAF8F5', border: '1px solid rgba(250,248,245,.2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FAF8F5', animation: 'syssPulse 2s infinite' }} />
              40,000+ books and counting
            </span>
            <h1 className="syss-hero-h1" style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 0.98, margin: '20px 0 0', color: '#fff' }}>
              Scan your shelf.<br />
              Watch it turn to <span style={{ fontStyle: 'italic', fontWeight: 900 }}>cash.</span>
            </h1>
            <p style={{ fontSize: 20, opacity: 0.85, lineHeight: 1.5, margin: '22px 0 0', maxWidth: 440 }}>
              Point your camera at your bookcase. We identify every book, price it, and list it — about 30 books in 90 seconds.
            </p>
            <div style={{ margin: '32px 0 8px' }}>
              <AppBadges utm={{ source: 'homepage', medium: 'hero', campaign: 'get_the_app' }} size="lg" layout="auto" />
            </div>
          </div>

          {/* Phone mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <div style={{ position: 'relative', width: 290, background: '#0e1714', borderRadius: 42, padding: 11, boxShadow: '0 40px 80px rgba(0,0,0,.42)' }}>
              <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 96, height: 24, background: '#0e1714', borderRadius: 999, zIndex: 5 }} />
              <div style={{ background: '#FAF8F5', borderRadius: 32, overflow: 'hidden', height: 540, position: 'relative' }}>
                <div style={{ background: '#fff', padding: '16px 18px', borderBottom: '1px solid #F0EDE8', textAlign: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1A1A1A' }}>Scan your shelf</span>
                </div>
                <div style={{ position: 'relative', height: 236, background: '#1F3329', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 5, alignItems: 'flex-end', justifyContent: 'center', padding: '22px 16px 0' }}>
                    <span style={{ width: 26, height: '84%', background: '#7a8b6f', borderRadius: 2 }} />
                    <span style={{ width: 20, height: '72%', background: '#b9542f', borderRadius: 2 }} />
                    <span style={{ width: 30, height: '92%', background: '#caa64b', borderRadius: 2 }} />
                    <span style={{ width: 18, height: '66%', background: '#3f6f8f', borderRadius: 2 }} />
                    <span style={{ width: 28, height: '80%', background: '#8a8f7a', borderRadius: 2 }} />
                    <span style={{ width: 22, height: '74%', background: '#a8693f', borderRadius: 2 }} />
                    <span style={{ width: 24, height: '88%', background: '#5a6b8f', borderRadius: 2 }} />
                  </div>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#fff', boxShadow: '0 0 18px 4px rgba(255,255,255,.7)', animation: 'syssScan 2.4s ease-in-out infinite alternate' }} />
                  <div style={{ position: 'absolute', left: 14, bottom: 12, background: 'rgba(255,255,255,.95)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#2D4A3E' }}>
                    7 spines found
                  </div>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {(phoneBooks.length > 0
                    ? phoneBooks.map((b, i) => ({ t: b.title, a: b.author ?? '', p: b.price.toFixed(2), bg: SWATCHES[i % SWATCHES.length] }))
                    : SAMPLE_BOOKS.slice(0, 3).map((b, i) => ({ t: b.title, a: b.author, p: b.price.toFixed(2), bg: SWATCHES[i % SWATCHES.length] }))
                  ).map((b, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #F0EDE8', borderRadius: 11, padding: 9, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 30, height: 44, borderRadius: 3, flex: 'none', background: b.bg }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.t}</div>
                        <div style={{ fontSize: 10.5, color: '#999' }}>{b.a}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2D4A3E' }}>£{b.p}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stat band */}
        <div style={{ position: 'relative', borderTop: '1px solid rgba(250,248,245,.14)', marginTop: 56 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }} className="syss-stat-row">
            <div className="syss-stat">
              <div style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 44, color: '#fff', lineHeight: 1 }}>90s</div>
              <div style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>to scan a full shelf</div>
            </div>
            <div className="syss-stat">
              <div style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 44, color: '#fff', lineHeight: 1 }}>£4–6</div>
              <div style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>kept per book sold</div>
            </div>
            <div className="syss-stat">
              <div style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 44, color: '#fff', lineHeight: 1 }}>£2.50</div>
              <div style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>flat shipping, paid by buyer</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SOCIAL PROOF BAR ===== */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E3DF' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '14px 34px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: '#666', fontWeight: 500 }}>
            <span style={{ color: '#C9A24B', letterSpacing: 1 }}>★★★★★</span> 4.8 on the App Store
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#666', fontWeight: 500 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#2D4A3E" strokeWidth="2"><path d="M12 1l3 6 6 .8-4.5 4.3 1.2 6.1L12 19l-5.9 3.2 1.2-6.1L3 7.8 9 7z" /></svg>
            40,000+ books listed
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#666', fontWeight: 500 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#2D4A3E" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>
            Secure payments by Stripe
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#666', fontWeight: 500 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#2D4A3E" strokeWidth="2"><path d="M12 3l8 4v5c0 4.4-3.1 7.6-8 9-4.9-1.4-8-4.6-8-9V7z" /><path d="M9 12l2 2 4-4" /></svg>
            Buyer protection included
          </span>
        </div>
      </div>

      {/* ===== THREE STEPS ===== */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 40px 40px' }}>
        <div style={{ maxWidth: 620, margin: '0 0 48px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2D4A3E' }}>Three steps. That&apos;s it.</span>
          <h2 style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 46, color: '#1A1A1A', margin: '12px 0 0', lineHeight: 1.04 }}>
            Selling books has never been this lazy
          </h2>
        </div>
        <div className="syss-steps" style={{ border: '1px solid #E5E3DF', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
          {[
            { n: '01', t: 'Scan your shelf', d: 'Pan your camera across the spines. Our AI reads every title in real time — about 30 books in 90 seconds.' },
            { n: '02', t: 'Review & price', d: 'We check live market data and suggest a fair price for each book. Accept it, or set your own — you’re in control.' },
            { n: '03', t: 'Ship & get paid', d: 'Drop it at any Yodel point with the £2.50 label — no printer needed. Cash lands once it’s delivered.' },
          ].map((s) => (
            <div key={s.n} className="syss-step">
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 52, lineHeight: 1, color: 'transparent', WebkitTextStroke: '1.5px #2D4A3E' }}>{s.n}</div>
              <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 23, color: '#1A1A1A', margin: '16px 0 9px' }}>{s.t}</h3>
              <p style={{ color: '#666', fontSize: 15, lineHeight: 1.55, margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== LIVE MARKETPLACE ===== */}
      <div style={{ background: '#fff', borderTop: '1px solid #E5E3DF', borderBottom: '1px solid #E5E3DF', marginTop: 48 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 36, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2D4A3E' }}>Live on the marketplace</span>
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 38, color: '#1A1A1A', margin: '12px 0 0' }}>What&apos;s selling right now</h2>
            </div>
            <Link href="/new" className="syss-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#2D4A3E', border: '1.5px solid #E5E3DF', background: '#fff', padding: '11px 20px', borderRadius: 999, textDecoration: 'none' }}>
              See all →
            </Link>
          </div>
          <div className="syss-mkt-grid">
            {usingSample
              ? SAMPLE_BOOKS.map((b, i) => (
                  <div key={i} className="syss-card">
                    <div style={{ aspectRatio: '2/3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 12, background: SWATCHES[i % SWATCHES.length], color: '#FAF8F5' }}>
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.5 }}>Sell Your Shelf</div>
                      <div>
                        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 13.5, lineHeight: 1.12 }}>{b.title}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.78, marginTop: 5 }}>{b.author}</div>
                      </div>
                    </div>
                    <div style={{ padding: '11px 12px 13px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                      <div style={{ fontSize: 11.5, color: '#999', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#2D4A3E' }}>£{b.price.toFixed(2)}</span>
                        <ConditionChip condition={b.condition} />
                      </div>
                    </div>
                  </div>
                ))
              : gridBooks.map((b, i) => (
                  <Link key={b.id} href={`/listing/${b.id}`} className="syss-card">
                    <div style={{ aspectRatio: '2/3', background: SWATCHES[i % SWATCHES.length], overflow: 'hidden' }}>
                      <img src={b.cover!} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ padding: '11px 12px 13px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                      <div style={{ fontSize: 11.5, color: '#999', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#2D4A3E' }}>£{b.price.toFixed(2)}</span>
                        <ConditionChip condition={b.condition} />
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </div>

      {/* ===== BROWSE BY CATEGORY ===== */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px 24px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2D4A3E' }}>For readers</span>
        <h2 style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 38, color: '#1A1A1A', margin: '12px 0 26px' }}>Browse by category</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 920, margin: '0 auto' }}>
          {CATEGORY_CHIPS.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="syss-chip" style={{ fontSize: 13.5, fontWeight: 500, padding: '9px 16px', borderRadius: 999, border: '1px solid #E5E3DF', background: '#fff', color: '#1A1A1A', textDecoration: 'none' }}>
              {c.name}
            </Link>
          ))}
          <Link href="/new" style={{ fontSize: 13.5, fontWeight: 600, padding: '9px 16px', borderRadius: 999, border: '1px solid #2D4A3E', background: '#2D4A3E', color: '#FAF8F5', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>
      </div>

      {/* ===== FINAL CTA ===== */}
      <div style={{ padding: '64px 40px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', background: '#2D4A3E', color: '#FAF8F5', borderRadius: 28, padding: '60px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, #3B5249, transparent 55%)', opacity: 0.6 }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 600, letterSpacing: '-.02em', fontSize: 46, color: '#fff', lineHeight: 1.05 }}>
              Your next chapter starts<br />with a clear shelf.
            </h2>
            <p style={{ fontSize: 17, opacity: 0.85, maxWidth: 480, margin: '16px auto 28px' }}>
              Download the app, scan your shelf, and watch your books turn into cash.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <AppBadges utm={{ source: 'homepage', medium: 'final_cta', campaign: 'get_the_app' }} size="md" layout="auto" align="center" />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
