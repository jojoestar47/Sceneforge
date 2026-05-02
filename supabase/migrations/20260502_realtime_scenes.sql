-- Broadcast scenes table UPDATEs so the viewer can react to in-place edits
-- of the currently-displayed scene (e.g. toggling hide_title) without
-- needing the DM to switch scenes.
ALTER PUBLICATION supabase_realtime ADD TABLE scenes;
