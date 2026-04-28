import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const metadata = {
  title: 'Delete your account – Sell Your Shelf',
  description: 'How to delete your Sell Your Shelf account and what happens to your data.',
}

export default function DeleteAccount() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-8">Delete your Sell Your Shelf account</h1>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold mb-3">How to delete your account</h2>
              <p className="mb-4">There are two ways to delete your Sell Your Shelf account:</p>

              <h3 className="font-semibold mb-2">In-app</h3>
              <p className="mb-4">
                Open the Sell Your Shelf app → Profile tab → scroll to bottom → tap Delete Account → confirm.
                Your account and associated data are removed immediately.
              </p>

              <h3 className="font-semibold mb-2">By email</h3>
              <p>
                Email <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 hover:underline">support@sellyourshelf.com</a> from
                the address registered to the account. Requests are processed within 7 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">What gets deleted</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Profile, username, and login credentials</li>
                <li>Listings and uploaded photos</li>
                <li>Messages and chat history</li>
                <li>Saved/liked items, follows, and notifications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">What's retained</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Completed transaction records (order history, payouts) — kept for 6 years as required by HMRC for UK tax/accounting purposes</li>
                <li>Anonymised analytics that cannot be tied back to the user</li>
              </ul>
            </section>

            <section>
              <p>
                Questions? Email <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 hover:underline">support@sellyourshelf.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
