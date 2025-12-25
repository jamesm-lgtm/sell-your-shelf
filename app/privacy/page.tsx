export default function Privacy() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="max-w-2xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-gray-600 mb-4">Last updated: December 2024</p>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-2">What we collect</h2>
            <p>When you use Sell Your Shelf, we collect your email address, profile information, and details of books you list for sale. We also access your camera to scan bookshelves, but images are processed and not stored.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">How we use it</h2>
            <p>Your information is used to facilitate book sales, process payments via Stripe, and communicate with buyers/sellers. We don't sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Payments</h2>
            <p>Payments are processed securely through Stripe. We don't store your full payment details on our servers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Contact</h2>
            <p>Questions? Email us at support@sellyourshelf.com</p>
          </section>
        </div>

        <a href="/" className="inline-block mt-8 text-emerald-600 hover:underline">← Back to home</a>
      </div>
    </main>

    
  );
  <p className="text-sm text-gray-500 mt-8">Sell Your Shelf Limited is a company registered in England and Wales.</p>
}