-- Default image crop position (object-position %) for character portraits
-- and campaign covers. 50/50 = centered (current default).
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS image_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_y numeric NOT NULL DEFAULT 50;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS cover_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_y numeric NOT NULL DEFAULT 50;

-- Per-scene flag to hide the scene name overlay on the viewer page.
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS hide_title boolean NOT NULL DEFAULT false;
