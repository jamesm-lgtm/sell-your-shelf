import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const metadata = {
  title: 'Returns Policy — Sell Your Shelf',
  description: 'Our returns and refund policy for secondhand book purchases on Sell Your Shelf.',
}

export default function Returns() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-8">Returns Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: March 2026</p>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold mb-3">Overview</h2>
              <p>
                Sell Your Shelf is a peer-to-peer marketplace. When you buy a book, you are purchasing
                directly from another user. Because all items are secondhand and pre-owned, our returns
                policy covers items that are defective or significantly not as described.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">When you can request a return</h2>
              <p className="mb-2">You may request a return or refund if:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>The book is significantly not as described (e.g. listed as "Like New" but has major damage)</li>
                <li>The wrong book was sent</li>
                <li>The book did not arrive within 14 days of the shipped date</li>
                <li>The book is damaged in transit beyond the stated condition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">When returns are not accepted</h2>
              <p className="mb-2">We cannot accept returns for:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Change of mind — all sales are final unless the item is not as described</li>
                <li>Minor wear consistent with the listed condition (these are secondhand books)</li>
                <li>Requests made more than 14 days after delivery</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">How to request a return</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Email <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 hover:underline">support@sellyourshelf.com</a> within
                  14 days of delivery
                </li>
                <li>Include your order number or transaction ID</li>
                <li>Describe the issue and include photos if relevant</li>
                <li>We will review your case and respond within 48 hours</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Refund process</h2>
              <p>
                If your return is approved, we will issue a full refund to your original payment method.
                Refunds typically take 5-10 business days to appear on your statement, depending on
                your bank or card provider.
              </p>
              <p className="mt-2">
                In some cases, we may issue a partial refund if the item has been used beyond its
                original condition since delivery.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Return shipping</h2>
              <p>
                If a return is approved and we require the book to be sent back, return shipping is
                the buyer's responsibility. We may waive this at our discretion for cases where the
                item was significantly misrepresented.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Exchanges</h2>
              <p>
                We do not offer exchanges. If you receive an item that is not as described,
                we will process a refund. You are welcome to purchase another copy separately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact</h2>
              <p>
                For any questions about returns or refunds:<br />
                Email: <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 hover:underline">support@sellyourshelf.com</a><br /><br />
                Sell Your Shelf Limited<br />
                94 Seymour Road<br />
                London, N8 0BE<br />
                United Kingdom
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
