import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL!
  const cookieStore = await cookies()

  // ── CSRF state validation ─────────────────────────────────────
  // Spotify echoes back the state param we sent. If it's missing or doesn't
  // match the value we stored in the httpOnly cookie, reject the request —
  // this prevents login-CSRF / authorization-code injection attacks.
  const returnedState = req.nextUrl.searchParams.get('state')
  const storedState   = cookieStore.get('sf_spotify_state')?.value

  // Always clear the state cookie regardless of outcome
  cookieStore.delete('sf_spotify_state')

  if (!returnedState || !storedState || returnedState !== storedState) {
    return NextResponse.redirect(`${appUrl}/?spotify=error`)
  }

  // ── Authorization code exchange ───────────────────────────────
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(`${appUrl}/?spotify=error`)

  const clientId     = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  const redirectUri  = `${appUrl}/auth/spotify/callback`

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) return NextResponse.redirect(`${appUrl}/?spotify=error`)

  const { access_token, refresh_token, expires_in } = await tokenRes.json()
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString()

  // ── Persist tokens for the authenticated user ─────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()   => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  await supabase.from('spotify_tokens').upsert(
    { user_id: user.id, access_token, refresh_token, expires_at },
    { onConflict: 'user_id' }
  )

  return NextResponse.redirect(`${appUrl}/?spotify=connected`)
}
