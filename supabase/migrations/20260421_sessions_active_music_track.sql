-- Sync active music track from DM to viewer
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_music_track_id UUID REFERENCES tracks(id) ON DELETE SET NULL;
