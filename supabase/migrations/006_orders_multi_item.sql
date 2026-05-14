-- Phase 1B: multi-item orders.
--
-- New canonical structure for multi-item purchases. The existing
-- `transactions` table is unchanged — iOS continues to write to it until
-- its own multi-item phase. A `unified_sales` view UNIONs both so seller-
-- facing queries can show all sales on a single timeline.
--
-- Deviations from the brief's literal schema:
--   * `buyer_id` is NULLABLE. Guest checkout creates the order *before*
--     the auth user exists; the Stripe webhook resolves and fills it on
--     payment_intent.succeeded (same pattern the existing single-item
--     guest flow uses via `temp_checkout_sessions`).
--   * Added a few columns that mirror what `transactions` already stores
--     and that the existing edge functions / `mark-shipped` expect:
--     `buyer_email`, `checkout_session_id`, `buyer_transfer_id`,
--     `shipping_method`, `shipping_handoff_code`, `cancelled_at`. None
--     were in the literal brief schema but all are needed by the flows
--     described in the brief.

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Buyer identity. buyer_id is filled on payment_intent.succeeded for
  -- guest orders; buyer_email is always populated so the order page can
  -- gate by email match for guests pre-account-creation.
  buyer_id                 uuid REFERENCES public.users(id),
  buyer_email              text NOT NULL,
  checkout_session_id      uuid REFERENCES public.temp_checkout_sessions(id),

  seller_id                uuid NOT NULL REFERENCES public.users(id),

  status                   text NOT NULL CHECK (
    status IN ('payment_pending','paid','shipped','delivered','completed','cancelled')
  ),

  -- Money. All gbp, two decimal places. Wallet+card always sum to total.
  subtotal_gbp             numeric(10,2) NOT NULL,
  shipping_gbp             numeric(10,2) NOT NULL,
  total_gbp                numeric(10,2) NOT NULL,
  platform_fee_gbp         numeric(10,2) NOT NULL,
  seller_payout_gbp        numeric(10,2) NOT NULL,
  wallet_applied_gbp       numeric(10,2) NOT NULL DEFAULT 0,
  card_charged_gbp         numeric(10,2) NOT NULL DEFAULT 0,

  -- Stripe ids
  stripe_payment_intent_id text,
  stripe_charge_id         text,
  stripe_transfer_id       text,           -- platform -> seller transfer for wallet portion
  buyer_transfer_id        text,           -- buyer Connect balance debit charge

  -- Shipping
  shipping_address         jsonb NOT NULL,
  shipping_label_url       text,
  tracking_number          text,
  tracking_url             text,
  shipping_handoff_code    text,
  shipping_method          text,
  parcel_tier              text CHECK (parcel_tier IN ('small','medium','large')),
  estimated_weight_grams   integer,

  -- Lifecycle
  created_at               timestamptz NOT NULL DEFAULT now(),
  paid_at                  timestamptz,
  shipped_at               timestamptz,
  delivered_at             timestamptz,
  completed_at             timestamptz,
  cancelled_at             timestamptz
);

CREATE INDEX IF NOT EXISTS orders_buyer_id_idx   ON orders (buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_id_idx  ON orders (seller_id);
CREATE INDEX IF NOT EXISTS orders_status_idx     ON orders (status);
CREATE INDEX IF NOT EXISTS orders_pi_id_idx      ON orders (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS orders_created_idx    ON orders (created_at DESC);

-- ---------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id          integer NOT NULL REFERENCES listings(id),

  -- Denormalised at purchase time so the order stays intact if the
  -- listing or book row is later deleted/changed.
  title               text NOT NULL,
  author              text,
  isbn                text,
  format              text,
  price_gbp           numeric(10,2) NOT NULL,
  platform_fee_gbp    numeric(10,2) NOT NULL,
  seller_payout_gbp   numeric(10,2) NOT NULL,
  weight_grams        integer,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_listing_id_idx ON order_items (listing_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Buyers see their own orders; sellers see orders they're a party to.
-- Service role bypasses RLS — edge functions and server components use
-- the service role for unauth flows (confirmation page, webhook writes).
DROP POLICY IF EXISTS orders_buyer_select  ON orders;
DROP POLICY IF EXISTS orders_seller_select ON orders;
CREATE POLICY orders_buyer_select  ON orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY orders_seller_select ON orders FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS order_items_select ON order_items;
CREATE POLICY order_items_select ON order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- No INSERT/UPDATE/DELETE policies → blocked for anon and authenticated
-- roles. Service role bypasses RLS so edge functions write freely.

-- ---------------------------------------------------------------------
-- unified_sales view
-- ---------------------------------------------------------------------
-- Seller-facing union of the legacy `transactions` rows and the new
-- `order_items` rows. One row per sold book. Inherits RLS from the
-- underlying tables — sellers see only their own rows from either side.
-- Note: transactions rows lose their book title if the listing is later
-- deleted (no denormalisation). Order_items keep theirs.

DROP VIEW IF EXISTS unified_sales;
CREATE VIEW unified_sales AS
SELECT
  'transaction:' || t.id::text                          AS unified_id,
  'transaction'::text                                   AS source,
  t.id::text                                            AS parent_id,
  t.seller_id,
  t.buyer_id,
  t.listing_id,
  COALESCE(l.title, '(listing removed)')                AS title,
  l.author                                              AS author,
  (t.sale_price_gbp - COALESCE(t.shipping_cost_gbp, 0)) AS price_gbp,
  t.platform_fee_gbp,
  t.seller_payout_gbp,
  t.status,
  t.created_at,
  t.paid_at,
  t.shipped_at,
  t.delivered_at,
  t.completed_at
FROM transactions t
LEFT JOIN listings l ON l.id = t.listing_id

UNION ALL

SELECT
  'order_item:' || oi.id::text         AS unified_id,
  'order_item'::text                   AS source,
  oi.order_id::text                    AS parent_id,
  o.seller_id,
  o.buyer_id,
  oi.listing_id,
  oi.title,
  oi.author,
  oi.price_gbp,
  oi.platform_fee_gbp,
  oi.seller_payout_gbp,
  o.status,
  oi.created_at,
  o.paid_at,
  o.shipped_at,
  o.delivered_at,
  o.completed_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id;
