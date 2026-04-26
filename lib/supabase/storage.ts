import type { SupabaseClient } from '@supabase/supabase-js'
import type { Campaign, Character, Handout, MediaRef, Scene, Track } from '@/lib/types'

const BUCKET   = 'scene-media'
const EXPIRES  = 4 * 60 * 60 // 4 hours — URLs refreshed every 3h so they never expire mid-session
const UPLOAD_TIMEOUT_MS = 120_000 // 2 minutes max per upload

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

/**
 * Resolve signed URLs on all media refs within a scene array.
 * Batches all storage paths into a single createSignedUrls call instead of
 * one call per asset — dramatically faster for campaigns with many scenes.
 */
export async function resolveSceneUrls(
  supabase: SupabaseClient,
  scenes: Scene[]
): Promise<Scene[]> {
  // Collect every storage path that needs a signed URL, tagged by location
  type PathRef = { path: string; sceneIdx: number; kind: 'bg' | 'overlay' | 'track' | 'handout'; trackIdx?: number; handoutIdx?: number }
  const refs: PathRef[] = []

  scenes.forEach((sc, si) => {
    if (sc.bg?.storage_path)      refs.push({ path: sc.bg.storage_path,      sceneIdx: si, kind: 'bg' })
    if (sc.overlay?.storage_path) refs.push({ path: sc.overlay.storage_path, sceneIdx: si, kind: 'overlay' })
    sc.tracks?.forEach((t, ti) => {
      if (t.storage_path) refs.push({ path: t.storage_path, sceneIdx: si, kind: 'track', trackIdx: ti })
    })
    sc.handouts?.forEach((h, hi) => {
      if (h.media?.storage_path) refs.push({ path: h.media.storage_path, sceneIdx: si, kind: 'handout', handoutIdx: hi })
    })
  })

  if (!refs.length) return scenes

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(refs.map(r => r.path), EXPIRES)

  if (error || !data) {
    // Fall back to individual resolution on failure
    return Promise.all(
      scenes.map(async sc => ({
        ...sc,
        bg:      await resolveMedia(supabase, sc.bg),
        overlay: await resolveMedia(supabase, sc.overlay),
        tracks:  sc.tracks
          ? await Promise.all(sc.tracks.map(async t => {
              if (!t.storage_path) return t
              const url = await signedUrl(supabase, t.storage_path)
              return { ...t, signed_url: url }
            }))
          : undefined,
      }))
    )
  }

  // Build a path → signedUrl map from the batch response
  const urlMap = new Map<string, string>()
  data.forEach((item, i) => {
    if (item.signedUrl) urlMap.set(refs[i].path, item.signedUrl)
  })

  // Apply resolved URLs back to the scene graph
  return scenes.map((sc, si) => {
    const sceneRefs  = refs.filter(r => r.sceneIdx === si)
    const bgRef      = sceneRefs.find(r => r.kind === 'bg')
    const overlayRef = sceneRefs.find(r => r.kind === 'overlay')
    const trackRefs  = sceneRefs.filter(r => r.kind === 'track')
    const handoutRefs = sceneRefs.filter(r => r.kind === 'handout')

    return {
      ...sc,
      bg:      bgRef && sc.bg      ? { ...sc.bg,      signed_url: urlMap.get(bgRef.path) }      : sc.bg,
      overlay: overlayRef && sc.overlay ? { ...sc.overlay, signed_url: urlMap.get(overlayRef.path) } : sc.overlay,
      tracks: sc.tracks?.map((t, ti) => {
        const ref = trackRefs.find(r => r.trackIdx === ti)
        return ref ? { ...t, signed_url: urlMap.get(ref.path) } : t
      }),
      handouts: sc.handouts?.map((h, hi) => {
        const ref = handoutRefs.find(r => r.handoutIdx === hi)
        if (!ref || !h.media) return h
        return { ...h, media: { ...h.media, signed_url: urlMap.get(ref.path) } }
      }),
    }
  })
}

/** Resolve signed URLs for characters that use Supabase storage */
export async function resolveCharacterUrls(
  supabase: SupabaseClient,
  characters: Character[]
): Promise<Character[]> {
  const withPath = characters.filter(c => c.storage_path)
  if (!withPath.length) return characters

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(withPath.map(c => c.storage_path!), EXPIRES)

  if (error || !data) {
    return Promise.all(characters.map(async c => {
      if (!c.storage_path) return c
      try {
        const url = await signedUrl(supabase, c.storage_path)
        return { ...c, signed_url: url }
      } catch { return c }
    }))
  }

  const urlMap = new Map<string, string>()
  data.forEach((item, i) => {
    if (item.signedUrl) urlMap.set(withPath[i].id, item.signedUrl)
  })

  return characters.map(c =>
    c.storage_path && urlMap.has(c.id) ? { ...c, signed_url: urlMap.get(c.id) } : c
  )
}

/** Resolve cover signed URLs for an array of campaigns */
export async function resolveCampaignCovers(
  supabase: SupabaseClient,
  campaigns: Campaign[]
): Promise<Campaign[]> {
  return Promise.all(
    campaigns.map(async c => {
      if (!c.cover_path) return c
      try {
        const url = await signedUrl(supabase, c.cover_path)
        return { ...c, cover_signed_url: url }
      } catch {
        return c
      }
    })
  )
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
