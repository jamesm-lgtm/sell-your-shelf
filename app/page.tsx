import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      {/* Navigation */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <Image 
            src="/logo.png" 
            alt="Sell Your Shelf" 
            width={32} 
            height={32}
            className="h-8 w-auto"
          />
          <span className="text-lg font-semibold text-[#1A1A1A]">Sell Your Shelf</span>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="#how-it-works" className="text-sm font-medium text-[#666666] hover:text-[#1A1A1A] transition-colors">
            How it works
          </Link>
          <Link href="/support" className="text-sm font-medium text-[#666666] hover:text-[#1A1A1A] transition-colors">
            Support
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#2D4A3E]/[0.08] border border-[#2D4A3E]/[0.15] rounded-full text-sm font-medium text-[#2D4A3E] mb-6">
              <span className="w-2 h-2 bg-[#2D4A3E] rounded-full animate-pulse"></span>
              Now live on the App Store
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl font-serif text-[#1A1A1A] leading-[1.1] tracking-tight mb-6">
              Your books deserve<br />
              <span className="text-[#2D4A3E]">better than boxes</span>
            </h1>

            {/* Description */}
            <p className="text-xl text-[#666666] leading-relaxed mb-10 max-w-lg">
              Scan your entire bookshelf in 90 seconds. Our AI identifies each title, prices it fairly, and connects you with readers who&apos;ll actually treasure them.
            </p>

            {/* App Store Button */}
            <a
              href="https://apps.apple.com/app/sell-your-shelf"
              className="inline-flex items-center gap-3 bg-[#1A1A1A] text-white px-6 py-4 rounded-xl hover:bg-[#1F3329] transition-all hover:-translate-y-0.5 mb-8"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <span className="block text-xs opacity-75">Download on the</span>
                <span className="block text-base font-semibold -mt-0.5">App Store</span>
              </div>
            </a>

            {/* Trust Badges */}
            <div className="flex items-center gap-6 text-sm text-[#666666]">
              <span className="flex items-center gap-2">
                <svg className="w-[18px] h-[18px] text-[#2D4A3E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                Secure payments
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-[18px] h-[18px] text-[#2D4A3E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Keep £4–6 per book
              </span>
            </div>
          </div>

          {/* Phone Mockup */}
          <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-[#2D4A3E]/10 to-[#2D4A3E]/5 rounded-3xl rotate-3 scale-95"></div>
            <div className="relative bg-[#1A1A1A] rounded-[40px] p-3 shadow-2xl max-w-[280px]">
              <div className="bg-[#FAF8F5] rounded-[32px] aspect-[9/16] overflow-hidden">
                <div className="px-5 py-4 bg-white border-b border-[#F0EDE8]">
                  <p className="text-sm font-semibold text-center text-[#1A1A1A]">Your Books</p>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { title: 'Atomic Habits', author: 'James Clear', price: '£6.50', color: 'from-[#2D4A3E] to-[#3B5249]' },
                    { title: 'The Psychology of Money', author: 'Morgan Housel', price: '£5.75', color: 'from-[#8B4513] to-[#A0522D]' },
                    { title: 'Deep Work', author: 'Cal Newport', price: '£4.25', color: 'from-[#2F4F4F] to-[#3D5C5C]' },
                  ].map((book, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 flex gap-3 border border-[#F0EDE8]">
                      <div className={`w-11 h-16 bg-gradient-to-br ${book.color} rounded flex-shrink-0`}></div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1A1A1A] truncate">{book.title}</p>
                        <p className="text-[11px] text-[#666666] mb-2">{book.author}</p>
                        <p className="text-sm font-bold text-[#2D4A3E]">{book.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white border-y border-[#E5E3DF] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 max-w-xl mx-auto">
            <h2 className="text-4xl font-serif text-[#1A1A1A] mb-4">From shelf to sold in three steps</h2>
            <p className="text-[#666666] text-lg">
              We&apos;ve stripped away everything that makes selling books tedious. No typing titles. No scanning barcodes. No guessing prices.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Scan your shelf',
                description: 'Pan your camera across your bookshelf. Our AI identifies every spine in real-time—typically 30 books in under 90 seconds.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              },
              {
                step: '02',
                title: 'Review & price',
                description: 'We check live market data and suggest fair prices. Accept our recommendations or adjust them—you\'re in control.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              },
              {
                step: '03',
                title: 'Ship & get paid',
                description: 'When a book sells, print your £2.69 shipping label and drop it at any ParcelShop. Payment lands in your account once delivered.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-12 h-12 bg-[#2D4A3E]/[0.08] border border-[#2D4A3E]/[0.12] rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#2D4A3E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#2D4A3E] mb-1">Step {item.step}</p>
                  <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">{item.title}</h3>
                  <p className="text-[#666666] leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-4xl mx-auto py-24 px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif text-[#1A1A1A] mb-4">Why settle for pennies?</h2>
          <p className="text-[#666666] text-lg">Trade-in services give you pocket change. We connect you directly with readers.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-[#F0EDE8] border border-[#E5E3DF] rounded-2xl p-8">
            <p className="text-sm font-medium text-[#666666] mb-4">Trade-in services</p>
            <p className="text-5xl font-serif text-[#999999] mb-1">~25p</p>
            <p className="text-[#666666]">per book, if they accept it</p>
          </div>
          <div className="bg-[#2D4A3E] text-white rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#3B5249] rounded-full opacity-30"></div>
            <div className="relative">
              <p className="text-sm font-medium text-white/80 mb-4">Sell Your Shelf</p>
              <p className="text-5xl font-serif mb-1">£4–6</p>
              <p className="text-white/80">per book, directly from readers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="bg-[#F0EDE8] border-t border-[#E5E3DF] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-12 text-sm text-[#666666]">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#999999]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/>
            </svg>
            Payments by Stripe
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            Buyer protection included
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#999999]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            UK registered company
          </span>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-[#999999] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <Image 
                  src="/logo.png" 
                  alt="Sell Your Shelf" 
                  width={28} 
                  height={28}
                  className="h-7 w-auto brightness-0 invert"
                />
                <span className="text-white font-semibold">Sell Your Shelf</span>
              </Link>
              <p className="text-sm leading-relaxed">
                Sell Your Shelf Limited<br />
                Company No. 16895246<br />
                Registered in England and Wales
              </p>
            </div>

            <div className="flex gap-16 text-sm">
              <div className="space-y-2">
                <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
              </div>
              <div className="space-y-2">
                <Link href="/support" className="block hover:text-white transition-colors">Support</Link>
                <a href="mailto:hello@sellyourshelf.com" className="block hover:text-white transition-colors">Contact</a>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/10 text-sm">
            © 2025 Sell Your Shelf Limited. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  )
}