-- Captured from prod 2026-05-20. Already applied; tracked for audit.

-- Communication preferences for email/push/sms consent management
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  channel text NOT NULL,  -- 'email', 'push', 'sms' (only 'email' used initially)
  opted_in boolean NOT NULL DEFAULT false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel)
);

-- RLS: users can read and update their own preferences
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON public.communication_preferences;
CREATE POLICY "Users can view own preferences"
  ON public.communication_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.communication_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.communication_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.communication_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.communication_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
DROP POLICY IF EXISTS "Service role full access" ON public.communication_preferences;
CREATE POLICY "Service role full access"
  ON public.communication_preferences FOR ALL
  USING (auth.role() = 'service_role');
