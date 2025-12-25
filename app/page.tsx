export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Sell Your Shelf
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Turn your bookshelf into cash in 90 seconds. Just scan, price, and sell — 
          no typing, no barcodes, no hassle.
        </p>
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <p className="text-lg text-emerald-600 font-semibold mb-2">
            Coming January 2025
          </p>
          <p className="text-gray-500">
            iOS App Store
          </p>
        </div>

        {/* How it works */}
        <div className="grid md:grid-cols-3 gap-8 text-left mt-16">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="text-3xl mb-4">📹</div>
            <h3 className="font-semibold text-gray-900 mb-2">1. Scan your shelf</h3>
            <p className="text-gray-600 text-sm">Point your camera at your bookshelf. Our AI identifies every book in seconds.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="font-semibold text-gray-900 mb-2">2. Get instant prices</h3>
            <p className="text-gray-600 text-sm">We check the market and suggest fair prices. You keep £4-6 per book.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="text-3xl mb-4">📦</div>
            <h3 className="font-semibold text-gray-900 mb-2">3. Ship & get paid</h3>
            <p className="text-gray-600 text-sm">Print a label, drop at your local shop. Money hits your account when delivered.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-20 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>© 2025 Sell Your Shelf Limited</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="/privacy" className="hover:text-gray-900">Privacy Policy</a>
            <a href="/support" className="hover:text-gray-900">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}