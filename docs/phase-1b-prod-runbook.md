# Phase 1B — Production Promotion Runbook

This document walks through promoting Phase 1B (multi-item checkout) from
`staging` to production. It's intentionally precise about ordering because
several steps fail loudly and visibly if done in the wrong sequence.

**Estimated total time:** 45–60 minutes including smoke tests.
**Recommended window:** weekday off-peak (e.g. Wednesday 10am UK), with the
team reachable. Avoid weekends and evenings.

---

## 1. What's being promoted

### Database (Supabase project `vsnhrukqqmukkpqlyrhh`)

- One additive migration: `006_orders_multi_item.sql`. Creates two new tables
  (`orders`, `order_items`) and one view (`unified_sales`). No changes to
  existing tables, no risk to mobile / single-item flow.

### Supabase Edge Functions (deployed to prod project)

| Function | Type of change | Notes |
|---|---|---|
| `send-email` | Updated | Adds multi-item template payloads; legacy single-item payloads unchanged |
| `stripe-webhook` | Updated | Adds `metadata.type === 'multi_item_order'` branch; existing single-item branch unchanged |
| `mark-shipped` | Updated | Accepts `order_id` or `transaction_id`; legacy `transaction_id` flow unchanged |
| `create-shipping-label` | Updated | Accepts `order_id` or `transaction_id` with scaled weight; legacy flow unchanged |
| `create-order-payment-intent` | **NEW** | Web multi-item checkout entry point. No legacy equivalent. |

All five share `_shared/handle-order-paid.ts` and `_shared/expo-push.ts`.
Supabase bundles `_shared` automatically with each function deploy.

### Web frontend (Vercel → main branch)

- New routes: `/checkout`, `/orders/[id]`, `/orders/[id]/confirmation`
- Modified components: `BasketProvider`, `BasketWidget`, `BasketPageClient`,
  `ShelfGrid`, `app/[username]/page.tsx`, `app/listing/[id]/page.tsx`
- New components: `CheckoutFlow`, `OrderConfirmationClient`, `AddToBasketButton`
- Basket lib refactor: shipping is now flat £2.50 with soft warn at 5kg /
  hard cap at 10kg (no per-tier rates)

### Stripe (production account)

- The existing live-mode webhook endpoint that already feeds `stripe-webhook`
  with `payment_intent.succeeded` events covers Phase 1B automatically — no
  new endpoint required. **Verify it's still active and subscribed to
  `payment_intent.succeeded` before promoting.**

### Secrets / env vars

- `STRIPE_WEBHOOK_SECRET` on prod Supabase: **already set** (the existing
  iOS single-item flow uses it). No change.
- `RESEND_API_KEY` on prod Supabase: **already set**. No change.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on prod Vercel: **already set with the
  live `pk_live_...` value**. Verify it isn't accidentally a test key.

---

## 2. Pre-flight checklist (do these BEFORE starting)

Run through this list. Don't start the promotion if any item is unchecked.

- [ ] Staging end-to-end has been verified within the last 7 days. Minimum:
      one successful card purchase on staging that crossed the free-shipping
      threshold and lit up the order_paid analytics event.
- [ ] `git log origin/staging..origin/main` is non-empty *only* if you
      intend to drop those commits — usually you want `git diff origin/main
      origin/staging` to confirm the diff matches what's documented above.
- [ ] You can reach the prod Supabase project via the CLI:
      `supabase functions list --project-ref vsnhrukqqmukkpqlyrhh`
      should return the existing function list.
- [ ] You have access to the **prod** Stripe dashboard in **live mode**.
- [ ] You have access to Vercel's prod environment for the `sell-your-shelf`
      project.
- [ ] Resend account is healthy (no recent deliverability issues, sending
      domain warm).
- [ ] At least one team member other than the deployer is available for the
      next 60 minutes in case of rollback.

---

## 3. Promotion steps (in strict order)

### Step 1 — Run migration 006 on prod Supabase

**Why first:** every downstream piece (webhook, edge functions) reads/writes
`orders` and `order_items`. If they hit prod before the tables exist, every
multi-item payment causes a 500 and a stuck `payment_pending` charge.

```bash
# Link CLI to prod
supabase link --project-ref vsnhrukqqmukkpqlyrhh

# Confirm what will apply
supabase db push --dry-run
#  → should list ONLY 006_orders_multi_item.sql
#  → if it lists older migrations too, something is wrong — STOP and investigate

# Apply
supabase db push
```

**Verify it landed:**

```bash
# Probe the new tables (no rows yet, just confirms they exist)
SERVICE_KEY=<prod service role key>
curl -s "https://vsnhrukqqmukkpqlyrhh.supabase.co/rest/v1/orders?select=*&limit=0" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Range: 0-0" -H "Prefer: count=exact" -i | grep -i content-range
#  → should return: content-range: */0

curl -s "https://vsnhrukqqmukkpqlyrhh.supabase.co/rest/v1/unified_sales?select=*&limit=0" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Range: 0-0" -H "Prefer: count=exact" -i | grep -i content-range
#  → returns the count of existing transactions + 0 new orders
```

**Rollback:** the migration is additive. If you need to revert:
```sql
DROP VIEW IF EXISTS unified_sales;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
```
Safe to run because no historical data exists in these tables on first
deploy. Don't rollback once a real order has been written.

**Time:** ~2 minutes including verification.

---

### Step 2 — Deploy edge functions to prod Supabase

**Why this order:** the new function (`create-order-payment-intent`) is
deployed *last* so the order of the system is always consistent:
- Before: tables exist + updated functions exist + new function absent
- After: everything exists.

The intermediate "updated functions deployed, new function missing" state is
harmless because nothing calls the new function yet — the web frontend
hasn't been promoted.

Deploy in this order (each is one command, each is idempotent):

```bash
# 1. send-email — must be first because stripe-webhook + mark-shipped invoke it
supabase functions deploy send-email --project-ref vsnhrukqqmukkpqlyrhh --no-verify-jwt

# 2. stripe-webhook
supabase functions deploy stripe-webhook --project-ref vsnhrukqqmukkpqlyrhh --no-verify-jwt

# 3. mark-shipped
supabase functions deploy mark-shipped --project-ref vsnhrukqqmukkpqlyrhh --no-verify-jwt

# 4. create-shipping-label
supabase functions deploy create-shipping-label --project-ref vsnhrukqqmukkpqlyrhh --no-verify-jwt

# 5. create-order-payment-intent — the new one, last
supabase functions deploy create-order-payment-intent --project-ref vsnhrukqqmukkpqlyrhh --no-verify-jwt
```

**Verify each landed:**

After each deploy, hit the function with an intentionally-bad request to
confirm it's the new code (each new version has clearer error messages than
the prior one for invalid input):

```bash
# Example for stripe-webhook
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://vsnhrukqqmukkpqlyrhh.supabase.co/functions/v1/stripe-webhook" \
  -H "Content-Type: application/json" -d '{}'
#  → 400 "No signature" (means the new version is live)
```

**Critical check after step 2.2 (stripe-webhook):** fire a test event
through the existing live Stripe webhook to make sure single-item iOS
payments still process correctly. Send a small test purchase from iOS or
use `stripe trigger payment_intent.succeeded --secret <prod sk_live>` if
you have the Stripe CLI installed. Verify the corresponding `transactions`
row flips to `paid` in prod. If it doesn't, ROLLBACK immediately (see
below) — you've broken the legacy flow.

**Rollback per function:** redeploy the previous version from the prod
function's history page. Vercel/Supabase's deploy UI keeps the previous
version's source. Or check out the prior commit on `staging` and redeploy
that specific function.

**Time:** ~5 minutes for all five.

---

### Step 3 — Verify Stripe live webhook is healthy

**No new endpoint to create** — Phase 1B uses the existing webhook that
already routes `payment_intent.succeeded` to `stripe-webhook`.

Verify in the Stripe Dashboard (live mode):

1. Developers → Webhooks
2. Find the endpoint pointing at `https://vsnhrukqqmukkpqlyrhh.supabase.co/functions/v1/stripe-webhook`
3. Confirm:
   - Status: enabled
   - Listening to "Your account" (not just Connected accounts)
   - Subscribed events include `payment_intent.succeeded`
4. Open the "Logs" tab for this endpoint and confirm recent events show
   `200` responses (i.e. the legacy single-item flow is working)

If the endpoint isn't subscribed to `payment_intent.succeeded`, fix that
before continuing. If you have to add it, copy the signing secret from the
endpoint detail page and update `STRIPE_WEBHOOK_SECRET` on prod Supabase
before continuing.

**Time:** ~3 minutes.

---

### Step 4 — Verify Vercel prod environment

In the Vercel dashboard for the `sell-your-shelf` project:

- Settings → Environment Variables
- Confirm `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set on **Production**
  scope and the value starts with `pk_live_` (not `pk_test_`)
- Confirm `NEXT_PUBLIC_SUPABASE_URL` points at the **prod** project (URL
  contains `vsnhrukqqmukkpqlyrhh`, not `dbqlgknktoctbchxfsvu`)
- Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SECRET_KEY` are
  set on Production scope

**Time:** ~2 minutes.

---

### Step 5 — Merge `staging` → `main`

**This is the moment customers can hit `/checkout`.** Don't do this step
until 1–4 are confirmed.

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only origin/staging
# If --ff-only fails, something rebased main since you started — investigate
# rather than force-merging
git push origin main
```

Vercel will auto-deploy. Watch the build in the Vercel dashboard. Should
take ~1–2 minutes. Once Ready, the new checkout flow is live for real
customers.

**Rollback:** revert the merge commit and push:
```bash
git revert -m 1 <merge-commit-sha>
git push origin main
```
Vercel auto-deploys the revert. Customers see the pre-Phase-1B basket flow
(with the "coming soon" Checkout button) again. The edge functions deployed
in step 2 stay deployed but become unused — they're harmless.

**Time:** ~3 minutes including Vercel build.

---

## 4. Production smoke test (within 10 min of merge)

Do this from a personal device with a real card. The whole flow should
cost ~£5–10 and refund cleanly afterwards.

1. Open prod URL: https://www.sellyourshelf.com
2. Navigate to a real seller's shelf (one you don't own — pick someone with
   3–4 cheap books). Don't use your own shelf, you'll trip the
   self-purchase guard.
3. Add 2–3 books to the basket, aim for total £5–10 (below the free
   shipping threshold so we exercise the £2.50 shipping path).
4. Click Checkout
5. Fill the form with a real email you control, real address
6. Use a real credit/debit card (not a test card — this is live mode)
7. Pay
8. Verify:
   - [ ] Land on `/orders/[id]/confirmation` showing the success state
         (the page auto-polls so this should happen within 2–4 seconds)
   - [ ] You receive the `Order confirmed: N books from @seller` email
         within ~30 seconds
   - [ ] The seller receives a `You've sold N books to @you` email
         (ask them to confirm)
   - [ ] In Supabase prod SQL editor:
         ```sql
         SELECT id, status, total_gbp, paid_at FROM orders ORDER BY created_at DESC LIMIT 1;
         ```
         shows your order with status=`paid` and paid_at populated
   - [ ] Stripe Dashboard shows the charge as Succeeded
9. Issue a refund:
   - Stripe Dashboard → find the charge → click Refund → full amount
   - The order status in our DB **stays `paid`** — that's expected,
     Phase 1B doesn't handle refund events (deferred to Phase 1C+). The
     buyer gets their money back via Stripe; the seller's Connect balance
     is also reversed automatically.

**If anything in this list fails, follow rollback in step 5.**

---

## 5. What to watch in the first 24 hours

### Dashboards / log streams to keep open

- Supabase prod → Logs → filter `level:error` for `stripe-webhook` and
  `create-order-payment-intent`. Any new errors not seen on staging are
  red flags.
- Vercel prod → Logs → look for 500s on `/checkout`, `/orders/[id]`,
  `/orders/[id]/confirmation`.
- Resend dashboard → delivery rate for `order_confirmation`, `new_sale`,
  `order_shipped`. Watch for bounces (real buyer emails).
- Stripe Dashboard → Payments. Healthy multi-item charges should have
  metadata `{ type: 'multi_item_order', order_id: '...' }`.

### Queries to run periodically

```sql
-- Are paid orders matching Stripe charges? Count should equal the count
-- of Stripe Succeeded charges in the same window.
SELECT count(*) FROM orders WHERE status = 'paid' AND paid_at > now() - interval '1 hour';

-- Any orders stuck in payment_pending for >5 minutes? (race symptom,
-- or webhook delivery failure)
SELECT id, created_at, stripe_payment_intent_id FROM orders
WHERE status = 'payment_pending'
  AND created_at < now() - interval '5 minutes';

-- Are listings being marked sold correctly after orders pay?
SELECT count(*) FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN listings l ON l.id = oi.listing_id
WHERE o.status = 'paid' AND l.status != 'sold';
-- Should always be 0.
```

### Alerting

If you have Sentry/etc wired into the project, ensure the alert routing
includes the new function names (`create-order-payment-intent`, the
multi-item branch in `stripe-webhook`).

---

## 6. Known issues that are NOT blockers

These were flagged during Phase 1B implementation and are deferred to
future phases. They don't block promotion:

- **`increment_seller_earnings` RPC doesn't exist on prod.** Both the
  single-item and multi-item paths try to call it and silently log a
  warning when it fails. The cached `user_wallets.available_balance_gbp`
  column has been drifting for as long as this has been a problem — Phase
  1B doesn't make it worse. Fix tracked separately.
- **Refund handling not implemented.** Stripe `charge.refunded` events
  arrive at the webhook and are ignored. Refund the customer via Stripe
  dashboard and reconcile manually until Phase 1C+ adds proper handling.
- **iOS app still on single-item flow.** This is expected — iOS multi-item
  is a separate phase. The `transactions` table and legacy code paths are
  unchanged.
- **No delivered/completed state transitions implemented.** Orders sit at
  `shipped` indefinitely. Phase 1C+ will add `delivered` (from carrier
  tracking webhook) and `completed` (auto after N days delivered).

---

## 7. Common failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Migration fails with "relation already exists" | Re-running an already-applied step | Safe to skip; verify with `supabase migration list` |
| `create-order-payment-intent` 500 with "STRIPE_SECRET_KEY not configured" | Secret missing on prod | `supabase secrets set STRIPE_SECRET_KEY=sk_live_...` (use the existing prod live key) |
| `stripe-webhook` returns 400 "Invalid signature" on real events | `STRIPE_WEBHOOK_SECRET` wrong or rotated | Copy current signing secret from Stripe Dashboard → Webhook detail page → set via `supabase secrets set` |
| `/checkout` page renders but Stripe Elements form is missing | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` missing or accidentally `pk_test_...` on Production env | Set the live `pk_live_...` on Vercel Production env, redeploy |
| Order stays `payment_pending` after successful Stripe charge | Webhook didn't reach Supabase, or signature failed | Check Stripe Webhook logs for delivery attempts; check Supabase function logs. The order can be manually flipped with the shared `handleOrderPaid` handler invoked via a one-off script |
| Confirmation page hangs at "Confirming…" | Same root cause as above OR client-side polling is misbehaving | Hard refresh once; if persistent, check the order state via SQL |
| Buyer email not received | Resend bounce (invalid recipient) or `RESEND_API_KEY` missing | Check Resend dashboard for that order's recipient address |

---

## 8. Post-promotion housekeeping (the same day, but lower urgency)

- [ ] Update the team's onboarding doc to mention the multi-item flow and
      where the new checkout pages live.
- [ ] If staging-only credentials were used for testing (test cards, test
      Stripe Connect accounts), the staging environment can stay as-is —
      it remains the canary for the next phase.
- [ ] File a follow-up ticket for the refund handler (Phase 1C scope).
- [ ] File a follow-up ticket for the `increment_seller_earnings` RPC.
- [ ] Verify the production `events` table is receiving the new analytics
      events (`order_created`, `order_paid`, `order_shipped`,
      `checkout_initiated`, `checkout_stale_items_detected`) — these will
      need ~24h of real traffic to validate volumes against expectation.

---

## 9. Contact / escalation

- **Stripe issues** (failed webhooks, signature errors, declined cards):
  Stripe support + the team member who set up the Stripe Connect platform.
- **Supabase issues** (function deploy failures, schema migration errors,
  RLS surprises): Supabase support + check function logs first.
- **Resend issues** (deliverability): Resend dashboard + their support if
  recurring.
- **Vercel issues** (build failures, function timeouts): Vercel support
  is usually unnecessary — the logs tell the whole story.

End of runbook.
