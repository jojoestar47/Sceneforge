import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSpotifyToken } from '@/lib/supabase/spotify-token'

// ── Rate limiting ─────────────────────────────────────────────
// 10 token fetches per user per 60 seconds.
const WINDOW_MS = 60_000
const MAX_REQS  = 10
const memoryStore = new Map<string, number[]>()

function checkMemoryLimit(userId: string): boolean {
  const now  = Date.now()
  const hits = (memoryStore.get(userId) ?? []).filter(t => now - t < WINDOW_MS)
  if (hits.length >= MAX_REQS) return false
  hits.push(now)
  memoryStore.set(userId, hits)
  return true
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return checkMemoryLimit(userId)
  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis }     = await import('@upstash/redis')
    const ratelimit = new Ratelimit({
      redis:   new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(MAX_REQS, '60 s'),
      prefix:  'sf_token',
    })
    const { success } = await ratelimit.limit(userId)
    return success
  } catch {
    return checkMemoryLimit(userId)
  }
}

function makeSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: Array<{ name: string; value: string; options: Record<string, unknown> }>) =>
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options as never)),
      },
    }
  )
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase    = makeSupabase(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await checkRateLimit(user.id)
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const token = await getSpotifyToken(supabase, user.id)
  if (!token)  return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  return NextResponse.json({ access_token: token })
}

export async function DELETE() {
  const cookieStore = await cookies()
  const supabase    = makeSupabase(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('spotify_tokens').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
