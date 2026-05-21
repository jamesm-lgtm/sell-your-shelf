-- Captured from prod 2026-05-20. Already applied; tracked for audit.
--
-- NOTE: contains the same hardcoded bearer token as 20260414000000.
-- Same rotation follow-up tracked. Not a Phase 1B blocker.
--
-- ============================================
-- Phase 3: Event-driven Loops syncs via database triggers
-- All triggers call sync-to-loops Edge Function via pg_net
-- ============================================

-- Helper: base URL and auth header for sync-to-loops calls
-- (same values used by the pg_cron nightly job)
CREATE OR REPLACE FUNCTION internal_sync_to_loops(p_user_id uuid, p_properties jsonb)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://vsnhrukqqmukkpqlyrhh.supabase.co/functions/v1/sync-to-loops',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <REDACTED — see Supabase project secrets vault>"}'::jsonb,
    body := jsonb_build_object('userId', p_user_id, 'properties', p_properties)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3a. Stripe onboarding updates
-- Fires when user_wallets row is updated (onboarding_step or stripe status changes)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_loops_seller_onboarding()
RETURNS trigger AS $$
BEGIN
  -- Only fire if onboarding_step or stripe_account_status actually changed
  IF (OLD.onboarding_step IS DISTINCT FROM NEW.onboarding_step)
     OR (OLD.stripe_account_status IS DISTINCT FROM NEW.stripe_account_status) THEN
    PERFORM internal_sync_to_loops(
      NEW.user_id,
      jsonb_build_object(
        'sellerEnabled', NEW.stripe_account_status = 'enabled',
        'onboardingStep', COALESCE(NEW.onboarding_step, 'not_started')
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loops_seller_onboarding ON user_wallets;
CREATE TRIGGER loops_seller_onboarding
  AFTER UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_loops_seller_onboarding();

-- ============================================
-- 3b. First draft created
-- Fires when a listing is inserted with status='draft'
-- Only syncs if this is the user's FIRST draft
-- ============================================
CREATE OR REPLACE FUNCTION trigger_loops_first_draft()
RETURNS trigger AS $$
DECLARE
  existing_count integer;
BEGIN
  IF NEW.status = 'draft' THEN
    SELECT COUNT(*) INTO existing_count
    FROM listings
    WHERE user_id = NEW.user_id
      AND status = 'draft'
      AND id != NEW.id;

    IF existing_count = 0 THEN
      PERFORM internal_sync_to_loops(
        NEW.user_id,
        jsonb_build_object('hasDrafts', true)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loops_first_draft ON listings;
CREATE TRIGGER loops_first_draft
  AFTER INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_loops_first_draft();

-- ============================================
-- 3c. First listing published
-- Fires when a listing status changes to 'active'
-- Only syncs if this is the user's FIRST active listing
-- ============================================
CREATE OR REPLACE FUNCTION trigger_loops_first_listing()
RETURNS trigger AS $$
DECLARE
  existing_count integer;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    SELECT COUNT(*) INTO existing_count
    FROM listings
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id != NEW.id;

    IF existing_count = 0 THEN
      PERFORM internal_sync_to_loops(
        NEW.user_id,
        jsonb_build_object('hasListings', true)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loops_first_listing ON listings;
CREATE TRIGGER loops_first_listing
  AFTER UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_loops_first_listing();

-- ============================================
-- 3d. Sale/purchase completed (single-item / transactions path)
-- Fires when a transaction is inserted (payment_intent.succeeded creates the row)
-- Syncs hasSold for seller, hasPurchased for buyer
-- ============================================
CREATE OR REPLACE FUNCTION trigger_loops_sale_purchase()
RETURNS trigger AS $$
BEGIN
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loops_sale_purchase ON transactions;
CREATE TRIGGER loops_sale_purchase
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_loops_sale_purchase();

-- ============================================
-- 3e. Email preference changed
-- Fires when communication_preferences is updated
-- Syncs emailOptIn and subscribed status
-- ============================================
CREATE OR REPLACE FUNCTION trigger_loops_email_preference()
RETURNS trigger AS $$
BEGIN
  IF NEW.channel = 'email' AND (OLD.opted_in IS DISTINCT FROM NEW.opted_in) THEN
    PERFORM internal_sync_to_loops(
      NEW.user_id,
      jsonb_build_object('emailOptIn', NEW.opted_in)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS loops_email_preference ON communication_preferences;
CREATE TRIGGER loops_email_preference
  AFTER UPDATE ON communication_preferences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_loops_email_preference();
