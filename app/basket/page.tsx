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
    <div className="sy-page">
      <SiteNav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 64px' }}>
        <BasketPageClient />
      </div>
      <Footer />
    </div>
  )
}
