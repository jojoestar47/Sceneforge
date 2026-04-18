-- Add a tags array to characters for filtering in the character roster.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_characters_tags ON characters USING gin(tags);
