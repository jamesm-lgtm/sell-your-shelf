import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BasketProvider } from "./components/BasketProvider";
import BasketWidget from "./components/BasketWidget";
import { ShelfInventoryProvider } from "./components/ShelfInventoryProvider";
import GaPageViews from "./components/GaPageViews";
import CookieBanner from "./components/CookieBanner";
import { GA_ID } from "./lib/ga";

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
      <head>
        {/* Consent Mode default MUST run before gtag.js: analytics denied
            unless a previous visit granted it (localStorage). GA sends
            cookieless pings while denied; the CookieBanner upgrades
            consent on accept. */}
        <Script id="ga-consent-default" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
var sysConsent = 'denied';
try { if (localStorage.getItem('sys_analytics_consent') === 'granted') sysConsent = 'granted'; } catch (e) {}
gtag('consent', 'default', {
  analytics_storage: sysConsent,
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
gtag('js', new Date());
gtag('config', '${GA_ID}', { send_page_view: false });`}
        </Script>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
      </head>
      <body className="antialiased">
        <BasketProvider>
          <ShelfInventoryProvider>
            {children}
            <BasketWidget />
          </ShelfInventoryProvider>
        </BasketProvider>
        <Suspense fallback={null}>
          <GaPageViews />
        </Suspense>
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}