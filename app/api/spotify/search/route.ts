import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSpotifyToken } from '@/lib/supabase/spotify-token'

// ── Simple in-process rate limiter ────────────────────────────
// Limits each authenticated user to 30 search requests per minute.
// This is per-instance (fine for Vercel serverless — cold starts reset it,
// but it still prevents sustained abuse within a single execution context).
const searchRateLimit = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now    = Date.now()
  const window = 60_000 // 1 minute
  const limit  = 30

  const entry = searchRateLimit.get(userId)
  if (!entry || now > entry.resetAt) {
    searchRateLimit.set(userId, { count: 1, resetAt: now + window })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

export async function GET(req: NextRequest) {
  // ── Input validation ──────────────────────────────────────────
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ tracks: [], playlists: [] })

  // Cap query length — Spotify itself limits to ~100 chars; enforce here too
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
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // ── Spotify search ────────────────────────────────────────────
  const token = await getSpotifyToken(supabase, user.id)
  if (!token)  return NextResponse.json({ error: 'Not connected' }, { status: 403 })

  const params = new URLSearchParams({ q, type: 'track,playlist', limit: '8' })
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
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
