-- Campaign-level handouts.
-- Extends the handouts table so a handout can belong to either a scene
-- (existing behavior) or a campaign (new: world maps and other persistent
-- player references that aren't tied to a single scene).
-- Exactly one of scene_id / campaign_id must be set.

ALTER TABLE handouts
  ALTER COLUMN scene_id DROP NOT NULL,
  ADD COLUMN  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE;

ALTER TABLE handouts
  ADD CONSTRAINT handouts_scope_check
    CHECK ((scene_id IS NULL) <> (campaign_id IS NULL));

CREATE INDEX IF NOT EXISTS handouts_campaign_id_idx ON handouts(campaign_id);

-- Replace existing policies so they cover both scopes.
DROP POLICY IF EXISTS "Users manage own handouts"             ON handouts;
DROP POLICY IF EXISTS "Public reads handouts in live sessions" ON handouts;

CREATE POLICY "Users manage own handouts"
  ON handouts FOR ALL
  TO authenticated
  USING (
    (scene_id IS NOT NULL AND scene_id IN (
      SELECT s.id FROM scenes s
      JOIN campaigns c ON c.id = s.campaign_id
      WHERE c.user_id = auth.uid()
    ))
    OR
    (campaign_id IS NOT NULL AND campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (scene_id IS NOT NULL AND scene_id IN (
      SELECT s.id FROM scenes s
      JOIN campaigns c ON c.id = s.campaign_id
      WHERE c.user_id = auth.uid()
    ))
    OR
    (campaign_id IS NOT NULL AND campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Public reads handouts in live sessions"
  ON handouts FOR SELECT
  TO anon
  USING (
    (scene_id IS NOT NULL AND scene_id IN (
      SELECT s.id FROM scenes s
      WHERE s.campaign_id IN (SELECT campaign_id FROM sessions WHERE is_live = true)
    ))
    OR
    (campaign_id IS NOT NULL AND campaign_id IN (
      SELECT campaign_id FROM sessions WHERE is_live = true
    ))
  );
