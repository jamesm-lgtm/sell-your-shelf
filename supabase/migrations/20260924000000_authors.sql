-- Author hub pages.
--
-- listings.author and books.author are CREDIT strings, not names. Live values
-- include "david walliams; illustrated by quentin blake" and "cgp books,
-- richard parsons". books.author_normalized exists but only lowercases, so
-- "david walliams" (103 copies) and "walliams, david" (31) stay apart. These
-- two tables are where a resolved name lives instead.
--
-- Populated by scripts/backfill-authors.ts. Nothing writes to them at request
-- time — the page reads, the backfill writes.

CREATE TABLE IF NOT EXISTS public.authors (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  -- 'person' gets /author/<slug>; 'publisher' gets /publisher/<slug>.
  -- CGP Books is the reason this column exists: 85+ copies, and the only
  -- cluster already ranking (position 7.5), because revision-guide buyers
  -- genuinely search by publisher. It is not an author and must not be
  -- presented as one.
  kind          TEXT NOT NULL DEFAULT 'person'
                CHECK (kind IN ('person', 'publisher', 'unknown')),
  -- How the name was settled, so a bad batch can be found and redone:
  --   'isbn'   — from ISBN enrichment, the authoritative source
  --   'rule'   — deterministic canonicaliser, unambiguous
  --   'model'  — resolved by Claude where the rules could not decide
  --   'manual' — a person corrected it
  source        TEXT NOT NULL DEFAULT 'rule'
                CHECK (source IN ('isbn', 'rule', 'model', 'manual')),
  -- Set when the model returned tokens absent from the input string, i.e. a
  -- possible invented correction. Such rows are NOT rendered until cleared.
  needs_review  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many on purpose: splitting credit strings is the whole point, so a
-- book by "David Walliams, Tony Ross" produces two rows here.
CREATE TABLE IF NOT EXISTS public.book_authors (
  book_id    BIGINT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  -- 0 is the primary credit; illustrators and co-authors follow. Lets the
  -- page show a book under its author without also filing it under the
  -- illustrator, if we later decide that is the right call.
  position   SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, author_id)
);

CREATE INDEX IF NOT EXISTS book_authors_author_idx ON public.book_authors (author_id);
CREATE INDEX IF NOT EXISTS authors_kind_idx ON public.authors (kind) WHERE needs_review = FALSE;

-- Live copy counts per author. The page's threshold (5+) is applied against
-- this, and so is the sitemap, so both agree by construction.
--
-- Counts ACTIVE listings only: a page exists because there is something to
-- buy. Drafts are private and removed listings are gone.
CREATE OR REPLACE VIEW public.author_live_counts AS
  SELECT
    a.id            AS author_id,
    a.slug,
    a.display_name,
    a.kind,
    COUNT(DISTINCT l.id)      AS live_copies,
    COUNT(DISTINCT l.book_id) AS live_titles,
    COUNT(DISTINCT l.user_id) AS sellers
  FROM public.authors a
  JOIN public.book_authors ba ON ba.author_id = a.id
  JOIN public.listings l      ON l.book_id = ba.book_id AND l.status = 'active'
  WHERE a.needs_review = FALSE
  GROUP BY a.id, a.slug, a.display_name, a.kind;

-- Both tables are public catalogue data — the same information already
-- rendered on every listing card. Read-only to everyone; writes are the
-- backfill's, which runs with the service role and bypasses RLS.
ALTER TABLE public.authors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authors_read ON public.authors;
CREATE POLICY authors_read ON public.authors
  FOR SELECT USING (true);

DROP POLICY IF EXISTS book_authors_read ON public.book_authors;
CREATE POLICY book_authors_read ON public.book_authors
  FOR SELECT USING (true);
