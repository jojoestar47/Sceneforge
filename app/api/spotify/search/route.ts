import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSpotifyToken } from '@/lib/supabase/spotify-token'

// ── Rate limiting ─────────────────────────────────────────────
// Uses Upstash Redis for a reliable sliding-window rate limiter that
// survives Vercel cold starts (unlike an in-process Map which resets
// each time a new function instance spins up).
//
// Requires env vars: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// Set these in Vercel → Settings → Environment Variables, and in
// .env.local for local development. If they're absent (e.g. local dev
// without Redis) we fall through and allow the request.
async function checkRateLimit(userId: string): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return true // not configured — allow

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis }     = await import('@upstash/redis')

    const ratelimit = new Ratelimit({
      redis:   new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix:  'sf_search',
    })

    const { success } = await ratelimit.limit(userId)
    return success
  } catch {
    // If Redis is unreachable, fail open — don't break the search feature
    return true
  }
}

export async function GET(req: NextRequest) {
  // ── Input validation ──────────────────────────────────────────
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ tracks: [], playlists: [] })

  if (q.length > 100) {
    return NextResponse.json({ error: 'Query too long' }, { status: 400 })
  }

  // ── Auth ──────────────────────────────────────────────────────
  const cookieStore = await cookies()
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limit ────────────────────────────────────────────────
  const allowed = await checkRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // ── Spotify search ────────────────────────────────────────────
  const spotifyToken = await getSpotifyToken(supabase, user.id)
  if (!spotifyToken) return NextResponse.json({ error: 'Not connected' }, { status: 403 })

  const params = new URLSearchParams({ q, type: 'track,playlist', limit: '8' })
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${spotifyToken}` },
  })

  if (!res.ok) return NextResponse.json({ error: 'Search failed' }, { status: 502 })

  const data = await res.json()

  return NextResponse.json({
    tracks: (data.tracks?.items ?? []).map((t: any) => ({
      uri:    t.uri    as string,
      name:   t.name   as string,
      artist: (t.artists?.[0]?.name ?? '') as string,
      image:  (t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null) as string | null,
    })),
    playlists: (data.playlists?.items ?? []).filter(Boolean).map((p: any) => ({
      uri:   p.uri   as string,
      name:  p.name  as string,
      image: (p.images?.[0]?.url ?? null) as string | null,
    })),
  })
}
