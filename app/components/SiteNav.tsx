'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SearchResult = {
  book_id: number
  title: string
  author: string
  cover_url: string | null
  category: string | null
  slug: string | null
  lowest_price: number
  copy_count: number
  similarity_score: number
}

function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type Props = {
  current?: 'browse' | 'support' | 'blog' | null
}

export default function SiteNav({ current = null }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setLoadingSuggestions(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data: SearchResult[] = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      }
    } catch {
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  // Debounced search input handler
  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value.trim())
    }, 300)
  }

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q.length > 0) {
      setShowSuggestions(false)
      router.push(`/search?q=${encodeURIComponent(q)}`)
      setSearchOpen(false)
      setMenuOpen(false)
    }
  }

  const handleSuggestionClick = (result: SearchResult) => {
    setShowSuggestions(false)
    setSearchOpen(false)
    setMenuOpen(false)
    const slug = result.slug || generateSlug(result.title, result.author || '')
    router.push(`/books/${slug}`)
  }

  const linkStyle = (active: boolean) => ({
    color: active ? '#FAF8F5' : 'rgba(250,248,245,0.8)',
    fontSize: 13,
    fontWeight: 500 as const,
    textDecoration: 'none' as const,
  })

  const SuggestionsDropdown = () => {
    if (!showSuggestions || suggestions.length === 0) return null

    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: '#fff',
        borderRadius: '0 0 10px 10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        zIndex: 200,
        overflow: 'hidden',
        maxHeight: 400,
        overflowY: 'auto',
      }}>
        {suggestions.map((result) => {
          const slug = result.slug || generateSlug(result.title, result.author || '')
          return (
            <button
              key={result.book_id}
              onClick={() => handleSuggestionClick(result)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '0.5px solid #F0EDE8',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FAF8F5' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {/* Cover thumbnail */}
              <div style={{
                width: 36,
                height: 52,
                borderRadius: 4,
                overflow: 'hidden',
                background: '#2D4A3E',
                flexShrink: 0,
              }}>
                {result.cover_url ? (
                  <img
                    src={result.cover_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 7, padding: 2, textAlign: 'center', lineHeight: 1.2 }}>
                      {result.title.slice(0, 20)}
                    </span>
                  </div>
                )}
              </div>

              {/* Book info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#1A1A1A',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {result.title}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#666',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {result.author}
                </div>
              </div>

              {/* Price + copies */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2D4A3E' }}>
                  from £{Number(result.lowest_price).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  {result.copy_count} {result.copy_count === 1 ? 'copy' : 'copies'}
                </div>
              </div>
            </button>
          )
        })}

        {/* "See all results" footer */}
        <button
          onClick={handleSearch as any}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            background: '#FAF8F5',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: '#2D4A3E',
            textAlign: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F0EDE8' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FAF8F5' }}
        >
          See all results for &ldquo;{searchQuery.trim()}&rdquo; →
        </button>
      </div>
    )
  }

  return (
    <>
      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 100 }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="site-nav-desktop">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); if (searchOpen) setShowSuggestions(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(250,248,245,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <Link href="/new" style={linkStyle(current === 'browse')}>Browse</Link>
          <Link href="/blog" style={linkStyle(current === 'blog')}>Blog</Link>
          <Link href="/support" style={linkStyle(current === 'support')}>Support</Link>
          <a href="https://apps.apple.com/gb/app/sell-your-shelf/id6739630632" style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
            Get the app
          </a>
        </div>

        {/* Mobile nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="site-nav-mobile">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); if (searchOpen) setShowSuggestions(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FAF8F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); setShowSuggestions(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FAF8F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FAF8F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Search bar dropdown with autocomplete */}
      {searchOpen && (
        <div
          ref={searchContainerRef}
          style={{ background: '#2D4A3E', padding: '0 24px 16px', borderBottom: '1px solid rgba(250,248,245,0.1)', position: 'relative', zIndex: 150 }}
        >
          <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder="Search by title or author..."
                autoFocus
                style={{
                  flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 8,
                  border: 'none', background: 'rgba(250,248,245,0.15)', color: '#FAF8F5',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500,
                  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                }}
              >
                Search
              </button>
            </form>

            <SuggestionsDropdown />
          </div>
        </div>
      )}

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div style={{ background: '#2D4A3E', padding: '8px 24px 20px', borderBottom: '1px solid rgba(250,248,245,0.1)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/new" onClick={() => setMenuOpen(false)} style={{ color: '#FAF8F5', fontSize: 15, textDecoration: 'none', fontWeight: current === 'browse' ? 600 : 400 }}>
            Browse Books
          </Link>
          <Link href="/blog" onClick={() => setMenuOpen(false)} style={{ color: '#FAF8F5', fontSize: 15, textDecoration: 'none', fontWeight: current === 'blog' ? 600 : 400 }}>
            Blog
          </Link>
          <Link href="/support" onClick={() => setMenuOpen(false)} style={{ color: '#FAF8F5', fontSize: 15, textDecoration: 'none', fontWeight: current === 'support' ? 600 : 400 }}>
            Support
          </Link>
          <a href="https://apps.apple.com/gb/app/sell-your-shelf/id6739630632" style={{ color: '#FAF8F5', fontSize: 15, textDecoration: 'none' }}>
            Get the App
          </a>
        </div>
      )}

      {/* Responsive CSS — hide mobile nav on desktop, desktop nav on mobile */}
      <style>{`
        .site-nav-mobile { display: none; }
        @media (max-width: 640px) {
          .site-nav-desktop { display: none !important; }
          .site-nav-mobile { display: flex !important; }
        }
      `}</style>
    </>
  )
}
