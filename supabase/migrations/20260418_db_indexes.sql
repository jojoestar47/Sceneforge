-- Performance indexes for common query patterns.
--
-- scenes(campaign_id, order_index)
--   Every campaign load runs: SELECT ... FROM scenes WHERE campaign_id = ?
--   ORDER BY order_index. Without an index this is a full-table scan that
--   grows linearly with total scenes across all campaigns.
CREATE INDEX IF NOT EXISTS idx_scenes_campaign_order
  ON scenes(campaign_id, order_index);

-- tracks(scene_id)
--   Scenes are always loaded with their tracks via:
--   SELECT *, tracks(*) FROM scenes WHERE campaign_id = ?
--   A foreign-key column without an index means a seq scan on tracks for
--   each scene row returned.
CREATE INDEX IF NOT EXISTS idx_tracks_scene_id
  ON tracks(scene_id);

-- scene_characters(scene_id)
--   Character pools are loaded per-scene on every scene switch.
--   Same pattern as tracks — without an index each lookup scans the
--   entire scene_characters table.
CREATE INDEX IF NOT EXISTS idx_scene_characters_scene_id
  ON scene_characters(scene_id);

-- Note: sessions(campaign_id) is already covered by the UNIQUE constraint
-- added in 20260416_sessions_unique_campaign.sql. PostgreSQL automatically
-- creates a unique index to enforce the constraint, so no additional index
-- is needed here.
