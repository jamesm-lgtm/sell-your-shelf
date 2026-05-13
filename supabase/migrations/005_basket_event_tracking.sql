-- Phase 1A: server-side bot / IP tracking for the events table.
--
-- Adds the three columns the track-event edge function will populate from
-- request headers (user_agent, ip_hash, is_bot) so we can filter bot traffic
-- out of analytics queries and group anonymous activity by approximate IP
-- without storing raw IPs.
--
-- Additive and nullable so existing inserts (mobile, current web) keep working.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash    TEXT,
  ADD COLUMN IF NOT EXISTS is_bot     BOOLEAN DEFAULT FALSE;

-- Most analytics queries will want "real" traffic only — index lets the
-- planner skip the bot rows cheaply.
CREATE INDEX IF NOT EXISTS events_is_bot_created_idx
  ON events (is_bot, created_at DESC);

-- Optional: same coverage for the other tracking tables so funnels across
-- listing_views / shelf_visits / events can use a consistent bot filter.
ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_bot  BOOLEAN DEFAULT FALSE;

ALTER TABLE shelf_visits
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_bot  BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS listing_views_is_bot_created_idx
  ON listing_views (is_bot, created_at DESC);

CREATE INDEX IF NOT EXISTS shelf_visits_is_bot_created_idx
  ON shelf_visits (is_bot, created_at DESC);
