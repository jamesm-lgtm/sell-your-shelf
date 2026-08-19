# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences reaching the same product through different doors.

- **Buyers — the primary web audience.** UK readers hunting a specific title. They typically arrive from organic search on a book name, author, or ISBN and expect to transact as they would on any ecommerce store: find the book, judge condition and price, check out. They are not browsing for entertainment; they arrive with intent.
- **Sellers — a landing-page audience.** People with shelves of already-read books. On web, the job is persuasion and app install, not listing: the listing and scanning work happens in the companion native app.

The two are deliberately not sealed segments. The strategic goal is overlap — sellers become buyers, buyers become sellers — and design should make crossing between the roles easy rather than treating them as separate populations.

**The live imbalance: sellers without buyers.** Confirmed 2026-08-17. The app has strong seller adoption and close to zero buyers. Demand, not supply, is the current bottleneck, and it changes what each surface is for:

- **Web leads with sellers.** The homepage keeps the scan hook and the app-install path. This is settled, not up for re-litigation.
- **Both browse pages need redesign, not restyling.** Confirmed 2026-08-17. The website's browse page (`app/new/page.tsx`, linked as "Shop books") and the app's browse screen both need their structure, merchandising and discovery model reconsidered — not simply repainted into the new visual language. Do not treat either as a token-swap job; route them through a shaping round first.
- **The app converts sellers into buyers.** Its **browse page is the priority surface** — the place a seller who already has the app becomes someone who buys. Discovery there should learn from Vinted (search-first, scannable price-led grids, saved searches, follows) and from bookshops (curation, staff-pick framing, browsing by taste rather than by filter).

**Target audience is not current audience.** Confirmed 2026-08-17. Today's sellers skew toward low-value, poor-condition stock, and that is explicitly *not* the audience being designed for. The intended reader is older and more sophisticated than a young-and-trendy resale demographic — closer to an independent-bookshop customer than a fast-fashion reseller. Design decisions serve the audience being recruited, not the one currently listing.

This has a direct, non-cosmetic consequence: **any surface that renders live inventory unfiltered will display the current audience's stock and undercut the positioning.** Homepage and marketing selections should be curated — by price floor, cover quality, or hand-picked titles — rather than pulling the most recent listings. This is a product decision, not a styling one.

## Product Purpose

A UK peer-to-peer marketplace for secondhand books. Sellers turn read books into money with far less friction than trade-in services or hand-listing on general marketplaces; buyers get specific secondhand titles with tracked delivery and buyer protection. Success means a liquid two-sided marketplace with aggressive share capture in UK secondhand books.

## Positioning

A marketplace platform in the Vinted mould — peer-to-peer, not a reseller or a warehouse. Differentiators, in confirmed priority order:

1. **AI shelf scanning.** Point a camera at a shelf; roughly 30 books identified in about 90 seconds, with prices suggested from live market data. This is the hook that drives app downloads and converts curiosity into supply. It is the highest-priority claim.
2. **Seller economics.** Sellers keep meaningfully more per book than trade-in services, which pay pennies. Pricing is deliberately aggressive to win market share.
3. **Shared and curated shelves.** The `/[username]` shelves and bundles turn sellers into browsable identities — buying from a person's taste rather than a warehouse. A later community play that supports the brand rather than driving acquisition today.

## Operating Context

- This repo (Next.js 16, App Router) is the **web storefront plus seller landing page**. Listing and scanning live in the companion React Native app in a separate repository (`book-marketplace/SellYourShelf`), along with the `ocr` and `analyze-books` edge functions.
- **Seller flow:** scan shelf → AI identifies spines → suggested prices → accept or adjust → publish. On sale, a shipping label is generated; the seller drops the parcel at any InPost or Yodel point using a QR code with no printing, and is paid once delivered.
- **Buyer flow:** search or browse → listing shows condition, price, and seller location → Stripe checkout → tracked delivery.
- **Admin surfaces** (`app/admin/*`: orders, analytics, merchandise, wallets and payouts) are internal operations tooling. Different audience, different rules — out of scope for storefront design work unless named explicitly.

## Capabilities and Constraints

- **Fees (confirmed):** 20% platform fee on sale price; £0.60 minimum fee per book; £2.50 shipping paid by the buyer, **free over £10** (`FREE_SHIPPING_THRESHOLD_GBP = 10`, implemented in `lib/basket.ts`, `lib/bundlePricing.ts` and `lib/offerSchema.ts`). Free to list; no hidden charges.
- **Buyer protection:** not-as-described claims honoured within 14 days.
- Payments processed through Stripe. Sellers are paid on delivery.
- Sell Your Shelf Limited, registered in England and Wales, company number 16895246, based in London.
- Locale `en_GB`; GBP throughout.
- **Seller take — corrected fact.** Typical seller take is approximately **£2–4 per book**, varying by title. The **£4–6** figure currently shipped in the root layout metadata and Open Graph tags is inaccurate and must be replaced wherever it appears. Any per-book figure is book-dependent and must be framed as typical, never guaranteed.

## Brand Commitments

- The **"Sell Your Shelf" name is fixed** and carries through any redesign unchanged.
- **The shelf symbol is binding.** The mark in `public/icon.png` — four spines on a rail, three upright with the second dimmed, one leaning away — is the app-icon symbol and stays. It ships on web as inline SVG ([app/components/BrandMark.tsx](app/components/BrandMark.tsx)) traced from that asset, so the store icon and the web lockup are the same mark. The **wordmark and typeface are not binding** and may change.
- **Green is binding.** A green in the `#2D4A3E` family carries the brand. It need not be that exact value, but it must read as the same colour: the ambition is a mass-market marketplace at Vinted's level, green reads correctly for books, and it matches the app icon. Green is not merely permitted — a redesign that drops it has failed the brief.
- **Everything else in the old visual world is open.** The `#FAF8F5` warm background, the Fraunces serif, and the gold accent are replaceable. Treat the retired look as evidence, not design authority.
- **Standing design preference: the category standard, executed at reference-level craft.** Confirmed 2026-08-17. The user reviewed a full direction round — including an instrument/viewfinder world that was built — and chose the conventional path deliberately. This is a durable preference, not a one-off: future work does not re-litigate it or smuggle in quirk. The craft bar is triangulated against three named references, each contributing one thing:
  - **[fable.co](https://fable.co)** — deep green carrying a whole page, high-contrast serif display, real covers as hero material, warmth without whimsy. The closest single reference.
  - **Vinted / Depop** — transactional clarity: search-first, prices legible at a glance, mass-market scannability.
  - **Daunt Books and British independent booksellers** — letterspaced serif restraint, quiet confidence, near-monochrome discipline.
- **Covers are the imagery.** Fable's distinctiveness rests on commissioned illustration, which this product does not have. Real book covers, shown large and well, carry that weight instead. Do not substitute gradients, stock photography, or generic icon tiles for authored imagery.
- **Fee transparency is binding.** The explicit 20% / £0.60 / £2.50 breakdown and the legal pages (terms, privacy, returns, company registration) stay prominent and unchanged in substance.
- **App-first selling is binding.** App Store and Play badges, and the story that real selling happens in the native app, remain a visible part of the web experience.

## Evidence on Hand

- Editorial content: blog posts under `content/blog`.
- Live listing, bundle, and shelf data via Supabase.
- Legal and company facts verified in [app/about/page.tsx](app/about/page.tsx) and the legal routes (`/terms`, `/privacy`, `/returns`).
- App store badges: [app/components/AppBadges.tsx](app/components/AppBadges.tsx).

- **Volume claim — resolved 2026-08-17.** The homepage previously hardcoded "40,000+ books" in two places. Both now render a live `count` of active listings (currently 3,622), so the figure cannot drift from reality. Do not reintroduce a hardcoded volume claim.

**Absences that future work must not fabricate.** There are no testimonials, reviews, ratings, customer counts, seller earnings case studies, press mentions, awards, or trust-badge partnerships. Do not invent them or design layouts that assume them. The "30 books in 90 seconds" figure is a product claim taken from About copy, not measured benchmark data.

## Data Prerequisites

Design work has hit five data problems that no amount of layout can solve. Each is recorded here because a future session will otherwise rediscover them, or worse, paper over them.

1. **Categorisation backfill.** 14% of active listings have no category. Category browse stays a second-class axis until this is filled. *User is handling separately.*

2. **Edition confidence — three definitions, pick one.** The app shows "Verified Edition" from `identification_method` containing `isbn`; web shows "Specific Edition" from the presence of edition metadata; and 65% of listings simply have an ISBN. On live data those resolve to 0%, 2% and 65% respectively. Decide one rule, one label, and one token — the web badge currently borrows `--color-cond-like-new`, a *condition* colour, to mean verification, which is token drift. The useful claim to a buyer is "this is the exact edition pictured", not "specific edition".

3. **Author pages.** Authors are plain text everywhere. An author route would aggregate supply across all 189 sellers, is SEO-addressable in a way listing URLs are not, and gives a better cross-sell than "more from this shelf" when a shelf is thin. Needs a slug scheme and author-name normalisation — the same class of problem as the category backfill.

4. **Editorial collections are near-empty.** 14 tagged listings across 6 collections (0.4% of catalogue), three collections inactive, four with no description. Browse is built to degrade gracefully, but it only becomes a real shop window at roughly 100–150 tagged listings.

5. **Mispriced stock is now promoted.** The browse gate ranks quality partly by price, so listings like a £21.06 self-care journal and an £18.14 paperback are surfaced *first*. A price ceiling or an outlier check would help, but the underlying fix is correcting the prices.

## Product Principles

1. **Buyers arrive with intent.** The web buying path is search-led ecommerce, not discovery browsing. Move people from query to checkout without ceremony.
2. **The scan is the story.** For sellers, the AI shelf scan is the single most compelling thing to show. It earns the download; nothing else on the seller path outranks it.
3. **Honest money.** Fee and payout claims stay concrete, verifiable, and never inflated. Aggressive positioning comes from real economics, not rounded-up numbers.
4. **One person, both roles.** Never design as though buyers and sellers are separate populations. Make crossing over easy and obvious.
5. **Peer, not warehouse.** This is a marketplace of people — real sellers, real shelves, honestly stated condition.

## Accessibility & Inclusion

WCAG AA is a hard requirement, not an aspiration: colour contrast, visible focus states, complete keyboard paths, and correct semantics.
