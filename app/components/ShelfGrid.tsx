'use client'

import { useState } from 'react'
import Link from 'next/link'

type Listing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  books: { cover_url: string | null } | null
}

type Props = {
  listings: Listing[]
}

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

const CONDITION_ORDER: Record<string, number> = {
  like_new: 0,
  very_good: 1,
  good: 2,
  acceptable: 3,
}

export default function ShelfGrid({ listings }: Props) {
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest')
  const [condition, setCondition] = useState<string>('all')

  const filtered = listings
    .filter(l => condition === 'all' || l.condition === condition)
    .sort((a, b) => {
      if (sort === 'price_asc') return a.asking_price_gbp - b.asking_price_gbp
      if (sort === 'price_desc') return b.asking_price_gbp - a.asking_price_gbp
      return 0
    })

  const activeConditions = Array.from(new Set(listings.map(l => l.condition)))
    .sort((a, b) => CONDITION_ORDER[a] - CONDITION_ORDER[b])

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setCondition('all')}
            style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', background: condition === 'all' ? '#2D4A3E' : '#fff', color: condition === 'all' ? '#FAF8F5' : '#666', borderColor: condition === 'all' ? '#2D4A3E' : '#E5E3DF' }}
          >
            All
          </button>
          {activeConditions.map(c => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', background: condition === c ? '#2D4A3E' : '#fff', color: condition === c ? '#FAF8F5' : '#666', borderColor: condition === c ? '#2D4A3E' : '#E5E3DF' }}
            >
              {CONDITIONS[c] ?? c}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A', cursor: 'pointer' }}
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
        {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
        {condition !== 'all' ? ` in ${CONDITIONS[condition]}` : ''}
      </p>

      {filtered.length === 0 ? (
        <p style={{ color: '#999', fontSize: 15, textAlign: 'center', paddingTop: 48 }}>
          No books match this filter.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {filtered.map((listing) => (
            <div key={listing.id} style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ aspectRatio: '2/3', background: '#2D4A3E', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {listing.books?.cover_url ? (
                  <img
                    src={listing.books.cover_url}
                    alt={listing.title}
                    style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: 8, textAlign: 'center' }}>
                    {listing.title}
                  </span>
                )}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 3 }}>
                  {listing.title}
                </div>
                {listing.author && (
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
                    {listing.author}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#2D4A3E' }}>
                    £{Number(listing.asking_price_gbp).toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    {CONDITIONS[listing.condition] ?? listing.condition}
                  </span>
                </div>
                <Link
                  href={`/listing/${listing.id}`}
                  style={{ display: 'block', textAlign: 'center', background: '#2D4A3E', color: '#FAF8F5', fontSize: 13, fontWeight: 500, padding: '9px 0', borderRadius: 6, textDecoration: 'none' }}
                >
                  Buy on Sell Your Shelf
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}