'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Basket,
  BasketItem,
  BASKET_STORAGE_KEY,
  shippingState,
  subtotalGbp,
  totalWeightG,
} from '@/app/lib/basket'
import {
  trackBasketItemAdded,
  trackBasketItemRemoved,
  trackBasketThresholdCrossed,
  trackBasketOversizeTriggered,
  trackCrossSellerModalShown,
  resetOversizeFiredFlag,
} from '@/app/lib/basketAnalytics'

type SellerRef = { sellerId: string; sellerUsername: string }

type CrossSellerConflict = {
  attempt: { seller: SellerRef; item: BasketItem }
  currentSeller: SellerRef
}

// 'bundle' added for slice 8 — buyer adds a whole bundle from the
// BundlesRow on the shelf page (or the bundle strip on a book detail
// page in slice 9). Analytics distinguishes it from 'shelf_card' so
// we can measure bundle-adoption separately.
export type AddSource = 'shelf_card' | 'listing_page' | 'suggestion' | 'bundle'
export type RemoveSource = 'card_toggle' | 'basket_page' | 'widget'

type BasketContextValue = {
  basket: Basket | null
  itemCount: number
  hasItem: (listingId: number) => boolean
  // Returns true if added; false if cross-seller conflict was raised.
  addItem: (seller: SellerRef, item: BasketItem, source: AddSource) => boolean
  // Add multiple items from the same seller in one call (used by suggestions).
  addItems: (seller: SellerRef, items: BasketItem[], source: AddSource) => boolean
  removeItem: (listingId: number, source: RemoveSource) => void
  clearBasket: () => void
  // Cross-seller modal state
  conflict: CrossSellerConflict | null
  dismissConflict: () => void
  // For the basket page — replace whole basket (e.g. drop stale items)
  setItems: (items: BasketItem[]) => void
}

const BasketContext = createContext<BasketContextValue | null>(null)

function readFromStorage(): Basket | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(BASKET_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items) || !parsed.sellerId || !parsed.sellerUsername) {
      return null
    }
    return parsed as Basket
  } catch {
    return null
  }
}

function writeToStorage(basket: Basket | null) {
  if (typeof window === 'undefined') return
  try {
    if (basket === null || basket.items.length === 0) {
      window.localStorage.removeItem(BASKET_STORAGE_KEY)
    } else {
      window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket))
    }
  } catch {
    // Storage full / disabled — fail silent. Basket still works in-memory for the session.
  }
}

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [basket, setBasket] = useState<Basket | null>(null)
  const [conflict, setConflict] = useState<CrossSellerConflict | null>(null)
  const hydratedRef = useRef(false)
  // Mirror of `basket` for action callbacks to read pre-transition state
  // without forcing the callback to re-memo on every basket change.
  const basketRef = useRef<Basket | null>(null)
  // Last shipping state, to detect threshold / oversize transitions.
  const prevShippingKindRef = useRef<'empty' | 'below' | 'unlocked' | 'oversize' | 'exceeded' | null>(null)

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const hydrated = readFromStorage()
    setBasket(hydrated)
    basketRef.current = hydrated
    hydratedRef.current = true
  }, [])

  // Persist on change (post-hydration only).
  useEffect(() => {
    if (!hydratedRef.current) return
    writeToStorage(basket)
    basketRef.current = basket
  }, [basket])

  // Sync across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BASKET_STORAGE_KEY) return
      const next = readFromStorage()
      setBasket(next)
      basketRef.current = next
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Threshold + oversize transitions. Independent of which action caused the
  // change so it covers cross-tab sync, hydration, and direct setItems too.
  useEffect(() => {
    if (!hydratedRef.current) return
    const items = basket?.items ?? []
    const curKind = shippingState(items).kind
    const prevKind = prevShippingKindRef.current
    prevShippingKindRef.current = curKind

    if (!basket || prevKind === null || prevKind === curKind) return

    if (curKind === 'unlocked' && prevKind !== 'unlocked') {
      trackBasketThresholdCrossed({ direction: 'unlocked', basket })
    } else if (prevKind === 'unlocked' && curKind !== 'unlocked' && curKind !== 'empty') {
      trackBasketThresholdCrossed({ direction: 'relapsed', basket })
    }

    if (curKind === 'oversize' && prevKind !== 'oversize') {
      trackBasketOversizeTriggered({ basket })
    } else if (prevKind === 'oversize' && curKind !== 'oversize') {
      resetOversizeFiredFlag()
    }
  }, [basket])

  const hasItem = useCallback(
    (listingId: number) => !!basket?.items.some((it) => it.listingId === listingId),
    [basket],
  )

  const addItem = useCallback<BasketContextValue['addItem']>((seller, item, source) => {
    const prev = basketRef.current

    if (prev && prev.sellerId !== seller.sellerId && prev.items.length > 0) {
      setConflict({
        attempt: { seller, item },
        currentSeller: { sellerId: prev.sellerId, sellerUsername: prev.sellerUsername },
      })
      trackCrossSellerModalShown({
        currentSellerUsername: prev.sellerUsername,
        attemptedSellerUsername: seller.sellerUsername,
        currentBasket: prev,
      })
      return false
    }

    // Resolve the new basket state synchronously so we can diff for analytics.
    let next: Basket
    if (!prev || prev.sellerId !== seller.sellerId) {
      next = { sellerId: seller.sellerId, sellerUsername: seller.sellerUsername, items: [item] }
    } else if (prev.items.some((it) => it.listingId === item.listingId)) {
      // No-op: already in basket.
      return false
    } else {
      next = { ...prev, items: [...prev.items, item] }
    }

    setBasket(next)
    basketRef.current = next

    trackBasketItemAdded({
      item,
      seller,
      itemsBefore: prev?.items ?? [],
      itemsAfter: next.items,
      source,
    })
    return true
  }, [])

  const addItems = useCallback<BasketContextValue['addItems']>((seller, items, source) => {
    if (items.length === 0) return true
    const prev = basketRef.current

    if (prev && prev.sellerId !== seller.sellerId && prev.items.length > 0) {
      setConflict({
        attempt: { seller, item: items[0] },
        currentSeller: { sellerId: prev.sellerId, sellerUsername: prev.sellerUsername },
      })
      trackCrossSellerModalShown({
        currentSellerUsername: prev.sellerUsername,
        attemptedSellerUsername: seller.sellerUsername,
        currentBasket: prev,
      })
      return false
    }

    const base: Basket =
      !prev || prev.sellerId !== seller.sellerId
        ? { sellerId: seller.sellerId, sellerUsername: seller.sellerUsername, items: [] }
        : prev

    const existingIds = new Set(base.items.map((it) => it.listingId))
    const merged: BasketItem[] = [...base.items]
    const newlyAdded: BasketItem[] = []
    for (const it of items) {
      if (!existingIds.has(it.listingId)) {
        merged.push(it)
        existingIds.add(it.listingId)
        newlyAdded.push(it)
      }
    }
    const next: Basket = { ...base, items: merged }

    setBasket(next)
    basketRef.current = next

    // One basket_item_added per newly-added book, all with the same source.
    const itemsBefore = prev?.items ?? []
    for (let i = 0; i < newlyAdded.length; i++) {
      const it = newlyAdded[i]
      // Show cumulative growth per item: itemsBefore + already-added subset.
      const partialAfter = [...itemsBefore, ...newlyAdded.slice(0, i + 1)]
      trackBasketItemAdded({
        item: it,
        seller,
        itemsBefore: i === 0 ? itemsBefore : [...itemsBefore, ...newlyAdded.slice(0, i)],
        itemsAfter: partialAfter,
        source,
      })
    }
    return true
  }, [])

  const removeItem = useCallback<BasketContextValue['removeItem']>((listingId, source) => {
    const prev = basketRef.current
    if (!prev) return
    const removed = prev.items.find((it) => it.listingId === listingId)
    const nextItems = prev.items.filter((it) => it.listingId !== listingId)
    const next: Basket | null = nextItems.length === 0 ? null : { ...prev, items: nextItems }

    setBasket(next)
    basketRef.current = next

    if (removed) {
      trackBasketItemRemoved({
        item: removed,
        basketBefore: prev,
        itemsAfter: nextItems,
        source,
      })
    }
  }, [])

  const clearBasket = useCallback(() => {
    setBasket(null)
    basketRef.current = null
  }, [])
  const dismissConflict = useCallback(() => setConflict(null), [])

  const setItems = useCallback<BasketContextValue['setItems']>((items) => {
    setBasket((prev) => {
      if (!prev) return prev
      const next = items.length === 0 ? null : { ...prev, items }
      basketRef.current = next
      return next
    })
  }, [])

  const itemCount = basket?.items.length ?? 0

  const value = useMemo<BasketContextValue>(
    () => ({
      basket,
      itemCount,
      hasItem,
      addItem,
      addItems,
      removeItem,
      clearBasket,
      conflict,
      dismissConflict,
      setItems,
    }),
    [basket, itemCount, hasItem, addItem, addItems, removeItem, clearBasket, conflict, dismissConflict, setItems],
  )

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
}

export function useBasket() {
  const ctx = useContext(BasketContext)
  if (!ctx) throw new Error('useBasket must be used inside <BasketProvider>')
  return ctx
}

// Convenience selectors derived from the basket state.
export function useBasketShipping() {
  const { basket } = useBasket()
  const items = basket?.items ?? []
  return {
    state: shippingState(items),
    subtotal: subtotalGbp(items),
    weightG: totalWeightG(items),
  }
}
