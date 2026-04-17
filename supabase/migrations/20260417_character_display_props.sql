-- Add per-character image display controls to scene_characters.
-- object_fit:      'contain' (default, letterbox) or 'cover' (fill + crop)
-- object_position: CSS object-position string e.g. '50% 20%'
-- flipped:         horizontal mirror

ALTER TABLE scene_characters
  ADD COLUMN IF NOT EXISTS object_fit text NOT NULL DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS object_position text NOT NULL DEFAULT '50% 100%',
  ADD COLUMN IF NOT EXISTS flipped boolean NOT NULL DEFAULT false;
