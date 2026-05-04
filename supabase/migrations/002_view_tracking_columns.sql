-- Add columns the /api/listing-view and /api/shelf-visit routes have been
-- trying to insert since 2026-03-27. Without these, every insert errored
-- with "column does not exist" and the error was swallowed at every layer.

ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS country    TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE shelf_visits
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS country    TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS listing_views_session_id_idx ON listing_views (session_id);
CREATE INDEX IF NOT EXISTS shelf_visits_session_id_idx  ON shelf_visits  (session_id);
