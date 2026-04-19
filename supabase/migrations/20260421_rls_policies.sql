-- Row Level Security for all core tables.
--
-- Design:
--   authenticated users  → full CRUD on rows they own (via user_id or campaign ownership chain)
--   anon (viewer)        → SELECT-only on rows that belong to a campaign with an active live session

-- ── campaigns ────────────────────────────────────────────────────────────────

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── sessions ─────────────────────────────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- DM manages the session for their campaign
CREATE POLICY "DM manages own session"
  ON sessions FOR ALL
  TO authenticated
  USING  (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

-- Viewers (anon) can read any live session (filtered by join_code in app query)
CREATE POLICY "Public reads live sessions"
  ON sessions FOR SELECT
  TO anon
  USING (is_live = true);

-- ── scenes ───────────────────────────────────────────────────────────────────

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scenes"
  ON scenes FOR ALL
  TO authenticated
  USING  (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

-- Viewers can read scenes that belong to a campaign with an active live session
CREATE POLICY "Public reads scenes in live sessions"
  ON scenes FOR SELECT
  TO anon
  USING (campaign_id IN (SELECT campaign_id FROM sessions WHERE is_live = true));

-- ── tracks ───────────────────────────────────────────────────────────────────

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tracks"
  ON tracks FOR ALL
  TO authenticated
  USING  (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN campaigns c ON c.id = s.campaign_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN campaigns c ON c.id = s.campaign_id
    WHERE c.user_id = auth.uid()
  ));

-- Viewers can read tracks for scenes in live sessions
CREATE POLICY "Public reads tracks in live sessions"
  ON tracks FOR SELECT
  TO anon
  USING (scene_id IN (
    SELECT s.id FROM scenes s
    WHERE s.campaign_id IN (SELECT campaign_id FROM sessions WHERE is_live = true)
  ));

-- ── characters ───────────────────────────────────────────────────────────────

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own characters"
  ON characters FOR ALL
  TO authenticated
  USING  (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

-- Viewers can read characters for campaigns with live sessions
CREATE POLICY "Public reads characters in live sessions"
  ON characters FOR SELECT
  TO anon
  USING (campaign_id IN (SELECT campaign_id FROM sessions WHERE is_live = true));

-- ── scene_characters ─────────────────────────────────────────────────────────

ALTER TABLE scene_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scene_characters"
  ON scene_characters FOR ALL
  TO authenticated
  USING  (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN campaigns c ON c.id = s.campaign_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN campaigns c ON c.id = s.campaign_id
    WHERE c.user_id = auth.uid()
  ));

-- ── campaign_tags ─────────────────────────────────────────────────────────────

ALTER TABLE campaign_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campaign_tags"
  ON campaign_tags FOR ALL
  TO authenticated
  USING  (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));
