import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import { resolveBookCover } from '@/app/lib/coverUrl'
import { BookCard, BookGrid, formatCount } from '@/app/components/ui'
import { buildFlow, DEFAULT_FLOW_RULES } from '@/app/lib/browseFlow'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Browse-by-category chips, wired to the existing /category/[slug] routes.
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

// Condition reads as a calibration patch: a metered value, not a pastel badge.
const CONDITION_CHIP: Record<string, { label: string; bg: string }> = {
  like_new: { label: 'Like New', bg: 'var(--color-cond-like-new)' },
  very_good: { label: 'Very Good', bg: 'var(--color-cond-very-good)' },
  good: { label: 'Good', bg: 'var(--color-cond-good)' },
  acceptable: { label: 'Acceptable', bg: 'var(--color-cond-acceptable)' },
}

// ColorChecker reference patches. A missing cover becomes a metered chip.
const PATCHES = [
  '#2E8FA6', '#B33A34', '#3A5CA8', '#E0B03C', '#4B8B5A', '#A6417E',
  '#276E80', '#8E2F2A', '#2C477F', '#B98C2E', '#3A6D46', '#7F3161',
]

// Layout-reference fallback, only rendered when the marketplace returns no
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
  category: string | null
  sellerId: string | null
}

function ConditionChip({ condition }: { condition: string }) {
  const c = CONDITION_CHIP[condition] ?? CONDITION_CHIP.good
  return (
    <span className="sl-cond">
      <i style={{ background: c.bg }} aria-hidden />
      {c.label}
    </span>
  )
}

export default async function Home() {
  // The "40,000+" figure was a hardcoded claim PRODUCT.md flagged as
  // unverified. Count it instead — it costs one head request and can
  // never drift from reality.
  const { count: activeCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
  const liveCount = activeCount ?? 0

  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, author, asking_price_gbp, condition, user_id, books(cover_url, cover_url_hosted, category), listing_images(url, sort_order)')
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
    user_id: string | null
    books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
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
      category: l.books?.category ?? null,
      sellerId: l.user_id ?? null,
    }))
    .filter((l) => l.cover)

  // The same gate browse uses. Unfiltered newest-first is precisely where
  // the sub-£1 tail concentrates, and this is the shop window.
  // The gate reads asking_price_gbp; the homepage's own shape calls it
  // price. Without this the price floor compared against undefined and
  // never held anything back.
  const gridBooks = buildFlow(
    liveBooks.map((l) => ({ ...l, asking_price_gbp: l.price })),
    DEFAULT_FLOW_RULES,
  ).flow.slice(0, 12)
  const usingSample = gridBooks.length === 0

  // The metering panel reads real listings. Its total is the honest sum of
  // exactly the rows shown — a measurement, never a claim about a shelf.
  const meterRows = liveBooks.slice(0, 5)
  const meterTotal = meterRows.reduce((sum, b) => sum + b.price, 0)

  return (
    <main style={{ background: 'var(--color-paper)', color: 'var(--color-ink)' }}>
      <SiteNav />

      {/* ===== HERO — the instrument metering a shelf ===== */}
      <section className="sl-hero">
        <div className="sl-hero-inner">
          <div>
            <span className="sl-chip-live">
              <i aria-hidden />
              {formatCount(liveCount)} books available now
            </span>

            <h1 className="sy-display sl-h1">
              Scan your shelf.<br />
              Watch it turn to cash.
            </h1>

            <p className="sl-lede">
              Point your camera at your bookcase. We identify every book, price it, and list it — about 30 books in 90 seconds.
            </p>

            <div style={{ margin: '30px 0 0' }}>
              <AppBadges utm={{ source: 'homepage', medium: 'hero', campaign: 'get_the_app' }} size="lg" layout="auto" />
            </div>
          </div>

          {/* Metering panel — the scan resolving spines into priced rows */}
          <div className="sl-meter">
            <div className="sl-meter-head">
              <span className="sy-mark">Reading shelf</span>
              <span className="sy-mark" style={{ color: 'var(--color-action)' }}>Live</span>
            </div>

            <div className="sl-strip">
              <span className="sl-scanline" aria-hidden />
              {(meterRows.length > 0 ? meterRows : SAMPLE_BOOKS.slice(0, 5)).map((b: any, i: number) => (
                <span
                  key={b.id ?? i}
                  className="sl-spine"
                  style={{ background: PATCHES[i % PATCHES.length] }}
                >
                  {b.cover ? (
                    <img src={b.cover} alt="" />
                  ) : (
                    <em>{b.title.slice(0, 22)}</em>
                  )}
                </span>
              ))}
            </div>

            <ol className="sl-rows">
              {(meterRows.length > 0 ? meterRows : SAMPLE_BOOKS.slice(0, 5)).map((b: any, i: number) => (
                <li key={b.id ?? i} style={{ animationDelay: `${0.18 * i + 0.5}s` }}>
                  <span className="sl-rownum sy-figure">{String(i + 1).padStart(2, '0')}</span>
                  <span className="sl-rowtitle">{b.title}</span>
                  <span className="sl-rowprice sy-figure">£{Number(b.price).toFixed(2)}</span>
                </li>
              ))}
            </ol>

            <div className="sl-total">
              <span className="sy-mark">Total of {(meterRows.length > 0 ? meterRows : SAMPLE_BOOKS.slice(0, 5)).length} listings shown</span>
              <span className="sy-figure sl-totalfig">
                £{(meterTotal > 0 ? meterTotal : SAMPLE_BOOKS.slice(0, 5).reduce((s, b) => s + b.price, 0)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Specification plate — the instrument's data, not a hero-metric row */}
        <div className="sl-spec">
          <dl>
            <div><dt className="sy-mark">Scan a full shelf</dt><dd className="sy-figure">90s</dd></div>
            <div><dt className="sy-mark">Seller take per book</dt><dd className="sy-figure">£2–4</dd></div>
            <div><dt className="sy-mark">Shipping, buyer pays</dt><dd className="sy-figure">£2.50</dd></div>
            <div><dt className="sy-mark">Platform fee</dt><dd className="sy-figure">20%</dd></div>
          </dl>
        </div>
      </section>

      {/* ===== VERIFICATION STRIP ===== */}
      <section className="sl-verify">
        <div className="sl-verify-inner">
          <span><b className="sy-figure">4.8 / 5</b> App Store rating</span>
          <span><b className="sy-figure">{formatCount(liveCount)}</b> books listed</span>
          <span><b>Stripe</b> secure payments</span>
          <span><b>14 days</b> buyer protection</span>
        </div>
      </section>

      {/* ===== THREE STEPS ===== */}
      <section className="sl-sheetband">
        <div className="sl-wrap">
          <h2 className="sy-display sl-h2">Selling books has never been this lazy</h2>
          <div className="sl-steps">
            {[
              { n: '01', t: 'Scan your shelf', d: 'Pan your camera across the spines. Our AI reads every title in real time — about 30 books in 90 seconds.' },
              { n: '02', t: 'Review & price', d: 'We check live market data and suggest a fair price for each book. Accept it, or set your own — you’re in control.' },
              { n: '03', t: 'Ship & get paid', d: 'Drop it at any InPost/Yodel point with the £2.50 label — no printer needed. Cash lands once it’s delivered.' },
            ].map((s) => (
              <div key={s.n} className="sl-step">
                <span className="sl-stepnum sy-figure">{s.n}</span>
                <h3 className="sy-display sl-h3">{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LIVE MARKETPLACE ===== */}
      <section className="sl-market"><div className="sl-market-inner">
        <div className="sl-market-head">
          <h2 className="sy-display sl-h2">What’s selling right now</h2>
          <Link href="/new" className="sl-btn-ghost">See all →</Link>
        </div>

        <BookGrid>
          {(usingSample ? SAMPLE_BOOKS : gridBooks).map((b: any, i: number) => (
            <BookCard
              key={b.id ?? i}
              href={b.id ? `/listing/${b.id}` : undefined}
              book={{
                id: b.id ?? i,
                title: b.title,
                author: b.author,
                price: Number(b.price),
                cover: b.cover ?? null,
              }}
            />
          ))}
        </BookGrid>
        </div>
      </section>

      {/* ===== BROWSE BY CATEGORY ===== */}
      <section className="sl-cats"><div className="sl-cats-inner">
        <h2 className="sy-display sl-h2">Browse by category</h2>
        <div className="sl-catrow">
          {CATEGORY_CHIPS.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="sl-cat">{c.name}</Link>
          ))}
          <Link href="/new" className="sl-cat is-action">View all →</Link>
        </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="sl-wrap sl-cta-wrap">
        <div className="sl-cta">
          <h2 className="sy-display sl-h2" style={{ color: '#fff' }}>
            Your next chapter starts<br />with a clear shelf.
          </h2>
          <p>Download the app, scan your shelf, and watch your books turn into cash.</p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppBadges utm={{ source: 'homepage', medium: 'final_cta', campaign: 'get_the_app' }} size="md" layout="auto" align="center" />
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        /* SELL YOUR SHELF — paper-led, green as punctuation.
           Warm paper carries the reading; green holds the nav, the trust
           band, the closing panel and the footer. Covers are the imagery
           and sit on light, where they carry hardest. */
        @keyframes syRise { from { opacity: .4; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        .sl-wrap { max-width: 1160px; margin: 0 auto; padding: 0 32px; }

        /* Hero — paper */
        .sl-hero { background: var(--color-paper); padding: 76px 0 0; }
        .sl-hero-inner {
          max-width: 1160px; margin: 0 auto; padding: 0 32px;
          display: grid; grid-template-columns: 1fr .9fr; gap: 64px; align-items: center;
        }
        .sl-chip-live {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 8px 16px; border-radius: var(--radius-pill);
          font-size: 13px; font-weight: 500;
          background: var(--color-paper-warm); color: var(--color-ink-soft);
          border: 1px solid var(--color-rule);
        }
        .sl-chip-live i { width: 6px; height: 6px; border-radius: 50%; background: var(--color-action); display: block; }
        .sl-h1 {
          font-family: var(--font-display); font-weight: 600;
          font-size: clamp(38px, 4.4vw, 60px); line-height: 1.08; letter-spacing: -0.014em;
          color: var(--color-ink); margin: 24px 0 0; text-transform: none;
        }
        .sl-lede { font-size: 18px; line-height: 1.62; margin: 22px 0 0; max-width: 470px; color: var(--color-ink-soft); }

        /* Reading-shelf panel — a quiet card on paper */
        .sl-meter { background: var(--color-sheet); border: 1px solid var(--color-rule); border-radius: var(--radius-md); padding: 24px; }
        .sl-meter-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; color: var(--color-ink-faint); }
        .sl-strip { position: relative; display: flex; gap: 8px; padding: 0; background: none; overflow: visible; }
        .sl-spine { position: relative; flex: 1; aspect-ratio: 2/3; overflow: hidden; display: block; border-radius: var(--radius-sm); box-shadow: 0 6px 16px rgba(26,29,27,.18); }
        .sl-spine img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sl-spine em {
          position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 6px;
          font-style: normal; font-size: 12px; font-weight: 600; letter-spacing: .02em;
          color: rgba(255,255,255,0.94); line-height: 1.25; background: var(--color-ground-raised);
        }
        .sl-scanline { display: none; }
        .sl-rows { list-style: none; margin: 22px 0 0; padding: 0; }
        .sl-rows li {
          display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 12px; align-items: baseline;
          padding: 11px 0; border-bottom: 1px solid var(--color-rule);
          animation: syRise .5s ease both;
        }
        .sl-rownum { color: var(--color-ink-faint); font-size: 12px; }
        .sl-rowtitle { color: var(--color-ink); font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sl-rowprice { color: var(--color-ink); font-size: 15px; font-weight: 600; }
        .sl-total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--color-ink); color: var(--color-ink-faint); }
        .sl-totalfig { font-family: var(--font-display); font-size: 32px; font-weight: 600; color: var(--color-ink); }

        /* Stat strip — on paper */
        .sl-spec { max-width: 1160px; margin: 68px auto 0; padding: 0 32px 76px; }
        .sl-spec dl { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; grid-template-rows: auto auto; column-gap: 24px; border-top: 1px solid var(--color-rule); margin: 0; padding-top: 28px; }
        .sl-spec dl > div { display: contents; }
        /* ink-soft, not ink-faint: the faint token is 2.9:1 on paper and
           fails AA. These are labels, not decoration. */
        .sl-spec dt { color: var(--color-ink-soft); margin: 0 0 12px; align-self: start; }
        .sl-spec dd { margin: 0; font-family: var(--font-display); font-size: 32px; font-weight: 600; color: var(--color-ink); }

        /* Trust band — green punctuation */
        .sl-verify { background: var(--color-ground); }
        .sl-verify-inner {
          max-width: 1160px; margin: 0 auto; padding: 18px 32px;
          display: flex; flex-wrap: wrap; gap: 10px 44px; justify-content: center;
          font-size: 14px; color: rgba(255,255,255,0.76);
        }
        .sl-verify-inner b { color: var(--color-paper); font-weight: 600; }

        /* Steps — white sheet, so paper and sheet alternate rather than repeat */
        .sl-sheetband { background: var(--color-sheet); color: var(--color-ink); padding: 92px 0; }
        .sl-h2 {
          font-family: var(--font-display); font-weight: 600; text-transform: none;
          font-size: clamp(28px, 3.2vw, 42px); line-height: 1.12; letter-spacing: -0.014em;
          color: var(--color-ink); margin: 0 0 48px;
        }
        .sl-h3 { font-family: var(--font-display); font-weight: 600; text-transform: none; font-size: 21px; margin: 16px 0 10px; color: var(--color-ink); letter-spacing: -0.008em; }
        .sl-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 44px; border: 0; }
        .sl-step { padding: 0; border: 0; }
        .sl-step p { color: var(--color-ink-soft); font-size: 15px; line-height: 1.64; margin: 0; }
        .sl-stepnum { font-family: var(--font-display); font-size: 13px; letter-spacing: .22em; color: var(--color-action); background: none; padding: 0; }

        /* Marketplace — on paper, covers carrying the colour */
        .sl-market { background: var(--color-paper); }
        .sl-market-inner { max-width: 1160px; margin: 0 auto; padding: 92px 32px 0; }
        .sl-market-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .sl-market-head .sl-h2 { margin-bottom: 0; }
        .sy-grid { margin-top: 44px; }
        .sl-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 30px; margin-top: 40px; }
        .sl-market-head { margin-bottom: 12px; }
        .sl-card { display: flex; flex-direction: column; text-decoration: none; color: var(--color-ink); background: none; border: 0; transition: transform .18s ease; }
        .sl-card:hover { transform: translateY(-4px); }
        .sl-card:hover .sl-cover { box-shadow: 0 18px 34px rgba(26,29,27,.24); }
        .sl-cover { position: relative; display: block; aspect-ratio: 2/3; overflow: hidden; border-radius: var(--radius-sm); box-shadow: 0 8px 20px rgba(26,29,27,.16); transition: box-shadow .18s ease; }
        .sl-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sl-cover em {
          position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 12px;
          font-family: var(--font-display); font-style: normal; font-size: 15px; font-weight: 600;
          color: rgba(255,255,255,0.95); line-height: 1.2; background: var(--color-ground-raised);
        }
        .sl-cardmeta { display: block; padding: 14px 2px 0; }
        .sl-cardtitle { display: block; font-size: 15px; font-weight: 600; color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sl-cardauthor { display: block; font-size: 13px; color: var(--color-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px; }
        .sl-cardfoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
        .sl-price { font-size: 16px; font-weight: 600; color: var(--color-ink); }
        .sl-cond { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-ink-faint); }
        .sl-cond i { width: 7px; height: 7px; border-radius: 50%; display: block; }

        .sl-btn-ghost {
          font-size: 14px; font-weight: 600; color: var(--color-ink);
          border: 1px solid var(--color-rule); border-radius: var(--radius-pill);
          padding: 11px 22px; text-decoration: none; white-space: nowrap;
        }
        .sl-btn-ghost:hover { background: var(--color-paper-warm); }
        .sl-cats { background: var(--color-paper); }
        .sl-cats-inner { max-width: 1160px; margin: 0 auto; padding: 92px 32px 0; }
        .sl-catrow { display: flex; flex-wrap: wrap; gap: 10px; }
        .sl-cat {
          font-size: 14px; font-weight: 500; padding: 10px 18px; text-decoration: none;
          color: var(--color-ink); border: 1px solid var(--color-rule);
          border-radius: var(--radius-pill); background: none;
        }
        .sl-cat:hover { background: var(--color-paper-warm); }
        .sl-cat.is-action { background: var(--color-ground); border-color: var(--color-ground); color: var(--color-paper); }
        .sl-cat.is-action:hover { background: var(--color-ground-deep); border-color: var(--color-ground-deep); }

        /* Closing panel — green punctuation */
        .sl-cta-wrap { background: var(--color-paper); padding: 100px 32px 108px; }
        .sl-cta { max-width: 1096px; margin: 0 auto; background: var(--color-ground); border: 0; border-radius: var(--radius-md); padding: 76px 40px; text-align: center; }
        .sl-cta .sl-h2 { color: var(--color-paper) !important; margin-bottom: 18px; }
        .sl-cta p { color: rgba(255,255,255,0.84); font-size: 16px; max-width: 460px; margin: 0 auto 30px; }

        @media (max-width: 900px) {
          .sl-hero-inner { grid-template-columns: 1fr; gap: 44px; }
          .sl-lede { max-width: none; }
          .sl-spec dl { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; row-gap: 24px; }
          .sl-spec dl > div { display: block; }
          .sl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
          .sl-steps { grid-template-columns: 1fr; gap: 34px; }
        }
        @media (max-width: 640px) {
          .sl-wrap, .sl-hero-inner, .sl-spec, .sl-verify-inner, .sl-market-inner, .sl-cats-inner { padding-left: 20px; padding-right: 20px; }
          .sl-spec dl { grid-auto-flow: row; grid-template-columns: minmax(0, 1fr); grid-template-rows: none; row-gap: 20px; }
          .sl-spec dl > div { display: block; }
          .sl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
          .sl-cta { padding: 46px 22px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sl-rows li { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </main>
  )
}
