export default function Privacy() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="max-w-2xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">Last updated: January 2026</p>

        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
            <p>
              Sell Your Shelf Limited ("we", "us", "our") is a company registered in England and Wales 
              (Company Number 16895246), with registered address at 94 Seymour Road, London, N8 0BE. 
              We operate the Sell Your Shelf mobile application ("App").
            </p>
            <p className="mt-2">
              We are the data controller for personal information collected through the App. 
              For privacy enquiries, contact us at privacy@sellyourshelf.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. What We Collect</h2>
            <p className="mb-2">We collect the following personal information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> Email address, name, username</li>
              <li><strong>Transaction data:</strong> Purchase history, sales history, payment information (processed by Stripe)</li>
              <li><strong>Shipping addresses:</strong> Delivery addresses for purchases</li>
              <li><strong>Device information:</strong> Device type, operating system, app version</li>
              <li><strong>Camera data:</strong> Video and images of bookshelves (processed for book identification, not stored permanently)</li>
              <li><strong>Usage data:</strong> How you interact with the App, books scanned, listings created</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and improve the App's services</li>
              <li>Process transactions between buyers and sellers</li>
              <li>Facilitate book identification through AI analysis</li>
              <li>Send order confirmations, shipping updates, and service notifications</li>
              <li>Prevent fraud and ensure platform safety</li>
              <li>Analyse usage patterns to improve our service</li>
              <li>Generate personalised book recommendations based on your scan activity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Legal Basis for Processing</h2>
            <p className="mb-2">We process your data under the following legal bases:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Contract:</strong> To provide our services and process transactions</li>
              <li><strong>Legitimate interests:</strong> To improve our services, prevent fraud, and analyse usage</li>
              <li><strong>Consent:</strong> For optional marketing communications</li>
              <li><strong>Legal obligation:</strong> To comply with tax and regulatory requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Who We Share Data With</h2>
            <p className="mb-2">We share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Other users:</strong> Your name is shared with buyers/sellers you transact with. Shipping addresses are only shared with shipping partners.</li>
              <li><strong>Stripe:</strong> Our payment processor, for secure payment handling</li>
              <li><strong>Yodel:</strong> Our shipping partner, to generate shipping labels and track deliveries</li>
              <li><strong>Cloud infrastructure providers:</strong> For secure data storage and processing</li>
              <li><strong>AI service providers:</strong> For book identification (images processed, not stored)</li>
            </ul>
            <p className="mt-2">We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide services. 
              Transaction records are retained for 7 years for tax and legal compliance.
            </p>
            <p className="mt-2">
              To request deletion of your account, email support@sellyourshelf.com. 
              We will process deletion requests within 30 days, subject to our legal retention obligations for transaction records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="mb-2">Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Rectify inaccurate data</li>
              <li>Erase your data (right to be forgotten)</li>
              <li>Restrict processing</li>
              <li>Data portability</li>
              <li>Object to processing</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at privacy@sellyourshelf.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Data Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your personal data, 
              including encryption in transit and at rest, secure authentication, and regular security assessments. 
              However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. International Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries outside the UK, including the United States 
              (where some of our service providers are based). We ensure appropriate safeguards are in place, 
              such as Standard Contractual Clauses approved by the UK ICO.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
            <p>
              Our App is not intended for children under 18. We do not knowingly collect personal information from children. 
              If you believe we have collected data from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes 
              via email or in-app notification. Your continued use of the App after changes constitutes acceptance 
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
            <p>For privacy-related enquiries: privacy@sellyourshelf.com</p>
            <p className="mt-2">
              To make a complaint to the UK data protection regulator:<br />
              Information Commissioner's Office (ICO)<br />
              Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF<br />
              Website: ico.org.uk
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