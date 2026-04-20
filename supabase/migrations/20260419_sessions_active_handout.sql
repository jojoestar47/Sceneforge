-- Sync active handout from DM to viewer
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_handout_id UUID REFERENCES handouts(id) ON DELETE SET NULL;
