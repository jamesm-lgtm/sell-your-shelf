import type { Metadata } from "next";
import { Suspense } from "react";
import { Archivo, Literata } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BasketProvider } from "./components/BasketProvider";
import BasketWidget from "./components/BasketWidget";
import { ShelfInventoryProvider } from "./components/ShelfInventoryProvider";
import GaPageViews from "./components/GaPageViews";
import CookieBanner from "./components/CookieBanner";
import { GA_ID } from "./lib/ga";

// Display voice: Literata. A sturdy reading serif with a full variable
// weight axis — chosen over Libre Caslon (one weight only, hairlines thin
// out on colour) and over Bodoni Moda (fashion register, not bookish).
// The weight axis means it holds on paper and on green alike.
const literata = Literata({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-literata",
});

// UI, body and every figure. Archivo carries the transactional half — the
// Vinted contribution: prices legible at a glance, tabular figures always.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.sellyourshelf.com"),
  alternates: {
    canonical: './',
  },
  title: "Sell Your Shelf — Turn your bookshelf into cash",
  description: "Scan your bookshelf in 90 seconds. Our AI identifies each book, prices it fairly, and connects you with readers. Keep £2-4 per book instead of pennies from trade-in services.",
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
    <html lang="en" className={`${archivo.variable} ${literata.variable}`}>
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
        {/* Direction contract, emitted as a real HTML comment so it survives the
            production build and stays auditable. JSX comments never reach the DOM. */}
        <div
          style={{ display: 'none' }}
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: The page is the instrument that meters a shelf. It refuses the warm-bookshop hero — stacked paperbacks, serif headline, testimonial row.
OWN-WORLD: warm paper (#FAF7F2) leads; brand green (#2D4A3E, user-pinned — the app-icon green) is punctuation, holding nav, footer, one accent band and the closing panel. Literata for headings, Archivo for the wordmark, UI and every tabular figure; letterspaced serif caps for section marks; generous space; hairline rules, no brackets. Book covers are the imagery — shown large, never substituted with gradients or stock. The shelf symbol is binding and ships as inline SVG traced from the app icon; the wordmark and typeface are not.
STORY: A seller sees that pointing a phone at a shelf produces priced, listed books, and installs the app.
FIRST VIEWPORT: Warm paper. Left, a Literata headline over the scan promise and both store buttons. Right, a white reading-shelf card: five real covers above a ruled list of titles and tabular prices, closing on an honestly-labelled total of exactly the listings shown. Below, a hairline stat row — scan time, seller take, shipping, fee.
FORM: The Scan Line, rendered in calibration-target materials. Ranked 1 of 7 on the grounded list; chosen over roll assignment 6. Seed key ffefbb56.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`,
          }}
        />
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