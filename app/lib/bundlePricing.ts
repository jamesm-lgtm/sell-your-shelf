// Client-side bundle pricing for the website. Third copy of the
// canonical algorithm — must stay in lock-step with:
//   - mobile/utils/bundlePricing.ts (RN bundler)
//   - supabase/functions/_shared/bundlePricing.ts (Deno, server-of-truth)
//
// Used by BundlesRow on the shelf page (slice 8) and the bundle strip
// on the book detail page (slice 9) to show the buyer "Save £X" and
// preview the per-item effective prices before adding to basket.
//
// Pure, no I/O. If the algorithm here ever drifts from the server,
// the buyer-side preview will disagree with the actual charge — keep
// these in sync.

export type PricingMode = 'discount' | 'absolute'

export interface BundleListingInput {
  listingId: number
  askingPriceGbp: number
}

export interface BundlePricingInput {
  listings: BundleListingInput[]
  pricingMode: PricingMode
  discountPct?: number
  priceGbp?: number
}

export interface BundlePricingLine {
  listingId: number
  originalPriceGbp: number
  effectivePriceGbp: number
  discountGbp: number
  platformFeeGbp: number
  sellerPayoutGbp: number
}

export interface BundlePricingResult {
  subtotalGbp: number
  bundlePriceGbp: number
  totalDiscountGbp: number
  effectiveDiscountPct: number
  lines: BundlePricingLine[]
  totalPlatformFeeGbp: number
  totalSellerPayoutGbp: number
  qualifiesForFreeShipping: boolean
}

const FREE_SHIPPING_THRESHOLD_GBP = 10
const FLAT_FEE_GBP = 1.0
const FLAT_FEE_PRICE_CEILING_GBP = 5.0
const PERCENT_FEE_RATE = 0.20

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function platformFeeFor(effectivePriceGbp: number): number {
  if (effectivePriceGbp < FLAT_FEE_PRICE_CEILING_GBP) return FLAT_FEE_GBP
  return round2(effectivePriceGbp * PERCENT_FEE_RATE)
}

export function computeBundlePricing(input: BundlePricingInput): BundlePricingResult {
  const listings = input.listings

  if (listings.length === 0) {
    return {
      subtotalGbp: 0,
      bundlePriceGbp: 0,
      totalDiscountGbp: 0,
      effectiveDiscountPct: 0,
      lines: [],
      totalPlatformFeeGbp: 0,
      totalSellerPayoutGbp: 0,
      qualifiesForFreeShipping: false,
    }
  }

  const subtotal = round2(
    listings.reduce((sum, l) => sum + Number(l.askingPriceGbp), 0),
  )

  let bundlePrice: number
  if (input.pricingMode === 'discount') {
    const pct = Number(input.discountPct)
    if (!Number.isFinite(pct)) {
      throw new Error('computeBundlePricing: discountPct required for discount mode')
    }
    bundlePrice = round2(subtotal * (1 - pct / 100))
  } else {
    const px = Number(input.priceGbp)
    if (!Number.isFinite(px) || px <= 0) {
      throw new Error('computeBundlePricing: priceGbp required and > 0 for absolute mode')
    }
    bundlePrice = round2(Math.min(px, subtotal))
  }

  const totalDiscount = round2(subtotal - bundlePrice)
  const effectivePct = subtotal > 0 ? round2((totalDiscount / subtotal) * 100) : 0

  const ratio = subtotal > 0 ? bundlePrice / subtotal : 0
  const rawEffective = listings.map((l) => round2(Number(l.askingPriceGbp) * ratio))
  const sumEffective = round2(rawEffective.reduce((s, v) => s + v, 0))
  const remainder = round2(bundlePrice - sumEffective)

  if (remainder !== 0) {
    let maxIdx = 0
    for (let i = 1; i < listings.length; i++) {
      if (Number(listings[i].askingPriceGbp) > Number(listings[maxIdx].askingPriceGbp)) {
        maxIdx = i
      }
    }
    rawEffective[maxIdx] = round2(rawEffective[maxIdx] + remainder)
  }

  const lines: BundlePricingLine[] = listings.map((l, i) => {
    const original = round2(Number(l.askingPriceGbp))
    const effective = rawEffective[i]
    const discount = round2(original - effective)
    const fee = platformFeeFor(effective)
    const payout = round2(effective - fee)
    return {
      listingId: l.listingId,
      originalPriceGbp: original,
      effectivePriceGbp: effective,
      discountGbp: discount,
      platformFeeGbp: fee,
      sellerPayoutGbp: payout,
    }
  })

  const totalFee = round2(lines.reduce((s, l) => s + l.platformFeeGbp, 0))
  const totalPayout = round2(lines.reduce((s, l) => s + l.sellerPayoutGbp, 0))

  return {
    subtotalGbp: subtotal,
    bundlePriceGbp: bundlePrice,
    totalDiscountGbp: totalDiscount,
    effectiveDiscountPct: effectivePct,
    lines,
    totalPlatformFeeGbp: totalFee,
    totalSellerPayoutGbp: totalPayout,
    qualifiesForFreeShipping: bundlePrice >= FREE_SHIPPING_THRESHOLD_GBP,
  }
}
