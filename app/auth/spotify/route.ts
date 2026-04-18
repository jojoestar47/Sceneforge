import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET() {
  const clientId    = process.env.SPOTIFY_CLIENT_ID!
  const appUrl      = process.env.APP_URL!
  const redirectUri = `${appUrl}/auth/spotify/callback`

  // Generate a random CSRF state token and store it in an httpOnly cookie.
  // The callback will verify it matches before accepting the authorization code.
  const state = crypto.randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('sf_spotify_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600, // 10 minutes — more than enough for the OAuth round-trip
    path:     '/',
  })

  // Only request scopes the app actually uses — streaming requires Premium,
  // modify+read playback-state are needed for play/pause/volume control.
  const scope = [
    'streaming',
    'user-modify-playback-state',
    'user-read-playback-state',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    scope,
    redirect_uri:  redirectUri,
    state,
    show_dialog:   'false',
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}
