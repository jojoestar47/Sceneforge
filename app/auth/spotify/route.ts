import { NextResponse } from 'next/server'

export async function GET() {
  const clientId   = process.env.SPOTIFY_CLIENT_ID!
  const appUrl     = process.env.APP_URL!
  const redirectUri = `${appUrl}/auth/spotify/callback`

  const scope = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:      clientId,
    scope,
    redirect_uri:   redirectUri,
    show_dialog:    'false',
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}
