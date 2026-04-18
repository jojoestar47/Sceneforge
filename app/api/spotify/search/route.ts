import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSpotifyToken } from '@/lib/supabase/spotify-token'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ tracks: [], playlists: [] })

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
