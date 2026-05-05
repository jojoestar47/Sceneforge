-- Add above_overlay column to scene_characters: when true, the character
-- renders in front of OverlayStack (atmospheric overlays sit behind the
-- character instead of washing over them).
ALTER TABLE scene_characters
  ADD COLUMN IF NOT EXISTS above_overlay boolean NOT NULL DEFAULT false;
