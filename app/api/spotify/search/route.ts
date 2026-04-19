import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSpotifyToken } from '@/lib/supabase/spotify-token'

// ── Rate limiting ─────────────────────────────────────────────
// Primary: Upstash Redis sliding window (survives cold starts).
// Fallback: in-memory map (per warm instance, better than nothing).
// 30 requests per user per 60 seconds.

const WINDOW_MS = 60_000
const MAX_REQS  = 30

// In-memory fallback: map of userId → sorted array of timestamps
const memoryStore = new Map<string, number[]>()

function checkMemoryLimit(userId: string): boolean {
  const now = Date.now()
  const hits = (memoryStore.get(userId) ?? []).filter(t => now - t < WINDOW_MS)
  if (hits.length >= MAX_REQS) return false
  hits.push(now)
  memoryStore.set(userId, hits)
  return true
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // No Redis configured — use in-memory fallback
    return checkMemoryLimit(userId)
  }

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis }     = await import('@upstash/redis')

    const ratelimit = new Ratelimit({
      redis:   new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(MAX_REQS, '60 s'),
      prefix:  'sf_search',
    })

    const { success } = await ratelimit.limit(userId)
    return success
  } catch {
    // Redis unreachable — fall back to in-memory
    return checkMemoryLimit(userId)
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
        setAll: (cs: Array<{ name: string; value: string; options: Record<string, unknown> }>) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options as never)),
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
