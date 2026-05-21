-- Captured from prod 2026-05-20.
-- This migration was applied directly on prod (via Studio or another route)
-- before our local migration tracking caught up. Adding the file to source
-- control so the repo accurately reflects prod schema. Already applied;
-- the CLI sees this version on remote and skips it on `db push`.

-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast trigram lookups
CREATE INDEX IF NOT EXISTS idx_books_title_trgm
  ON books USING gin (title_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_books_author_trgm
  ON books USING gin (author_normalized gin_trgm_ops);

-- Book-level fuzzy search function
CREATE OR REPLACE FUNCTION search_books_fuzzy(
  search_term text,
  result_limit int DEFAULT 20
)
RETURNS TABLE (
  book_id bigint,
  title text,
  author text,
  cover_url text,
  category text,
  slug text,
  lowest_price numeric,
  copy_count bigint,
  similarity_score real
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  term text := lower(trim(search_term));
  words text[];
BEGIN
  -- Split search term into individual words (2+ chars)
  SELECT array_agg(w)
    INTO words
    FROM unnest(string_to_array(term, ' ')) AS w
   WHERE length(w) >= 2;

  RETURN QUERY
  SELECT
    b.id              AS book_id,
    b.title,
    b.author,
    b.cover_url,
    b.category,
    b.slug,
    MIN(l.asking_price_gbp) AS lowest_price,
    COUNT(l.id)        AS copy_count,
    (
      CASE
        -- Exact ISBN match
        WHEN b.isbn IS NOT NULL AND lower(b.isbn) = term THEN 1.0

        -- Exact substring match in title (high confidence)
        WHEN lower(b.title) ILIKE '%' || term || '%' THEN 0.9

        -- Exact substring match in author
        WHEN lower(b.author) ILIKE '%' || term || '%' THEN 0.85

        -- All search words found in title+author combined
        WHEN words IS NOT NULL AND array_length(words, 1) > 1 AND (
          SELECT bool_and(
            COALESCE(b.title_normalized, lower(b.title)) || ' ' ||
            COALESCE(b.author_normalized, lower(b.author))
            ILIKE '%' || w || '%'
          )
          FROM unnest(words) AS w
        ) THEN 0.8

        -- Trigram similarity fallback (genuine fuzzy match for typos)
        ELSE GREATEST(
          similarity(COALESCE(b.title_normalized, lower(b.title)), term),
          similarity(COALESCE(b.author_normalized, lower(b.author)), term),
          similarity(
            COALESCE(b.title_normalized, lower(b.title)) || ' ' ||
            COALESCE(b.author_normalized, lower(b.author)),
            term
          )
        )
      END
    )::real AS similarity_score
  FROM books b
  INNER JOIN listings l ON l.book_id = b.id
  INNER JOIN users u    ON l.user_id = u.id
  WHERE l.status = 'active'
    AND (u.deleted_at IS NULL)
    AND (u.username NOT ILIKE ANY(ARRAY[
          '%igor%','%tahleel%','%shojin%','%sapling%','%jmumberson%'
        ]))
    AND (
      -- Substring match on title or author
      b.title ILIKE '%' || search_term || '%'
      OR b.author ILIKE '%' || search_term || '%'
      -- All words present in title+author
      OR (
        words IS NOT NULL AND array_length(words, 1) > 1 AND (
          SELECT bool_and(
            COALESCE(b.title_normalized, lower(b.title)) || ' ' ||
            COALESCE(b.author_normalized, lower(b.author))
            ILIKE '%' || w || '%'
          )
          FROM unnest(words) AS w
        )
      )
      -- Trigram similarity (only above 0.3 threshold for genuine fuzzy)
      OR similarity(COALESCE(b.title_normalized, lower(b.title)), term) > 0.3
      OR similarity(COALESCE(b.author_normalized, lower(b.author)), term) > 0.3
      -- Exact ISBN
      OR (b.isbn IS NOT NULL AND lower(b.isbn) = term)
    )
  GROUP BY b.id, b.title, b.author, b.cover_url, b.category, b.slug
  HAVING (
    CASE
      WHEN b.isbn IS NOT NULL AND lower(b.isbn) = term THEN 1.0
      WHEN lower(b.title) ILIKE '%' || term || '%' THEN 0.9
      WHEN lower(b.author) ILIKE '%' || term || '%' THEN 0.85
      WHEN words IS NOT NULL AND array_length(words, 1) > 1 AND (
        SELECT bool_and(
          COALESCE(b.title_normalized, lower(b.title)) || ' ' ||
          COALESCE(b.author_normalized, lower(b.author))
          ILIKE '%' || w || '%'
        )
        FROM unnest(words) AS w
      ) THEN 0.8
      ELSE GREATEST(
        similarity(COALESCE(b.title_normalized, lower(b.title)), term),
        similarity(COALESCE(b.author_normalized, lower(b.author)), term),
        similarity(
          COALESCE(b.title_normalized, lower(b.title)) || ' ' ||
          COALESCE(b.author_normalized, lower(b.author)),
          term
        )
      )
    END
  ) >= 0.3
  ORDER BY similarity_score DESC, copy_count DESC
  LIMIT result_limit;
END;
$$;
