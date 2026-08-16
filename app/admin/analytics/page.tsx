'use client'

// /admin/analytics — daily search-traffic + purchase-funnel dashboard.
// Data comes from the admin_search_funnel_dashboard() Postgres function via
// /api/admin/analytics (password-gated). Charts are dependency-free SVG.

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminNav from '@/app/components/AdminNav'
import { getAdminPassword, setAdminPassword } from '@/app/lib/adminAuth'

type DailyRow = {
  date: string
  book_views: number
  listing_views: number
  shelf_visits: number
  checkout_starts: number
  impressions: number
  clicks: number
  app_dau: number
  new_active_listings: number
  new_draft_listings: number
  app_sales: number
  app_gmv: number
  ebay_sales: number
  ebay_gmv: number
}

type LiveWallets = {
  generated_at: string
  total_available_gbp: number
  total_pending_gbp: number
  total_ebay_owed_gbp: number
  spendable_gbp: number
  unreachable: number
  rows: {
    user_id: string; username: string | null; email: string | null
    stripe_account_status: string | null
    earned_gbp: number; ebay_owed_gbp: number; ebay_paid_gbp: number
    ebay_outstanding_gbp: number; stripe_earned_gbp: number; spent_gbp: number
    available_gbp: number | null; pending_gbp: number | null
    stripe_error: string | null; last_sale_at: string | null
  }[]
}

type Dashboard = {
  days: number
  daily: DailyRow[]
  sources: { source: string; views: number; sessions: number }[]
  top_books: { title: string; author: string | null; views: number }[]
  top_queries: { query: string; impressions: number; clicks: number; position: number }[]
  seller_funnel: { registered: number; listed: number; payments_enabled: number; made_a_sale: number }
  listing_inventory: {
    active: number; draft: number; sold: number; removed: number
    sellers_with_active: number; sellers_with_draft: number
    avg_active_price: number; active_inventory_value: number
    cross_listed: number; draft_value: number
  }
  top_sellers: { username: string; active_listings: number; inventory_value: number }[]
  wallets: {
    total_gbp: number
    holders: number
    spendable_gbp: number
    blocked_gbp: number
    rows: {
      id: string; username: string | null; email: string | null
      earned_gbp: number; spent_gbp: number; balance_gbp: number
      stripe_account_status: string | null; last_sale_at: string | null
    }[]
  }
  totals: {
    views: number
    sessions: number
    checkout_starts: number
    sales: number
    gmv: number
    impressions: number
    clicks: number
  }
  gsc_rows: number
}

// Validated categorical palette (dataviz slots 1–3, light mode).
const SERIES = {
  book_views: { label: 'Book pages', color: '#2a78d6' },
  listing_views: { label: 'Listing pages', color: '#eb6834' },
  shelf_visits: { label: 'Shelves', color: '#1baf7a' },
} as const

const INK = '#0b0b0b'
const INK_SECONDARY = '#52514e'
const INK_MUTED = '#898781'
const GRID = '#e1e0d9'
const SURFACE = '#fcfcfb'

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 })

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: SURFACE, border: '1px solid rgba(11,11,11,0.10)', borderRadius: 12, padding: '14px 18px', minWidth: 130 }}>
      <div style={{ fontSize: 12, color: INK_MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: INK }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: INK_SECONDARY, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: SURFACE, border: '1px solid rgba(11,11,11,0.10)', borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

// Stacked daily views bar chart with hover tooltip.
function ViewsChart({ daily }: { daily: DailyRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 200
  const PAD = { top: 8, right: 8, bottom: 22, left: 34 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const max = Math.max(1, ...daily.map((r) => r.book_views + r.listing_views + r.shelf_visits))
  const band = innerW / Math.max(1, daily.length)
  const barW = Math.max(3, Math.min(26, band - 2))

  const keys = ['book_views', 'listing_views', 'shelf_visits'] as const

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Daily page views by page type">
        {[0.5, 1].map((f) => {
          const y = PAD.top + innerH - innerH * f
          return (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={INK_MUTED}>
                {Math.round(max * f)}
              </text>
            </g>
          )
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#c3c2b7" strokeWidth={1} />
        {daily.map((r, i) => {
          const x = PAD.left + i * band + (band - barW) / 2
          let yCursor = PAD.top + innerH
          return (
            <g key={r.date}>
              {keys.map((k) => {
                const h = (r[k] / max) * innerH
                if (h <= 0) return null
                yCursor -= h
                const y = yCursor
                // 2px surface gap between stacked segments via stroke
                return <rect key={k} x={x} y={y} width={barW} height={h} fill={SERIES[k].color} stroke={SURFACE} strokeWidth={1} rx={2} />
              })}
              {/* hit target across the full band height */}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {(i === 0 || i === daily.length - 1 || (daily.length > 14 && i % 7 === 0)) && (
                <text x={PAD.left + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={INK_MUTED}>
                  {r.date.slice(5)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && daily[hover] && (
        <div
          style={{
            position: 'absolute',
            left: `${((PAD.left + hover * band + band / 2) / W) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
            background: INK,
            color: '#fff',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{daily[hover].date}</div>
          {(['book_views', 'listing_views', 'shelf_visits'] as const).map((k) => (
            <div key={k}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SERIES[k].color, marginRight: 6 }} />
              {SERIES[k].label}: {daily[hover][k]}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: INK_SECONDARY }}>
        {(['book_views', 'listing_views', 'shelf_visits'] as const).map((k) => (
          <span key={k}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: SERIES[k].color, marginRight: 6, verticalAlign: 'middle' }} />
            {SERIES[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Small-multiple daily bars for one measure (sales count or GMV) — one hue,
// separate charts instead of a dual axis.
function MiniBars({ daily, getValue, color, format, label }: {
  daily: DailyRow[]
  getValue: (r: DailyRow) => number
  color: string
  format: (n: number) => string
  label: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 340
  const H = 120
  const PAD = { top: 6, right: 4, bottom: 18, left: 4 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const max = Math.max(1, ...daily.map(getValue))
  const band = innerW / Math.max(1, daily.length)
  const barW = Math.max(2, Math.min(22, band - 2))
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={label}>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#c3c2b7" strokeWidth={1} />
        {daily.map((r, i) => {
          const v = getValue(r)
          const h = (v / max) * innerH
          const x = PAD.left + i * band + (band - barW) / 2
          return (
            <g key={r.date}>
              {v > 0 && <rect x={x} y={PAD.top + innerH - h} width={barW} height={h} fill={color} rx={2} />}
              <rect x={PAD.left + i * band} y={PAD.top} width={band} height={innerH} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          )
        })}
        {daily.length > 0 && (
          <>
            <text x={PAD.left} y={H - 4} fontSize={9} fill={INK_MUTED}>{daily[0].date.slice(5)}</text>
            <text x={W - PAD.right} y={H - 4} fontSize={9} fill={INK_MUTED} textAnchor="end">{daily[daily.length - 1].date.slice(5)}</text>
          </>
        )}
      </svg>
      {hover !== null && daily[hover] && (
        <div style={{
          position: 'absolute', left: `${((PAD.left + hover * band + band / 2) / W) * 100}%`, top: 0,
          transform: 'translateX(-50%)', background: INK, color: '#fff', borderRadius: 8,
          padding: '6px 8px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5,
        }}>
          {daily[hover].date}: <strong>{format(getValue(daily[hover]))}</strong>
        </div>
      )}
    </div>
  )
}

// Horizontal funnel: ordinal blue ramp (steps 250→550).
const FUNNEL_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab']

function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null
        const rate = prev && prev > 0 ? ` · ${((s.value / prev) * 100).toFixed(1)}% of prev` : ''
        return (
          <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, color: INK_SECONDARY, textAlign: 'right' }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: `${Math.max(0.5, (s.value / max) * 100)}%`, minWidth: 2, height: 18, background: FUNNEL_RAMP[i], borderRadius: 4 }} />
              <span style={{ fontSize: 12, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                {s.value.toLocaleString()}
                <span style={{ color: INK_MUTED }}>{rate}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SourceBars({ sources }: { sources: Dashboard['sources'] }) {
  const max = Math.max(1, ...sources.map((s) => s.views))
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {sources.map((s) => (
        <div key={s.source} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: INK_SECONDARY, textAlign: 'right' }}>{s.source}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: `${Math.max(0.5, (s.views / max) * 100)}%`, minWidth: 2, height: 18, background: '#2a78d6', borderRadius: 4 }} />
            <span style={{ fontSize: 12, color: INK, fontVariantNumeric: 'tabular-nums' }}>
              {s.views.toLocaleString()} <span style={{ color: INK_MUTED }}>({s.sessions.toLocaleString()} sessions)</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [authed, setAuthed] = useState(false)
  // Avoids flashing the login form while the stored password is restored.
  const [restoring, setRestoring] = useState(true)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [section, setSection] = useState<'search' | 'funnel' | 'views' | 'listings' | 'wallets'>('search')
  // Wallet balances come live from Stripe (see /api/admin/wallets), so they
  // load lazily when the tab is opened rather than on every dashboard fetch.
  const [wallets, setWallets] = useState<LiveWallets | null>(null)
  const [walletsLoading, setWalletsLoading] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markError, setMarkError] = useState('')
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (pw: string, windowDays: number) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/analytics', {
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
    const stored = getAdminPassword()
    if (stored) {
      setPassword(stored)
      load(stored, days).finally(() => setRestoring(false))
    } else {
      setRestoring(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAuth = async () => {
    setAdminPassword(password)
    await load(password, days)
  }

  const changeDays = (d: 7 | 30 | 90) => {
    setDays(d)
    load(password, d)
  }

  useEffect(() => {
    if (section !== 'wallets' || wallets || walletsLoading || !password) return
    setWalletsLoading(true)
    fetch('/api/admin/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('wallets failed'))))
      .then(setWallets)
      .catch(() => setWallets(null))
      .finally(() => setWalletsLoading(false))
  }, [section, wallets, walletsLoading, password])

  const markEbayPaid = async (userId: string, username: string | null, outstanding: number) => {
    // Records a transfer you've already made — it does not send money.
    if (!confirm(
      `Record £${outstanding.toFixed(2)} as PAID to @${username ?? 'seller'}?\n\n` +
      `This only writes a ledger entry — make sure you have actually sent the money first.`
    )) return
    setMarkingId(userId)
    setMarkError('')
    try {
      const res = await fetch('/api/admin/wallets/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userId, amountGbp: outstanding, method: 'bank transfer' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'failed')
      setWallets(null) // force a refetch so the row reflects the new balance
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setMarkingId(null)
    }
  }

  const prevWindowNote = useMemo(() => (data ? `last ${data.days} days` : ''), [data])

  if (restoring) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7' }} />
    )
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: SURFACE, border: '1px solid rgba(11,11,11,0.10)', borderRadius: 12, padding: 28, width: 320 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: INK }}>Analytics — admin</div>
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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 60px' }}>
        <AdminNav />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Search & funnel analytics</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => changeDays(d)}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  border: '1px solid rgba(11,11,11,0.10)',
                  background: days === d ? '#254B3C' : SURFACE,
                  color: days === d ? '#fff' : INK_SECONDARY,
                  fontWeight: days === d ? 600 : 400,
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ color: '#d03b3b', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {loading && !data && <div style={{ color: INK_MUTED, fontSize: 13 }}>Loading…</div>}

        {data && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['search', 'Search & traffic'],
                ['funnel', 'Funnel'],
                ['views', 'Views'],
                ['listings', 'Listings'],
                ['wallets', 'Wallets'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    border: '1px solid rgba(11,11,11,0.10)',
                    background: section === key ? '#254B3C' : SURFACE,
                    color: section === key ? '#fff' : INK_SECONDARY,
                    fontWeight: section === key ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {section === 'search' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <StatTile label={`Impressions (${prevWindowNote})`} value={data.totals.impressions.toLocaleString()} sub="Google Search" />
                  <StatTile label="Clicks" value={data.totals.clicks.toLocaleString()} sub="Google Search" />
                  <StatTile
                    label="CTR"
                    value={data.totals.impressions > 0 ? `${((data.totals.clicks / data.totals.impressions) * 100).toFixed(2)}%` : '—'}
                    sub="clicks ÷ impressions"
                  />
                </div>
                {data.gsc_rows === 0 && (
                  <div style={{ background: '#FEF9C3', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#854D0E' }}>
                    ⚠ Google Search Console import not running yet — impressions, clicks and query data will appear here once the GSC service account is connected.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
<Card title="Daily search impressions">
                <MiniBars daily={data.daily} getValue={(r) => r.impressions} color="#2a78d6" format={(n) => `${n.toLocaleString()} impressions`} label="Daily search impressions" />
              </Card>
<Card title="Daily search clicks">
                <MiniBars daily={data.daily} getValue={(r) => r.clicks} color="#eb6834" format={(n) => `${n} click${n === 1 ? '' : 's'}`} label="Daily search clicks" />
              </Card>
                </div>
<Card title="Traffic sources (landing referrer)">
                <SourceBars sources={data.sources} />
              </Card>
<Card title={`Top search queries (${prevWindowNote})`}>
              {data.top_queries.length === 0 ? (
                <div style={{ fontSize: 13, color: INK_MUTED }}>No query data in this window.</div>
              ) : (
                <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                  <thead>
                    <tr style={{ color: INK_MUTED, fontSize: 12 }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400 }}>Query</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Impressions</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Clicks</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Avg pos</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {data.top_queries.map((q) => (
                      <tr key={q.query} style={{ borderTop: `1px solid ${GRID}` }}>
                        <td style={{ padding: '6px 8px' }}>{q.query}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{q.impressions.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{q.clicks}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{q.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
              </div>
            )}

            {section === 'funnel' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <StatTile label="Checkout starts" value={data.totals.checkout_starts.toLocaleString()} />
                  <StatTile label="Purchases" value={data.totals.sales.toLocaleString()} />
                  <StatTile label="GMV" value={gbp(data.totals.gmv)} />
                  <StatTile
                    label="Views → purchase"
                    value={data.totals.views > 0 ? `${((data.totals.sales / data.totals.views) * 100).toFixed(1)}%` : '—'}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
<Card title={`Buyer funnel (${prevWindowNote})`}>
                <Funnel
                  stages={[
                    { label: 'Page views', value: data.totals.views },
                    { label: 'Unique sessions', value: data.totals.sessions },
                    { label: 'Checkout starts', value: data.totals.checkout_starts },
                    { label: 'Purchases', value: data.totals.sales },
                  ]}
                />
              </Card>
<Card title={`Seller activation — signed up in ${prevWindowNote}`}>
                <Funnel
                  stages={[
                    { label: 'Registered', value: data.seller_funnel.registered },
                    { label: 'Listed a book', value: data.seller_funnel.listed },
                    { label: 'Payments enabled', value: data.seller_funnel.payments_enabled },
                    { label: 'Made a sale', value: data.seller_funnel.made_a_sale },
                  ]}
                />
                <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 8 }}>
                  Cohort funnel: later stages naturally lag sign-up, so short windows understate them.
                </div>
              </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
<Card title="Daily purchases (app + eBay)">
                <MiniBars daily={data.daily} getValue={(r) => r.app_sales + r.ebay_sales} color="#2a78d6" format={(n) => `${n} sale${n === 1 ? '' : 's'}`} label="Daily purchases" />
              </Card>
<Card title="Daily GMV">
                <MiniBars daily={data.daily} getValue={(r) => r.app_gmv + r.ebay_gmv} color="#eb6834" format={gbp} label="Daily GMV" />
              </Card>
                </div>
              </div>
            )}

            {section === 'views' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <StatTile label={`Page views (${prevWindowNote})`} value={data.totals.views.toLocaleString()} />
                  <StatTile label="Unique sessions" value={data.totals.sessions.toLocaleString()} />
                </div>
<Card title="Daily page views by page type">
              <ViewsChart daily={data.daily} />
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, color: INK_MUTED, cursor: 'pointer' }}>Data table</summary>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 8, width: '100%' }}>
                  <thead>
                    <tr style={{ color: INK_MUTED, textAlign: 'right' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Date</th>
                      <th style={{ padding: '4px 8px' }}>Books</th>
                      <th style={{ padding: '4px 8px' }}>Listings</th>
                      <th style={{ padding: '4px 8px' }}>Shelves</th>
                      <th style={{ padding: '4px 8px' }}>Checkouts</th>
                      <th style={{ padding: '4px 8px' }}>Sales</th>
                      <th style={{ padding: '4px 8px' }}>GMV</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {data.daily.map((r) => (
                      <tr key={r.date} style={{ borderTop: `1px solid ${GRID}`, textAlign: 'right' }}>
                        <td style={{ textAlign: 'left', padding: '4px 8px' }}>{r.date}</td>
                        <td style={{ padding: '4px 8px' }}>{r.book_views}</td>
                        <td style={{ padding: '4px 8px' }}>{r.listing_views}</td>
                        <td style={{ padding: '4px 8px' }}>{r.shelf_visits}</td>
                        <td style={{ padding: '4px 8px' }}>{r.checkout_starts}</td>
                        <td style={{ padding: '4px 8px' }}>{r.app_sales + r.ebay_sales}</td>
                        <td style={{ padding: '4px 8px' }}>{gbp(r.app_gmv + r.ebay_gmv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
<Card title="Most-viewed book pages (last 7 days)">
              {data.top_books.length === 0 ? (
                <div style={{ fontSize: 13, color: INK_MUTED }}>
                  No book-page views recorded yet — the tracker only went live recently.
                </div>
              ) : (
                <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                  <tbody>
                    {data.top_books.map((b) => (
                      <tr key={`${b.title}-${b.author}`} style={{ borderTop: `1px solid ${GRID}` }}>
                        <td style={{ padding: '6px 8px' }}>
                          {b.title} <span style={{ color: INK_MUTED }}>{b.author ?? ''}</span>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
<Card title="App daily active users">
                <MiniBars daily={data.daily} getValue={(r) => r.app_dau} color="#1baf7a" format={(n) => `${n} active user${n === 1 ? '' : 's'}`} label="App daily active users" />
                <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 8 }}>
                  Counts signed-in users sending app events — populates as the next app release rolls out.
                </div>
              </Card>
                </div>
              </div>
            )}

            {section === 'wallets' && (
              <div style={{ display: 'grid', gap: 14 }}>
                {walletsLoading && <div style={{ fontSize: 13, color: INK_MUTED }}>Fetching live balances from Stripe…</div>}
                {!walletsLoading && !wallets && <div style={{ fontSize: 13, color: '#B3261E' }}>Could not load balances.</div>}
                {wallets && (
                  <>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <StatTile label="In Stripe (available)" value={gbp(wallets.total_available_gbp)} sub="sellers can spend or withdraw" />
                      <StatTile label="Stripe pending" value={gbp(wallets.total_pending_gbp)} sub="settling, ~7 days" />
                      <StatTile label="Owed for eBay sales" value={gbp(wallets.total_ebay_owed_gbp)} sub="you pay manually" />
                    </div>

                    {wallets.total_ebay_owed_gbp > 0 && (
                      <div style={{ background: '#FDECEC', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#B3261E' }}>
                        <strong>{gbp(wallets.total_ebay_owed_gbp)} owed outside Stripe.</strong> eBay cross-list sales settle
                        into the platform&apos;s eBay account, never the seller&apos;s Stripe Connect account — so this money
                        appears in no balance and has to be paid by hand.
                      </div>
                    )}

                    {wallets.unreachable > 0 && (
                      <div style={{ background: '#FEF7E0', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#8A6100' }}>
                        {wallets.unreachable} account(s) could not be reached at Stripe — shown as “?”, not zero.
                      </div>
                    )}

                    <Card title="Seller balances">
                      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                        <thead>
                          <tr style={{ color: INK_MUTED, fontSize: 12 }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400 }}>Seller</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>In Stripe</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Pending</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>eBay outstanding</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Earned all-time</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400 }}>Last sale</th>
                            <th style={{ padding: '4px 8px' }} />
                          </tr>
                        </thead>
                        <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {wallets.rows.map((w) => (
                            <tr key={w.user_id} style={{ borderTop: `1px solid ${GRID}` }}>
                              <td style={{ padding: '6px 8px' }}>
                                <div>
                                  @{w.username ?? '—'}
                                  {w.stripe_account_status !== 'enabled' && (
                                    <span style={{ color: '#8A6100', fontSize: 11 }}> · {w.stripe_account_status ?? 'no wallet'}</span>
                                  )}
                                </div>
                                {w.email && <a href={`mailto:${w.email}`} style={{ fontSize: 11, color: INK_MUTED }}>{w.email}</a>}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                                {w.available_gbp === null ? <span title={w.stripe_error ?? ''}>?</span> : gbp(w.available_gbp)}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: INK_MUTED }}>
                                {w.pending_gbp === null ? '?' : w.pending_gbp > 0 ? gbp(w.pending_gbp) : '—'}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: Number(w.ebay_outstanding_gbp) > 0 ? '#B3261E' : INK_MUTED, fontWeight: Number(w.ebay_outstanding_gbp) > 0 ? 700 : 400 }}>
                                {Number(w.ebay_outstanding_gbp) > 0 ? gbp(Number(w.ebay_outstanding_gbp)) : '—'}
                                {Number(w.ebay_paid_gbp) > 0 && (
                                  <div style={{ fontSize: 11, color: '#1B5E20', fontWeight: 400 }}>
                                    {gbp(Number(w.ebay_paid_gbp))} paid
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', color: INK_SECONDARY }}>{gbp(Number(w.earned_gbp))}</td>
                              <td style={{ padding: '6px 8px', color: INK_SECONDARY }}>
                                {w.last_sale_at ? new Date(w.last_sale_at).toLocaleDateString('en-GB') : '—'}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                {Number(w.ebay_outstanding_gbp) > 0 && (
                                  <button
                                    onClick={() => markEbayPaid(w.user_id, w.username, Number(w.ebay_outstanding_gbp))}
                                    disabled={markingId === w.user_id}
                                    style={{
                                      padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                                      border: '1px solid rgba(11,11,11,0.15)', background: SURFACE, color: INK_SECONDARY,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {markingId === w.user_id ? 'Recording…' : 'Mark paid'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {markError && <div style={{ color: '#B3261E', fontSize: 12, marginTop: 8 }}>{markError}</div>}
                      <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 10 }}>
                        &ldquo;Mark paid&rdquo; records a transfer you have already made — it does not send money.
                        Balances read live from Stripe via the same function the app uses, so this always matches what the
                        seller sees. Cached <code>user_wallets</code> columns are 0 for everyone and are not used.
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            {section === 'listings' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <StatTile label="Active listings" value={data.listing_inventory.active.toLocaleString()} sub={`${data.listing_inventory.sellers_with_active} sellers`} />
                  <StatTile label="Live inventory" value={gbp(data.listing_inventory.active_inventory_value)} sub={`avg ${gbp(data.listing_inventory.avg_active_price)}`} />
                  <StatTile label="Drafts" value={data.listing_inventory.draft.toLocaleString()} sub={`${gbp(data.listing_inventory.draft_value)} unpublished`} />
                  <StatTile label="Cross-listed on eBay" value={data.listing_inventory.cross_listed.toLocaleString()} />
                  <StatTile label="Sold all-time" value={data.listing_inventory.sold.toLocaleString()} />
                </div>

                <div style={{ background: '#FEF7E0', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#8A6100' }}>
                  {data.listing_inventory.draft.toLocaleString()} drafts across {data.listing_inventory.sellers_with_draft} sellers
                  ({gbp(data.listing_inventory.draft_value)}) are scanned but never published — the largest recoverable supply pool.
                </div>

                <Card title="New listings per day">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: INK_MUTED, marginBottom: 4 }}>Published (active)</div>
                      <MiniBars daily={data.daily} getValue={(r) => r.new_active_listings} color="#1baf7a" format={(n) => `${n} listed`} label="New active listings per day" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: INK_MUTED, marginBottom: 4 }}>Drafted only</div>
                      <MiniBars daily={data.daily} getValue={(r) => r.new_draft_listings} color="#eda100" format={(n) => `${n} drafted`} label="New draft listings per day" />
                    </div>
                  </div>
                </Card>

                <Card title="Biggest live shelves">
                  {data.top_sellers.length === 0 ? (
                    <div style={{ fontSize: 13, color: INK_MUTED }}>No active listings.</div>
                  ) : (
                    <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                      <thead>
                        <tr style={{ color: INK_MUTED, fontSize: 12 }}>
                          <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400 }}>Seller</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Active</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 400 }}>Inventory</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {data.top_sellers.map((s) => (
                          <tr key={s.username} style={{ borderTop: `1px solid ${GRID}` }}>
                            <td style={{ padding: '6px 8px' }}>
                              <a href={`https://www.sellyourshelf.com/${s.username}`} target="_blank" rel="noopener noreferrer" style={{ color: '#254B3C' }}>@{s.username}</a>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.active_listings}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{gbp(s.inventory_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
