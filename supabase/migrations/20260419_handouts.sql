-- Handouts: images and documents the DM can show players during a session

CREATE TABLE IF NOT EXISTS handouts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id     UUID        NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'Handout',
  media        JSONB,
  order_index  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handouts_scene_id_idx ON handouts(scene_id);

ALTER TABLE handouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own handouts"
  ON handouts FOR ALL
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

CREATE POLICY "Public reads handouts in live sessions"
  ON handouts FOR SELECT
  TO anon
  USING (scene_id IN (
    SELECT s.id FROM scenes s
    WHERE s.campaign_id IN (SELECT campaign_id FROM sessions WHERE is_live = true)
  ));
