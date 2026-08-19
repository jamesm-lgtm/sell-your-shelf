import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const metadata = {
  title: 'Contact Us — Sell Your Shelf',
  description: 'Get in touch with Sell Your Shelf. Email us at support@sellyourshelf.com or hello@sellyourshelf.com.',
}

export default function Contact() {
  return (
    <div className="sy-page">
      <SiteNav />
      <main className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="sy-h2" style={{ marginBottom: 16 }}>Contact Us</h1>
          <p className="sy-prose" style={{ marginBottom: 34 }}>
            We'd love to hear from you. Whether you have a question about an order,
            need help with your account, or just want to say hello.
          </p>

          <div className="space-y-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="sy-h3" style={{ marginBottom: 12 }}>Customer Support</h2>
              <p className="sy-prose" style={{ marginBottom: 8 }}>
                For order issues, account help, or disputes:
              </p>
              <a href="mailto:support@sellyourshelf.com" className="text-emerald-700 font-medium hover:underline">
                support@sellyourshelf.com
              </a>
              <p className="sy-prose" style={{ fontSize: 14, marginTop: 8 }}>We typically respond within 24 hours.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="sy-h3" style={{ marginBottom: 12 }}>General Enquiries</h2>
              <p className="sy-prose" style={{ marginBottom: 8 }}>
                For partnerships, press, or general questions:
              </p>
              <a href="mailto:hello@sellyourshelf.com" className="text-emerald-700 font-medium hover:underline">
                hello@sellyourshelf.com
              </a>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="sy-h3" style={{ marginBottom: 12 }}>Registered Address</h2>
              <p className="sy-prose">
                Sell Your Shelf Limited<br />
                94 Seymour Road<br />
                London, N8 0BE<br />
                United Kingdom
              </p>
              <p className="sy-prose" style={{ fontSize: 14, marginTop: 12 }}>
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
