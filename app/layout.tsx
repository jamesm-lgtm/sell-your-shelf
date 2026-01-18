import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}