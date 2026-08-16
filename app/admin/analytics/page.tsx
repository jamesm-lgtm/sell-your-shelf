'use client'

// /admin/analytics — daily search-traffic + purchase-funnel dashboard.
// Data comes from the admin_search_funnel_dashboard() Postgres function via
// /api/admin/analytics (password-gated). Charts are dependency-free SVG.

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminNav from '@/app/components/AdminNav'

type DailyRow = {
  date: string
  book_views: number
  listing_views: number
  shelf_visits: number
  checkout_starts: number
  impressions: number
  clicks: number
  app_dau: number
  app_sales: number
  app_gmv: number
  ebay_sales: number
  ebay_gmv: number
}

type Dashboard = {
  days: number
  daily: DailyRow[]
  sources: { source: string; views: number; sessions: number }[]
  top_books: { title: string; author: string | null; views: number }[]
  top_queries: { query: string; impressions: number; clicks: number; position: number }[]
  seller_funnel: { registered: number; listed: number; payments_enabled: number; made_a_sale: number }
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
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [days, setDays] = useState<7 | 30 | 90>(30)
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

  const changeDays = (d: 7 | 30 | 90) => {
    setDays(d)
    load(password, d)
  }

  const prevWindowNote = useMemo(() => (data ? `last ${data.days} days` : ''), [data])

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
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatTile label={`Impressions (${prevWindowNote})`} value={data.totals.impressions.toLocaleString()} sub="Google Search" />
              <StatTile label="Clicks" value={data.totals.clicks.toLocaleString()} sub="Google Search" />
              <StatTile label="Page views" value={data.totals.views.toLocaleString()} />
              <StatTile label="Unique sessions" value={data.totals.sessions.toLocaleString()} />
              <StatTile label="Checkout starts" value={data.totals.checkout_starts.toLocaleString()} />
              <StatTile label="Purchases" value={data.totals.sales.toLocaleString()} />
              <StatTile label="GMV" value={gbp(data.totals.gmv)} />
            </div>

            {data.gsc_rows === 0 && (
              <div style={{ background: '#FEF9C3', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#854D0E' }}>
                ⚠ Google Search Console import not running yet — impressions, clicks and query data will appear here once the GSC service account is connected.
              </div>
            )}

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <Card title="Daily search impressions">
                <MiniBars daily={data.daily} getValue={(r) => r.impressions} color="#2a78d6" format={(n) => `${n.toLocaleString()} impressions`} label="Daily search impressions" />
              </Card>
              <Card title="Daily search clicks">
                <MiniBars daily={data.daily} getValue={(r) => r.clicks} color="#eb6834" format={(n) => `${n} click${n === 1 ? '' : 's'}`} label="Daily search clicks" />
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <Card title="Daily purchases (app + eBay)">
                <MiniBars daily={data.daily} getValue={(r) => r.app_sales + r.ebay_sales} color="#2a78d6" format={(n) => `${n} sale${n === 1 ? '' : 's'}`} label="Daily purchases" />
              </Card>
              <Card title="Daily GMV">
                <MiniBars daily={data.daily} getValue={(r) => r.app_gmv + r.ebay_gmv} color="#eb6834" format={gbp} label="Daily GMV" />
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
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
              <Card title="Traffic sources (landing referrer)">
                <SourceBars sources={data.sources} />
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
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
              <Card title="App daily active users">
                <MiniBars daily={data.daily} getValue={(r) => r.app_dau} color="#1baf7a" format={(n) => `${n} active user${n === 1 ? '' : 's'}`} label="App daily active users" />
                <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 8 }}>
                  Counts signed-in users sending app events — populates as the next app release rolls out.
                </div>
              </Card>
            </div>

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
          </div>
        )}
      </div>
    </div>
  )
}
