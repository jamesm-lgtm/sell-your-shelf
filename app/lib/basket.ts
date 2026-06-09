// Client-side basket model. localStorage only — no Supabase persistence in Phase 1.
// Single seller per basket. Free shipping over £10, flat £2.50 below threshold.
// Soft warn at 5kg (parcel still ships at flat rate). Hard cap at 10kg.

export const BASKET_STORAGE_KEY = 'sys:basket:v1'
export const UNLOCK_FLASH_FLAG = 'sys:basket:unlocked-once'

export const FREE_SHIPPING_THRESHOLD_GBP = 10
export const SHIPPING_FLAT_GBP = 2.5
export const SOFT_CAP_WEIGHT_G = 5000   // warn the buyer; checkout still allowed
export const HARD_CAP_WEIGHT_G = 10_000 // block checkout

// Kept as aliases for any existing call sites; treat both as the soft cap.
export const LARGE_PARCEL_WEIGHT_G = SOFT_CAP_WEIGHT_G
export const LARGE_PARCEL_FEE_GBP = SHIPPING_FLAT_GBP

// Heuristic per-book weights (grams). Packaging is per-parcel, not per-book.
const WEIGHT_PAPERBACK_G = 280
const WEIGHT_HARDBACK_G = 800
const WEIGHT_UNKNOWN_G = 350
const PACKAGING_G = 150

export type BasketFormat = 'paperback' | 'hardback' | null

export type BasketItem = {
  listingId: number
  title: string
  author: string | null
  /**
   * What the BUYER PAYS for this item. For bundle items this is the
   * EFFECTIVE (post-discount allocated) price, NOT the listing's
   * asking price. Basket subtotal = sum of priceGbp, and that's
   * exactly what the checkout server will charge — so the basket
   * total and the actual charge always agree.
   *
   * (The pre-fix bug: BundlesRow set this to asking_price_gbp, so the
   * basket showed £8 for a bundle that would actually charge £5.)
   */
  priceGbp: number
  format: BasketFormat
  coverUrl: string | null
  category: string | null
  /**
   * If this item was added as part of a bundle, the bundle.id (server
   * id from public.bundles). Null/undefined for items added individually.
   * The checkout caller (CheckoutForm) derives the unique non-null
   * bundleIds from the basket and sends them to
   * create-order-payment-intent; the server revalidates each (all
   * members present, bundle still active) before applying the discount.
   *
   * Buyer can remove individual basket items without losing the rest
   * of the bundle's items — they just lose the discount on this bundle.
   * That matches the 2026-06-09 design: "If the buyer removes one item,
   * the discount silently drops off."
   */
  bundleId?: number | null
  /**
   * For bundle items: the listing's original asking price (pre-discount).
   * Set alongside bundleId. Used by the basket page to render
   * "£3.13 ~~£5.00~~" for visual context. Null/undefined for
   * non-bundle items (priceGbp IS the asking price for them).
   */
  originalPriceGbp?: number | null
  /**
   * For bundle items: originalPriceGbp - priceGbp. Used by the basket
   * page to render a "Bundle discount −£X" summary line and a per-item
   * "−£X from «bundle»" caption.
   */
  bundleDiscountGbp?: number | null
}

export type Basket = {
  sellerId: string
  sellerUsername: string
  items: BasketItem[]
}

export function emptyBasket(): null {
  return null
}

export function weightForItem(format: BasketFormat): number {
  if (format === 'paperback') return WEIGHT_PAPERBACK_G
  if (format === 'hardback') return WEIGHT_HARDBACK_G
  return WEIGHT_UNKNOWN_G
}

export function totalWeightG(items: BasketItem[]): number {
  if (items.length === 0) return 0
  return items.reduce((sum, it) => sum + weightForItem(it.format), 0) + PACKAGING_G
}

export function subtotalGbp(items: BasketItem[]): number {
  return items.reduce((sum, it) => sum + Number(it.priceGbp), 0)
}

// Shipping state — drives widget + basket + checkout copy.
//   below       : items present, subtotal < £10
//   unlocked    : subtotal >= £10 (free shipping)
//   oversize    : weight > 5kg soft cap (warn — shipping is still flat)
//   exceeded    : weight > 10kg hard cap (block checkout)
// `oversize` and `exceeded` always take precedence over the subtotal state so
// the warning is visible regardless of basket total.
export type ShippingState =
  | { kind: 'empty' }
  | { kind: 'below'; gapGbp: number; progressPct: number }
  | { kind: 'unlocked' }
  | { kind: 'oversize'; weightG: number }
  | { kind: 'exceeded'; weightG: number }

export function shippingState(items: BasketItem[]): ShippingState {
  if (items.length === 0) return { kind: 'empty' }
  const weightG = totalWeightG(items)
  if (weightG > HARD_CAP_WEIGHT_G) return { kind: 'exceeded', weightG }
  if (weightG > SOFT_CAP_WEIGHT_G) return { kind: 'oversize', weightG }
  const sub = subtotalGbp(items)
  if (sub >= FREE_SHIPPING_THRESHOLD_GBP) return { kind: 'unlocked' }
  return {
    kind: 'below',
    gapGbp: round2(FREE_SHIPPING_THRESHOLD_GBP - sub),
    progressPct: Math.max(0, Math.min(100, (sub / FREE_SHIPPING_THRESHOLD_GBP) * 100)),
  }
}

export function shippingCostGbp(items: BasketItem[]): number {
  const state = shippingState(items)
  if (state.kind === 'unlocked') return 0
  if (state.kind === 'empty' || state.kind === 'exceeded') return 0
  // below, oversize → flat rate
  return SHIPPING_FLAT_GBP
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------- Suggestion engine ----------
// Pick combinations of shelf inventory (not in basket) that close the gap to £10.
// Prefer single-book solutions, then 2-book, then 3-book.
// Target window: [gap, gap × 1.5] — "slightly over, not under".
// Affinity: prefer combinations sharing a category with current basket items.

export type Candidate = {
  listingId: number
  priceGbp: number
  category: string | null
}

export type Suggestion = {
  items: Candidate[]
  totalGbp: number
}

export function buildSuggestions(args: {
  candidates: Candidate[]
  gapGbp: number
  basketCategories: Set<string>
  maxSuggestions?: number
}): Suggestion[] {
  const { candidates, gapGbp, basketCategories } = args
  const maxSuggestions = args.maxSuggestions ?? 3
  if (gapGbp <= 0 || candidates.length === 0) return []

  const lower = gapGbp
  const upper = gapGbp * 1.5

  const inWindow = (total: number) => total >= lower && total <= upper

  const score = (combo: Candidate[]): number => {
    // Smaller combos preferred; affinity bonus; closer to lower bound preferred.
    const total = combo.reduce((s, c) => s + c.priceGbp, 0)
    const sizePenalty = combo.length * 1000
    const overshoot = Math.max(0, total - lower) * 10
    const affinityBonus = combo.some(
      (c) => c.category && basketCategories.has(c.category),
    )
      ? -500
      : 0
    return sizePenalty + overshoot + affinityBonus
  }

  const found: Suggestion[] = []
  const seen = new Set<string>()
  const keyFor = (combo: Candidate[]) =>
    combo
      .map((c) => c.listingId)
      .sort((a, b) => a - b)
      .join(',')

  // 1-book
  for (const c of candidates) {
    if (inWindow(c.priceGbp)) {
      const combo = [c]
      const k = keyFor(combo)
      if (!seen.has(k)) {
        seen.add(k)
        found.push({ items: combo, totalGbp: round2(c.priceGbp) })
      }
    }
  }

  // 2-book — only if we don't yet have enough
  if (found.length < maxSuggestions) {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const t = candidates[i].priceGbp + candidates[j].priceGbp
        if (inWindow(t)) {
          const combo = [candidates[i], candidates[j]]
          const k = keyFor(combo)
          if (!seen.has(k)) {
            seen.add(k)
            found.push({ items: combo, totalGbp: round2(t) })
          }
        }
        if (found.length >= maxSuggestions * 3) break
      }
      if (found.length >= maxSuggestions * 3) break
    }
  }

  // 3-book — only if still under-supplied
  if (found.length < maxSuggestions) {
    outer: for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        for (let k = j + 1; k < candidates.length; k++) {
          const t =
            candidates[i].priceGbp + candidates[j].priceGbp + candidates[k].priceGbp
          if (inWindow(t)) {
            const combo = [candidates[i], candidates[j], candidates[k]]
            const key = keyFor(combo)
            if (!seen.has(key)) {
              seen.add(key)
              found.push({ items: combo, totalGbp: round2(t) })
            }
          }
          if (found.length >= maxSuggestions * 3) break outer
        }
      }
    }
  }

  // Rank: affinity + smallest combo + smallest overshoot. Keep top N.
  found.sort((a, b) => score(a.items) - score(b.items))
  return found.slice(0, maxSuggestions)
}
