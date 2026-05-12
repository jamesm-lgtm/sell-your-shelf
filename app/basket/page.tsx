import type { Metadata } from 'next'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import BasketPageClient from '@/app/components/BasketPageClient'

export const metadata: Metadata = {
  title: 'Your basket — Sell Your Shelf',
  robots: { index: false, follow: false },
}

export default function BasketPage() {
  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 64px' }}>
        <BasketPageClient />
      </div>
      <Footer />
    </div>
  )
}
