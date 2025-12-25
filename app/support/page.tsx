export default function Support() {
  return (
    <main className="min-h-screen bg-white py-16">
      <div className="max-w-2xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">Support</h1>
        
        <div className="space-y-6 text-gray-700">
          <p>Need help with Sell Your Shelf? We're here for you.</p>

          <section>
            <h2 className="text-xl font-semibold mb-2">Contact us</h2>
            <p>Email: <a href="mailto:support@sellyourshelf.com" className="text-emerald-600 hover:underline">support@sellyourshelf.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Common questions</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium">How do I get paid?</p>
                <p className="text-gray-600">Payments are sent to your linked bank account via Stripe once the buyer confirms delivery.</p>
              </div>
              <div>
                <p className="font-medium">How does scanning work?</p>
                <p className="text-gray-600">Point your camera at your bookshelf and slowly pan across. Our AI identifies book spines and matches them to our database.</p>
              </div>
              <div>
                <p className="font-medium">What's your fee?</p>
                <p className="text-gray-600">We take 20% commission on each sale. Shipping labels are £2.69.</p>
              </div>
            </div>
          </section>
        </div>

        <a href="/" className="inline-block mt-8 text-emerald-600 hover:underline">← Back to home</a>
      </div>
    </main>
  );
}