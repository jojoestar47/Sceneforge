-- Atmospheric video overlays layered on top of scenes (fog, smoke, rain, etc.)

CREATE TABLE IF NOT EXISTS scene_overlays (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id        UUID        NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL DEFAULT 'Overlay',
  source          TEXT        NOT NULL DEFAULT 'upload'
                              CHECK (source IN ('library','upload')),
  library_key     TEXT,
  storage_path    TEXT,
  url             TEXT,
  file_name       TEXT,
  blend_mode      TEXT        NOT NULL DEFAULT 'screen'
                              CHECK (blend_mode IN ('screen','lighten','multiply','overlay')),
  opacity         FLOAT       NOT NULL DEFAULT 0.8,
  playback_rate   FLOAT       NOT NULL DEFAULT 1.0,
  scale           FLOAT       NOT NULL DEFAULT 1.0,
  pan_x           FLOAT       NOT NULL DEFAULT 50,
  pan_y           FLOAT       NOT NULL DEFAULT 50,
  enabled_default BOOLEAN     NOT NULL DEFAULT true,
  order_index     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scene_overlays_scene_id_idx ON scene_overlays(scene_id);

ALTER TABLE scene_overlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scene_overlays"
  ON scene_overlays FOR ALL
  TO authenticated
  USING (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN campaigns c ON c.id = s.campaign_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN campaigns c ON c.id = s.campaign_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY "Public reads scene_overlays in live sessions"
  ON scene_overlays FOR SELECT
  TO anon
  USING (scene_id IN (
    SELECT s.id FROM scenes s
    WHERE s.campaign_id IN (SELECT campaign_id FROM sessions WHERE is_live = true)
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE scene_overlays;

-- Live overlay state: DM toggles overlays on/off and adjusts opacity mid-session
-- Shape: { [overlay_id]: { on: boolean, opacity: number } }
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_overlays JSONB DEFAULT '{}'::jsonb;
