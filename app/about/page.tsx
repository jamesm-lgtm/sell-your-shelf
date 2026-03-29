import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import Link from 'next/link'

export const metadata = {
  title: 'About — Sell Your Shelf',
  description: 'Sell Your Shelf is a UK peer-to-peer marketplace for secondhand books. Scan your shelf, list in seconds, and ship with ease.',
}

export default function About() {
  const appStoreUrl = 'https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=about&utm_medium=web'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-8">About Sell Your Shelf</h1>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Sell Your Shelf is a UK marketplace for secondhand books. We make it simple to buy and sell
              pre-loved books — no listing fees, no fuss.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 pt-4">How it works for sellers</h2>
            <p>
              Point your phone camera at your bookshelf and our AI identifies every spine in real time —
              typically 30 books in under 90 seconds. We suggest fair prices based on live market data.
              Accept our recommendations or adjust them yourself, then publish your listings with one tap.
            </p>
            <p>
              When a book sells, we generate a shipping label. Drop the parcel at any Yodel drop-off point —
              no printing required, just show the QR code. Payment lands in your account once delivered.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 pt-4">How it works for buyers</h2>
            <p>
              Browse thousands of secondhand books from sellers across the UK. Every listing shows the book's
              condition, price, and seller location. Buy with confidence — all payments are processed securely
              through Stripe, and every order includes tracked delivery.
            </p>
            <p>
              If a book arrives not as described, contact us within 14 days and we'll make it right.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 pt-4">Our fees</h2>
            <p>
              It's free to list books. We only charge when a sale completes:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Books £5 and above:</strong> 20% platform fee</li>
              <li><strong>Books under £5:</strong> £1 flat fee</li>
            </ul>
            <p>
              Shipping costs £2.50 and is paid by the buyer. There are no hidden charges.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 pt-4">The company</h2>
            <p>
              Sell Your Shelf Limited is registered in England and Wales (Company Number 16895246).
              We're based in London and committed to giving secondhand books a second life.
            </p>

            <div className="pt-6">
              <a
                href={appStoreUrl}
                className="inline-block px-6 py-3 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#2D4A3E' }}
              >
                Download the app →
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
