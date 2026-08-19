// New-in flow rules for the browse shop window.
//
// Two problems this solves, both measured rather than assumed:
//
//  1. 41% of active listings are at or under £1, so an ungated flow
//     ordered by recency reads as a jumble sale.
//  2. The 200 most recent listings came from 9 sellers, with the top
//     three holding 78% and Children's making up 39%. Without a cap the
//     flow becomes one person's kids books.
//
// The gate and the cap are deliberately separate: the gate decides what is
// good enough to front, the cap decides how it is interleaved.

export type FlowListing = {
  id: number
  asking_price_gbp: number
  cover: string | null
  category: string | null
  sellerId: string | null
}

export type FlowRules = {
  /** Listings at or below this are add-on stock, not shop-window stock. */
  priceFloor: number
  /** A coverless listing looks worst and reads as low quality. */
  requireCover: boolean
  /** Category becomes a working axis once the categorisation backfill lands. */
  requireCategory: boolean
  /** No more than this many consecutive listings from one seller. */
  maxConsecutivePerSeller: number
  /** No more than this many from one seller within a single page. */
  maxPerSellerPerPage: number
  /** Target listings per page — the window the per-seller cap applies to. */
  pageSize: number
}

export const DEFAULT_FLOW_RULES: FlowRules = {
  priceFloor: 1,
  requireCover: true,
  requireCategory: false, // flip on once categorisation is backfilled
  maxConsecutivePerSeller: 3,
  maxPerSellerPerPage: 6,
  pageSize: 48,
}

/** Does this listing clear the quality bar for the shop-window flow? */
export function passesGate<T extends FlowListing>(l: T, rules: FlowRules): boolean {
  if (Number(l.asking_price_gbp) <= rules.priceFloor) return false
  if (rules.requireCover && !l.cover) return false
  if (rules.requireCategory && !l.category) return false
  return true
}

/**
 * Diversify into pages, each with its own per-seller quota.
 *
 * Quotas reset per page rather than sliding, and that is deliberate. A
 * sliding window cannot slide without placing and cannot place without
 * sliding, so it deadlocks at roughly `sellers × cap` items however large
 * the catalogue is — an earlier version stalled at 40 of 3,622.
 *
 * Pages are returned so the UI can load exactly one per "show more". A page
 * closes early when scarcity leaves nothing within quota, so page sizes
 * vary; paginating on a fixed count instead would straddle boundaries and
 * appear to break the cap even when it holds.
 *
 * Newest-first order is preserved within each page, so "new in" stays new.
 */
export function diversifyPaged<T extends FlowListing>(
  listings: T[],
  rules: FlowRules,
): { items: T[]; pages: number[] } {
  const out: T[] = []
  const pages: number[] = []
  const pending = [...listings]
  const key = (l: T) => l.sellerId ?? '∅'

  while (pending.length > 0) {
    const used = new Map<string, number>()
    let run: { seller: string | null; n: number } = { seller: null, n: 0 }
    let placed = 0

    while (placed < rules.pageSize && pending.length > 0) {
      const underQuota = (l: T) => (used.get(key(l)) ?? 0) < rules.maxPerSellerPerPage
      const breaksRun = (l: T) => run.seller === key(l) && run.n >= rules.maxConsecutivePerSeller

      // Both rules are hard. When nothing qualifies, close the page rather
      // than relax the run cap — a new page resets `run`, so the listing is
      // placed immediately overleaf instead of extending a visible streak.
      // Relaxing here instead produced runs of 5 against a cap of 3.
      const idx = pending.findIndex((l) => underQuota(l) && !breaksRun(l))
      if (idx === -1) break

      const [next] = pending.splice(idx, 1)
      const k = key(next)
      out.push(next)
      used.set(k, (used.get(k) ?? 0) + 1)
      run = run.seller === k ? { seller: k, n: run.n + 1 } : { seller: k, n: 1 }
      placed++
    }

    if (placed === 0) break
    pages.push(placed)
  }

  return { items: out, pages }
}

/**
 * Gate, then diversify into pages.
 *
 * `flow` is every listing that cleared the gate, ordered so no seller
 * dominates any single page. `heldBackByGate` failed the quality bar and
 * stays reachable through search, filters and the "see everything" view.
 */
export function buildFlow<T extends FlowListing>(
  listings: T[],
  rules: FlowRules = DEFAULT_FLOW_RULES,
): { flow: T[]; pages: number[]; heldBackByGate: number } {
  const gated = listings.filter((l) => passesGate(l, rules))
  const { items, pages } = diversifyPaged(gated, rules)
  return { flow: items, pages, heldBackByGate: listings.length - gated.length }
}
