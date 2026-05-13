'use client'

// Thin wrappers around the shared `track()` analytics client for the basket
// flow. Keeps call sites readable while reusing the proven batching pipeline
// (sendBeacon, ?debug=1 opt-out, page-hide flush).
//
// Conventions:
//   - One row per book on suggestion adds (caller iterates and calls
//     trackBasketItemAdded() per item).
//   - Threshold-crossed `unlocked` fires once per session (sessionStorage).
//   - Oversize triggers once per oversize transition.
//   - Every entry point is wrapped in try/catch so an analytics failure can
//     never break the basket UX.

import { track } from '@/app/lib/analytics'
import {
  Basket,
  BasketItem,
  shippingState,
  subtotalGbp,
  totalWeightG,
} from '@/app/lib/basket'

const UNLOCKED_FIRED_KEY = 'sys:basket:unlocked_event_fired'
const OVERSIZE_FIRED_KEY = 'sys:basket:oversize_event_fired'

type ThresholdStatus = 'below' | 'unlocked' | 'oversize'

function statusFromItems(items: BasketItem[]): ThresholdStatus {
  const s = shippingState(items)
  if (s.kind === 'unlocked') return 'unlocked'
  if (s.kind === 'oversize') return 'oversize'
  return 'below'
}

function safe<T extends unknown[]>(fn: (...args: T) => void) {
  return (...args: T) => {
    try {
      fn(...args)
    } catch {
      // Analytics must never break the flow.
    }
  }
}

// ---------- add / remove ----------

type AddSource = 'shelf_card' | 'listing_page' | 'suggestion'

export const trackBasketItemAdded = safe(function (args: {
  item: BasketItem
  seller: { sellerId: string; sellerUsername: string }
  itemsBefore: BasketItem[]
  itemsAfter: BasketItem[]
  source: AddSource
}) {
  const { item, seller, itemsBefore, itemsAfter, source } = args
  track(
    'basket_item_added',
    {
      listing_id: String(item.listingId),
      seller_username: seller.sellerUsername,
      price_gbp: Number(item.priceGbp),
      source,
      basket_total_before_gbp: subtotalGbp(itemsBefore),
      basket_total_after_gbp: subtotalGbp(itemsAfter),
      basket_item_count_after: itemsAfter.length,
      threshold_status_after: statusFromItems(itemsAfter),
    },
    { source, listingId: item.listingId, sellerId: seller.sellerId },
  )
})

type RemoveSource = 'card_toggle' | 'basket_page' | 'widget'

export const trackBasketItemRemoved = safe(function (args: {
  item: BasketItem
  basketBefore: Basket
  itemsAfter: BasketItem[]
  source: RemoveSource
}) {
  const { item, basketBefore, itemsAfter, source } = args
  track(
    'basket_item_removed',
    {
      listing_id: String(item.listingId),
      seller_username: basketBefore.sellerUsername,
      price_gbp: Number(item.priceGbp),
      source,
      basket_total_after_gbp: subtotalGbp(itemsAfter),
      basket_item_count_after: itemsAfter.length,
      threshold_status_after: statusFromItems(itemsAfter),
    },
    { source, listingId: item.listingId, sellerId: basketBefore.sellerId },
  )
})

// ---------- suggestions ----------

type SuggestionPlacement = 'shelf_top' | 'widget_expander'

export const trackBasketSuggestionShown = safe(function (args: {
  placement: SuggestionPlacement
  seller: { sellerId: string; sellerUsername: string }
  gapGbp: number
  numSuggestions: number
  basketTotalGbp: number
}) {
  track(
    'basket_suggestion_shown',
    {
      placement: args.placement,
      seller_username: args.seller.sellerUsername,
      gap_to_threshold_gbp: args.gapGbp,
      num_suggestions_shown: args.numSuggestions,
      basket_total_gbp: args.basketTotalGbp,
    },
    { source: args.placement, sellerId: args.seller.sellerId },
  )
})

export const trackBasketSuggestionClicked = safe(function (args: {
  placement: SuggestionPlacement
  seller: { sellerId: string; sellerUsername: string }
  numBooks: number
  suggestionTotalGbp: number
  itemsBefore: BasketItem[]
  itemsAfter: BasketItem[]
}) {
  track(
    'basket_suggestion_clicked',
    {
      placement: args.placement,
      seller_username: args.seller.sellerUsername,
      num_books_in_suggestion: args.numBooks,
      suggestion_total_gbp: args.suggestionTotalGbp,
      basket_total_before_gbp: subtotalGbp(args.itemsBefore),
      basket_total_after_gbp: subtotalGbp(args.itemsAfter),
      unlocked_free_shipping:
        statusFromItems(args.itemsBefore) !== 'unlocked' &&
        statusFromItems(args.itemsAfter) === 'unlocked',
    },
    { source: args.placement, sellerId: args.seller.sellerId },
  )
})

// ---------- threshold / oversize (one-shot guards) ----------

export const trackBasketThresholdCrossed = safe(function (args: {
  direction: 'unlocked' | 'relapsed'
  basket: Basket
}) {
  const { direction, basket } = args
  // Fire `unlocked` only on the first cross within a session — matches the
  // one-per-session unlock-flash animation. `relapsed` fires every time the
  // user falls back below £10 (more useful as a recurring signal).
  if (direction === 'unlocked') {
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem(UNLOCKED_FIRED_KEY) === '1') return
        window.sessionStorage.setItem(UNLOCKED_FIRED_KEY, '1')
      } catch {
        // sessionStorage unavailable — fall through, at worst we fire twice.
      }
    }
  }
  track(
    'basket_threshold_crossed',
    {
      direction,
      seller_username: basket.sellerUsername,
      basket_total_gbp: subtotalGbp(basket.items),
      basket_item_count: basket.items.length,
    },
    { sellerId: basket.sellerId },
  )
})

export const trackBasketOversizeTriggered = safe(function (args: { basket: Basket }) {
  const { basket } = args
  // One-shot per oversize *transition*. The reset (basket becomes non-oversize)
  // happens in resetOversizeFiredFlag().
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(OVERSIZE_FIRED_KEY) === '1') return
      window.sessionStorage.setItem(OVERSIZE_FIRED_KEY, '1')
    } catch {
      // sessionStorage unavailable — fall through.
    }
  }
  track(
    'basket_oversize_triggered',
    {
      seller_username: basket.sellerUsername,
      basket_total_gbp: subtotalGbp(basket.items),
      basket_weight_grams: totalWeightG(basket.items),
      basket_item_count: basket.items.length,
    },
    { sellerId: basket.sellerId },
  )
})

export function resetOversizeFiredFlag(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(OVERSIZE_FIRED_KEY)
  } catch {
    // ignore
  }
}

export function resetUnlockedFiredFlag(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(UNLOCKED_FIRED_KEY)
  } catch {
    // ignore
  }
}

// ---------- cross-seller modal ----------

export const trackCrossSellerModalShown = safe(function (args: {
  currentSellerUsername: string
  attemptedSellerUsername: string
  currentBasket: Basket
}) {
  track('cross_seller_modal_shown', {
    current_seller_username: args.currentSellerUsername,
    attempted_seller_username: args.attemptedSellerUsername,
    current_basket_total_gbp: subtotalGbp(args.currentBasket.items),
    current_basket_item_count: args.currentBasket.items.length,
  })
})

export const trackCrossSellerModalAction = safe(function (args: {
  action: 'checkout' | 'clear' | 'cancel'
  currentSellerUsername: string
  attemptedSellerUsername: string
}) {
  track('cross_seller_modal_action', {
    action: args.action,
    current_seller_username: args.currentSellerUsername,
    attempted_seller_username: args.attemptedSellerUsername,
  })
})

// ---------- basket page + checkout cta ----------

export const trackBasketPageViewed = safe(function (args: {
  basket: Basket
  staleItemsCount: number
}) {
  const { basket, staleItemsCount } = args
  track(
    'basket_page_viewed',
    {
      seller_username: basket.sellerUsername,
      basket_total_gbp: subtotalGbp(basket.items),
      basket_item_count: basket.items.length,
      stale_items_count: staleItemsCount,
      threshold_status: statusFromItems(basket.items),
    },
    { sellerId: basket.sellerId },
  )
})

export const trackCheckoutCtaClicked = safe(function (args: { basket: Basket }) {
  const { basket } = args
  track(
    'checkout_cta_clicked',
    {
      seller_username: basket.sellerUsername,
      basket_total_gbp: subtotalGbp(basket.items),
      basket_item_count: basket.items.length,
      threshold_status: statusFromItems(basket.items),
    },
    { sellerId: basket.sellerId },
  )
})
