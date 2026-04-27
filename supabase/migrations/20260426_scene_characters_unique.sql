-- Deduplicate any existing rows keeping the earliest created
DELETE FROM scene_characters sc1
USING scene_characters sc2
WHERE sc1.id > sc2.id
  AND sc1.scene_id = sc2.scene_id
  AND sc1.character_id = sc2.character_id;

-- Unique constraint so upsert can resolve conflicts on save
ALTER TABLE scene_characters
  ADD CONSTRAINT scene_characters_scene_character_unique
  UNIQUE (scene_id, character_id);
