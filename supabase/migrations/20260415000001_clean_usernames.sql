-- Captured from prod 2026-05-20. One-time data fix; already applied.
-- Tracked for audit. Idempotent (filter only matches dirty rows that
-- were cleaned in the original run).

-- Clean up existing usernames to match app validation rules
-- (lowercase, alphanumeric + underscore only)

-- Step 1: Replace spaces with underscores, strip all non-alphanumeric/underscore chars, lowercase
UPDATE public.users
SET username = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRIM(username),     -- trim leading/trailing whitespace
      '\s+', '_', 'g'     -- spaces → underscores
    ),
    '[^a-z0-9_]', '', 'g' -- strip everything else
  )
)
WHERE username ~ '[^a-z0-9_]'
  AND is_anonymous = false;

-- Step 2: Handle email-as-username — take the part before @ and clean it
UPDATE public.users
SET username = LOWER(
  REGEXP_REPLACE(
    SPLIT_PART(username, '@', 1),
    '[^a-z0-9_]', '', 'g'
  )
)
WHERE username LIKE '%@%'
  AND is_anonymous = false;
