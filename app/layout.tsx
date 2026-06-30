import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BasketProvider } from "./components/BasketProvider";
import BasketWidget from "./components/BasketWidget";
import { ShelfInventoryProvider } from "./components/ShelfInventoryProvider";

// Display/heading typeface. Exposed as the --font-fraunces CSS variable
// (wired into --font-serif in globals.css) so headings can opt into it
// via fontFamily: 'var(--font-serif)'. Variable font → full weight range,
// includes the italic 900 used for the hero "cash" emphasis.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.sellyourshelf.com"),
  alternates: {
    canonical: './',
  },
  title: "Sell Your Shelf — Turn your bookshelf into cash",
  description: "Scan your bookshelf in 90 seconds. Our AI identifies each book, prices it fairly, and connects you with readers. Keep £4-6 per book instead of pennies from trade-in services.",
  keywords: ["sell books", "secondhand books", "book marketplace", "sell used books UK"],
  authors: [{ name: "Sell Your Shelf Limited" }],
  openGraph: {
    title: "Sell Your Shelf — Turn your bookshelf into cash",
    description: "Scan your bookshelf in 90 seconds. Our AI identifies each book, prices it fairly, and connects you with readers.",
    url: "https://www.sellyourshelf.com",
    siteName: "Sell Your Shelf",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sell Your Shelf — Turn your bookshelf into cash",
    description: "Scan your bookshelf in 90 seconds. Our AI identifies each book, prices it fairly, and connects you with readers.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="antialiased">
        <BasketProvider>
          <ShelfInventoryProvider>
            {children}
            <BasketWidget />
          </ShelfInventoryProvider>
        </BasketProvider>
        <Analytics />
      </body>
    </html>
  );
}