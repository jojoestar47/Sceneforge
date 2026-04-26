import type { Campaign, Character, Handout, MediaRef, Scene, Track } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'scene-media'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const UPLOAD_TIMEOUT_MS = 120_000

// ── Public URL helpers ────────────────────────────────────────────────────────
// The scene-media bucket is public, so we never need signed URLs.
// These are synchronous — no API roundtrips.

/** Direct public URL for a storage path. Cached indefinitely by CDN. */
export function publicStorageUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`
}

/**
 * Supabase image-transform URL for thumbnail use-cases.
 * Converts a public storage URL to the render/image endpoint for width-based scaling.
 * Does NOT set resize=cover — the image scales proportionally to the given width and
 * CSS objectFit handles the visual crop. Falls back to the original URL on any error.
 * Only applies to supabase.co storage URLs; external URLs are returned unchanged.
 */
export function thumbUrl(url: string, width: number, quality = 80): string {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith('.supabase.co')) return url
    u.pathname = u.pathname.replace('/storage/v1/object/', '/storage/v1/render/image/')
    u.searchParams.set('width', String(width))
    u.searchParams.set('quality', String(quality))
    return u.toString()
  } catch {
    return url
  }
}

// ── Synchronous URL resolution ────────────────────────────────────────────────
// Each function takes a plain data array and stamps public URLs onto signed_url
// fields — no network call, no supabase client needed.

function resolveMediaRef(media: MediaRef | null | undefined): MediaRef | null | undefined {
  if (!media?.storage_path) return media
  return { ...media, signed_url: publicStorageUrl(media.storage_path) }
}

/** Stamp public URLs onto all media refs in a scene array. Synchronous. */
export function resolveSceneUrls(scenes: Scene[]): Scene[] {
  return scenes.map(sc => ({
    ...sc,
    bg:      resolveMediaRef(sc.bg)      as Scene['bg'],
    overlay: resolveMediaRef(sc.overlay) as Scene['overlay'],
    tracks: sc.tracks?.map((t: Track) =>
      t.storage_path ? { ...t, signed_url: publicStorageUrl(t.storage_path) } : t
    ),
    handouts: sc.handouts?.map((h: Handout) =>
      h.media?.storage_path
        ? { ...h, media: { ...h.media, signed_url: publicStorageUrl(h.media.storage_path) } }
        : h
    ),
  }))
}

/** Stamp public cover URLs onto a campaign array. Synchronous. */
export function resolveCampaignCovers(campaigns: Campaign[]): Campaign[] {
  return campaigns.map(c =>
    c.cover_path ? { ...c, cover_signed_url: publicStorageUrl(c.cover_path) } : c
  )
}

/** Stamp public image URLs onto a character array. Synchronous. */
export function resolveCharacterUrls(characters: Character[]): Character[] {
  return characters.map(c =>
    c.storage_path ? { ...c, signed_url: publicStorageUrl(c.storage_path) } : c
  )
}

// ── Upload / delete ───────────────────────────────────────────────────────────

/** Upload a file to Storage, return the storage_path */
export async function uploadMedia(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const uploadPromise = supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Upload timed out — please check your connection and try again.')), UPLOAD_TIMEOUT_MS)
  )

  const { error } = await Promise.race([uploadPromise, timeoutPromise])
  if (error) throw error
  return path
}

/** Delete a file from Storage */
export async function deleteMedia(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath])
}

/** Delete multiple files from Storage in one call. No-ops on empty input. */
export async function deleteMediaBatch(
  supabase: SupabaseClient,
  storagePaths: string[]
): Promise<void> {
  if (!storagePaths.length) return
  await supabase.storage.from(BUCKET).remove(storagePaths)
}
