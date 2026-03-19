import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <nav className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt="Sell Your Shelf"
          width={32}
          height={32}
          className="h-8 w-auto"
        />
        <span className="text-lg font-semibold text-gray-900">Sell Your Shelf</span>
      </Link>
      <div className="flex items-center gap-8">
        <Link
          href="/#how-it-works"
          className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          How it works
        </Link>
        <Link
          href="/blog"
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Blog
        </Link>
        <Link
          href="/support"
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Support
        </Link>
      </div>
    </nav>
  );
}