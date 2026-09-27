import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const metadata = {
  title: 'Delete your account – Sell Your Shelf',
  description: 'How to delete your Sell Your Shelf account and what happens to your data.',
}

export default function DeleteAccount() {
  return (
    <div className="sy-page">
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="sy-h2" style={{ marginBottom: 28 }}>Delete your Sell Your Shelf account</h1>

          <div className="space-y-8 sy-prose">
            <section>
              <h2 className="sy-h3" style={{ marginBottom: 12 }}>How to delete your account</h2>
              <p className="mb-4">There are two ways to delete your Sell Your Shelf account:</p>

              <h3 className="sy-h3" style={{ fontSize: 16, marginBottom: 8 }}>In-app</h3>
              <p className="mb-4">
                Open the Sell Your Shelf app → Profile tab → scroll to bottom → tap Delete Account → confirm.
                Your account and associated data are removed immediately.
              </p>

              <h3 className="sy-h3" style={{ fontSize: 16, marginBottom: 8 }}>By email</h3>
              <p className="mb-4">
                If you no longer have the app — or would rather not hunt through it — email us from the
                address registered to the account and we&apos;ll do it for you. Requests are processed within 7 days.
              </p>
              {/* A one-click mailto rather than an address to copy out. The
                  person reading this has already decided to leave; making them
                  compose an email from scratch is a last small indignity. */}
              <a
                href={'mailto:support@sellyourshelf.com' +
                  '?subject=' + encodeURIComponent('Please delete my account') +
                  '&body=' + encodeURIComponent(
                    "Hello,\n\nPlease delete my Sell Your Shelf account and the data associated with it.\n\n" +
                    "I'm sending this from the email address registered to the account.\n\nThanks")}
                className="inline-block rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white no-underline hover:bg-emerald-800"
              >
                Email us to delete your account
              </a>
            </section>

            <section>
              <h2 className="sy-h3" style={{ marginBottom: 12 }}>What gets deleted</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Profile, username, and login credentials</li>
                <li>Listings and uploaded photos</li>
                <li>Messages and chat history</li>
                <li>Saved/liked items, follows, and notifications</li>
              </ul>
            </section>

            <section>
              <h2 className="sy-h3" style={{ marginBottom: 12 }}>What's retained</h2>
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
