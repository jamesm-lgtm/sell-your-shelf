'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  current?: 'browse' | 'support' | null
}

export default function SiteNav({ current = null }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q.length > 0) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
      setSearchOpen(false)
      setMenuOpen(false)
    }
  }

  const linkStyle = (active: boolean) => ({
    color: active ? '#FAF8F5' : 'rgba(250,248,245,0.8)',
    fontSize: 13,
    fontWeight: 500 as const,
    textDecoration: 'none' as const,
  })

  return (
    <>
      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 100 }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="site-nav-desktop">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(250,248,245,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <Link href="/new" style={linkStyle(current === 'browse')}>Browse</Link>
          <Link href="/support" style={linkStyle(current === 'support')}>Support</Link>
          <a href="https://apps.apple.com/gb/app/sell-your-shelf/id6739630632" style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
            Get the app
          </a>
        </div>

        {/* Mobile nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="site-nav-mobile">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FAF8F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false) }}
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

      {/* Search bar dropdown */}
      {searchOpen && (
        <div style={{ background: '#2D4A3E', padding: '0 24px 16px', borderBottom: '1px solid rgba(250,248,245,0.1)' }}>
          <form onSubmit={handleSearch} style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
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
        </div>
      )}

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div style={{ background: '#2D4A3E', padding: '8px 24px 20px', borderBottom: '1px solid rgba(250,248,245,0.1)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="/new" onClick={() => setMenuOpen(false)} style={{ color: '#FAF8F5', fontSize: 15, textDecoration: 'none', fontWeight: current === 'browse' ? 600 : 400 }}>
            Browse Books
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
