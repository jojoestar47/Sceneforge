-- Campaign-level tag library
CREATE TABLE IF NOT EXISTS campaign_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'gold',
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, name)
);

CREATE INDEX IF NOT EXISTS idx_campaign_tags_campaign ON campaign_tags(campaign_id);

-- Re-create characters.tags as uuid[] (was text[], column has no data yet)
ALTER TABLE characters DROP COLUMN IF EXISTS tags;
ALTER TABLE characters ADD COLUMN tags uuid[] NOT NULL DEFAULT '{}';
