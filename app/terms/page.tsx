export default function Terms() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="max-w-2xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <p className="text-gray-600 mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Welcome to Sell Your Shelf. These Terms of Service ("Terms") govern your use of the Sell Your Shelf 
              mobile application ("App") operated by Sell Your Shelf Limited ("we", "us", "our"), a company 
              registered in England and Wales (Company Number 16895246).
            </p>
            <p className="mt-2">
              By using our App, you agree to these Terms. If you do not agree, please do not use our App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Our Service</h2>
            <p>
              Sell Your Shelf is a peer-to-peer marketplace that enables users to buy and sell secondhand books. 
              We provide technology to facilitate transactions between buyers and sellers, including AI-powered 
              book identification, pricing suggestions, and integrated shipping.
            </p>
            <p className="mt-2">
              <strong>Important:</strong> We are a platform, not a party to transactions. When you buy or sell 
              a book, you are transacting directly with another user. We do not own, possess, or inspect the 
              books listed on our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years old and have the legal capacity to enter into contracts to use our App. 
              By using the App, you represent that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Account Registration</h2>
            <p>
              To access certain features, you must create an account. You agree to provide accurate information 
              and keep it updated. You are responsible for maintaining the confidentiality of your account 
              credentials and for all activities under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Listing Books</h2>
            <p className="mb-2">When listing books for sale, you agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Only list books you legally own and have the right to sell</li>
              <li>Provide accurate descriptions and condition ratings</li>
              <li>Set fair prices (our AI suggestions are recommendations only)</li>
              <li>Ship books promptly when sold (within 3 business days)</li>
              <li>Use our provided shipping labels and designated carriers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Buying Books</h2>
            <p className="mb-2">When purchasing books, you understand that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are buying from another user, not from Sell Your Shelf</li>
              <li>Books are secondhand and may show signs of use consistent with their condition rating</li>
              <li>Delivery times depend on the seller shipping promptly and carrier performance</li>
              <li>You must provide accurate shipping information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Prohibited Items</h2>
            <p className="mb-2">You may not list:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Counterfeit or pirated books</li>
              <li>Stolen property</li>
              <li>Books you do not own or have the right to sell</li>
              <li>Obscene or illegal material</li>
              <li>Items other than books and related media</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Fees</h2>
            <p className="mb-2">Sell Your Shelf charges sellers the following fees on completed sales:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Books priced £5 and above:</strong> 20% platform fee</li>
              <li><strong>Books priced under £5:</strong> £1 flat fee</li>
            </ul>
            <p className="mt-2">
              Fees are deducted automatically from the sale price before payout to sellers. 
              Shipping costs are paid by buyers and are separate from platform fees.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Payments</h2>
            <p>
              All payments are processed securely through Stripe. When you become a seller, you must complete 
              Stripe's identity verification process. Sale proceeds are held for 7 days before becoming available 
              for withdrawal to protect against chargebacks and disputes.
            </p>
            <p className="mt-2">
              Buyers may use their available seller balance to make purchases on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Shipping</h2>
            <p>
              Sellers must use our integrated shipping service (currently Yodel) and ship within 3 business days 
              of sale. Shipping labels are generated through the App. Sellers are responsible for packaging books 
              securely. We are not liable for items lost or damaged in transit, though buyers may raise disputes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Disputes and Refunds</h2>
            <p className="mb-2">If a book arrives significantly not as described, buyers may request a refund within 14 days of delivery. Disputes are handled as follows:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Buyer contacts us at support@sellyourshelf.com with evidence</li>
              <li>We review the listing, messages, and evidence provided</li>
              <li>If the dispute is valid, we may issue a full or partial refund</li>
              <li>Sellers may be required to accept returns for valid disputes</li>
            </ul>
            <p className="mt-2">
              We reserve the right to make final decisions on disputes at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. User Conduct</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Harass, abuse, or threaten other users</li>
              <li>Manipulate prices or reviews</li>
              <li>Circumvent the platform to avoid fees</li>
              <li>Use automated systems or bots</li>
              <li>Violate any applicable laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Intellectual Property</h2>
            <p>
              The App, including its design, features, and content, is owned by Sell Your Shelf Limited. 
              You may not copy, modify, or distribute our intellectual property without permission. 
              By listing books, you grant us a licence to display your listing content on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Termination</h2>
            <p>
              You may close your account at any time by emailing support@sellyourshelf.com. 
              We may suspend or terminate accounts that violate these Terms. Upon termination, 
              any pending sales must be completed and outstanding payouts will be processed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Sell Your Shelf Limited is not liable for any indirect, 
              incidental, or consequential damages arising from your use of the App. Our total liability is 
              limited to the fees you have paid us in the 12 months preceding any claim.
            </p>
            <p className="mt-2">
              We do not guarantee the quality, safety, or legality of items listed, the truth of listings, 
              or the ability of sellers to sell or buyers to pay.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">16. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Sell Your Shelf Limited from any claims, damages, 
              or expenses arising from your use of the App, your listings, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">17. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of significant changes via email 
              or in-app notification. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">18. Governing Law</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes shall be subject to 
              the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">19. Contact Us</h2>
            <p>
              For questions about these Terms:<br />
              Email: support@sellyourshelf.com<br /><br />
              Sell Your Shelf Limited<br />
              94 Seymour Road<br />
              London, N8 0BE<br />
              United Kingdom
            </p>
          </section>
        </div>

        <a href="/" className="inline-block mt-8 text-emerald-600 hover:underline">← Back to home</a>
      </div>
      <p className="text-sm text-gray-500 mt-8 text-center">
        Sell Your Shelf Limited is a company registered in England and Wales (16895246).
      </p>
    </main>
  );
}