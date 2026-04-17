-- Add flipped column to scene_characters for per-character mirror state.
ALTER TABLE scene_characters
  ADD COLUMN IF NOT EXISTS flipped boolean NOT NULL DEFAULT false;
