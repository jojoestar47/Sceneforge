-- Spotify integration: token storage + track columns

-- One row per user, stores OAuth tokens
CREATE TABLE IF NOT EXISTS spotify_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT spotify_tokens_user_id_key UNIQUE (user_id)
);

ALTER TABLE spotify_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own spotify tokens"
  ON spotify_tokens FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Spotify URI (e.g. spotify:track:4iV5W9uYEdYUVa79Axb7Rh) and type ('track' | 'playlist')
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS spotify_uri  text,
  ADD COLUMN IF NOT EXISTS spotify_type text;
