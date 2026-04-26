-- Add tracks and handouts to the realtime publication so the viewer receives
-- live inserts/updates/deletes without requiring a page refresh.
ALTER PUBLICATION supabase_realtime ADD TABLE tracks, handouts;
