# Handoff — iOS/Android app multi-item checkout

**Purpose of this doc**: brief a fresh Claude Code chat that's picking up the
React Native side of multi-item bundling. The web side (Phase 1, 1A, 1B)
shipped to prod on 2026-05-20. Everything multi-item-related on the backend
is already there. This phase is putting the same flow into the iOS and
Android apps.

Estimated effort: **3–5 focused sessions** (see §6 for the breakdown).

---

## 0. Read this first

The author of this doc (an earlier Claude Code session) **never saw the
React Native app's source code directly**. The web repo and prod Supabase
are documented from direct observation; the RN app is documented from
inference and from web-side references (deep links, "Get the app" CTAs,
shared edge functions, push token columns).

**Confirm the RN app's actual structure with the user at the start of
your first session before you start coding.** Specifically ask:
- Is the RN app in this repo (`sell-your-shelf`), a sibling directory, or a
  separate repo entirely?
- What's the state management library? Navigation library?
- Is Expo Router used, or React Navigation?
- What's the networking pattern — bare `fetch`, React Query, Supabase
  client, something else?
- Where's the existing single-item checkout flow currently implemented?
  (You'll be mirroring its patterns.)

---

## 1. Current state of the codebase

### Web repo (this one)

- **Location**: this repo (`sell-your-shelf` on GitHub:
  `jamesm-lgtm/sell-your-shelf`)
- **Stack**: Next.js 16.0.10 App Router, deployed on Vercel
- **Source of truth for**: web frontend, all Supabase Edge Functions (under
  `supabase/functions/`), DB migrations (`supabase/migrations/`)
- **`main` and `staging` branches are at the same SHA** (`913cf52` as of
  Phase 1B close-out)
- **Branch protection on `main`**: requires PR + a verified GitHub email on
  the committer. GitHub Push Protection is on — secrets in commits get
  blocked. Pushing a real `sb_secret_...` token will fail the push.

### Supabase

- **Prod project**: `vsnhrukqqmukkpqlyrhh` (`https://vsnhrukqqmukkpqlyrhh.supabase.co`)
- **Staging project**: `dbqlgknktoctbchxfsvu`
  (`https://dbqlgknktoctbchxfsvu.supabase.co`) — a real second project, not
  a branch. Staging Supabase project does **not** have the 6 captured prod
  migrations (`20260402*`–`20260415*`) applied; only `001`–`006` and
  `20260520000000` are on staging. Worth knowing if you `db push` against
  staging.
- **Migration tracking now matches the repo on prod** — 12 migrations total

### React Native app (inferred — verify with user)

- **Framework**: Expo (the `/auth/callback` web page deeplinks to
  `sellyourshelf://`, and `push_tokens.expo_push_token` is the storage
  column — both confirm Expo)
- **Push notifications**: **Expo Push API** (not OneSignal, despite an
  earlier brief's wording). All push payloads on the backend go to
  `https://exp.host/--/api/v2/push/send`.
- **Stripe**: the React Native Stripe SDK is presumably wired up since
  iOS already has single-item checkout in production. The web side uses
  `@stripe/react-stripe-js` + `@stripe/stripe-js`; RN would use
  `@stripe/stripe-react-native`. Confirm.
- **Android launch is fresh**: PRs #3 and #4 (commit hashes `26e82ec` +
  `2164607`) shipped Android-specific assets on 2026-05-17 (SHA-256
  fingerprint for App Links, Google Play parity). Android is live or
  about to be.
- **Auth flow**: the web's `/auth/callback` page just deep-links into the
  app — implying the auth flow happens entirely in the app, the web
  is buyer-only and guest-only.

### What lives where on the backend (you'll be calling all of these)

| Edge function | Purpose | Accepts |
|---|---|---|
| `create-payment-intent` | Single-item iOS checkout (legacy) | `listingId` |
| `create-order-payment-intent` | **Multi-item entry point — this is the one you wire** | `listingIds[]` + shipping address + optional `applyWallet` |
| `stripe-webhook` | Routes Stripe events; branches on `metadata.type === 'multi_item_order'` | (webhook) |
| `mark-shipped` | Marks a sale shipped | `transaction_id` OR `order_id` |
| `create-shipping-label` | ShipEngine call + stores label data | `transaction_id` OR `order_id` |
| `send-email` | Resend templates; detects multi-item by `data.items` array | `{type, to, data}` |
| `track-event` | Server + client analytics inserts | event batch |

`_shared/handle-order-paid.ts` and `_shared/expo-push.ts` are the shared
modules. The post-payment work (mark paid, mark listings sold, resolve
guest buyer, system message, push, email) lives in `handle-order-paid`.
Both the wallet-only path (run in-process from create-order-payment-intent)
and the card path (run from stripe-webhook) call into it — single source
of truth for "what happens when an order pays."

---

## 2. Architecture decisions Phase 1B locked in (apps must respect these)

### Two parallel transaction models, both live in prod

- **Legacy single-item** (iOS today): `transactions` row per sale. One book,
  one row. Status: `paid → shipped`. Phase 1B did NOT touch this — the iOS
  app's current code path continues to work unchanged after the promotion.
- **Multi-item** (web today, apps next): `orders` row per checkout + one
  `order_items` row per book. Status: `payment_pending → paid → shipped →
  delivered → completed → cancelled`. **This is the model the apps need to
  produce when the user checks out a basket.**

### The `unified_sales` view exists so seller-facing surfaces work for both

```sql
CREATE VIEW unified_sales AS
  SELECT 'transaction:' || id, 'transaction' AS source, ... FROM transactions
  UNION ALL
  SELECT 'order_item:' || id, 'order_item' AS source, ... FROM order_items JOIN orders;
```

A seller's "your sales" screen should read from `unified_sales`, not from
`transactions` directly. Then it works whether the sale came from the
legacy single-item or new multi-item flow.

The buyer's "your orders" screen has the same need: union `transactions`
where `buyer_id = me` with `orders` where `buyer_id = me`. There's no
pre-built view for the buyer side yet — could be added if useful.

### Wallet = Stripe Connect balance, not a DB column

`user_wallets.available_balance_gbp` is a **cached column** that nothing
currently writes to (the `increment_seller_earnings` RPC the webhook calls
silently fails; this is a pre-existing issue). The actual wallet balance
is fetched at request time via `stripe.balance.retrieve({stripeAccount})`.

**Implication for the apps**: when showing "use wallet?" to a buyer:
1. Check if they have a Stripe Connect account (`user_wallets.stripe_account_id`
   not null AND `stripe_account_status = 'enabled'`)
2. Fetch their live balance via Stripe API (or via `create-order-payment-intent`,
   which does this server-side if `applyWallet: true` is passed)
3. **Don't read `user_wallets.available_balance_gbp`** — it's stale

The wallet flow only works for buyers who are also sellers (because the
"wallet" is their Stripe Connect Express balance from past sales). Pure
buyers can't use it — same as web.

### Order lifecycle and what triggers each transition

| From → to | Triggered by | Side effects |
|---|---|---|
| (new) → `payment_pending` | `create-order-payment-intent` (atomic insert with PI creation) | Stripe PI created; basket lock not held |
| `payment_pending` → `paid` | `stripe-webhook` on `payment_intent.succeeded` OR in-process for wallet-only | Listings sold, system message, emails, pushes, analytics, Loops sync via DB trigger |
| `paid` → `shipped` | `mark-shipped(order_id)` | Tracking on order, shipped email + push, system message |
| `paid` → `cancelled` | Stripe PI creation failure or wallet debit failure during `create-order-payment-intent` | None (order isolated) |
| `shipped` → `delivered` | **Not implemented (Phase 1C scope)** | — |
| `delivered` → `completed` | **Not implemented (Phase 1C scope)** | — |
| `payment_pending` → `cancelled` | Not currently — no refund handler | — |

### Loops triggers — multi-item is covered

A DB trigger `loops_order_paid` fires on `orders` UPDATE when status flips
to `paid`. It mirrors the existing `loops_sale_purchase` trigger on
`transactions` INSERT. So multi-item buyers/sellers get `hasPurchased` /
`hasSold` flipped in Loops just like single-item ones do. No app-side work
needed for this.

### Shipping math (apps should mirror exactly)

```
subtotal = sum of asking_price_gbp across all items
shipping = 0 if subtotal >= £10, else £2.50 (flat — no tiers)
total = subtotal + shipping
soft warn at 5kg (UI only; checkout still allowed)
hard cap at 10kg (block checkout; reject in create-order-payment-intent)
```

Per-book weight heuristic (mirror in app — these are in
`supabase/functions/_shared/expo-push.ts`... actually no, in
`app/lib/basket.ts` and `create-order-payment-intent/index.ts`):

```
paperback: 280g
hardback: 800g
unknown: 350g
+ 150g per parcel for packaging
```

Per-book platform fee:
- If book price < £5: £1 flat
- If book price >= £5: 20% of book price

Seller payout per book = book price − platform fee. Total payout for an
order = sum across items.

### Push notification copy (apps must produce, backend already sends)

Backend already fires the right copy in `handle-order-paid` and
`mark-shipped`. The apps need to **receive and route** these:

- Buyer payment confirmed: title `"Order confirmed ✓"`, deep-link
  `{ screen: 'Orders', orderId }`
- Buyer shipped: title `"Your order has shipped! 📦"`, same deep link
- Seller new sale: title `"You made a sale! 🎉"`, deep link
  `{ screen: 'Orders', orderId }`

The apps need to handle `data.orderId` and navigate accordingly. Today's
single-item pushes only set `{ screen: 'Orders' }` (no order id), so the
deep-link handler probably needs an update to honour the id.

### System messages — one per milestone, not per item

Inserted by the backend into the `conversations` / `messages` tables:

- On payment: `"Purchased N books for £X — title1, title2, ..."` truncated
  at 200 chars, `event = 'purchase'`
- On shipped: `"Order shipped — tracking: ABC123"` or `"Order shipped"` if
  no tracking, `event = 'shipped'`

The apps' chat UI should already render `message_type = 'system'` entries
specially; the new `event` values just need to look sensible in the thread.

---

## 3. Five outstanding items from Phase 1B

| # | Item | Status | Effort |
|---|---|---|---|
| 1 | **iOS / Android multi-item** | **This phase — primary focus** | 3–5 sessions |
| 2 | Refund handler | Deferred to Phase 1C+ | ~1 session |
| 3 | `increment_seller_earnings` RPC missing on prod | Pre-existing, predates 1B; cached seller balances stay frozen | ~30 min |
| 4 | Hardcoded Loops bearer token in `pg_proc` / `cron.job` | Redacted from repo, real value still on prod | ~30 min (rotate to Supabase Vault + update function calls) |
| 5 | `delivered` / `completed` state transitions | Not wired — orders sit at `shipped` indefinitely | ~1 session (needs carrier tracking webhook integration too) |

For this app phase, only #1 is in scope. Items 2–5 are intentionally
deferred and won't block app multi-item.

---

## 4. 24-hour watch list (still relevant for the apps phase)

From `docs/phase-1b-prod-runbook.md` §5, applicable to app rollout too:

```sql
-- Orders stuck in payment_pending for >5 minutes — should always be 0
SELECT id, created_at, stripe_payment_intent_id
FROM orders
WHERE status = 'payment_pending' AND created_at < now() - interval '5 minutes';

-- Are paid orders matching Stripe charges? Compare to Stripe Dashboard
SELECT count(*) FROM orders WHERE status = 'paid' AND paid_at > now() - interval '1 hour';

-- Are listings being marked sold correctly?
SELECT count(*) FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN listings l ON l.id = oi.listing_id
WHERE o.status = 'paid' AND l.status != 'sold';
-- Should always be 0.
```

Prod log locations:
- **Vercel logs**: `https://vercel.com/james-mumbersons-projects/sell-your-shelf-app/logs`
- **Supabase function logs**: `https://supabase.com/dashboard/project/vsnhrukqqmukkpqlyrhh/functions/<function-name>/logs`
- **Resend dashboard**: deliverability + bounce rate per template
- **Stripe Dashboard** (live mode): payment + webhook delivery success rate

---

## 5. Deployment runbook location

`docs/phase-1b-prod-runbook.md` — written for the Phase 1B web promotion
but the structure (pre-flight → strict-order steps → rollback per step →
smoke test → 24h watch → known non-blockers → failure-mode table) is
exactly the template to follow for the app rollout.

Specific differences when promoting the app:
- App store / Play store release flow replaces Vercel deploy
- Backend artifacts (edge functions, migrations) shouldn't change much —
  Phase 1B already did the backend lift. The apps mostly call existing
  endpoints.
- TestFlight + Play Console internal testing is the equivalent of the
  staging smoke test. Use it.

---

## 6. The 5 sessions estimate — what each would cover

These are loose. The "best case 3 / realistic 5" split assumes you have
visibility into the RN repo. If the user hands you a code paste at a time,
double the count.

### Session 1 — Buyer basket model (RN parity with web)

Mirror what `app/lib/basket.ts` does on web, in whatever state-management
pattern the RN app uses (Zustand, MobX, Context, whatever):
- Storage adapter (AsyncStorage if Expo, MMKV if bare RN, or whatever's there)
- Basket type: `{ sellerId, sellerUsername, items: [{listingId, title, author, priceGbp, format, coverUrl, category}] }`
- Operations: `addItem(item, source)`, `removeItem(listingId, source)`, `addItems(items, source)`, `clearBasket()`
- Single-seller invariant + cross-seller modal
- Threshold state machine: `empty | below | unlocked | oversize | exceeded`
- Suggestion engine (rule-based, port from `buildSuggestions()`)

Then the UI:
- Add-to-basket button on book cards (toggle to "✓ Added — Remove?")
- Persistent basket widget pinned bottom of viewport (or top tab badge,
  whatever fits RN nav patterns)
- Threshold-gap assistant on the shelf screen
- Basket detail screen (`/basket` equivalent)

### Session 2 — Checkout + Stripe RN integration

- Checkout screen: shipping address form (use saved address if any),
  optional wallet toggle if buyer has Stripe Connect balance > 0
- `POST /functions/v1/create-order-payment-intent` with the basket
- Handle 409 stale-items response — show remove-and-retry UI
- If `requires_payment: false` (wallet covered total): show success state
  immediately, skip Stripe RN sheet
- If `requires_payment: true`: present Stripe RN Payment Sheet with the
  client_secret
- On payment success: navigate to order confirmation screen
- Auto-poll the order status if the screen renders before the webhook
  fires (see §7 — gotcha)

### Session 3 — Seller side + order detail

- Order detail screen using `unified_sales` view as the source: works for
  both legacy single-item and new multi-item
- "Generate shipping label" button → `POST /create-shipping-label` with
  `order_id`. Display the returned QR code and handoff code.
- "Mark as shipped" button → `POST /mark-shipped` with `order_id`
- Buyer-side order detail screen for tracking + status
- Loops triggers on the backend already fire — apps just need to handle
  the deep links from pushes

### Sessions 4–5 — Buffer

Realistically used for:
- Whatever the RN architecture surprises with (state library quirks,
  navigation re-renders, hydration on app cold start, etc.)
- Apple Pay setup if not already on the existing single-item flow
- Native push handler updates to read `data.orderId` and route correctly
- TestFlight / internal Play test cycle
- Bug-fixing whatever's caught in dogfood
- Edge cases on iOS / Android divergence (Android Soft Keyboard input
  modes, iOS PKPaymentRequest setup, etc.)

If the app already has a polished single-item buyer flow, sessions 1 + 2
mirror it closely — same data shapes, same patterns, just N items instead
of 1.

---

## 7. Subtle things that took the Phase 1B build hours

Read these before you start. Each one of these was a real bite during the
web build and at promotion. The apps will likely run into the same shape
of issue.

### 7.1 The migration drift trap

Phase 1B's prod promotion was blocked because **6 migrations had been
applied directly to prod (via Studio or earlier sessions) without their
`.sql` files being in the repo**. The Supabase CLI refused `db push` until
those migrations were captured locally with matching timestamp names
(`20260402000000_fuzzy_book_search.sql` etc.).

**If you see `Remote migration versions not found in local migrations
directory` when running `supabase db push`**: stop. Don't run
`migration repair --status reverted` (the CLI's default suggestion) — it
loses audit trail. Instead, query `supabase_migrations.schema_migrations`
via Studio SQL Editor and capture each unknown migration as a properly-
named local file. See PR #5 on this repo for the pattern.

### 7.2 GitHub Push Protection blocks real secrets

The Loops migrations on prod contain a hardcoded `sb_secret_...` bearer
token in plain text. Pushing the captured `.sql` files to GitHub got
blocked by Push Protection. **Always redact secrets to a placeholder
like `<REDACTED — see Supabase project secrets vault>` before committing
captured prod migrations.** The migration files end up an inaccurate
mirror of what's literally in prod, but the secret stays out of git.

### 7.3 `increment_seller_earnings` doesn't exist on prod, never has

The webhook calls `supabase.rpc("increment_seller_earnings", ...)` on
every paid order and catches the resulting error with a
`console.log("⚠️ Wallet update skipped (RPC may not exist)")`. The
function genuinely doesn't exist. The `user_wallets.available_balance_gbp`
column has been frozen for as long as that has been the case. **Don't
read this column from the apps for "your earnings" — read Stripe balance
directly or recompute from paid orders.**

### 7.4 `temp_checkout_sessions.password_hash` is misleading

The column is named `_hash` but it actually stores **plaintext** passwords
that the user types during web guest checkout. The webhook reads it back
and passes it verbatim to `supabase.auth.admin.createUser({ password })`,
which expects plaintext. The hashing happens on the auth.users side
inside Supabase. **The web flow trusts that the column's contents never
leave the table except via the webhook's createUser call. Don't expose
this column in any RLS-exposed view.** Apps don't directly touch
`temp_checkout_sessions` — they don't have a "guest" flow, every app
user has an account.

### 7.5 Wallet is Stripe Connect balance, not what `user_wallets` suggests

This caught the web phase out for hours. The brief said "call existing
wallet debit RPC" — there's no such RPC. The "wallet" is the buyer's own
Stripe Connect Express account balance, charged via
`stripe.charges.create({ source: connect_account_id })`. Then a separate
`stripe.transfers.create({ destination: seller_connect_account_id })`
moves the seller's portion of that into their Connect account.

If you implement "use wallet" in the app, mirror this exactly — see
`create-payment-intent/index.ts` (single-item) and
`create-order-payment-intent/index.ts` (multi-item) for the dance.

### 7.6 Stripe SDK v17 narrowed `apiVersion` type

If you use the Node Stripe SDK in scripts, **omit `apiVersion`** in the
constructor. v17 narrowed the type to a single literal that matches the
SDK's built-in default. Setting `apiVersion: '2023-10-16'` (the value
the edge functions use) fails the TS check on Vercel even though it
works at runtime. The SDK uses its default if you omit — always
type-safe.

### 7.7 Next.js dynamic route slug name collisions are runtime-only bugs

We had `/order/[transactionId]/page.tsx` (legacy single-item order
detail) and added `/order/[id]/confirmation/page.tsx` (new multi-item).
Same parent path `/order/`, different dynamic slug names. **`next build`
does not catch this.** Every SSR-rendered page (including unrelated
pages like `/`) timed out at 30s in production because the function
worker crashed on cold-start with `Error: You cannot use different slug
names for the same dynamic path ('id' !== 'transactionId')`.

If the apps use file-system routing too (Expo Router), the same trap
applies — keep dynamic segment names consistent under a shared parent.

### 7.8 The web confirmation page polls because of a real race

The Stripe Elements `confirmPayment({ return_url })` redirects the buyer
to the confirmation page within ~500ms of the charge succeeding. The
webhook arrives ~1–2s later. If the confirmation page renders before the
webhook lands, the order is still `payment_pending` — the buyer sees a
"Confirming…" state.

The web fixed this with `router.refresh()` polling every 2s for up to
40s. **The apps will hit the same race.** Plan for either:
- Polling the order via Supabase realtime subscriptions (cheap with
  Supabase Realtime)
- Re-fetching the order on a timer until status flips out of
  `payment_pending`
- Or: don't show the confirmation screen until the app sees the order
  status update (block on the Stripe SDK's payment-confirmed callback
  AND the order-status confirmation)

### 7.9 Vercel deployment auth wall hangs after sign-in

If a Vercel preview deploy is set to require auth (`Standard Protection`
in Deployment Protection settings), the user sometimes lands on a
"✓ Authenticated" screen that hangs indefinitely instead of redirecting
to the actual app. This is a Vercel-side flake; the only reliable fix is
to **turn off Deployment Protection on preview deploys** at the project
level. Not relevant for production but worth flagging if the apps phase
needs a staging URL.

### 7.10 Stripe test Connect accounts need specific test values

If you need a fresh Stripe Connect account for testing (e.g. for an app
seller account), Stripe's "instant-verify" test values are:

```
individual.id_number = '000000000'
individual.dob = { day: 1, month: 1, year: 1901 }
individual.address.line1 = 'address_full_match'
external_account = { bank_account with account_number: '00012345', routing_number: '108800' }
```

See `scripts/create-test-connect-account.ts` for a working script.
`charges_enabled` doesn't flip to true immediately after creation — wait
~5–10s then retrieve again.

### 7.11 The cross-seller modal logic

The basket only holds books from one seller. If a buyer is on Seller A's
shelf with items in basket and tries to add from Seller B, a modal
appears with three options: Checkout A's basket, Clear basket, Cancel.
**"Clear basket" does NOT auto-add the book they were trying to add** —
they must re-click. This is a deliberate UX call from the web brief.
Mirror it in the apps.

### 7.12 Phase 1B promotion order matters precisely

If you're ever promoting backend changes alongside the apps, follow this
order strictly (this bit us once on staging):
1. Apply migration on prod Supabase
2. Deploy updated edge functions to prod Supabase (in dependency order:
   `send-email` first since others call it, then everything else, then
   any genuinely-new function last)
3. Verify the live Stripe webhook is healthy
4. Verify Vercel env vars (or app stores' env equivalents)
5. THEN merge code to main / release build to stores

Doing them out of order causes specific predictable failures — see the
"Common failure modes" table in `docs/phase-1b-prod-runbook.md`.

---

## 8. Quick reference

- **Phase 1B production runbook**: `docs/phase-1b-prod-runbook.md`
- **Shared edge function helpers**: `supabase/functions/_shared/`
- **Multi-item entry point**: `supabase/functions/create-order-payment-intent/index.ts`
- **Order lifecycle handler**: `supabase/functions/_shared/handle-order-paid.ts`
- **Web basket lib (mirror for app)**: `app/lib/basket.ts`
- **Web checkout flow (reference)**: `app/components/CheckoutFlow.tsx`
- **Phase 1B promotion record**: PR #5 on `jamesm-lgtm/sell-your-shelf`
- **Test Connect account script**: `scripts/create-test-connect-account.ts`
- **Test webhook regression script**: `scripts/test-legacy-webhook.ts`

---

End of handoff. Confirm app repo structure with the user, then start
with session 1.
