'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppBadges from './AppBadges'
import BrandMark from './BrandMark'

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

const RECENT_SEARCHES_KEY = 'sys_recent_searches'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined') return
  const q = query.trim()
  if (!q) return
  try {
    const existing = getRecentSearches().filter(s => s.toLowerCase() !== q.toLowerCase())
    const updated = [q, ...existing].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {}
}

function removeRecentSearch(query: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const updated = getRecentSearches().filter(s => s !== query)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return []
  }
}

function clearRecentSearches() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {}
}

// Cover fallback swatches, drawn from the calibration patch set so a missing
// asset becomes a metered reference chip rather than a grey hole.
const PATCH_SWATCHES = ['#2E8FA6', '#3A5CA8', '#4B8B5A', '#B33A34', '#A6417E', '#E0B03C']

function patchFor(id: number) {
  return PATCH_SWATCHES[Math.abs(id) % PATCH_SWATCHES.length]
}

type Props = {
  current?: 'browse' | 'bundles' | 'support' | 'blog' | null
}

export default function SiteNav({ current = null }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setShowRecent(false)
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

    if (value.trim().length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      // Show recent searches when input is cleared
      const recent = getRecentSearches()
      setRecentSearches(recent)
      setShowRecent(recent.length > 0)
      return
    }

    setShowRecent(false)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value.trim())
    }, 300)
  }

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setShowRecent(false)
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
      saveRecentSearch(q)
      setRecentSearches(getRecentSearches())
      setShowSuggestions(false)
      setShowRecent(false)
      router.push(`/search?q=${encodeURIComponent(q)}`)
      setSearchOpen(false)
      setMenuOpen(false)
    }
  }

  const handleSuggestionClick = (result: SearchResult) => {
    saveRecentSearch(searchQuery.trim())
    setRecentSearches(getRecentSearches())
    setShowSuggestions(false)
    setShowRecent(false)
    setSearchOpen(false)
    setMenuOpen(false)
    const slug = result.slug || generateSlug(result.title, result.author || '')
    router.push(`/books/${slug}`)
  }

  const handleRecentClick = (query: string) => {
    setSearchQuery(query)
    setShowRecent(false)
    router.push(`/search?q=${encodeURIComponent(query)}`)
    setSearchOpen(false)
    setMenuOpen(false)
  }

  const handleRemoveRecent = (query: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = removeRecentSearch(query)
    setRecentSearches(updated)
    if (updated.length === 0) setShowRecent(false)
  }

  const handleClearAllRecent = () => {
    clearRecentSearches()
    setRecentSearches([])
    setShowRecent(false)
  }

  const handleSearchFocus = () => {
    if (searchQuery.trim().length === 0) {
      const recent = getRecentSearches()
      setRecentSearches(recent)
      setShowRecent(recent.length > 0)
    } else if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const SuggestionsDropdown = () => {
    if (!showSuggestions || suggestions.length === 0) return null

    return (
      <div className="sl-sheet">
        {suggestions.map((result) => (
          <button
            key={result.book_id}
            onClick={() => handleSuggestionClick(result)}
            className="sl-row"
          >
            <div
              style={{
                width: 34,
                height: 51,
                overflow: 'hidden',
                background: patchFor(result.book_id),
                flexShrink: 0,
              }}
            >
              {result.cover_url ? (
                <img
                  src={result.cover_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span
                  className="sy-mark"
                  style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: 'flex-end',
                    padding: 3,
                    fontSize: 6,
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.1,
                  }}
                >
                  {result.title.slice(0, 18)}
                </span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {result.title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--color-ink-soft)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {result.author}{result.category ? ` · ${result.category}` : ''}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="sy-figure" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-ink)' }}>
                from £{Number(result.lowest_price).toFixed(2)}
              </div>
              <div className="sy-figure" style={{ fontSize: 11.5, color: 'var(--color-ink-faint)' }}>
                {result.copy_count} {result.copy_count === 1 ? 'copy' : 'copies'}
              </div>
            </div>
          </button>
        ))}

        <button onClick={handleSearch as any} className="sl-row-foot">
          See all results for &ldquo;{searchQuery.trim()}&rdquo; →
        </button>
      </div>
    )
  }

  const RecentSearchesDropdown = () => {
    if (!showRecent || recentSearches.length === 0) return null

    return (
      <div className="sl-sheet">
        <div
          style={{
            padding: '11px 16px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-rule)',
          }}
        >
          <span className="sy-mark" style={{ color: 'var(--color-ink-faint)' }}>Recent searches</span>
          <button onClick={handleClearAllRecent} className="sl-clear">Clear all</button>
        </div>
        {recentSearches.map((query) => (
          <button key={query} onClick={() => handleRecentClick(query)} className="sl-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-ink-faint)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--color-ink)', textAlign: 'left' }}>{query}</span>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Remove ${query}`}
              onClick={(e) => handleRemoveRecent(query, e)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRemoveRecent(query, e as any) }}
              className="sl-remove"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    )
  }

  const navLink = (href: string, label: string, key: Props['current']) => (
    <Link href={href} className={`sl-navlink${current === key ? ' is-active' : ''}`}>
      {label}
    </Link>
  )

  return (
    <>
      <nav className="sl-nav">
        <Link href="/" className="sl-logo">
          <BrandMark size={26} color="#fff" />
          <span className="sy-wordmark">Sell Your Shelf</span>
        </Link>

        {/* Desktop nav */}
        <div className="site-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); if (searchOpen) { setShowSuggestions(false); setShowRecent(false) } }}
            className="sl-iconbtn"
            aria-label="Search"
            aria-expanded={searchOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          {navLink('/new', 'Shop books', 'browse')}
          {navLink('/bundles', 'Bundles', 'bundles')}
          {navLink('/blog', 'Blog', 'blog')}
          {navLink('/support', 'Support', 'support')}
          <AppBadges utm={{ source: 'nav', medium: 'header', campaign: 'get_the_app' }} size="sm" layout="row" />
        </div>

        {/* Mobile nav */}
        <div className="site-nav-mobile" style={{ alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); if (searchOpen) { setShowSuggestions(false); setShowRecent(false) } }}
            className="sl-iconbtn"
            aria-label="Search"
            aria-expanded={searchOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); setShowSuggestions(false); setShowRecent(false) }}
            className="sl-iconbtn"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* Search bar with autocomplete */}
      {searchOpen && (
        <div ref={searchContainerRef} className="sl-searchbar">
          <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
            <span className="sy-mark" style={{ color: 'var(--color-on-ground-soft)', display: 'block', marginBottom: 8 }}>
              Search the marketplace
            </span>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 0 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onFocus={handleSearchFocus}
                placeholder="Title, author or ISBN"
                autoFocus
                className="sl-input"
              />
              <button type="submit" className="sl-submit">Search</button>
            </form>
            {loadingSuggestions && (
              <span className="sy-mark" style={{ color: 'var(--color-on-ground-soft)', display: 'block', marginTop: 8 }}>
                Reading…
              </span>
            )}
            <SuggestionsDropdown />
            <RecentSearchesDropdown />
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sl-mobilemenu">
          <Link href="/new" onClick={() => setMenuOpen(false)} className={`sl-mobilelink${current === 'browse' ? ' is-active' : ''}`}>Shop books</Link>
          <Link href="/bundles" onClick={() => setMenuOpen(false)} className={`sl-mobilelink${current === 'bundles' ? ' is-active' : ''}`}>Bundles</Link>
          <Link href="/blog" onClick={() => setMenuOpen(false)} className={`sl-mobilelink${current === 'blog' ? ' is-active' : ''}`}>Blog</Link>
          <Link href="/support" onClick={() => setMenuOpen(false)} className={`sl-mobilelink${current === 'support' ? ' is-active' : ''}`}>Support</Link>
          <div style={{ paddingTop: 6 }}>
            <AppBadges utm={{ source: 'nav', medium: 'mobile_menu', campaign: 'get_the_app' }} size="md" layout="row" />
          </div>
        </div>
      )}

      <style>{`
        .sl-nav {
          background: var(--color-ground-deep);
          padding: 0 24px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 100;
          border-bottom: 1px solid var(--color-rule-dim);
        }
        .sl-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
          text-decoration: none;
        }
        .sl-navlink {
          color: rgba(255,255,255,0.82);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          padding: 4px 0;
          border-bottom: 2px solid transparent;
          transition: color .12s linear, border-color .12s linear;
        }
        .sl-navlink:hover { color: #fff; border-bottom-color: var(--color-on-ground-soft); }
        .sl-navlink.is-active { color: #fff; border-bottom-color: var(--color-accent); }
        .sl-iconbtn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          color: rgba(255,255,255,0.88);
        }
        .sl-iconbtn:hover { color: #fff; }
        .sl-searchbar {
          background: var(--color-ground-deep);
          padding: 18px 24px 22px;
          border-bottom: 1px solid var(--color-rule-dim);
          position: relative;
          z-index: 150;
        }
        .sl-input {
          flex: 1;
          min-width: 0;
          padding: 13px 20px;
          font-size: 15px;
          border: 1px solid transparent;
          background: var(--color-paper);
          color: var(--color-ink);
          outline: none;
          border-radius: var(--radius-pill) 0 0 var(--radius-pill);
        }
        .sl-input::placeholder { color: var(--color-ink-faint); }
        .sl-submit {
          background: var(--color-action);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          padding: 13px 26px;
          border: 1px solid var(--color-action);
          cursor: pointer;
          border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
        }
        .sl-submit:hover { background: var(--color-action-deep); border-color: var(--color-action-deep); }
        .sl-sheet {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--color-sheet);
          border: 1px solid var(--color-rule);
          border-radius: 0 0 var(--radius-md) var(--radius-md);
          box-shadow: 0 16px 34px rgba(26,29,27,0.26);
          margin-top: 8px;
          z-index: 200;
          max-height: 420px;
          overflow-y: auto;
        }
        .sl-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 14px;
          border: 0;
          border-bottom: 1px solid var(--color-rule);
          background: transparent;
          cursor: pointer;
          text-align: left;
        }
        .sl-row:hover { background: var(--color-paper-warm); }
        .sl-row-foot {
          display: block;
          width: 100%;
          padding: 13px 16px;
          border: 0;
          background: var(--color-paper-warm);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-action);
          text-align: center;
        }
        .sl-row-foot:hover { background: var(--color-paper-deep); }
        .sl-clear {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-action);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .sl-clear:hover { text-decoration: underline; }
        .sl-remove {
          color: var(--color-ink-faint);
          cursor: pointer;
          display: flex;
          padding: 4px;
        }
        .sl-remove:hover { color: var(--color-action); }
        .sl-mobilemenu {
          background: var(--color-ground-deep);
          padding: 12px 24px 22px;
          border-bottom: 1px solid var(--color-rule-dim);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .sl-mobilelink {
          color: rgba(255,255,255,0.88);
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
        }
        .sl-mobilelink.is-active { color: #fff; text-decoration: underline; text-underline-offset: 5px; text-decoration-color: var(--color-accent); text-decoration-thickness: 2px; }
        .sl-navlink { white-space: nowrap; }
        .site-nav-mobile { display: none; }
        /* 900, not 640: the desktop row carries four links plus both store
           badges, and it starts wrapping well before phone widths. */
        @media (max-width: 900px) {
          .site-nav-desktop { display: none !important; }
          .site-nav-mobile { display: flex !important; }
        }
      `}</style>
    </>
  )
}
