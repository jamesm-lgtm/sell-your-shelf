-- Extend listing_views, shelf_visits, and events with full tracking schema.
--
-- listing_views / shelf_visits: convert session_id UUID -> text, add user_id
-- and UTM fields, add platform check constraint and indexes.
--
-- events: additive only. The table is already populated by the mobile app, so
-- we can't drop+recreate or rename `properties` -> `metadata`. New columns are
-- nullable; tighten later once mobile is also writing them.

----------------------------------------------------------------------
-- listing_views
----------------------------------------------------------------------
ALTER TABLE listing_views ALTER COLUMN session_id TYPE TEXT USING session_id::text;

ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'listing_views'::regclass
      AND conname = 'listing_views_platform_check'
  ) THEN
    ALTER TABLE listing_views
      ADD CONSTRAINT listing_views_platform_check
      CHECK (platform IS NULL OR platform IN ('web','ios','android'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listing_views_user_id_created_idx
  ON listing_views (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_views_listing_id_created_idx
  ON listing_views (listing_id, created_at DESC);

----------------------------------------------------------------------
-- shelf_visits
----------------------------------------------------------------------
ALTER TABLE shelf_visits ALTER COLUMN session_id TYPE TEXT USING session_id::text;

ALTER TABLE shelf_visits
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shelf_visits'::regclass
      AND conname = 'shelf_visits_platform_check'
  ) THEN
    ALTER TABLE shelf_visits
      ADD CONSTRAINT shelf_visits_platform_check
      CHECK (platform IS NULL OR platform IN ('web','ios','android'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS shelf_visits_user_id_created_idx
  ON shelf_visits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shelf_visits_username_created_idx
  ON shelf_visits (username, created_at DESC);

----------------------------------------------------------------------
-- events (additive, nullable)
----------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS listing_id BIGINT REFERENCES listings(id),
  ADD COLUMN IF NOT EXISTS seller_id  UUID   REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS source     TEXT,
  ADD COLUMN IF NOT EXISTS platform   TEXT;

-- Every existing events row predates web tracking, so they all originated
-- from the mobile app.
UPDATE events SET platform = 'ios' WHERE platform IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'events'::regclass
      AND conname = 'events_platform_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_platform_check
      CHECK (platform IS NULL OR platform IN ('web','ios','android'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_session_id_created_idx
  ON events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_event_name_created_idx
  ON events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_id_created_idx
  ON events (user_id, created_at DESC);
