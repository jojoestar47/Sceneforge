-- Add zoom/pan columns to scene_characters for per-character framing.
-- Replaces the unused object_fit / object_position approach.
ALTER TABLE scene_characters
  ADD COLUMN IF NOT EXISTS zoom    numeric  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pan_x   numeric  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pan_y   numeric  NOT NULL DEFAULT 100;
