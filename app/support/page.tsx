import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export default function Support() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <SiteNav current="support" />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-4">Support</h1>
          <p className="text-gray-600 mb-8">
            Need help with Sell Your Shelf? We&apos;re here for you.
          </p>

          {/* Contact Section */}
          <div className="bg-emerald-50 rounded-lg p-6 mb-10">
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p className="text-gray-700">
              Email: <a href="mailto:support@sellyourshelf.com" className="text-emerald-600 hover:underline">support@sellyourshelf.com</a>
            </p>
            <p className="text-gray-500 text-sm mt-2">We typically respond within 24 hours.</p>
          </div>

          {/* FAQs */}
          <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">How does scanning work?</h3>
              <p className="text-gray-700">
                Open the app, tap Scan, and slowly pan your camera across your bookshelf.
                Our AI identifies book spines and matches them to our database.
                You can then review, edit prices, and publish listings in seconds.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">What are your fees?</h3>
              <p className="text-gray-700">
                We charge a platform fee on completed sales:<br />
                • <strong>20%</strong> of the sale price<br />
                • With a <strong>minimum fee of £0.60</strong> per book<br /><br />
                Fees are deducted automatically before payout.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">How do I get paid?</h3>
              <p className="text-gray-700">
                When you make a sale, the funds are held for 7 days then become available in your balance.
                You can withdraw to your bank account anytime via the Profile screen.
                Payouts typically arrive within 1-2 business days.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">How does shipping work?</h3>
              <p className="text-gray-700">
                When you sell a book, go to My Orders → Sales to generate a shipping label.
                You&apos;ll get a QR code to show at any InPost or Yodel drop-off point — no printing required.
                Shipping costs £2.50 and is paid by the buyer.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">How long do I have to ship?</h3>
              <p className="text-gray-700">
                Please ship within 3 days of a sale. Buyers are notified when you drop off the parcel.
                Delivery usually takes 2-3 working days.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">How do I track my order?</h3>
              <p className="text-gray-700">
                Go to My Orders → Purchases. Once the seller ships, you&apos;ll see a tracking link.
                You&apos;ll also receive push notifications when your book is on its way and when it&apos;s delivered.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">What if my book doesn&apos;t arrive or isn&apos;t as described?</h3>
              <p className="text-gray-700">
                Contact us at support@sellyourshelf.com within 14 days of delivery.
                Include your order details and photos if relevant.
                We&apos;ll review the case and may issue a full or partial refund.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">Can I use my seller balance to buy books?</h3>
              <p className="text-gray-700">
                Yes! If you have available balance from sales, you can apply it at checkout.
                Any remaining amount can be paid by card.
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-semibold text-lg mb-2">How do I delete my account?</h3>
              <p className="text-gray-700">
                Email support@sellyourshelf.com and we&apos;ll process your request within 30 days.
                Note that transaction records are retained for 7 years for legal compliance.
              </p>
            </div>

            <div className="pb-6">
              <h3 className="font-semibold text-lg mb-2">I&apos;m having trouble logging in</h3>
              <p className="text-gray-700">
                We use magic links — check your spam folder if you don&apos;t see our email.
                Links expire after 1 hour. If you&apos;re still stuck, email us and we&apos;ll help.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
