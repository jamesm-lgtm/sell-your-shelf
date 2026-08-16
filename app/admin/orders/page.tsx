'use client'

// /admin/orders — operational order tracking across app + eBay.
// Answers, in one place: what's been paid for and not shipped, how long
// it's been sitting, who the seller is, when they were last active, and
// how to reach them.

import { useCallback, useEffect, useMemo, useState } from 'react'

type Order = {
  id: string
  kind: 'transaction' | 'order'
  channel: 'app' | 'ebay'
  ref: string
  buyer_name: string | null
  buyer_contact: string | null
  first_title: string | null
  item_count: number
  total_gbp: number
  seller_payout_gbp: number | null
  status: string
  created_at: string
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipping_label_url: string | null
  ship_to: string | null
  seller_username: string | null
  seller_email: string | null
  seller_first_name: string | null
  seller_phone: string | null
  seller_push_tokens: number
  seller_email_opted_in: boolean
  seller_wallet_status: string | null
  seller_last_active_at: string | null
  days_since_paid: number | null
  days_since_shipped: number | null
  days_to_ship: number | null
  severity: 'critical' | 'warning' | 'ok'
  attention_reason: string | null
}

type Board = {
  days: number
  generated_at: string
  summary: {
    total: number
    awaiting_dispatch: number
    critical: number
    warning: number
    in_transit: number
    gmv_gbp: number
  }
  orders: Order[]
}

const INK = '#0b0b0b'
const INK_SECONDARY = '#52514e'
const INK_MUTED = '#898781'
const GRID = '#e1e0d9'
const SURFACE = '#fcfcfb'

// Status palette (reserved — never reused for series colour)
const SEVERITY = {
  critical: { bg: '#FDECEC', fg: '#B3261E', label: 'Critical' },
  warning: { bg: '#FEF7E0', fg: '#8A6100', label: 'Attention' },
  ok: { bg: '#EDF6EE', fg: '#1B5E20', label: 'OK' },
} as const

const gbp = (n: number) =>
  Number(n).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

function daysAgo(iso: string | null): string {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 31) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'critical' | 'warning' }) {
  const fg = tone ? SEVERITY[tone].fg : INK
  return (
    <div style={{ background: SURFACE, border: '1px solid rgba(11,11,11,0.10)', borderRadius: 12, padding: '14px 18px', minWidth: 132 }}>
      <div style={{ fontSize: 12, color: INK_MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: fg }}>{value}</div>
    </div>
  )
}

function OrderCard({ o }: { o: Order }) {
  const sev = SEVERITY[o.severity]
  const stale = o.seller_last_active_at
    ? Math.floor((Date.now() - new Date(o.seller_last_active_at).getTime()) / 86400000)
    : null

  return (
    <div style={{ background: SURFACE, border: '1px solid rgba(11,11,11,0.10)', borderLeft: `4px solid ${sev.fg}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', background: o.channel === 'ebay' ? '#E8EEF9' : '#EAF2EE', color: o.channel === 'ebay' ? '#1B3A6B' : '#254B3C', padding: '3px 8px', borderRadius: 5 }}>
          {o.channel}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{o.ref}</span>
        <span style={{ fontSize: 12, color: INK_SECONDARY }}>
          {o.first_title}{o.item_count > 1 ? ` +${o.item_count - 1} more` : ''}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: INK }}>{gbp(o.total_gbp)}</span>
      </div>

      {o.attention_reason && (
        <div style={{ background: sev.bg, color: sev.fg, fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
          ⚠ {o.attention_reason}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12, color: INK_SECONDARY }}>
        <div>
          <div style={{ color: INK_MUTED, marginBottom: 2 }}>Status</div>
          <div style={{ color: INK, fontWeight: 600 }}>{o.status}</div>
          <div>
            paid {daysAgo(o.paid_at)}
            {o.shipped_at ? ` · shipped ${daysAgo(o.shipped_at)}` : ''}
            {o.days_to_ship !== null ? ` (${o.days_to_ship}d to ship)` : ''}
          </div>
        </div>

        <div>
          <div style={{ color: INK_MUTED, marginBottom: 2 }}>Seller</div>
          <div style={{ color: INK, fontWeight: 600 }}>
            @{o.seller_username ?? '—'}
            {o.seller_wallet_status && o.seller_wallet_status !== 'enabled' && (
              <span style={{ color: SEVERITY.warning.fg, fontWeight: 500 }}> · wallet {o.seller_wallet_status}</span>
            )}
          </div>
          <div>
            last active {daysAgo(o.seller_last_active_at)}
            {stale !== null && stale > 14 && <span style={{ color: SEVERITY.warning.fg }}> · stale</span>}
          </div>
        </div>

        <div>
          <div style={{ color: INK_MUTED, marginBottom: 2 }}>Reach seller</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {o.seller_email ? (
              <a
                href={`mailto:${o.seller_email}?subject=${encodeURIComponent(`Your Sell Your Shelf order ${o.ref}`)}&body=${encodeURIComponent(`Hi ${o.seller_first_name || o.seller_username || 'there'},\n\nYour order ${o.ref} (${o.first_title}) was paid ${o.days_since_paid ?? '?'} days ago and hasn't been marked as shipped yet.\n\nCould you let me know if you've posted it, or if anything's holding it up?\n\nThanks,\nJames`)}`}
                style={{ color: '#254B3C', textDecoration: 'underline' }}
              >
                email
              </a>
            ) : <span style={{ color: INK_MUTED }}>no email</span>}
            {o.seller_phone && <a href={`tel:${o.seller_phone}`} style={{ color: '#254B3C', textDecoration: 'underline' }}>{o.seller_phone}</a>}
            {o.seller_push_tokens > 0 && <span title="has app push tokens">push ✓</span>}
            {!o.seller_email_opted_in && <span style={{ color: SEVERITY.warning.fg }}>opted out</span>}
          </div>
        </div>

        <div>
          <div style={{ color: INK_MUTED, marginBottom: 2 }}>Buyer / shipping</div>
          <div style={{ color: INK }}>{o.buyer_name || o.buyer_contact || '—'}</div>
          <div>{o.ship_to || '—'}</div>
          {o.tracking_number && (
            <div>
              {o.tracking_url
                ? <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: '#254B3C' }}>{o.tracking_number}</a>
                : o.tracking_number}
            </div>
          )}
          {o.shipping_label_url && (
            <a href={o.shipping_label_url} target="_blank" rel="noopener noreferrer" style={{ color: '#254B3C' }}>label</a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [days, setDays] = useState<30 | 90 | 365>(90)
  const [data, setData] = useState<Board | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'attention' | 'open' | 'all'>('attention')
  const [channel, setChannel] = useState<'all' | 'app' | 'ebay'>('all')

  const load = useCallback(async (pw: string, windowDays: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, days: windowDays }),
      })
      if (res.status === 401) {
        setAuthed(false)
        setAuthError('Invalid password')
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
      setAuthed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem('sys_admin_pw')
    if (stored) {
      setPassword(stored)
      load(stored, days)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAuth = async () => {
    sessionStorage.setItem('sys_admin_pw', password)
    await load(password, days)
  }

  const visible = useMemo(() => {
    if (!data) return []
    return data.orders.filter((o) => {
      if (channel !== 'all' && o.channel !== channel) return false
      if (filter === 'attention') return o.severity !== 'ok'
      if (filter === 'open') return !['completed', 'cancelled', 'delivered'].includes(o.status)
      return true
    })
  }, [data, filter, channel])

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: SURFACE, border: '1px solid rgba(11,11,11,0.10)', borderRadius: 12, padding: 28, width: 320 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: INK }}>Orders — admin</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Admin password"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #c3c2b7', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <button onClick={handleAuth} disabled={loading} style={{ width: '100%', padding: '10px 12px', background: '#254B3C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
          {authError && <div style={{ color: '#d03b3b', fontSize: 12, marginTop: 8 }}>{authError}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'system-ui, sans-serif', color: INK }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Order tracking</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            {([30, 90, 365] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setDays(d); load(password, d) }}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  border: '1px solid rgba(11,11,11,0.10)',
                  background: days === d ? '#254B3C' : SURFACE,
                  color: days === d ? '#fff' : INK_SECONDARY,
                  fontWeight: days === d ? 600 : 400,
                }}
              >
                {d === 365 ? 'All' : `${d}d`}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ color: '#d03b3b', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {loading && !data && <div style={{ color: INK_MUTED, fontSize: 13 }}>Loading…</div>}

        {data && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Tile label="Awaiting dispatch" value={String(data.summary.awaiting_dispatch)} tone={data.summary.awaiting_dispatch > 0 ? 'warning' : undefined} />
              <Tile label="Critical (7d+)" value={String(data.summary.critical)} tone={data.summary.critical > 0 ? 'critical' : undefined} />
              <Tile label="Needs attention" value={String(data.summary.critical + data.summary.warning)} />
              <Tile label="In transit" value={String(data.summary.in_transit)} />
              <Tile label="Orders" value={String(data.summary.total)} />
              <Tile label="GMV" value={gbp(data.summary.gmv_gbp)} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['attention', 'open', 'all'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  border: '1px solid rgba(11,11,11,0.10)',
                  background: filter === f ? '#254B3C' : SURFACE,
                  color: filter === f ? '#fff' : INK_SECONDARY,
                  fontWeight: filter === f ? 600 : 400,
                }}>
                  {f === 'attention' ? 'Needs attention' : f === 'open' ? 'Open' : 'All'}
                </button>
              ))}
              <span style={{ width: 12 }} />
              {(['all', 'app', 'ebay'] as const).map((c) => (
                <button key={c} onClick={() => setChannel(c)} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  border: '1px solid rgba(11,11,11,0.10)',
                  background: channel === c ? '#3F3F3A' : SURFACE,
                  color: channel === c ? '#fff' : INK_SECONDARY,
                }}>
                  {c === 'all' ? 'All channels' : c}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: INK_MUTED }}>
                {visible.length} shown · generated {new Date(data.generated_at).toLocaleTimeString('en-GB')}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {visible.length === 0 ? (
                <div style={{ background: SURFACE, border: `1px solid ${GRID}`, borderRadius: 10, padding: 24, textAlign: 'center', color: INK_MUTED, fontSize: 14 }}>
                  Nothing here — no orders match this filter.
                </div>
              ) : (
                visible.map((o) => <OrderCard key={o.id} o={o} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
