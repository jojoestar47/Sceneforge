-- Soundboard: campaign-wide one-shot SFX library + live broadcast column
-- on sessions for triggering viewer playback in real time.

CREATE TABLE IF NOT EXISTS campaign_sounds (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  storage_path TEXT,
  url          TEXT,
  file_name    TEXT,
  volume       NUMERIC     NOT NULL DEFAULT 1.0
                           CHECK (volume >= 0 AND volume <= 1),
  order_index  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_sounds_campaign_id_idx
  ON campaign_sounds(campaign_id, order_index);

ALTER TABLE campaign_sounds ENABLE ROW LEVEL SECURITY;

-- Owner: full access to sounds in their own campaigns
CREATE POLICY "Users manage own campaign_sounds"
  ON campaign_sounds FOR ALL
  USING (campaign_id IN (
    SELECT c.id FROM campaigns c WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (campaign_id IN (
    SELECT c.id FROM campaigns c WHERE c.user_id = auth.uid()
  ));

-- Viewer: read sounds for any campaign with a live session so the SFX event
-- payload can be resolved against the sound's metadata + storage_path.
CREATE POLICY "Viewer can read sounds for live sessions"
  ON campaign_sounds FOR SELECT
  USING (campaign_id IN (
    SELECT s.campaign_id FROM sessions s WHERE s.is_live = true
  ));

-- Realtime: viewer subscribes to inserts/updates/deletes so newly uploaded
-- sounds become playable mid-session without reconnecting. Without this,
-- SFX events for sounds added after the viewer connected would silently
-- fail because the sound's metadata isn't cached.
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_sounds;

-- Live SFX event written to sessions.active_sfx_event by the DM to trigger
-- viewer playback. Shape: { id, sound_id, played_at, volume?, stop? }.
-- The unique id ensures repeat plays of the same sound register as a row
-- update; stop=true tells the viewer to pause any in-flight playback of
-- sound_id (used by the tap-toggle behaviour on the DM's pad).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_sfx_event JSONB;
