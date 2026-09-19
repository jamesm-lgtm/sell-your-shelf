import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'

export const metadata = {
  title: 'Scan your shelf — Sell Your Shelf',
  description:
    'Film a shelf of books and we identify every one, find the covers and price them against what copies actually sell for. About 90 seconds for a full shelf.',
}

/**
 * The destination for the "try it on your shelf" button in the welcome email.
 *
 * It exists so that one URL works for everyone. Someone who signed up on the
 * website and never installed the app lands here and gets the store badges.
 * Once a build carrying /scan deep-link routing is live, /scan comes out of
 * the NOT list in the app-site-association file and the same link opens the
 * camera directly for anyone who has the app — without the email changing.
 */
export default function Scan() {
  return (
    <div className="sy-page">
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="sy-h2" style={{ marginBottom: 28 }}>
            Point your camera at a shelf
          </h1>

          <div className="space-y-6 sy-prose">
            <p>
              Film a shelf of books like you&apos;re showing it to a friend. We read the spines,
              identify each book, find the covers and suggest a price for every one — based on what
              copies actually sell for, not a guess.
            </p>
            <p>
              A full shelf takes about 90 seconds. There&apos;s no typing and no photographing books
              one at a time.
            </p>
            <p>
              You check the prices, untick anything you want to keep, and publish. Listing is free —
              we take 20% when a book sells, minimum 60p, and nothing at all if it doesn&apos;t.
            </p>
          </div>

          <div style={{ marginTop: 36 }}>
            <AppBadges utm={{ source: 'email', medium: 'lifecycle', campaign: 'welcome-scan' }} size="lg" />
          </div>

          <div className="sy-prose" style={{ marginTop: 36 }}>
            <p>
              Already have the app? Open it and tap <strong>Scan</strong>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
