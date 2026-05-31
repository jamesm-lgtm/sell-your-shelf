-- Captured from prod 2026-05-20. Already applied; tracked for audit.

-- Recommendation events tracking table
CREATE TABLE IF NOT EXISTS recommendation_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  listing_id INT8 REFERENCES listings(id),
  trigger_point TEXT,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  tapped_at TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_id ON recommendation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_trigger_point ON recommendation_events(trigger_point);

-- Add seller_welcome_shown column to users table for post-onboarding interstitial
ALTER TABLE users
ADD COLUMN IF NOT EXISTS seller_welcome_shown BOOLEAN DEFAULT false;
