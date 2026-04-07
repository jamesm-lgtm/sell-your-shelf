CREATE TABLE IF NOT EXISTS editorial_tags (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_editorial_tags (
  listing_id INT8 REFERENCES listings(id) ON DELETE CASCADE,
  tag_id INT REFERENCES editorial_tags(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, tag_id)
);

INSERT INTO editorial_tags (label, slug, display_order) VALUES
  ('Staff Pick',   'staff-pick',   1),
  ('Rare Find',    'rare-find',    2),
  ('Perfect Gift', 'perfect-gift', 3),
  ('Hidden Gem',   'hidden-gem',   4),
  ('Under £5',     'under-5',      5),
  ('Seasonal',     'seasonal',     6)
ON CONFLICT (slug) DO NOTHING;
