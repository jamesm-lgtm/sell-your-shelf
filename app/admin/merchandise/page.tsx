'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminNav from '@/app/components/AdminNav'
import { getAdminPassword, setAdminPassword, clearAdminPassword } from '@/app/lib/adminAuth'

type Tag = {
  id: number
  label: string
  slug: string
  active: boolean
  display_order: number
  app_display_order: number
  description: string
  show_on: 'web' | 'app' | 'both'
}

type TagListing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  books: { cover_url: string | null } | null
}

type Listing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  books: { cover_url: string | null; isbn: string | null } | null
  listing_editorial_tags: { tag_id: number }[]
}

type Platform = 'web' | 'app'

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

const SHOW_ON_OPTIONS: { value: Tag['show_on']; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'web', label: 'Web' },
  { value: 'app', label: 'App' },
]

export default function MerchandisePage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [platform, setPlatform] = useState<Platform>('web')
  const [tags, setTags] = useState<Tag[]>([])
  const [expandedTagId, setExpandedTagId] = useState<number | null>(null)
  const [tagListings, setTagListings] = useState<Record<number, TagListing[]>>({})
  const [tagCounts, setTagCounts] = useState<Record<number, number>>({})
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [descriptions, setDescriptions] = useState<Record<number, string>>({})
  const [savedDescTagId, setSavedDescTagId] = useState<number | null>(null)
  const [addingTag, setAddingTag] = useState(false)
  const [newTagLabel, setNewTagLabel] = useState('')
  const [newTagDescription, setNewTagDescription] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Listing[]>([])
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    // Shared with /admin/orders and /admin/analytics so moving between
    // admin sections doesn't re-prompt.
    if (getAdminPassword() || localStorage.getItem('admin_token')) setAuthed(true)
  }, [])

  const handleLogin = async () => {
    setAuthError('')
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      await res.json()
      setAdminPassword(password)
      setAuthed(true)
    } else {
      setAuthError('Invalid password')
    }
  }

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/admin/tags')
    if (res.ok) {
      const data = await res.json()
      setTags(data)
      const descMap: Record<number, string> = {}
      for (const tag of data) {
        descMap[tag.id] = tag.description || ''
        fetchTagListings(tag.id)
      }
      setDescriptions(prev => {
        const merged = { ...descMap }
        for (const [k, v] of Object.entries(prev)) {
          if (v !== undefined) merged[Number(k)] = v
        }
        return merged
      })
    }
  }, [])

  const fetchTagListings = async (tagId: number) => {
    const res = await fetch(`/api/admin/tags/${tagId}/listings`)
    if (res.ok) {
      const listings: TagListing[] = await res.json()
      setTagListings(prev => ({ ...prev, [tagId]: listings }))
      setTagCounts(prev => ({ ...prev, [tagId]: listings.length }))
    }
  }

  useEffect(() => {
    if (authed) fetchTags()
  }, [authed, fetchTags])

  // Filter and sort tags for current platform
  const filteredTags = tags
    .filter(t => {
      if (platform === 'web') return t.show_on === 'web' || t.show_on === 'both'
      return t.show_on === 'app' || t.show_on === 'both'
    })
    .sort((a, b) => {
      const aOrder = platform === 'app' ? (a.app_display_order ?? a.display_order) : a.display_order
      const bOrder = platform === 'app' ? (b.app_display_order ?? b.display_order) : b.display_order
      return aOrder - bOrder
    })

  const handleExpandTag = (tagId: number) => {
    if (expandedTagId === tagId) { setExpandedTagId(null); return }
    setExpandedTagId(tagId)
    fetchTagListings(tagId)
  }

  const handleStartRename = (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingTagId(tag.id)
    setEditLabel(tag.label)
  }

  const handleSaveRename = async (tag: Tag) => {
    if (!editLabel.trim()) return
    await fetch('/api/admin/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, label: editLabel.trim() }),
    })
    setRenamingTagId(null)
    fetchTags()
  }

  const handleSaveDescription = async (tag: Tag) => {
    const desc = descriptions[tag.id] ?? ''
    await fetch('/api/admin/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, description: desc }),
    })
    setSavedDescTagId(tag.id)
    setTimeout(() => setSavedDescTagId(null), 2000)
  }

  const handleUpdateShowOn = async (tag: Tag, showOn: Tag['show_on']) => {
    await fetch('/api/admin/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, show_on: showOn }),
    })
    fetchTags()
  }

  const handleUpdateOrder = async (tag: Tag, newOrder: number) => {
    const field = platform === 'app' ? 'app_display_order' : 'display_order'
    await fetch('/api/admin/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, [field]: newOrder }),
    })
    fetchTags()
  }

  const handleToggleActive = async (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/admin/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tag.id, active: !tag.active }),
    })
    fetchTags()
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage('')
    const direction = platform === 'web' ? 'web-to-app' : 'app-to-web'
    const res = await fetch('/api/admin/tags/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    if (res.ok) {
      const { synced } = await res.json()
      setSyncMessage(`Synced ${synced} tags`)
      setTimeout(() => setSyncMessage(''), 3000)
      fetchTags()
    }
    setSyncing(false)
  }

  const handleAddTag = async () => {
    if (!newTagLabel.trim()) return
    const res = await fetch('/api/admin/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newTagLabel.trim(), description: newTagDescription.trim() }),
    })
    if (res.ok) {
      setNewTagLabel('')
      setNewTagDescription('')
      setAddingTag(false)
      fetchTags()
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const res = await fetch(`/api/admin/listings/search?q=${encodeURIComponent(searchQuery)}`)
    if (res.ok) setSearchResults(await res.json())
    setSearching(false)
  }

  const handleSelectListing = (listing: Listing) => {
    setSelectedListing(listing)
    setSelectedTagIds(listing.listing_editorial_tags.map(t => t.tag_id))
  }

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSaveTags = async () => {
    if (!selectedListing) return
    setSaving(true)
    await fetch('/api/admin/listings/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: selectedListing.id, tag_ids: selectedTagIds }),
    })
    setSearchResults(prev =>
      prev.map(l =>
        l.id === selectedListing.id
          ? { ...l, listing_editorial_tags: selectedTagIds.map(tag_id => ({ tag_id })) }
          : l
      )
    )
    setSelectedListing(prev =>
      prev ? { ...prev, listing_editorial_tags: selectedTagIds.map(tag_id => ({ tag_id })) } : null
    )
    setSaving(false)
    for (const tagId of selectedTagIds) fetchTagListings(tagId)
    fetchTags()
  }

  // Login screen
  if (!authed) {
    return (
      <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 12, padding: 32, width: 360 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>Admin Access</h1>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Enter the admin password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '0.5px solid #E5E3DF', borderRadius: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          {authError && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{authError}</p>}
          <button
            onClick={handleLogin}
            style={{ width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 500, background: '#2D4A3E', color: '#FAF8F5', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const activeTags = tags.filter(t => t.active)

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E3DF', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', margin: 0 }}>Editorial Merchandising</h1>
        <button
          onClick={() => { clearAdminPassword(); setAuthed(false) }}
          style={{ fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 0' }}>
        <AdminNav />
      </div>

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', padding: 24, gap: 24 }}>
        {/* Left column — Tag management (40%) */}
        <div style={{ width: '40%', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 12, padding: 20 }}>

            {/* Platform tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '0.5px solid #E5E3DF', borderRadius: 8, overflow: 'hidden' }}>
              {(['web', 'app'] as Platform[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setPlatform(p); setExpandedTagId(null) }}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                    background: platform === p ? '#2D4A3E' : '#fff',
                    color: platform === p ? '#FAF8F5' : '#666',
                  }}
                >
                  {p === 'web' ? 'Web Collections' : 'App Collections'}
                </button>
              ))}
            </div>

            {/* Sync button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
                  background: '#fff', color: '#2D4A3E', border: '1px solid #2D4A3E',
                }}
              >
                {syncing ? 'Syncing…' : platform === 'web' ? 'Copy all to App' : 'Sync from Web'}
              </button>
              {syncMessage && (
                <span style={{ fontSize: 12, color: '#2D4A3E', fontWeight: 500 }}>{syncMessage}</span>
              )}
            </div>

            {/* Tag list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTags.map(tag => {
                const isExpanded = expandedTagId === tag.id
                const isRenaming = renamingTagId === tag.id
                const count = tagCounts[tag.id] ?? 0
                const listings = tagListings[tag.id] ?? []
                const orderValue = platform === 'app' ? (tag.app_display_order ?? tag.display_order) : tag.display_order
                const coversCount = listings.filter(l => l.books?.cover_url).length

                return (
                  <div
                    key={tag.id}
                    style={{
                      background: tag.active ? '#fff' : '#F5F5F5',
                      border: `0.5px solid ${isExpanded ? '#2D4A3E' : '#E5E3DF'}`,
                      borderRadius: 8,
                      opacity: tag.active ? 1 : 0.6,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Tag header row */}
                    <div
                      onClick={() => handleExpandTag(tag.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: 11, color: '#999', userSelect: 'none' }}>
                        {isExpanded ? '▾' : '▸'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isRenaming ? (
                          <input
                            type="text"
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(tag); if (e.key === 'Escape') setRenamingTagId(null) }}
                            onBlur={() => handleSaveRename(tag)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                            style={{ fontSize: 14, fontWeight: 500, border: '1px solid #2D4A3E', borderRadius: 4, padding: '2px 6px', width: '100%', boxSizing: 'border-box' }}
                          />
                        ) : (
                          <div
                            onDoubleClick={e => handleStartRename(tag, e)}
                            style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}
                            title="Double-click to rename"
                          >
                            {tag.label}
                            <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 6 }}>
                              {count} {count === 1 ? 'book' : 'books'}
                            </span>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#999' }}>{tag.slug}</div>
                      </div>
                      <input
                        type="number"
                        value={orderValue}
                        onChange={e => handleUpdateOrder(tag, parseInt(e.target.value) || 0)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 44, padding: '3px 4px', fontSize: 12, border: '0.5px solid #E5E3DF', borderRadius: 4, textAlign: 'center' }}
                        title={platform === 'app' ? 'App display order' : 'Web display order'}
                      />
                      <button
                        onClick={e => handleToggleActive(tag, e)}
                        style={{
                          padding: '3px 10px', fontSize: 11, fontWeight: 500, borderRadius: 4, border: 'none', cursor: 'pointer',
                          background: tag.active ? '#2D4A3E' : '#E5E3DF',
                          color: tag.active ? '#FAF8F5' : '#666',
                        }}
                      >
                        {tag.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div style={{ padding: '0 12px 12px', borderTop: '0.5px solid #E5E3DF' }}>
                        {/* Show on toggle */}
                        <div style={{ padding: '10px 0 8px' }}>
                          <label style={{ fontSize: 11, fontWeight: 500, color: '#999', display: 'block', marginBottom: 4 }}>Show on</label>
                          <div style={{ display: 'flex', gap: 0, border: '0.5px solid #E5E3DF', borderRadius: 6, overflow: 'hidden' }}>
                            {SHOW_ON_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => handleUpdateShowOn(tag, opt.value)}
                                style={{
                                  flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                                  background: tag.show_on === opt.value ? '#2D4A3E' : '#fff',
                                  color: tag.show_on === opt.value ? '#FAF8F5' : '#666',
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ padding: '4px 0 8px' }}>
                          <label style={{ fontSize: 11, fontWeight: 500, color: '#999', display: 'block', marginBottom: 4 }}>Description</label>
                          <textarea
                            value={descriptions[tag.id] ?? tag.description ?? ''}
                            onChange={e => setDescriptions(prev => ({ ...prev, [tag.id]: e.target.value }))}
                            placeholder="Add a description for this tag…"
                            rows={2}
                            style={{ width: '100%', fontSize: 13, border: '0.5px solid #E5E3DF', borderRadius: 4, padding: '6px 8px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <button
                              onClick={() => handleSaveDescription(tag)}
                              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 500, background: '#2D4A3E', color: '#FAF8F5', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Save description
                            </button>
                            {savedDescTagId === tag.id && (
                              <span style={{ fontSize: 12, color: '#2D4A3E', fontWeight: 500 }}>Saved!</span>
                            )}
                          </div>
                        </div>

                        {/* Stats (useful for app tab) */}
                        {platform === 'app' && count > 0 && (
                          <div style={{ padding: '4px 0 8px', fontSize: 12, color: '#666' }}>
                            {coversCount}/{count} books have cover images
                            {count < 3 && (
                              <span style={{ color: '#C43E3E', marginLeft: 8 }}>
                                (needs 3+ to show in app)
                              </span>
                            )}
                          </div>
                        )}

                        {/* Tagged books */}
                        {listings.length === 0 ? (
                          <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>No books tagged yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            {listings.map(listing => (
                              <div key={listing.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                <div style={{ width: 28, height: 40, borderRadius: 3, overflow: 'hidden', background: '#2D4A3E', flexShrink: 0 }}>
                                  {listing.books?.cover_url && (
                                    <img src={listing.books.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {listing.title}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#999' }}>
                                    {listing.author ?? 'Unknown'} · £{Number(listing.asking_price_gbp).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Tags not on this platform */}
              {tags.filter(t => {
                if (platform === 'web') return t.show_on === 'app'
                return t.show_on === 'web'
              }).length > 0 && (
                <div style={{ padding: '8px 0', borderTop: '0.5px solid #E5E3DF', marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: '#999', margin: '0 0 6px' }}>
                    Not on {platform === 'web' ? 'web' : 'app'}:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.filter(t => {
                      if (platform === 'web') return t.show_on === 'app'
                      return t.show_on === 'web'
                    }).map(t => (
                      <span
                        key={t.id}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#F0EDE8', color: '#999', cursor: 'pointer' }}
                        onClick={() => handleUpdateShowOn(t, 'both')}
                        title={`Click to add to ${platform}`}
                      >
                        {t.label} +
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new tag */}
              {addingTag ? (
                <div style={{ border: '1px dashed #2D4A3E', borderRadius: 8, padding: 12 }}>
                  <input
                    type="text"
                    value={newTagLabel}
                    onChange={e => setNewTagLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setAddingTag(false) }}
                    placeholder="Tag label (e.g. Summer Reads)"
                    autoFocus
                    style={{ width: '100%', fontSize: 14, border: '0.5px solid #E5E3DF', borderRadius: 4, padding: '8px 10px', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <textarea
                    value={newTagDescription}
                    onChange={e => setNewTagDescription(e.target.value)}
                    placeholder="Optional description…"
                    rows={2}
                    style={{ width: '100%', fontSize: 13, border: '0.5px solid #E5E3DF', borderRadius: 4, padding: '6px 8px', marginBottom: 8, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAddTag}
                      style={{ padding: '6px 16px', fontSize: 13, fontWeight: 500, background: '#2D4A3E', color: '#FAF8F5', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Add tag
                    </button>
                    <button
                      onClick={() => { setAddingTag(false); setNewTagLabel(''); setNewTagDescription('') }}
                      style={{ padding: '6px 16px', fontSize: 13, color: '#666', background: 'none', border: '0.5px solid #E5E3DF', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTag(true)}
                  style={{
                    padding: '10px 12px', fontSize: 13, fontWeight: 500, color: '#2D4A3E',
                    background: 'none', border: '1px dashed #E5E3DF', borderRadius: 8, cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  + Add tag
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right column — Search & tagging (60%) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', margin: '0 0 12px' }}>Search Listings</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by title, author, or ISBN…"
                style={{ flex: 1, padding: '10px 12px', fontSize: 14, border: '0.5px solid #E5E3DF', borderRadius: 8 }}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500, background: '#2D4A3E', color: '#FAF8F5', border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', margin: '0 0 12px' }}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map(listing => {
                  const isSelected = selectedListing?.id === listing.id
                  const listingTagIds = listing.listing_editorial_tags.map(t => t.tag_id)
                  const listingTags = tags.filter(t => listingTagIds.includes(t.id))

                  return (
                    <div
                      key={listing.id}
                      onClick={() => handleSelectListing(listing)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                        border: `1px solid ${isSelected ? '#2D4A3E' : '#E5E3DF'}`,
                        borderRadius: 8, cursor: 'pointer',
                        background: isSelected ? 'rgba(45, 74, 62, 0.04)' : '#fff',
                      }}
                    >
                      <div style={{ width: 40, height: 56, borderRadius: 4, overflow: 'hidden', background: '#2D4A3E', flexShrink: 0 }}>
                        {listing.books?.cover_url && (
                          <img src={listing.books.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {listing.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {listing.author ?? 'Unknown author'} · £{Number(listing.asking_price_gbp).toFixed(2)} · {CONDITIONS[listing.condition] ?? listing.condition}
                        </div>
                        {listingTags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {listingTags.map(t => (
                              <span key={t.id} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#2D4A3E', color: '#FAF8F5' }}>
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {selectedListing && (
            <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', margin: '0 0 4px' }}>
                Assign tags to: {selectedListing.title}
              </h3>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>
                {selectedListing.author ?? 'Unknown author'} · £{Number(selectedListing.asking_price_gbp).toFixed(2)}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {activeTags.map(tag => (
                  <label
                    key={tag.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#1A1A1A' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => handleToggleTag(tag.id)}
                      style={{ width: 16, height: 16, accentColor: '#2D4A3E' }}
                    />
                    {tag.label}
                    <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>
                      ({tag.show_on})
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSaveTags}
                disabled={saving}
                style={{ padding: '10px 24px', fontSize: 14, fontWeight: 500, background: '#2D4A3E', color: '#FAF8F5', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                {saving ? 'Saving…' : 'Save tags'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
