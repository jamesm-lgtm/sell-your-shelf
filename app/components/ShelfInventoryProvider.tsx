'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

// Lets shelf pages publish their inventory + seller so the floating basket
// widget can compute suggestions from anywhere in the layout. When the shelf
// page unmounts (user navigates away), the data resets to null.

export type ShelfListing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  format?: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
}

export type ShelfSeller = { sellerId: string; sellerUsername: string }

export type ShelfData = { listings: ShelfListing[]; seller: ShelfSeller } | null

type ShelfInventoryContextValue = {
  data: ShelfData
  setData: (d: ShelfData) => void
}

const ShelfInventoryContext = createContext<ShelfInventoryContextValue | null>(null)

export function ShelfInventoryProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataRaw] = useState<ShelfData>(null)
  const setData = useCallback((d: ShelfData) => setDataRaw(d), [])
  const value = useMemo(() => ({ data, setData }), [data, setData])
  return <ShelfInventoryContext.Provider value={value}>{children}</ShelfInventoryContext.Provider>
}

export function useShelfInventory(): ShelfData {
  const ctx = useContext(ShelfInventoryContext)
  return ctx?.data ?? null
}

// Side-effect-only component the shelf page renders to publish its data.
export function RegisterShelfInventory({
  listings,
  seller,
}: {
  listings: ShelfListing[]
  seller: ShelfSeller
}) {
  const ctx = useContext(ShelfInventoryContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setData({ listings, seller })
    return () => ctx.setData(null)
    // We intentionally only re-publish when the seller id changes; the listings
    // array reference is unstable on every render of the shelf page but the
    // content doesn't change per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.sellerId])
  return null
}
