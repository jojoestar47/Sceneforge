-- Useful read-only views over campaigns/scenes/sessions/users.
-- security_invoker = true ensures RLS on underlying tables still applies,
-- so each user only sees rows they already have access to.

CREATE OR REPLACE VIEW v_campaign_overview
WITH (security_invoker = true) AS
SELECT
  c.id                                                            AS campaign_id,
  c.user_id,
  c.name,
  c.description,
  c.cover_path,
  c.created_at,
  c.updated_at,
  (SELECT COUNT(*) FROM scenes s
     WHERE s.campaign_id = c.id)                                  AS scene_count,
  (SELECT COUNT(*) FROM characters ch
     WHERE ch.campaign_id = c.id)                                 AS character_count,
  (SELECT COUNT(*) FROM scene_folders f
     WHERE f.campaign_id = c.id)                                  AS folder_count,
  (SELECT COUNT(*) FROM campaign_tags t
     WHERE t.campaign_id = c.id)                                  AS tag_count,
  (SELECT COUNT(*) FROM campaign_sounds cs
     WHERE cs.campaign_id = c.id)                                 AS sound_count,
  (SELECT COUNT(*) FROM handouts h
     JOIN scenes s2 ON s2.id = h.scene_id
     WHERE s2.campaign_id = c.id)                                 AS handout_count,
  (SELECT COUNT(*) FROM tracks tk
     JOIN scenes s3 ON s3.id = tk.scene_id
     WHERE s3.campaign_id = c.id)                                 AS track_count,
  (SELECT MAX(s4.updated_at) FROM scenes s4
     WHERE s4.campaign_id = c.id)                                 AS last_scene_update,
  EXISTS (SELECT 1 FROM sessions ss
     WHERE ss.campaign_id = c.id AND ss.is_live)                  AS has_live_session
FROM campaigns c;

CREATE OR REPLACE VIEW v_scene_details
WITH (security_invoker = true) AS
SELECT
  s.id                                                            AS scene_id,
  s.campaign_id,
  c.name                                                          AS campaign_name,
  s.folder_id,
  f.name                                                          AS folder_name,
  s.name,
  s.location,
  s.order_index,
  s.dynamic_music,
  s.created_at,
  s.updated_at,
  (s.bg IS NOT NULL)                                              AS has_bg,
  (s.overlay IS NOT NULL)                                         AS has_legacy_overlay,
  (SELECT COUNT(*) FROM tracks t
     WHERE t.scene_id = s.id)                                     AS track_count,
  (SELECT COUNT(*) FROM tracks t
     WHERE t.scene_id = s.id AND t.kind = 'music')                AS music_track_count,
  (SELECT COUNT(*) FROM tracks t
     WHERE t.scene_id = s.id AND t.kind = 'ambience')             AS ambience_track_count,
  (SELECT COUNT(*) FROM scene_characters sc
     WHERE sc.scene_id = s.id)                                    AS character_count,
  (SELECT COUNT(*) FROM scene_overlays so
     WHERE so.scene_id = s.id)                                    AS overlay_count,
  (SELECT COUNT(*) FROM handouts h
     WHERE h.scene_id = s.id)                                     AS handout_count
FROM scenes s
JOIN campaigns c ON c.id = s.campaign_id
LEFT JOIN scene_folders f ON f.id = s.folder_id;

CREATE OR REPLACE VIEW v_active_sessions
WITH (security_invoker = true) AS
SELECT
  ss.id                                                           AS session_id,
  ss.campaign_id,
  c.name                                                          AS campaign_name,
  c.user_id                                                       AS campaign_owner,
  ss.join_code,
  ss.is_live,
  ss.created_by,
  ss.created_at,
  ss.updated_at,
  ss.active_scene_id,
  s.name                                                          AS active_scene_name,
  ss.active_music_track_id,
  t.name                                                          AS active_music_track_name,
  ss.active_handout_id,
  h.name                                                          AS active_handout_name
FROM sessions ss
JOIN campaigns c ON c.id = ss.campaign_id
LEFT JOIN scenes s ON s.id = ss.active_scene_id
LEFT JOIN tracks t ON t.id = ss.active_music_track_id
LEFT JOIN handouts h ON h.id = ss.active_handout_id;

CREATE OR REPLACE VIEW v_user_stats
WITH (security_invoker = true) AS
SELECT
  c.user_id,
  COUNT(DISTINCT c.id)                                            AS campaign_count,
  COUNT(DISTINCT s.id)                                            AS scene_count,
  COUNT(DISTINCT ch.id)                                           AS character_count,
  COUNT(DISTINCT ss.id)                                           AS session_count,
  COUNT(DISTINCT ss.id) FILTER (WHERE ss.is_live)                 AS live_session_count,
  MAX(c.updated_at)                                               AS last_campaign_update,
  EXISTS (SELECT 1 FROM spotify_tokens st
     WHERE st.user_id = c.user_id)                                AS has_spotify
FROM campaigns c
LEFT JOIN scenes s ON s.campaign_id = c.id
LEFT JOIN characters ch ON ch.campaign_id = c.id
LEFT JOIN sessions ss ON ss.campaign_id = c.id
GROUP BY c.user_id;

GRANT SELECT ON v_campaign_overview TO authenticated;
GRANT SELECT ON v_scene_details      TO authenticated;
GRANT SELECT ON v_active_sessions    TO authenticated;
GRANT SELECT ON v_user_stats         TO authenticated;
