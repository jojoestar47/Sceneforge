import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaRef, Scene, Track } from '@/lib/types'

const BUCKET   = 'scene-media'
const EXPIRES  = 60 * 60 // 1 hour

/** Upload a file to Storage, return the storage_path */
export async function uploadMedia(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** Get a signed URL for a storage path */
export async function signedUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPIRES)
  if (error) throw error
  return data.signedUrl
}

/** Resolve signed_url on a MediaRef if it has a storage_path */
export async function resolveMedia(
  supabase: SupabaseClient,
  media: MediaRef | null | undefined
): Promise<MediaRef | null | undefined> {
  if (!media?.storage_path) return media
  const url = await signedUrl(supabase, media.storage_path)
  return { ...media, signed_url: url }
}

/** Resolve signed URLs on all media refs within a scene array */
export async function resolveSceneUrls(
  supabase: SupabaseClient,
  scenes: Scene[]
): Promise<Scene[]> {
  return Promise.all(
    scenes.map(async sc => ({
      ...sc,
      bg:      await resolveMedia(supabase, sc.bg),
      overlay: await resolveMedia(supabase, sc.overlay),
      tracks:  sc.tracks
        ? await Promise.all(sc.tracks.map(t => resolveTrack(supabase, t)))
        : undefined,
    }))
  )
}

async function resolveTrack(supabase: SupabaseClient, t: Track): Promise<Track> {
  if (!t.storage_path) return t
  const url = await signedUrl(supabase, t.storage_path)
  return { ...t, signed_url: url }
}

/** Delete a file from Storage */
export async function deleteMedia(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath])
}
