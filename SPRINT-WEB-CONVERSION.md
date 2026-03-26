# Sprint: Web Conversion — Handover Document

**Date:** 26 March 2026
**Status:** Complete — deployed to production

---

## Overview

This sprint added a full transaction layer to the Sell Your Shelf website (sellyourshelf.com). Web visitors can now discover, search, browse by category, and purchase books directly — no app download required.

---

## What Was Built

### 1. Edge Function: `web-create-payment-intent`
**Location:** `SellYourShelf/supabase/functions/web-create-payment-intent/index.ts`
**Deployed:** Yes (Supabase, project ref `vsnhrukqqmukkpqlyrhh`)

Creates a lightweight Supabase auth account and Stripe PaymentIntent for unauthenticated web buyers.

- Validates listing is active, seller is onboarded (`onboarding_step = 'complete'` + `stripe_account_status = 'enabled'`)
- Creates or retrieves Supabase auth user via `admin.createUser`
- Fee logic matches the app exactly:
  - Buyer charged: book price + £2.50 shipping
  - Platform fee: 20% of book price (or £1 flat if book < £5)
  - Seller receives: book price - platform fee
  - Platform keeps: fee + shipping
  - Stripe processing fee (~1.5% + 20p) absorbed by platform
- `application_fee_amount` = platform fee + shipping (both stay with platform)
- `transfer_data.destination` = seller's Stripe Connect account
- Metadata includes all amounts in pence + shipping address for webhook processing
- JWT verification OFF — unauthenticated buyers call this endpoint
- Transaction row inserted with `status: 'payment_pending'`, `shipping_address` (JSONB), `buyer_email`

### 2. Edge Function: `send-shipped-email`
**Location:** `SellYourShelf/supabase/functions/send-shipped-email/index.ts`
**Deployed:** Yes

Sends a branded shipped notification email via Resend to web buyers.

- Gets buyer email from `transactions.buyer_email` (fallback: `auth.users`)
- Email links to `sellyourshelf.com/order/{transactionId}` for web tracking
- JWT verification ON — called by authenticated sellers
- Non-blocking — failure doesn't block the mark-shipped flow

### 3. iOS App Change
**File:** `SellYourShelf/screens/profile/OrdersScreen.tsx`

After `mark-shipped` succeeds, fires `send-shipped-email` in the background. Uses `.catch()` so failures don't affect the UX.

### 4. Canonical Book Pages: `/books/[slug]`
**File:** `sell-your-shelf/app/books/[slug]/page.tsx`

Aggregation pages showing all active listings for a given book.

- Slug format: `the-edge-david-baldacci` (from `title_normalized-author_normalized`)
- Direct lookup via `books.slug` column (indexed), with fuzzy fallback
- JSON-LD structured data (Schema.org Book + AggregateOffer)
- SEO metadata with cover image, price range, listing count
- Pages auto-404 when last listing sells
- ~271 book pages currently live

### 5. Category Pages: `/category/[category]`
**File:** `sell-your-shelf/app/category/[category]/page.tsx`

Browse pages filtered by book category.

- 15 categories: Fiction, Children's, Biography & Memoir, Self-Help, History, Reference & Education, Business & Finance, Travel, Cookery & Food, Art & Photography, Science & Nature, Young Adult, Comics & Graphic Novels, Sci-Fi & Fantasy, Crime & Thriller
- Horizontal scrollable category pills for navigation between categories
- SEO metadata per category
- 914 books have category data

### 6. Web Checkout: `/checkout/[listingId]`
**Files:** `sell-your-shelf/app/checkout/[listingId]/page.tsx` (server) + `sell-your-shelf/app/components/CheckoutForm.tsx` (client)

Full checkout flow for web buyers.

- Server component validates listing is active + seller is onboarded, redirects to listing page if not
- CRO-optimised layout: order summary first (book cover, title, condition, price breakdown), then account fields, delivery address, payment
- Stripe Payment Element via `@stripe/react-stripe-js`
- Two-step flow: fill form → call edge function → receive clientSecret → show Stripe card input → confirm payment → redirect to /order/confirmed
- Sticky pay button fixed to bottom of viewport on mobile
- Trust signals: secure checkout, tracked delivery, buyer protection
- Shipping shown as £2.50 with "2-4 working days" estimate
- Pay button shows total including shipping (e.g. "Pay £7.10")

### 7. Order Pages
**Files:** `sell-your-shelf/app/order/confirmed/page.tsx` + `sell-your-shelf/app/order/[transactionId]/page.tsx`

- `/order/confirmed` — post-payment landing page, reads `transaction_id` from Stripe redirect URL params
- `/order/[transactionId]` — order status page with Paid → Shipped → Delivered tracker, shipped date display
- Both include App Store download CTAs
- No auth required (security by obscurity for MVP)

### 8. Search: `/search?q=`
**File:** `sell-your-shelf/app/search/page.tsx`

- Searches listings by title AND author using `ilike`
- Deduplicates results from both queries
- Results displayed in ShelfGrid with Load More pagination
- `noindex` meta tag (search results shouldn't be indexed)

### 9. Shared Navigation: `SiteNav`
**File:** `sell-your-shelf/app/components/SiteNav.tsx`

Client component used on every page across the site.

- Desktop: Logo | Search icon | Browse | Blog | Support | Get the app
- Mobile (< 640px): Logo | Search icon | Burger menu
- Burger menu expands: Browse Books, Blog, Support, Get the App
- Search bar slides open inline in the nav
- Active page highlighting via `current` prop
- Applied to all 15+ pages including homepage, blog, support, privacy, terms

### 10. Shared Footer
**File:** `sell-your-shelf/app/components/Footer.tsx` (pre-existing, now used everywhere)

Applied to all pages. Contains logo, company registration, Privacy Policy, Terms, Support, Contact links, copyright.

### 11. ShelfGrid Improvements
**File:** `sell-your-shelf/app/components/ShelfGrid.tsx`

- Equal-height cards using flexbox column layout
- CTA changed from "Buy on Sell Your Shelf" to "View listing"
- Load More pagination with configurable `pageSize` prop (default 24)
- Resets to first page when filter changes

### 12. Listing Page Updates
**File:** `sell-your-shelf/app/listing/[id]/page.tsx`

- "Buy available copies" CTA below the book description, linking to `/books/[slug]`
- Breadcrumbs: Home / Browse / [Book Title] / This copy
- Sell CTA updated for web context
- Shared nav + footer

### 13. Browse Page Updates
**File:** `sell-your-shelf/app/new/page.tsx`

- Fetches 200 listings (was 96)
- Category pills for quick filtering
- Breadcrumbs
- Live count display

### 14. Homepage Updates
**File:** `sell-your-shelf/app/page.tsx`

- "Browse by category" section with pill links to all categories
- "Popular books" section showing 8 books with covers linking to book pages
- Step 3 corrected: £2.50 shipping via Yodel (was £2.69 ParcelShop)
- Shared SiteNav + Footer replacing inline nav/footer

---

## SEO

### What's in place
- **Sitemap** (`/sitemap.xml`): Regenerates hourly. Includes ~560+ URLs: homepage, browse, 15 category pages, ~271 book pages, ~278 listing pages, blog posts, seller profiles
- **Canonical URLs**: `metadataBase` set in root layout, all pages get `<link rel="canonical">` automatically
- **JSON-LD**: Book pages have Schema.org Book + AggregateOffer structured data (enables rich results in Google)
- **OpenGraph + Twitter cards**: All pages have OG title, description, images
- **Breadcrumbs**: On listing, book, category, browse, and search pages
- **Category pages**: Target mid-funnel queries like "buy fiction books secondhand UK"
- **Book pages**: Target long-tail queries like "buy Foundation by Isaac Asimov"
- **`revalidate = 0`** on all data pages: Google always sees current inventory
- **next/image config**: Amazon and Google Books domains whitelisted for optimised image loading
- **Slug column**: `books.slug` column with index for direct O(1) lookups

### Sitemap priority structure
| Priority | Pages | Count |
|----------|-------|-------|
| 1.0 | Homepage | 1 |
| 0.9 | Browse (/new) | 1 |
| 0.8 | Category pages + Book pages | ~286 |
| 0.7 | Blog index | 1 |
| 0.6 | Individual listings + blog posts | ~278+ |
| 0.5 | Seller profiles | varies |
| 0.2-0.4 | Support, privacy, terms | 3 |

### Actions taken
- Sitemap submitted to Google Search Console
- Manual indexing requested for homepage, browse, top category pages, and key book pages

### Future SEO opportunities
- **Full-text search**: Replace `ilike` with Supabase full-text search or Algolia for typo tolerance and ranking
- **Internal linking improvements**: Link from blog posts to relevant book/category pages
- **Author pages**: `/author/[name]` aggregating all books by an author
- **Price history / price comparison**: "cheapest copy of X" content for SEO
- **Review/rating system**: User-generated content helps ranking
- **Image optimisation**: Convert remaining `<img>` tags to `next/image` on listing and checkout pages

---

## Database Changes

### Migration run
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS buyer_email TEXT;

ALTER TABLE books ADD COLUMN IF NOT EXISTS slug TEXT;
-- Slug populated from title_normalized + author_normalized
CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
```

### Known data issue
Some sellers have `onboarding_step = 'not_started'` despite `stripe_account_status = 'enabled'` (onboarded under a previous setup before `onboarding_step` existed). These sellers' listings will show on the site but checkout will redirect back to the listing page. Fix: update `onboarding_step` to `'complete'` for verified sellers.

---

## Packages Added (website)

- `@stripe/stripe-js` — Stripe.js loader
- `@stripe/react-stripe-js` — React components for Stripe Elements

---

## Environment Variables

No new env vars needed. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY` (edge functions)
- `RESEND_API_KEY` (edge functions)

---

## Deploy Commands

```bash
# Edge functions
supabase functions deploy web-create-payment-intent --project-ref vsnhrukqqmukkpqlyrhh
supabase functions deploy send-shipped-email --project-ref vsnhrukqqmukkpqlyrhh

# Website (auto-deploys via GitHub → Vercel on push to main)
cd sell-your-shelf && git push origin main
```

---

## Testing

### End-to-end checkout (not yet completed with real payment)
1. Visit `/checkout/3731` (The Sinner, £5.00 — seller is onboarded)
2. Fill email, password (min 8 chars), delivery address
3. Tap Pay £7.50
4. Enter card details in Stripe Payment Element
5. Confirm payment → redirect to `/order/confirmed?transaction_id=X`
6. Check `/order/X` for status tracking
7. Mark as shipped in iOS app → buyer gets email with tracking link

### Seller onboarding requirement
Only listings from sellers with `onboarding_step = 'complete'` AND `stripe_account_status = 'enabled'` allow checkout. Currently one seller is fully onboarded (user `444427c2-8dfa-46cd-a177-d77cd9a5170d`, username `livingdeadgirl`).

---

## Files Changed

### Website (sell-your-shelf repo)
**New files:**
- `app/books/[slug]/page.tsx`
- `app/category/[category]/page.tsx`
- `app/checkout/[listingId]/page.tsx`
- `app/components/CheckoutForm.tsx`
- `app/components/SiteNav.tsx`
- `app/order/confirmed/page.tsx`
- `app/order/[transactionId]/page.tsx`
- `app/search/page.tsx`

**Modified files:**
- `app/page.tsx` — SiteNav, Footer, categories, popular books, Step 3 fix
- `app/new/page.tsx` — SiteNav, Footer, category pills, 200 limit
- `app/listing/[id]/page.tsx` — SiteNav, Footer, breadcrumbs, "Buy available copies" CTA
- `app/[username]/page.tsx` — SiteNav, Footer
- `app/blog/page.tsx` — SiteNav (was Header)
- `app/blog/[slug]/page.tsx` — SiteNav (was Header)
- `app/support/page.tsx` — SiteNav, Footer
- `app/privacy/page.tsx` — SiteNav, Footer
- `app/terms/page.tsx` — SiteNav, Footer
- `app/components/ShelfGrid.tsx` — equal height cards, "View listing" CTA, Load More
- `app/layout.tsx` — metadataBase + canonical URLs
- `app/sitemap.ts` — book pages, category pages, fixed Supabase key
- `next.config.ts` — remote image domains
- `package.json` — Stripe dependencies

### Mobile app (SellYourShelf repo)
**New files:**
- `supabase/functions/web-create-payment-intent/index.ts`
- `supabase/functions/web-create-payment-intent/deno.json`
- `supabase/functions/send-shipped-email/index.ts`
- `supabase/functions/send-shipped-email/deno.json`

**Modified files:**
- `supabase/config.toml` — new function entries
- `screens/profile/OrdersScreen.tsx` — send-shipped-email call after mark-shipped
