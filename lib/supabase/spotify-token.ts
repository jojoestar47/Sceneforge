import type { SupabaseClient } from '@supabase/supabase-js'

interface TokenRow {
  access_token:  string
  refresh_token: string
  expires_at:    string
}

/** Returns a valid Spotify access token for the given user, refreshing if expired. */
export async function getSpotifyToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('spotify_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single<TokenRow>()

  if (!data) return null

  // Return cached token if still valid (with 60s buffer)
  if (new Date(data.expires_at).getTime() - 60_000 > Date.now()) {
    return data.access_token
  }

  return refreshSpotifyToken(supabase, userId, data.refresh_token)
}

async function refreshSpotifyToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId     = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null

  const { access_token, expires_in, refresh_token: newRefresh } = await res.json()
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString()

  await supabase.from('spotify_tokens').update({
    access_token,
    expires_at,
    ...(newRefresh ? { refresh_token: newRefresh } : {}),
  }).eq('user_id', userId)

  return access_token
}
