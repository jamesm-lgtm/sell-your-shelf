import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-16 px-6">
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
              <Link href="/about" className="block hover:text-white transition-colors">About</Link>
              <Link href="/new" className="block hover:text-white transition-colors">Browse Books</Link>
              <Link href="/support" className="block hover:text-white transition-colors">Support</Link>
              <Link href="/contact" className="block hover:text-white transition-colors">Contact</Link>
            </div>
            <div className="space-y-2">
              <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/returns" className="block hover:text-white transition-colors">Returns Policy</Link>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-sm">
          © 2026 Sell Your Shelf Limited. All rights reserved.
        </div>
      </div>
    </footer>
  );
}