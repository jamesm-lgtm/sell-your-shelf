/**
 * /bundle/[id] — product page for a single bundle (slice L14).
 *
 * Per-bundle shareable URL with full description, big cover stack,
 * itemised member list, and per-listing tap-through. Server-rendered;
 * the Add-to-Basket affordance is a small client island so we keep
 * BasketProvider context out of the page tree everywhere else.
 *
 * OG metadata makes share cards on Twitter/FB show the bundle name,
 * cover, and savings line.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import BundleDetailAddButton, {
  type BundleDetailMember,
} from '@/app/components/BundleDetailAddButton'
import ShareButton from '@/app/components/ShareButton'
import { computeBundlePricing } from '@/app/lib/bundlePricing'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'

const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

type RawBundleListing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  format: 'paperback' | 'hardback' | null
  status: string
  user_id: string
  books: { cover_url: string | null; cover_url_hosted: string | null; category: string | null } | null
}
type RawBundle = {
  id: number
  name: string
  description: string | null
  pricing_mode: 'discount' | 'absolute'
  discount_pct: number | null
  price_gbp: number | null
  status: string
  seller_id: string
  seller: { username: string; deleted_at: string | null } | { username: string; deleted_at: string | null }[] | null
  bundle_items: Array<{
    listing_id: number
    sort_order: number
    listing: RawBundleListing | RawBundleListing[] | null
  }>
}

async function loadBundle(idStr: string) {
  const id = Number(idStr)
  if (!Number.isInteger(id) || id <= 0) return null

  const { data, error } = await supabase
    .from('bundles')
    .select(
      `
      id,
      name,
      description,
      pricing_mode,
      discount_pct,
      price_gbp,
      status,
      seller_id,
      seller:users!inner ( username, deleted_at ),
      bundle_items (
        listing_id,
        sort_order,
        listing:listings!inner (
          id, title, author, asking_price_gbp, condition, format, status, user_id,
          books ( cover_url, cover_url_hosted, category )
        )
      )
      `,
    )
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as unknown as RawBundle
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bundle = await loadBundle(id)
  if (!bundle || bundle.status !== 'active') {
    return { title: 'Bundle not found — Sell Your Shelf' }
  }
  const seller = Array.isArray(bundle.seller) ? bundle.seller[0] : bundle.seller
  return {
    title: `${bundle.name} — bundle from @${seller?.username} — Sell Your Shelf`,
    description:
      bundle.description ??
      `${bundle.bundle_items.length} books bundled together by @${seller?.username} on Sell Your Shelf.`,
    openGraph: {
      title: `${bundle.name} — bundle from @${seller?.username}`,
      description:
        bundle.description ??
        `${bundle.bundle_items.length} books bundled together. One shipment, one discount.`,
      // `images` omitted so the opengraph-image route supplies the card
      // (cover stack + saving, sized 1200×630 for share clients).
      url: `https://www.sellyourshelf.com/bundle/${bundle.id}`,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bundle = await loadBundle(id)

  if (!bundle || bundle.status !== 'active') return notFound()
  const seller = Array.isArray(bundle.seller) ? bundle.seller[0] : bundle.seller
  if (!seller || seller.deleted_at) return notFound()

  // Hydrate members — extract from the nested join.
  const sortedItems = [...bundle.bundle_items].sort((a, b) => a.sort_order - b.sort_order)
  type Member = {
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    format: 'paperback' | 'hardback' | null
    coverUrl: string | null
    category: string | null
  }
  const members: Member[] = []
  for (const it of sortedItems) {
    const l = Array.isArray(it.listing) ? it.listing[0] : it.listing
    if (!l || l.status !== 'active') continue
    members.push({
      id: l.id,
      title: l.title,
      author: l.author,
      asking_price_gbp: Number(l.asking_price_gbp),
      condition: l.condition,
      format: l.format,
      coverUrl: l.books?.cover_url_hosted || l.books?.cover_url || null,
      category: l.books?.category ?? null,
    })
  }
  if (members.length < 2) return notFound()

  // Compute pricing once, server-side. Lines map gives us each
  // member's effective price + discount for the basket items the
  // add button will write.
  const pricing = computeBundlePricing({
    listings: members.map((m) => ({
      listingId: m.id,
      askingPriceGbp: Number(m.asking_price_gbp),
    })),
    pricingMode: bundle.pricing_mode,
    discountPct: bundle.discount_pct ?? undefined,
    priceGbp: bundle.price_gbp != null ? Number(bundle.price_gbp) : undefined,
  })
  const lineById = new Map(pricing.lines.map((l) => [l.listingId, l]))

  const detailMembers: BundleDetailMember[] = members.map((m) => {
    const line = lineById.get(m.id)
    return {
      id: m.id,
      title: m.title,
      author: m.author,
      asking_price_gbp: m.asking_price_gbp,
      condition: m.condition,
      format: m.format,
      coverUrl: m.coverUrl,
      category: m.category,
      effectivePriceGbp: line?.effectivePriceGbp ?? m.asking_price_gbp,
      discountGbp: line?.discountGbp ?? 0,
    }
  })

  return (
    <div className="sy-page">
      <SiteNav current="bundles" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        {/* Where you are, and what you can do with this page. Share used to
            sit under the buy button at equal width; this page does have a
            utility row, so the exception that kept it there no longer holds. */}
        <div className="sy-pagebar">
          <div className="sy-crumbs">
            <Link href="/">Home</Link>
            <span className="sy-crumb-sep">/</span>
            <Link href="/bundles">Bundles</Link>
            <span className="sy-crumb-sep">/</span>
            <span className="sy-crumb-here sy-crumb-clip">{bundle.name}</span>
          </div>
          <ShareButton
            url={`https://www.sellyourshelf.com/bundle/${bundle.id}`}
            title={`${bundle.name} — bundle from @${seller.username}`}
            description={bundle.description}
            kind="bundle"
            compact
          />
        </div>

        {/* Hero — covers + headline */}
        <div style={{ marginBottom: 40 }}>
          {/* Every cover, at the size covers get everywhere else. This is the
              page for the whole set — there is nothing to truncate to. */}
          <div className="sy-bundle-hero">
            {detailMembers.map((m) => (
              <div key={m.id} className="sy-cover" title={m.title}>
                {m.coverUrl ? <img src={m.coverUrl} alt={m.title} /> : null}
              </div>
            ))}
          </div>

          <h1 className="sy-h2" style={{ margin: '0 0 8px' }}>
            {bundle.name}
          </h1>

          {/* Seller */}
          <Link
            href={`/${seller.username}`}
            style={{ fontSize: 13, color: FOREST, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}
          >
            from @{seller.username} →
          </Link>

          {/* Price block */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: FOREST_DEEP }}>
              £{pricing.bundlePriceGbp.toFixed(2)}
            </span>
            {pricing.totalDiscountGbp > 0 && (
              <>
                <span style={{ fontSize: 16, color: 'var(--color-ink-faint)', textDecoration: 'line-through' }}>
                  £{pricing.subtotalGbp.toFixed(2)}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: FOREST }}>
                  Save £{pricing.totalDiscountGbp.toFixed(2)}
                </span>
              </>
            )}
          </div>
          {pricing.qualifiesForFreeShipping && (
            <div style={{ fontSize: 12, color: FOREST, fontWeight: 600, marginBottom: 14 }}>
              ✓ Free shipping included
            </div>
          )}

          {/* Description */}
          {bundle.description && (
            <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', lineHeight: 1.6, margin: '14px 0 20px', fontStyle: 'italic' }}>
              {bundle.description}
            </p>
          )}

          <div style={{ maxWidth: 380 }}>
            <BundleDetailAddButton
              bundleId={bundle.id}
              bundleName={bundle.name}
              members={detailMembers}
              seller={{ sellerId: bundle.seller_id, sellerUsername: seller.username }}
            />
          </div>
        </div>

        {/* Books in this bundle */}
        <h2 className="sy-h3" style={{ margin: '0 0 4px' }}>
          Books in this bundle
        </h2>
        <div>
          {detailMembers.map((m) => (
            <Link
              key={m.id}
              href={`/listing/${m.id}`}
              className="sy-member-row"
            >
              <div className="sy-cover" style={{ width: 54, flex: '0 0 54px' }}>
                {m.coverUrl ? <img src={m.coverUrl} alt={m.title} /> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sy-member-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.32, marginBottom: 3 }}>
                  {m.title}
                </div>
                {m.author && (
                  <div style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>{m.author}</div>
                )}
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: FOREST_DEEP }}>
                    £{m.effectivePriceGbp.toFixed(2)}
                  </span>
                  {m.discountGbp > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--color-ink-faint)', textDecoration: 'line-through' }}>
                      £{m.asking_price_gbp.toFixed(2)}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--color-ink-soft)', background: 'var(--color-paper-warm)', padding: '2px 8px', borderRadius: 3 }}>
                    {CONDITION_LABELS[m.condition] ?? m.condition}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: FOREST, fontWeight: 600, whiteSpace: 'nowrap' }}>
                View →
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginTop: 24, lineHeight: 1.6 }}>
          Bundles ship together in one parcel. The discount is applied automatically at checkout. Remove any item from
          your basket and the bundle discount drops — the remaining items charge at their normal price.
        </p>
      </div>

      <Footer />
    </div>
  )
}
