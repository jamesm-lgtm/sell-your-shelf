import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'

export const metadata = {
  title: 'Set up payments — Sell Your Shelf',
  description:
    'Payment setup takes a couple of minutes and you only do it once. Stripe handles it, and we never see your bank details.',
}

/**
 * The destination for the payment-setup button in onboarding email 2.
 *
 * The email it replaces had no link at all (0.0% clicks on 113 sends) and,
 * worse, told people that finishing payment setup would make their shelf live.
 * It doesn't. DraftDetailScreen gates publish on
 * stripe_account_status === 'enabled' and then publishes THAT ONE listing —
 * so payment setup unlocks publishing, it doesn't perform it. 100 people are
 * currently sitting on drafts they are already entitled to publish, which is
 * what that missing sentence looks like in the data.
 *
 * So this page is explicit about both steps, in order.
 */
export default function GetPaid() {
  return (
    <div className="sy-page">
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="sy-h2" style={{ marginBottom: 28 }}>
            Somewhere for the money to go
          </h1>

          <div className="space-y-6 sy-prose">
            <p>
              Before a book can go on sale, we need somewhere to send your money when it sells.
              That&apos;s the payment setup — it takes a couple of minutes, and you only ever do it
              once.
            </p>
            <p>
              It&apos;s handled by Stripe, the same payment company behind millions of online
              businesses. Your bank details go straight to them. We never see them.
            </p>
            <p>
              You&apos;ll need your name and address, a bank account for payouts, and a photo of an
              ID document — that last one is a legal requirement for anyone taking payments, not
              something we&apos;ve added.
            </p>
          </div>

          <h2 className="sy-h3" style={{ marginTop: 40, marginBottom: 16 }}>
            Then publish your books
          </h2>

          <div className="space-y-6 sy-prose">
            <p>
              This is the part people miss. Finishing payment setup doesn&apos;t put your books on
              sale by itself — it unlocks the publish button. Your scanned books stay as drafts until
              you publish them.
            </p>
            <p>
              Open <strong>My Books</strong>, go to <strong>Drafts</strong>, check the prices look
              right, and publish. You can do the whole lot at once.
            </p>
          </div>

          <div style={{ marginTop: 36 }}>
            <AppBadges utm={{ source: 'email', medium: 'lifecycle', campaign: 'get-paid' }} size="lg" />
          </div>

          <div className="sy-prose" style={{ marginTop: 36 }}>
            <p>
              Already have the app? Open it, go to <strong>Profile</strong> and tap{' '}
              <strong>Seller setup</strong>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
