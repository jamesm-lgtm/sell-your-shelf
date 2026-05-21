-- Captured from prod 2026-05-20. Already applied; tracked for audit.
--
-- NOTE (flag 2 from the promotion runbook discussion): this migration
-- contains a hardcoded service-role bearer token in the cron schedule.
-- Rotation is tracked as a separate follow-up; not a blocker for Phase 1B.

-- Loops sync retry queue
CREATE TABLE IF NOT EXISTS public.loops_sync_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  properties jsonb NOT NULL,
  attempts integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  next_retry_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loops_sync_queue_retry
  ON loops_sync_queue(next_retry_at) WHERE attempts < 5;

ALTER TABLE public.loops_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.loops_sync_queue;
CREATE POLICY "Service role full access"
  ON public.loops_sync_queue FOR ALL
  USING (auth.role() = 'service_role');

-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule nightly Loops sync at 02:00 UTC
SELECT cron.schedule(
  'loops-nightly-sync',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url := 'https://vsnhrukqqmukkpqlyrhh.supabase.co/functions/v1/loops-nightly-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <REDACTED — see Supabase project secrets vault>"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
