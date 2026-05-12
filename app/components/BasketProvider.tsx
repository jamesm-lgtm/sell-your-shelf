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

type SellerRef = { sellerId: string; sellerUsername: string }

type CrossSellerConflict = {
  attempt: { seller: SellerRef; item: BasketItem }
  currentSeller: SellerRef
}

type BasketContextValue = {
  basket: Basket | null
  itemCount: number
  hasItem: (listingId: number) => boolean
  // Returns true if added; false if cross-seller conflict was raised.
  addItem: (seller: SellerRef, item: BasketItem) => boolean
  // Add multiple items from the same seller in one call (used by suggestions).
  addItems: (seller: SellerRef, items: BasketItem[]) => boolean
  removeItem: (listingId: number) => void
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

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setBasket(readFromStorage())
    hydratedRef.current = true
  }, [])

  // Persist on change (post-hydration only).
  useEffect(() => {
    if (!hydratedRef.current) return
    writeToStorage(basket)
  }, [basket])

  // Sync across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== BASKET_STORAGE_KEY) return
      setBasket(readFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const hasItem = useCallback(
    (listingId: number) => !!basket?.items.some((it) => it.listingId === listingId),
    [basket],
  )

  const addItem = useCallback<BasketContextValue['addItem']>((seller, item) => {
    let added = false
    setBasket((prev) => {
      if (prev && prev.sellerId !== seller.sellerId && prev.items.length > 0) {
        setConflict({
          attempt: { seller, item },
          currentSeller: { sellerId: prev.sellerId, sellerUsername: prev.sellerUsername },
        })
        return prev
      }
      added = true
      if (!prev || prev.sellerId !== seller.sellerId) {
        return { sellerId: seller.sellerId, sellerUsername: seller.sellerUsername, items: [item] }
      }
      if (prev.items.some((it) => it.listingId === item.listingId)) return prev
      return { ...prev, items: [...prev.items, item] }
    })
    return added
  }, [])

  const addItems = useCallback<BasketContextValue['addItems']>((seller, items) => {
    if (items.length === 0) return true
    let added = false
    setBasket((prev) => {
      if (prev && prev.sellerId !== seller.sellerId && prev.items.length > 0) {
        setConflict({
          attempt: { seller, item: items[0] },
          currentSeller: { sellerId: prev.sellerId, sellerUsername: prev.sellerUsername },
        })
        return prev
      }
      added = true
      const base: Basket =
        !prev || prev.sellerId !== seller.sellerId
          ? { sellerId: seller.sellerId, sellerUsername: seller.sellerUsername, items: [] }
          : prev
      const existingIds = new Set(base.items.map((it) => it.listingId))
      const merged = [...base.items]
      for (const it of items) {
        if (!existingIds.has(it.listingId)) {
          merged.push(it)
          existingIds.add(it.listingId)
        }
      }
      return { ...base, items: merged }
    })
    return added
  }, [])

  const removeItem = useCallback<BasketContextValue['removeItem']>((listingId) => {
    setBasket((prev) => {
      if (!prev) return prev
      const next = prev.items.filter((it) => it.listingId !== listingId)
      if (next.length === 0) return null
      return { ...prev, items: next }
    })
  }, [])

  const clearBasket = useCallback(() => setBasket(null), [])
  const dismissConflict = useCallback(() => setConflict(null), [])

  const setItems = useCallback<BasketContextValue['setItems']>((items) => {
    setBasket((prev) => {
      if (!prev) return prev
      if (items.length === 0) return null
      return { ...prev, items }
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
