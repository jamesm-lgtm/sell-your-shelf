import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const metadata = {
  title: 'Contact Us — Sell Your Shelf',
  description: 'Get in touch with Sell Your Shelf. Email us at support@sellyourshelf.com or hello@sellyourshelf.com.',
}

export default function Contact() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
          <p className="text-gray-600 mb-10">
            We'd love to hear from you. Whether you have a question about an order,
            need help with your account, or just want to say hello.
          </p>

          <div className="space-y-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-3">Customer Support</h2>
              <p className="text-gray-700 mb-2">
                For order issues, account help, or disputes:
              </p>
              <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 font-medium hover:underline">
                support@sellyourshelf.com
              </a>
              <p className="text-gray-500 text-sm mt-2">We typically respond within 24 hours.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-3">General Enquiries</h2>
              <p className="text-gray-700 mb-2">
                For partnerships, press, or general questions:
              </p>
              <a href="mailto:hello@sellyourshelf.com" className="text-emerald-700 font-medium hover:underline">
                hello@sellyourshelf.com
              </a>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-3">Registered Address</h2>
              <p className="text-gray-700">
                Sell Your Shelf Limited<br />
                94 Seymour Road<br />
                London, N8 0BE<br />
                United Kingdom
              </p>
              <p className="text-gray-500 text-sm mt-3">
                Company Number: 16895246<br />
                Registered in England and Wales
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
