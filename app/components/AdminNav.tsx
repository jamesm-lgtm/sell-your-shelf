'use client'

// Shared nav for the admin pages. Client-side so it can highlight the
// current section, and deliberately plain — these pages are internal.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/merchandise', label: 'Merchandise' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '1px solid #e1e0d9',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <span style={{ fontSize: 12, color: '#898781', marginRight: 8, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
        Admin
      </span>
      {SECTIONS.map((s) => {
        const active = pathname === s.href || pathname?.startsWith(`${s.href}/`)
        return (
          <Link
            key={s.href}
            href={s.href}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13,
              textDecoration: 'none',
              fontWeight: active ? 600 : 400,
              background: active ? '#254B3C' : 'transparent',
              color: active ? '#fff' : '#52514e',
            }}
          >
            {s.label}
          </Link>
        )
      })}
      <Link
        href="/"
        style={{ marginLeft: 'auto', fontSize: 12, color: '#898781', textDecoration: 'none' }}
      >
        ← Site
      </Link>
    </div>
  )
}
