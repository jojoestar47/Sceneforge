'use client'
// Shared media-URL resolvers.
// These pick the best available URL field on a MediaRef or Character without
// hitting the network. Storage URL construction lives in lib/supabase/storage.

import type { Character, MediaRef } from '@/lib/types'
import { publicStorageUrl } from '@/lib/supabase/storage'

/**
 * Resolve a MediaRef (scene bg/overlay, handout.media, etc.) to a usable URL.
 * Prefers `signed_url` (stamped client-side by resolveSceneUrls) and falls
 * back to the raw `url` field for externally-hosted media.
 */
export function mediaUrl(m: MediaRef | null | undefined): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

/**
 * Resolve a Character to its display image URL.
 * - storage_path: prefer the stamped signed_url; otherwise build a public URL.
 * - external `url`: returned as-is.
 * - neither: null.
 */
export function characterImageUrl(c: Character): string | null {
  if (c.storage_path) return c.signed_url || publicStorageUrl(c.storage_path)
  return c.url || null
}
