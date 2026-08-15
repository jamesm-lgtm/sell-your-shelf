import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const metadata = {
  title: 'Privacy Policy — Sell Your Shelf',
  description: 'How Sell Your Shelf collects, uses, and protects your personal data.',
}

export default function Privacy() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: March 2026</p>

          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
              <p>
                Sell Your Shelf Limited ("we", "us", "our") is the data controller for personal data
                processed through the Sell Your Shelf app and website. We are registered in England
                and Wales (Company Number 16895246) at 94 Seymour Road, London, N8 0BE.
              </p>
              <p className="mt-2">
                Email: <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 hover:underline">support@sellyourshelf.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. What data we collect</h2>
              <p className="mb-2">We collect the following personal data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Account information:</strong> name, email address, username, password (encrypted)</li>
                <li><strong>Identity verification:</strong> information provided during Stripe seller onboarding (name, date of birth, address) — processed by Stripe, not stored by us</li>
                <li><strong>Transaction data:</strong> purchase history, sale history, payment amounts</li>
                <li><strong>Shipping addresses:</strong> delivery addresses provided at checkout</li>
                <li><strong>Device information:</strong> device type, operating system, app version</li>
                <li><strong>Usage data:</strong> pages viewed, listings viewed, search queries, session identifiers</li>
                <li><strong>Location data:</strong> approximate location derived from IP address (country, city level only)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How we use your data</h2>
              <p className="mb-2">We use your data to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide and maintain the marketplace service</li>
                <li>Process transactions and payments</li>
                <li>Generate and manage shipping labels</li>
                <li>Send order confirmations, shipping notifications, and service emails</li>
                <li>Resolve disputes between buyers and sellers</li>
                <li>Prevent fraud and enforce our Terms of Service</li>
                <li>Improve the platform based on usage patterns</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Legal basis for processing</h2>
              <p className="mb-2">We process your data on the following legal bases:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Contract:</strong> processing necessary to provide our service (account management, transactions, shipping)</li>
                <li><strong>Legitimate interest:</strong> fraud prevention, platform improvement, analytics</li>
                <li><strong>Legal obligation:</strong> tax records, regulatory compliance</li>
                <li><strong>Consent:</strong> marketing emails (you can opt out at any time)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Who we share data with</h2>
              <p className="mb-2">We share data with the following third parties, only as necessary to provide our service:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Stripe:</strong> payment processing and seller identity verification</li>
                <li><strong>InPost (incl. Yodel):</strong> shipping and delivery (name and address for shipping labels)</li>
                <li><strong>Supabase:</strong> database hosting (EU-based servers)</li>
                <li><strong>Vercel:</strong> website hosting</li>
                <li><strong>Resend:</strong> transactional email delivery</li>
                <li><strong>Expo:</strong> push notification delivery</li>
              </ul>
              <p className="mt-2">
                We do not sell your personal data to third parties. We do not share data with advertisers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Data retention</h2>
              <p>
                We retain your account data for as long as your account is active. Transaction records
                are retained for 7 years after the transaction date for legal and tax compliance.
                If you delete your account, we will remove your personal data within 30 days,
                except where retention is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Your rights</h2>
              <p className="mb-2">Under UK GDPR, you have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Access</strong> your personal data</li>
                <li><strong>Rectify</strong> inaccurate data</li>
                <li><strong>Erase</strong> your data (subject to legal retention requirements)</li>
                <li><strong>Restrict</strong> processing in certain circumstances</li>
                <li><strong>Data portability</strong> — receive your data in a machine-readable format</li>
                <li><strong>Object</strong> to processing based on legitimate interest</li>
                <li><strong>Withdraw consent</strong> for consent-based processing at any time</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, email <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 hover:underline">support@sellyourshelf.com</a>.
                We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Cookies and tracking</h2>
              <p>
                We use localStorage to store a session identifier for our own first-party analytics. This
                helps us understand how visitors use the site (e.g. which listings are viewed, whether
                visitors return).
              </p>
              <p className="mt-3">
                With your consent, we also use Google Analytics to understand how visitors find and use
                the site. Google Analytics sets cookies only if you accept them via the cookie banner;
                if you decline (or ignore the banner), no analytics cookies are set. You can change your
                mind at any time by clearing this site&apos;s data in your browser, which will show the
                banner again. Data collected by Google Analytics is aggregated and is not used for
                advertising. See{' '}
                <a
                  href="https://policies.google.com/privacy"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google&apos;s privacy policy
                </a>{' '}
                for how Google processes this data. We do not use advertising pixels.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Data security</h2>
              <p>
                We take reasonable measures to protect your data, including encryption in transit (HTTPS),
                encrypted database connections, and secure authentication. Payment card details are handled
                entirely by Stripe and never touch our servers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. International transfers</h2>
              <p>
                Your data is primarily stored in the EU (Supabase, eu-west-2). Some processors
                (Stripe, Vercel, Expo) may transfer data outside the UK/EU under appropriate safeguards
                including Standard Contractual Clauses.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Children</h2>
              <p>
                Our service is not directed at children under 18. We do not knowingly collect
                personal data from children. If you believe a child has provided us with personal data,
                please contact us and we will delete it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Changes to this policy</h2>
              <p>
                We may update this policy from time to time. We will notify you of significant changes
                via email or in-app notification. The "Last updated" date at the top will always reflect
                the current version.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Complaints</h2>
              <p>
                If you have concerns about how we handle your data, please contact us first at
                support@sellyourshelf.com. You also have the right to lodge a complaint with the
                Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" className="text-emerald-700 hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
