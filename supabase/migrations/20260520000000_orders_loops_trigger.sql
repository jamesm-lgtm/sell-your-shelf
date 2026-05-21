-- Phase 1B follow-up: mirror the `loops_sale_purchase` trigger on the new
-- `orders` table so multi-item buyers/sellers also get hasSold / hasPurchased
-- flipped in Loops.
--
-- The legacy trigger (loops_sale_purchase) fires on `transactions` INSERT.
-- For multi-item orders we never write to `transactions` — payments land in
-- `orders` with status='payment_pending' on creation, then transition to
-- status='paid' via the stripe-webhook (or in-process for wallet-only).
-- So the equivalent moment is an UPDATE where status transitions to 'paid'.
--
-- Depends on `internal_sync_to_loops(uuid, jsonb)` which was created by
-- 20260415000000_loops_event_triggers. Migration ordering ensures that
-- migration runs first.

CREATE OR REPLACE FUNCTION trigger_loops_order_paid()
RETURNS trigger AS $$
BEGIN
  -- Only fire on the transition INTO 'paid' — not on subsequent updates
  -- like 'shipped' / 'delivered' / 'cancelled', and not on no-op writes.
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Seller: hasSold
    IF NEW.seller_id IS NOT NULL THEN
      PERFORM internal_sync_to_loops(
        NEW.seller_id,
        jsonb_build_object('hasSold', true)
      );
    END IF;

    -- Buyer: hasPurchased
    IF NEW.buyer_id IS NOT NULL THEN
      PERFORM internal_sync_to_loops(
        NEW.buyer_id,
        jsonb_build_object('hasPurchased', true)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loops_order_paid ON orders;
CREATE TRIGGER loops_order_paid
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_loops_order_paid();
