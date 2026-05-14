import type { Metadata } from 'next'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import CheckoutFlow from '@/app/components/CheckoutFlow'

export const metadata: Metadata = {
  title: 'Checkout — Sell Your Shelf',
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px' }}>
        <CheckoutFlow />
      </div>
      <Footer />
    </div>
  )
}
