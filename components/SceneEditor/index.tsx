'use client'

// Scene editor orchestrator. Owns the modal shell, the master draft state,
// and the (large) save fan-out across scenes/tracks/handouts/overlays/chars.
// Per-tab UI lives in the *Tab.tsx siblings; this file deliberately knows
// nothing about how each tab renders — it just hands the draft down.

import { useEffect, useRef, useState } from 'react'
import type { Character, MediaRef, Scene, SceneOverlay } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { uploadMedia, deleteMediaBatch } from '@/lib/supabase/storage'
import SceneTab     from './SceneTab'
import HandoutsTab  from './HandoutsTab'
import OverlaysTab  from './OverlaysTab'
import { blankDraft, type Draft, type TabKey } from './types'

interface Props {
  scene:      Scene | null
  campaignId: string
  userId:     string
  onSave:     (scene: Scene, newCharacters?: Character[]) => void
  onClose:    () => void
}

export default function SceneEditor({ scene, campaignId, userId, onSave, onClose }: Props) {
  const supabase = createClient()
  const [tab,    setTab]    = useState<TabKey>('scene')
  const [draft,  setDraft]  = useState<Draft>(blankDraft(scene))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Campaign characters — loaded once per campaign, used by SceneTab's picker
  const [campaignChars, setCampaignChars] = useState<Character[]>([])
  const [charsLoading,  setCharsLoading]  = useState(false)

  // Track characters created inside the editor so the parent can merge them
  // without refetching the whole campaign roster on save.
  const createdCharsRef = useRef<Character[]>([])

  // ── Reset on scene change ─────────────────────────────────────
  useEffect(() => {
    setDraft(blankDraft(scene))
    setTab('scene')
    setError('')
    createdCharsRef.current = []
  }, [scene?.id])

  // ── Load campaign characters ──────────────────────────────────
  useEffect(() => {
    if (!campaignId) return
    setCharsLoading(true)
    supabase.from('characters').select('*').eq('campaign_id', campaignId).order('name')
      .then(({ data }) => { if (data) setCampaignChars(data as Character[]) })
      .then(() => setCharsLoading(false), () => setCharsLoading(false))
  }, [campaignId])

  // ── Load this scene's character pool ─────────────────────────
  useEffect(() => {
    if (!scene?.id) return
    supabase.from('scene_characters').select('*, character:characters(*)').eq('scene_id', scene.id)
      .then(({ data }) => {
        if (!data) return
        const pool = data
          .map(r => ({ character: r.character as Character, scale: r.scale ?? 1 }))
          .filter(e => !!e.character)
        setDraft(d => ({ ...d, characterPool: pool }))
      })
  }, [scene?.id])

  /**
   * Create a new character + add it to this scene's pool.
   * Returns the created Character on success so the calling tab can close
   * its form; returns null on failure (the error is surfaced via setError).
   */
  async function createCharacter(input: { name: string; file: File | null; url: string }): Promise<Character | null> {
    if ((!input.file && !input.url) || !input.name.trim()) return null
    try {
      let storagePath: string | undefined
      let url:         string | undefined
      if (input.file) storagePath = await uploadMedia(supabase, userId, input.file)
      else            url         = input.url
      const { data } = await supabase.from('characters').insert({
        campaign_id:  campaignId,
        name:         input.name.trim(),
        url:          url || null,
        storage_path: storagePath || null,
        file_name:    input.file?.name || null,
      }).select('*').single()
      if (!data) return null
      const newChar = data as Character
      setCampaignChars(prev => [...prev, newChar].sort((a, b) => a.name.localeCompare(b.name)))
      setDraft(d => ({ ...d, characterPool: [...d.characterPool, { character: newChar, scale: 1 }] }))
      createdCharsRef.current = [...createdCharsRef.current, newChar]
      return newChar
    } catch {
      setError('Failed to create character')
      return null
    }
  }

  async function handleSave() {
    setSaving(true); setError('')
    // Track every storage path uploaded in this save attempt so we can roll
    // them back if the subsequent DB writes fail (otherwise the files become
    // orphaned in the bucket with no referencing row).
    const newlyUploaded: string[] = []
    try {
      let bg = draft.bg
      if (draft._bgFile) {
        const path = await uploadMedia(supabase, userId, draft._bgFile)
        newlyUploaded.push(path)
        bg = { type: draft._bgFile.type.startsWith('video') ? 'video' : 'image', storage_path: path, file_name: draft._bgFile.name }
      }

      const scenePayload = {
        campaign_id: campaignId, name: draft.name || 'Untitled Scene',
        location: draft.location || null,
        dynamic_music: false,
        bg: bg ? { type: bg.type, url: bg.url, storage_path: bg.storage_path, file_name: bg.file_name } : null,
        order_index: scene?.order_index ?? 0,
      }

      let sceneId = scene?.id
      if (sceneId) {
        await supabase.from('scenes').update(scenePayload).eq('id', sceneId)
      } else {
        const { data } = await supabase.from('scenes').insert(scenePayload).select('id').single()
        sceneId = data!.id
      }

      // Tracks — preserve IDs so active_music_track_id in sessions stays valid
      const draftTrackIds = new Set(draft.tracks.filter(t => t.id).map(t => t.id!))
      if (scene?.id) {
        const { data: existingTracks } = await supabase.from('tracks').select('id, storage_path').eq('scene_id', sceneId!)
        const tracksToDelete = (existingTracks ?? []).filter(t => !draftTrackIds.has(t.id))
        const orphanedPaths  = tracksToDelete.map(t => t.storage_path).filter((p): p is string => !!p)
        if (tracksToDelete.length) await supabase.from('tracks').delete().in('id', tracksToDelete.map(t => t.id))
        await deleteMediaBatch(supabase, orphanedPaths)
      }
      const allTrackRows = (await Promise.all(draft.tracks.map(async (t, i) => {
        let storagePath = t.storage_path, fileName = t.file_name, url = t.url || null
        if (t._file) { storagePath = await uploadMedia(supabase, userId, t._file); newlyUploaded.push(storagePath); fileName = t._file.name; url = null }
        // Skip tracks that have no playable source and no Spotify URI
        if (!storagePath && !url && !t.spotify_uri) return null
        return { id: t.id, scene_id: sceneId!, kind: t.kind, name: t.name, url, storage_path: storagePath || null, file_name: fileName || null, spotify_uri: t.spotify_uri || null, spotify_type: t.spotify_type || null, loop: t.loop, volume: t.volume, order_index: i }
      }))).filter((t): t is NonNullable<typeof t> => t !== null)
      const tracksToUpsert = allTrackRows.filter(t => t.id).map(t => ({ ...t, id: t.id! }))
      const tracksToInsert = allTrackRows.filter(t => !t.id).map(({ id: _id, ...rest }) => rest)
      if (tracksToUpsert.length) await supabase.from('tracks').upsert(tracksToUpsert, { onConflict: 'id' })
      if (tracksToInsert.length) await supabase.from('tracks').insert(tracksToInsert)

      // Scene characters — selective delete + upsert so transient failures
      // never wipe the whole pool. The table has UNIQUE(scene_id, character_id)
      // so upsert safely handles both insert-new and update-scale-for-existing.
      {
        const draftCharIds = new Set(draft.characterPool.map(e => e.character.id))
        const { data: existingChars } = await supabase
          .from('scene_characters').select('id, character_id').eq('scene_id', sceneId!)
        const charIdsToRemove = (existingChars ?? [])
          .filter(c => !draftCharIds.has(c.character_id)).map(c => c.id)
        if (charIdsToRemove.length)
          await supabase.from('scene_characters').delete().in('id', charIdsToRemove)
        const charUpserts = draft.characterPool.map(e => ({
          scene_id: sceneId!, character_id: e.character.id, scale: e.scale,
        }))
        if (charUpserts.length)
          await supabase.from('scene_characters').upsert(charUpserts, { onConflict: 'scene_id,character_id' })
      }

      // Handouts — preserve IDs so active_handout_id in sessions stays valid
      const draftHandoutIds = new Set(draft.handouts.filter(h => h.id).map(h => h.id!))
      if (scene?.id) {
        const { data: existingHandouts } = await supabase.from('handouts').select('id, media').eq('scene_id', sceneId!)
        const handoutsToDelete     = (existingHandouts ?? []).filter(h => !draftHandoutIds.has(h.id))
        const orphanedHandoutPaths = handoutsToDelete
          .map((h: { media?: { storage_path?: string } | null }) => h.media?.storage_path)
          .filter((p): p is string => !!p)
        if (handoutsToDelete.length) await supabase.from('handouts').delete().in('id', handoutsToDelete.map(h => h.id))
        await deleteMediaBatch(supabase, orphanedHandoutPaths)
      }
      const allHandoutRows = await Promise.all(draft.handouts.map(async (h, i) => {
        // Strip signed_url before storing — it's ephemeral and must not be persisted in DB
        let media: MediaRef | null = h.media
          ? { type: h.media.type, url: h.media.url, storage_path: h.media.storage_path, file_name: h.media.file_name }
          : null
        if (h._file) {
          const path = await uploadMedia(supabase, userId, h._file)
          newlyUploaded.push(path)
          media = { type: 'image', storage_path: path, file_name: h._file.name }
        }
        return { id: h.id, scene_id: sceneId!, name: h.name, media: media || null, order_index: i }
      }))
      const handoutsToUpsert = allHandoutRows.filter(h => h.id).map(h => ({ ...h, id: h.id! }))
      const handoutsToInsert = allHandoutRows.filter(h => !h.id).map(({ id: _id, ...rest }) => rest)
      if (handoutsToUpsert.length) await supabase.from('handouts').upsert(handoutsToUpsert, { onConflict: 'id' })
      if (handoutsToInsert.length) {
        const { error: handoutInsertError } = await supabase.from('handouts').insert(handoutsToInsert)
        if (handoutInsertError) throw handoutInsertError
      }

      // Overlays — preserve IDs so active_overlays in sessions stays valid
      const draftOverlayIds = new Set(draft.overlays.filter(o => o.id).map(o => o.id!))
      if (scene?.id) {
        const { data: existingOverlays } = await supabase.from('scene_overlays').select('id, storage_path').eq('scene_id', sceneId!)
        const overlaysToDelete     = (existingOverlays ?? []).filter(o => !draftOverlayIds.has(o.id))
        const orphanedOverlayPaths = overlaysToDelete
          .map((o: { storage_path?: string | null }) => o.storage_path)
          .filter((p): p is string => !!p)
        if (overlaysToDelete.length) await supabase.from('scene_overlays').delete().in('id', overlaysToDelete.map(o => o.id))
        await deleteMediaBatch(supabase, orphanedOverlayPaths)
      }
      const allOverlayRows = (await Promise.all(draft.overlays.map(async (o, i) => {
        let storagePath = o.storage_path, fileName = o.file_name, url = o.url || null
        if (o._file) { storagePath = await uploadMedia(supabase, userId, o._file); newlyUploaded.push(storagePath); fileName = o._file.name; url = null }
        if (!storagePath && !url) return null
        return {
          id: o.id, scene_id: sceneId!, name: o.name, source: o.source,
          library_key: o.library_key || null,
          storage_path: storagePath || null, url: url || null, file_name: fileName || null,
          blend_mode: o.blend_mode, opacity: o.opacity, playback_rate: o.playback_rate,
          scale: o.scale, pan_x: o.pan_x, pan_y: o.pan_y,
          enabled_default: o.enabled_default, order_index: i,
        }
      }))).filter((o): o is NonNullable<typeof o> => o !== null)
      const overlaysToUpsert = allOverlayRows.filter(o => o.id).map(o => ({ ...o, id: o.id! }))
      const overlaysToInsert = allOverlayRows.filter(o => !o.id).map(({ id: _id, ...rest }) => rest)
      if (overlaysToUpsert.length) await supabase.from('scene_overlays').upsert(overlaysToUpsert, { onConflict: 'id' })
      if (overlaysToInsert.length) await supabase.from('scene_overlays').insert(overlaysToInsert)

      const { data: savedScene } = await supabase.from('scenes').select('*, tracks(*), handouts(*), scene_overlays(*)').eq('id', sceneId!).single()
      const savedSceneTyped = savedScene as Scene & { scene_overlays?: SceneOverlay[] }
      onSave({ ...savedSceneTyped, overlays: savedSceneTyped.scene_overlays ?? [] }, createdCharsRef.current)
      createdCharsRef.current = []
    } catch (e: unknown) {
      // Roll back any files we already uploaded — the DB write failed so
      // these paths would otherwise be permanently orphaned in the bucket.
      if (newlyUploaded.length) deleteMediaBatch(supabase, newlyUploaded).catch(() => {})
      setError(e instanceof Error ? e.message : 'Failed to save scene')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,18,.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxHeight: '90vh' }}>
        <div style={{ width: '680px', maxWidth: '95vw', background: 'var(--editor-bg)', border: '1px solid var(--border-lt)', borderRadius: '10px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 32px 80px rgba(0,0,0,.9)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', padding: '12px 20px 0', fontFamily: "'Cinzel',serif", fontSize: '13px', letterSpacing: '4px', color: 'var(--text-2)', textTransform: 'uppercase' }}>
              {scene ? scene.name : 'New Scene'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
              {(['scene', 'handouts', 'overlays'] as TabKey[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: tab === t ? 'var(--text)' : 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, marginBottom: '-1px' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
            {/* key={scene?.id} forces a remount when the editor opens a different
                scene — local form state inside each tab resets for free. */}
            {tab === 'scene' && (
              <SceneTab
                key={scene?.id ?? 'new'}
                draft={draft}
                setDraft={setDraft}
                campaignChars={campaignChars}
                charsLoading={charsLoading}
                createCharacter={createCharacter}
              />
            )}
            {tab === 'handouts' && (
              <HandoutsTab key={scene?.id ?? 'new'} draft={draft} setDraft={setDraft} />
            )}
            {tab === 'overlays' && (
              <OverlaysTab key={scene?.id ?? 'new'} draft={draft} setDraft={setDraft} />
            )}

            {error && (
              <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: '6px', fontSize: '12px', color: 'var(--accent)' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
          <button onClick={onClose} title="Discard"
            style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--border-lt)', background: 'var(--bg-raised)', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <button onClick={handleSave} disabled={saving} title="Save"
            style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: '16px', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? .6 : 1 }}>
            {saving ? '…' : '✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
