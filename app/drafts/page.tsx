import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'

export const metadata = {
  title: 'Your drafts — Sell Your Shelf',
  description:
    'Scanned books are saved as drafts until you publish them. Here is how to get them on sale.',
}

/**
 * The destination for the draft-rescue email.
 *
 * Scanning saves books as drafts; publishing is a separate, deliberate action
 * so nobody lists a book at a price they haven't seen. That's the right
 * behaviour, but it's the largest drop-off in the product: 565 people are
 * holding drafts and 13,006 books are sitting unpublished, against 5,480 live.
 * Plenty of those people think a scan listed the book.
 */
export default function Drafts() {
  return (
    <div className="sy-page">
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="sy-h2" style={{ marginBottom: 28 }}>
            Scanned isn&apos;t the same as listed
          </h1>

          <div className="space-y-6 sy-prose">
            <p>
              When you scan a shelf, every book we find is saved as a <strong>draft</strong>. Drafts
              are yours alone — nobody else can see them, and nobody can buy them.
            </p>
            <p>
              That&apos;s on purpose. We won&apos;t put a book up for sale at a price you
              haven&apos;t looked at. But it does mean a scan on its own doesn&apos;t list anything,
              which is easy to miss.
            </p>
          </div>

          <h2 className="sy-h3" style={{ marginTop: 40, marginBottom: 16 }}>
            Getting them on sale
          </h2>

          <div className="space-y-6 sy-prose">
            <p>
              Open <strong>My Books</strong> and go to <strong>Drafts</strong>. Check the prices —
              change any that look wrong, and untick anything you&apos;d rather keep. Then publish.
              You can do a whole scan at once rather than one book at a time.
            </p>
            <p>
              If you haven&apos;t set up payments yet, publishing will ask you to do that first.
              It&apos;s a couple of minutes and you only do it once.
            </p>
            <p>
              Listing is free. We take 20% when a book sells, minimum 60p, and nothing at all if it
              doesn&apos;t — so there&apos;s no cost to putting a draft up and seeing what happens.
            </p>
          </div>

          <div style={{ marginTop: 36 }}>
            <AppBadges utm={{ source: 'email', medium: 'lifecycle', campaign: 'draft-rescue' }} size="lg" />
          </div>

          <div className="sy-prose" style={{ marginTop: 36 }}>
            <p>
              Already have the app? Open it and tap <strong>My Books</strong>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
