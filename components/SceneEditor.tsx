'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import type { Scene, Track, MediaRef, Character, Handout, SceneOverlay } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { uploadMedia, deleteMediaBatch } from '@/lib/supabase/storage'
import { characterImageUrl } from '@/components/CharacterDisplay'
import UploadZone from './UploadZone'
import { OVERLAY_LIBRARY, OVERLAY_CATEGORIES } from '@/lib/overlay-library'

interface Props {
  scene: Scene | null
  campaignId: string
  userId: string
  onSave: (scene: Scene, newCharacters?: Character[]) => void
  onClose: () => void
}

type Kind = 'music' | 'ml2' | 'ml3' | 'ambience'
type TabKey = 'scene' | 'handouts' | 'overlays'

interface HandoutDraft {
  id?: string
  name: string
  media: MediaRef | null
  _file?: File
}

interface OverlayDraft {
  id?: string
  name: string
  source: 'library' | 'upload'
  library_key?: string
  storage_path?: string
  url?: string
  file_name?: string
  blend_mode: 'screen' | 'lighten' | 'multiply' | 'overlay'
  opacity: number
  playback_rate: number
  scale: number
  pan_x: number
  pan_y: number
  enabled_default: boolean
  _file?: File
}

interface TrackDraft {
  id?: string; kind: Kind; name: string; url: string
  storage_path?: string; file_name?: string
  spotify_uri?: string; spotify_type?: 'track' | 'playlist'
  loop: boolean; volume: number; _file?: File
}

interface CharPoolEntry {
  character: Character
  scale:     number
}

interface Draft {
  name: string; location: string
  bg: MediaRef | null; tracks: TrackDraft[]
  _bgFile?: File
  characterPool: CharPoolEntry[]
  handouts: HandoutDraft[]
  overlays: OverlayDraft[]
}

function blankDraft(scene: Scene | null): Draft {
  const existing = (kind: Kind): TrackDraft[] =>
    (scene?.tracks || []).filter(t => t.kind === kind)
      .map(t => ({ id: t.id, kind, name: t.name, url: t.url || '', storage_path: t.storage_path, file_name: t.file_name, spotify_uri: t.spotify_uri, spotify_type: t.spotify_type, loop: t.loop, volume: t.volume }))
  return {
    name: scene?.name || '', location: scene?.location || '',
    bg: scene?.bg || null,
    tracks: [...existing('music'), ...existing('ambience')],
    characterPool: [],
    handouts: (scene?.handouts || []).map(h => ({ id: h.id, name: h.name, media: h.media })),
    overlays: (scene?.overlays || []).map(o => ({
      id: o.id, name: o.name, source: o.source, library_key: o.library_key ?? undefined,
      storage_path: o.storage_path ?? undefined, url: o.url ?? undefined, file_name: o.file_name ?? undefined,
      blend_mode: o.blend_mode, opacity: o.opacity, playback_rate: o.playback_rate,
      scale: o.scale, pan_x: o.pan_x, pan_y: o.pan_y, enabled_default: o.enabled_default,
    })),
  }
}

export default function SceneEditor({ scene, campaignId, userId, onSave, onClose }: Props) {
  const supabase = createClient()
  const [tab, setTab]       = useState<TabKey>('scene')
  const [draft, setDraft]   = useState<Draft>(blankDraft(scene))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Campaign characters (for search + picker)
  const [campaignChars, setCampaignChars] = useState<Character[]>([])
  const [charsLoading, setCharsLoading]   = useState(false)
  const [charSearch, setCharSearch]       = useState('')
  const [charPickerOpen, setCharPickerOpen] = useState(false)

  // New character upload state
  const [newCharOpen, setNewCharOpen] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharFile, setNewCharFile] = useState<File | null>(null)
  const [newCharUrl,  setNewCharUrl]  = useState('')
  const [newCharSaving, setNewCharSaving] = useState(false)

  // Handout add form state
  const [newHandoutOpen, setNewHandoutOpen] = useState(false)
  const [newHandoutName, setNewHandoutName] = useState('')
  const [newHandoutFile, setNewHandoutFile] = useState<File | null>(null)
  const [newHandoutUrl,  setNewHandoutUrl]  = useState('')

  // Overlay add form state
  const [overlayPickerOpen, setOverlayPickerOpen] = useState(false)
  const [overlayPickerTab, setOverlayPickerTab]   = useState<'library' | 'upload'>('library')
  const [newOverlayName, setNewOverlayName]       = useState('')
  const [newOverlayFile, setNewOverlayFile]       = useState<File | null>(null)
  const [newOverlayUrl,  setNewOverlayUrl]        = useState('')
  const [overlayLibCat,  setOverlayLibCat]        = useState(OVERLAY_CATEGORIES[0] ?? '')
  // Which overlay row is expanded for editing
  const [expandedOverlayIdx, setExpandedOverlayIdx] = useState<number | null>(null)

  // Track characters created inside the editor so the parent can merge them
  // without refetching the whole campaign roster on save.
  const createdCharsRef = useRef<Character[]>([])

  useEffect(() => {
    setDraft(blankDraft(scene))
    setTab('scene')
    setError('')
    setCharPickerOpen(false)
    setNewCharOpen(false)
    setOverlayPickerOpen(false)
    setExpandedOverlayIdx(null)
    createdCharsRef.current = []
  }, [scene?.id])

  // Load all campaign characters
  useEffect(() => {
    if (!campaignId) return
    setCharsLoading(true)
    supabase.from('characters').select('*').eq('campaign_id', campaignId).order('name')
      .then(({ data }) => { if (data) setCampaignChars(data as Character[]) })
      .then(() => setCharsLoading(false), () => setCharsLoading(false))
  }, [campaignId])

  // Load scene's character pool
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

  const tracksOf = (kind: Kind) => draft.tracks.filter(t => t.kind === kind)
  const addTrack = (kind: Kind, t: Omit<TrackDraft, 'kind'>) =>
    setDraft(d => ({ ...d, tracks: [...d.tracks, { ...t, kind }] }))
  const removeTrack = (idx: number) =>
    setDraft(d => ({ ...d, tracks: d.tracks.filter((_, i) => i !== idx) }))

  const poolIds = new Set(draft.characterPool.map(e => e.character.id))
  const filteredChars = campaignChars.filter(c =>
    !poolIds.has(c.id) &&
    (!charSearch || c.name.toLowerCase().includes(charSearch.toLowerCase()))
  )

  // Create a new character + add to pool
  async function createCharacter() {
    if ((!newCharFile && !newCharUrl) || !newCharName.trim()) return
    setNewCharSaving(true)
    try {
      let storagePath: string | undefined
      let url: string | undefined
      if (newCharFile) {
        storagePath = await uploadMedia(supabase, userId, newCharFile)
      } else {
        url = newCharUrl
      }
      const { data } = await supabase.from('characters').insert({
        campaign_id:  campaignId,
        name:         newCharName.trim(),
        url:          url || null,
        storage_path: storagePath || null,
        file_name:    newCharFile?.name || null,
      }).select('*').single()
      if (data) {
        const newChar = data as Character
        setCampaignChars(prev => [...prev, newChar].sort((a, b) => a.name.localeCompare(b.name)))
        setDraft(d => ({ ...d, characterPool: [...d.characterPool, { character: newChar, scale: 1 }] }))
        createdCharsRef.current = [...createdCharsRef.current, newChar]
        setNewCharOpen(false); setNewCharName(''); setNewCharFile(null); setNewCharUrl('')
      }
    } catch (e) {
      setError('Failed to create character')
    } finally {
      setNewCharSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      let bg = draft.bg
      if (draft._bgFile) {
        const path = await uploadMedia(supabase, userId, draft._bgFile)
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

      // Tracks
      if (scene?.id) {
        const { data: existingTracks } = await supabase.from('tracks').select('storage_path').eq('scene_id', sceneId!)
        const reusedPaths = new Set(draft.tracks.filter(t => !t._file).map(t => t.storage_path).filter(Boolean))
        const orphanedPaths = (existingTracks ?? []).map(t => t.storage_path).filter((p): p is string => !!p && !reusedPaths.has(p))
        await supabase.from('tracks').delete().eq('scene_id', sceneId!)
        await deleteMediaBatch(supabase, orphanedPaths)
      }
      const trackInserts = (await Promise.all(draft.tracks.map(async (t, i) => {
        let storagePath = t.storage_path, fileName = t.file_name, url = t.url || null
        if (t._file) { storagePath = await uploadMedia(supabase, userId, t._file); fileName = t._file.name; url = null }
        // Skip tracks that have no playable source and no Spotify URI
        if (!storagePath && !url && !t.spotify_uri) return null
        return { scene_id: sceneId!, kind: t.kind, name: t.name, url, storage_path: storagePath || null, file_name: fileName || null, spotify_uri: t.spotify_uri || null, spotify_type: t.spotify_type || null, loop: t.loop, volume: t.volume, order_index: i }
      }))).filter((t): t is NonNullable<typeof t> => t !== null)
      if (trackInserts.length) await supabase.from('tracks').insert(trackInserts)

      // Scene characters — delete existing, re-insert pool (no position)
      await supabase.from('scene_characters').delete().eq('scene_id', sceneId!)
      const charInserts = draft.characterPool.map(e => ({
        scene_id:     sceneId!,
        character_id: e.character.id,
        scale:        e.scale,
      }))
      if (charInserts.length) await supabase.from('scene_characters').insert(charInserts)

      // Handouts — delete existing, re-insert
      if (scene?.id) {
        const { data: existingHandouts } = await supabase.from('handouts').select('media').eq('scene_id', sceneId!)
        const reusedHandoutPaths = new Set(draft.handouts.filter(h => !h._file).map(h => h.media?.storage_path).filter(Boolean))
        const orphanedHandoutPaths = (existingHandouts ?? [])
          .map((h: { media?: { storage_path?: string } | null }) => h.media?.storage_path)
          .filter((p): p is string => !!p && !reusedHandoutPaths.has(p))
        await supabase.from('handouts').delete().eq('scene_id', sceneId!)
        await deleteMediaBatch(supabase, orphanedHandoutPaths)
      }
      const handoutInserts = await Promise.all(draft.handouts.map(async (h, i) => {
        // Strip signed_url before storing — it's ephemeral and must not be persisted in DB
        let media: MediaRef | null = h.media
          ? { type: h.media.type, url: h.media.url, storage_path: h.media.storage_path, file_name: h.media.file_name }
          : null
        if (h._file) {
          const path = await uploadMedia(supabase, userId, h._file)
          media = { type: 'image', storage_path: path, file_name: h._file.name }
        }
        return { scene_id: sceneId!, name: h.name, media: media || null, order_index: i }
      }))
      if (handoutInserts.length) {
        const { error: handoutInsertError } = await supabase.from('handouts').insert(handoutInserts)
        if (handoutInsertError) throw handoutInsertError
      }

      // Overlays — delete existing, re-insert
      if (scene?.id) {
        const { data: existingOverlays } = await supabase.from('scene_overlays').select('storage_path').eq('scene_id', sceneId!)
        const reusedOverlayPaths = new Set(draft.overlays.filter(o => !o._file).map(o => o.storage_path).filter(Boolean))
        const orphanedOverlayPaths = (existingOverlays ?? [])
          .map((o: { storage_path?: string | null }) => o.storage_path)
          .filter((p): p is string => !!p && !reusedOverlayPaths.has(p))
        await supabase.from('scene_overlays').delete().eq('scene_id', sceneId!)
        await deleteMediaBatch(supabase, orphanedOverlayPaths)
      }
      const overlayInserts = await Promise.all(draft.overlays.map(async (o, i) => {
        let storagePath = o.storage_path, fileName = o.file_name, url = o.url || null
        if (o._file) { storagePath = await uploadMedia(supabase, userId, o._file); fileName = o._file.name; url = null }
        if (!storagePath && !url) return null
        return {
          scene_id: sceneId!, name: o.name, source: o.source,
          library_key: o.library_key || null,
          storage_path: storagePath || null, url: url || null, file_name: fileName || null,
          blend_mode: o.blend_mode, opacity: o.opacity, playback_rate: o.playback_rate,
          scale: o.scale, pan_x: o.pan_x, pan_y: o.pan_y,
          enabled_default: o.enabled_default, order_index: i,
        }
      }))
      const validOverlayInserts = overlayInserts.filter((o): o is NonNullable<typeof o> => o !== null)
      if (validOverlayInserts.length) await supabase.from('scene_overlays').insert(validOverlayInserts)

      const { data: savedScene } = await supabase.from('scenes').select('*, tracks(*), handouts(*), scene_overlays(*)').eq('id', sceneId!).single()
      const savedSceneTyped = savedScene as Scene & { scene_overlays?: SceneOverlay[] }
      onSave({ ...savedSceneTyped, overlays: savedSceneTyped.scene_overlays ?? [] }, createdCharsRef.current)
      createdCharsRef.current = []
    } catch (e: unknown) {
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
                <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: tab === t ? 'var(--text)' : 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, marginBottom: '-1px' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
            {tab === 'scene' && (
              <>
                {/* Name + Location */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', paddingTop: '20px' }}>
                  <div>
                    <label className="flabel">Name</label>
                    <input className="finput" value={draft.name} placeholder="New Scene" onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="flabel">Location</label>
                    <input className="finput" value={draft.location} placeholder="Location" onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} />
                  </div>
                </div>

                {/* VISUAL */}
                <Section title="Visual">
                  <PropRow label="Background" desc="Base image or video.">
                    <MediaField slot="bg" value={draft.bg} file={draft._bgFile} accept="image/*,video/*" icon="🖼" hint="JPG, PNG, WebP, MP4, WebM"
                      onFile={f => setDraft(d => ({ ...d, _bgFile: f, bg: { type: f.type.startsWith('video') ? 'video' : 'image', file_name: f.name } }))}
                      onUrl={(type, url) => setDraft(d => ({ ...d, _bgFile: undefined, bg: { type, url } }))}
                      onClear={() => setDraft(d => ({ ...d, _bgFile: undefined, bg: null }))} />
                  </PropRow>
                </Section>

                {/* CHARACTERS */}
                <Section title="Characters">
                  {/* Pool entries */}
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {draft.characterPool.map((entry, idx) => {
                      const imgUrl = characterImageUrl(entry.character)
                      return (
                        <div key={entry.character.id}>
                          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0', gap: '14px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--editor-row)', border: '1px solid var(--border-lt)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {imgUrl
                                ? <Image src={imgUrl} alt={entry.character.name} width={48} height={48} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                                : <span style={{ fontSize: '20px', opacity: .4 }}>🧑</span>
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.character.name}
                              </div>
                            </div>
                            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}
                              onClick={() => setDraft(d => ({ ...d, characterPool: d.characterPool.filter((_, i) => i !== idx) }))}>
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Empty state */}
                    {draft.characterPool.length === 0 && (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
                        No characters in this scene — add some below.
                      </div>
                    )}
                  </div>

                  {/* Add character / create new buttons */}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
                    <button className={`add-pill${charPickerOpen ? ' active' : ''}`} style={{ fontSize: '10px', padding: '6px 12px' }}
                      onClick={() => { setCharPickerOpen(o => !o); setNewCharOpen(false); setCharSearch('') }}>
                      ADD CHARACTER <span style={{ fontSize: '9px' }}>▼</span>
                    </button>
                    <button className={`add-pill${newCharOpen ? ' active' : ''}`} style={{ fontSize: '10px', padding: '6px 12px' }}
                      onClick={() => { setNewCharOpen(o => !o); setCharPickerOpen(false) }}>
                      + CREATE NEW <span style={{ fontSize: '9px' }}>▼</span>
                    </button>
                  </div>

                  {/* Character picker */}
                  {charPickerOpen && (
                    <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '12px', marginTop: '8px' }}>
                      <input
                        autoFocus
                        className="finput"
                        placeholder="Search characters…"
                        value={charSearch}
                        onChange={e => setCharSearch(e.target.value)}
                        style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }}
                      />
                      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {charsLoading && (
                          <div style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>
                            Loading characters…
                          </div>
                        )}
                        {!charsLoading && filteredChars.length === 0 && (
                          <div style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>
                            {campaignChars.length === 0 ? 'No characters yet — create one below' : campaignChars.length === draft.characterPool.length ? 'All characters already added' : 'No matches'}
                          </div>
                        )}
                        {!charsLoading && filteredChars.map(c => (
                          <button key={c.id}
                            onClick={() => {
                              setDraft(d => ({ ...d, characterPool: [...d.characterPool, { character: c, scale: 1 }] }))
                              setCharPickerOpen(false); setCharSearch('')
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', width: '100%', textAlign: 'left' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ width: '34px', height: '34px', borderRadius: '6px', background: 'var(--bg-raised)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {characterImageUrl(c)
                                ? <Image src={characterImageUrl(c)!} alt={c.name} width={34} height={34} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                                : <span style={{ fontSize: '14px' }}>🧑</span>
                              }
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New character form */}
                  {newCharOpen && (
                    <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '14px', marginTop: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '10px' }}>New Character</div>
                      <input className="finput" placeholder="Character name" value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }} />
                      <UploadZone accept="image/*" label="Drop character art here" icon="🧑" hint="PNG with transparency recommended — tall portrait works best" onFile={f => setNewCharFile(f)} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                      </div>
                      <input className="finput" placeholder="https://… image URL" value={newCharUrl} onChange={e => setNewCharUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setNewCharOpen(false); setNewCharName(''); setNewCharFile(null); setNewCharUrl('') }}>Cancel</button>
                        <button className="btn btn-red btn-sm" onClick={createCharacter} disabled={!newCharName.trim() || (!newCharFile && !newCharUrl) || newCharSaving}>
                          {newCharSaving ? 'Creating…' : 'Create & Add'}
                        </button>
                      </div>
                    </div>
                  )}
                </Section>

                {/* AUDIO */}
                <Section title="Audio">
                  <PropRow label="Music" desc="Looping background music.">
                    <TrackAdder kind="music" onAdd={t => addTrack('music', t)} />
                  </PropRow>
                  {tracksOf('music').map((t, i) => <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />)}
                  <PropRow label="Sound" desc="Ambient background sound.">
                    <TrackAdder kind="ambience" onAdd={t => addTrack('ambience', t)} />
                  </PropRow>
                  {tracksOf('ambience').map((t, i) => <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />)}
                </Section>
              </>
            )}

            {tab === 'handouts' && (
              <div style={{ paddingTop: '20px' }}>
                <Section title="Handouts">
                  {/* Handout list */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {draft.handouts.map((h, idx) => {
                      const imgUrl = h.media?.signed_url || h.media?.url || (h._file ? URL.createObjectURL(h._file) : null)
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--editor-row)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: 'var(--editor-card)', border: '1px solid var(--border-lt)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {imgUrl
                              ? <img src={imgUrl} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: '18px', opacity: 0.4 }}>🗺</span>
                            }
                          </div>
                          <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name || 'Untitled'}</span>
                          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}
                            onClick={() => setDraft(d => ({ ...d, handouts: d.handouts.filter((_, i) => i !== idx) }))}>
                            Remove
                          </button>
                        </div>
                      )
                    })}
                    {draft.handouts.length === 0 && (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
                        No handouts yet — add maps, images, or documents below.
                      </div>
                    )}
                  </div>

                  {/* Add handout */}
                  <div style={{ paddingTop: '12px' }}>
                    <button className={`add-pill${newHandoutOpen ? ' active' : ''}`} style={{ fontSize: '10px', padding: '6px 12px' }}
                      onClick={() => { setNewHandoutOpen(o => !o); setNewHandoutName(''); setNewHandoutFile(null); setNewHandoutUrl('') }}>
                      + ADD HANDOUT <span style={{ fontSize: '9px' }}>▼</span>
                    </button>
                    {newHandoutOpen && (
                      <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '14px', marginTop: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '10px' }}>New Handout</div>
                        <input className="finput" placeholder="Name (e.g. Treasure Map, Letter from the King)" value={newHandoutName} onChange={e => setNewHandoutName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }} />
                        <UploadZone accept="image/*" label="Drop image here" icon="🗺" hint="PNG, JPG, WebP" onFile={f => setNewHandoutFile(f)} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                        </div>
                        <input className="finput" placeholder="https://… image URL" value={newHandoutUrl} onChange={e => setNewHandoutUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setNewHandoutOpen(false); setNewHandoutName(''); setNewHandoutFile(null); setNewHandoutUrl('') }}>Cancel</button>
                          <button className="btn btn-red btn-sm"
                            disabled={!newHandoutName.trim() || (!newHandoutFile && !newHandoutUrl)}
                            onClick={() => {
                              if (!newHandoutName.trim() || (!newHandoutFile && !newHandoutUrl)) return
                              const media: MediaRef | null = newHandoutFile
                                ? { type: 'image', file_name: newHandoutFile.name }
                                : newHandoutUrl
                                ? { type: 'image', url: newHandoutUrl }
                                : null
                              setDraft(d => ({ ...d, handouts: [...d.handouts, { name: newHandoutName.trim(), media, _file: newHandoutFile || undefined }] }))
                              setNewHandoutOpen(false); setNewHandoutName(''); setNewHandoutFile(null); setNewHandoutUrl('')
                            }}>
                            Add Handout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              </div>
            )}

            {tab === 'overlays' && (
              <div style={{ paddingTop: '20px' }}>
                <Section title="Overlays">
                  {/* Overlay list */}
                  <div>
                    {draft.overlays.map((o, idx) => {
                      const isExpanded = expandedOverlayIdx === idx
                      return (
                        <div key={idx} style={{ background: 'var(--editor-row)', borderRadius: '8px', marginTop: '8px', overflow: 'hidden' }}>
                          {/* Row header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--editor-card)', border: '1px solid var(--border-lt)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', overflow: 'hidden' }}>
                              {o.source === 'library' ? '🌫' : '📁'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>{o.blend_mode} · {Math.round(o.opacity * 100)}% opacity</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setExpandedOverlayIdx(isExpanded ? null : idx)}
                              >
                                {isExpanded ? 'Done' : 'Edit'}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setDraft(d => ({ ...d, overlays: d.overlays.filter((_, i) => i !== idx) }))
                                  if (expandedOverlayIdx === idx) setExpandedOverlayIdx(null)
                                }}
                              >Remove</button>
                            </div>
                          </div>

                          {/* Expanded controls */}
                          {isExpanded && (
                            <div style={{ padding: '0 12px 14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                              {/* Name */}
                              <div style={{ marginBottom: '10px' }}>
                                <label className="flabel">Name</label>
                                <input className="finput" value={o.name} onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) }))} style={{ fontSize: '12px', padding: '7px 10px' }} />
                              </div>
                              {/* Blend mode */}
                              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ flex: 1 }}>
                                  <label className="flabel">Blend Mode</label>
                                  <select className="fselect" value={o.blend_mode} onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, blend_mode: e.target.value as OverlayDraft['blend_mode'] } : x) }))} style={{ fontSize: '12px', padding: '7px 8px', width: '100%' }}>
                                    <option value="screen">Screen (fog, fire, light)</option>
                                    <option value="lighten">Lighten (snow, embers)</option>
                                    <option value="multiply">Multiply (storm, shadow)</option>
                                    <option value="overlay">Overlay (mood, tint)</option>
                                  </select>
                                </div>
                              </div>
                              {/* Opacity + Playback rate */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label className="flabel">Opacity — {Math.round(o.opacity * 100)}%</label>
                                  <input type="range" min={0} max={1} step={0.01} value={o.opacity}
                                    onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, opacity: Number(e.target.value) } : x) }))}
                                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                                </div>
                                <div>
                                  <label className="flabel">Speed — {o.playback_rate.toFixed(1)}x</label>
                                  <input type="range" min={0.25} max={2} step={0.05} value={o.playback_rate}
                                    onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, playback_rate: Number(e.target.value) } : x) }))}
                                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                                </div>
                              </div>
                              {/* Scale + Pan */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label className="flabel">Scale — {o.scale.toFixed(1)}x</label>
                                  <input type="range" min={1} max={3} step={0.1} value={o.scale}
                                    onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, scale: Number(e.target.value) } : x) }))}
                                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                                </div>
                                <div>
                                  <label className="flabel">Pan X — {Math.round(o.pan_x)}%</label>
                                  <input type="range" min={0} max={100} step={1} value={o.pan_x}
                                    onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, pan_x: Number(e.target.value) } : x) }))}
                                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                                </div>
                                <div>
                                  <label className="flabel">Pan Y — {Math.round(o.pan_y)}%</label>
                                  <input type="range" min={0} max={100} step={1} value={o.pan_y}
                                    onChange={e => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, pan_y: Number(e.target.value) } : x) }))}
                                    style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '36px' }} />
                                </div>
                              </div>
                              {/* On by default */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)' }}>On by default</span>
                                <button
                                  onClick={() => setDraft(d => ({ ...d, overlays: d.overlays.map((x, i) => i === idx ? { ...x, enabled_default: !x.enabled_default } : x) }))}
                                  style={{
                                    fontSize: '10px', padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', border: `1px solid ${o.enabled_default ? 'var(--accent)' : 'var(--border)'}`,
                                    background: o.enabled_default ? 'var(--accent-bg)' : 'none',
                                    color: o.enabled_default ? 'var(--accent)' : 'var(--text-2)',
                                  }}
                                >{o.enabled_default ? 'Yes' : 'No'}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {draft.overlays.length === 0 && (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
                        No overlays yet — add fog, rain, smoke, or other atmospheric effects below.
                      </div>
                    )}
                  </div>

                  {/* Add overlay */}
                  <div style={{ paddingTop: '12px' }}>
                    <button className={`add-pill${overlayPickerOpen ? ' active' : ''}`} style={{ fontSize: '10px', padding: '6px 12px' }}
                      onClick={() => { setOverlayPickerOpen(o => !o); setNewOverlayName(''); setNewOverlayFile(null); setNewOverlayUrl('') }}>
                      + ADD OVERLAY <span style={{ fontSize: '9px' }}>▼</span>
                    </button>

                    {overlayPickerOpen && (
                      <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '14px', marginTop: '8px' }}>
                        {/* Tab toggle */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                          {(['library', 'upload'] as const).map(t => (
                            <button key={t} onClick={() => setOverlayPickerTab(t)} style={{ padding: '5px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${overlayPickerTab === t ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '5px', background: overlayPickerTab === t ? 'var(--accent-bg)' : 'none', color: overlayPickerTab === t ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer' }}>
                              {t === 'library' ? '✨ Library' : '📁 Upload'}
                            </button>
                          ))}
                        </div>

                        {overlayPickerTab === 'library' && (
                          <>
                            {/* Category filter */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                              {OVERLAY_CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => setOverlayLibCat(cat)} style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', border: `1px solid ${overlayLibCat === cat ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '12px', background: overlayLibCat === cat ? 'var(--accent-bg)' : 'none', color: overlayLibCat === cat ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
                                  {cat}
                                </button>
                              ))}
                            </div>
                            {/* Library grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '8px' }}>
                              {OVERLAY_LIBRARY.filter(l => l.category === overlayLibCat).map(lib => (
                                <button
                                  key={lib.key}
                                  onClick={() => {
                                    if (!lib.storage_path) return
                                    setDraft(d => ({
                                      ...d,
                                      overlays: [...d.overlays, {
                                        name: lib.name, source: 'library', library_key: lib.key,
                                        storage_path: lib.storage_path!, blend_mode: lib.blend_mode,
                                        opacity: lib.opacity, playback_rate: lib.playback_rate,
                                        scale: 1, pan_x: 50, pan_y: 50, enabled_default: true,
                                      }],
                                    }))
                                    setOverlayPickerOpen(false)
                                  }}
                                  disabled={!lib.storage_path}
                                  style={{ background: 'var(--editor-row)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '12px 10px', cursor: lib.storage_path ? 'pointer' : 'default', textAlign: 'left', opacity: lib.storage_path ? 1 : 0.4, display: 'flex', flexDirection: 'column', gap: '4px' }}
                                  onMouseEnter={e => { if (lib.storage_path) e.currentTarget.style.borderColor = 'var(--accent)' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-lt)' }}
                                >
                                  <span style={{ fontSize: '20px' }}>🌫</span>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>{lib.name}</span>
                                  <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{lib.blend_mode}</span>
                                  {!lib.storage_path && <span style={{ fontSize: '9px', color: 'var(--accent)', textTransform: 'uppercase' }}>Coming soon</span>}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {overlayPickerTab === 'upload' && (
                          <>
                            <input className="finput" placeholder="Name" value={newOverlayName} onChange={e => setNewOverlayName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }} />
                            <UploadZone accept="video/*" label="Drop overlay video here" icon="🎬" hint="MP4 or WebM on black background — bright areas show through" onFile={f => { setNewOverlayFile(f); setNewOverlayName(n => n || f.name.replace(/\.[^.]+$/, '')) }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                            </div>
                            <input className="finput" placeholder="https://… video URL" value={newOverlayUrl} onChange={e => setNewOverlayUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setOverlayPickerOpen(false); setNewOverlayName(''); setNewOverlayFile(null); setNewOverlayUrl('') }}>Cancel</button>
                              <button className="btn btn-red btn-sm"
                                disabled={!newOverlayName.trim() || (!newOverlayFile && !newOverlayUrl)}
                                onClick={() => {
                                  if (!newOverlayName.trim() || (!newOverlayFile && !newOverlayUrl)) return
                                  setDraft(d => ({
                                    ...d,
                                    overlays: [...d.overlays, {
                                      name: newOverlayName.trim(), source: 'upload',
                                      url: newOverlayUrl || undefined, _file: newOverlayFile || undefined,
                                      file_name: newOverlayFile?.name,
                                      blend_mode: 'screen', opacity: 0.7, playback_rate: 1.0,
                                      scale: 1, pan_x: 50, pan_y: 50, enabled_default: true,
                                    }],
                                  }))
                                  setOverlayPickerOpen(false); setNewOverlayName(''); setNewOverlayFile(null); setNewOverlayUrl('')
                                }}>
                                Add Overlay
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Section>
              </div>
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
          <button onClick={onClose} title="Discard" style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--border-lt)', background: 'var(--bg-raised)', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <button onClick={handleSave} disabled={saving} title="Save" style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: '16px', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? .6 : 1 }}>
            {saving ? '…' : '✓'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '28px' }}>
      <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: '15px', fontWeight: 700, color: 'var(--text)', letterSpacing: '1px', paddingBottom: '10px', borderBottom: '2px solid var(--accent)', display: 'block', marginBottom: 0 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function PropRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text)', marginBottom: '4px' }}>{label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{desc}</div>
        </div>
        <button className={`add-pill${open ? ' active' : ''}`} onClick={() => setOpen(o => !o)}>
          {open ? 'CLOSE' : 'ADD'} <span style={{ fontSize: '9px' }}>▼</span>
        </button>
      </div>
      {open && (
        <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '16px', marginBottom: '4px' }}>
          {children}
        </div>
      )}
    </>
  )
}

function MediaField({ accept, icon, hint, onFile, onUrl, onClear, value, file }: { slot: string; accept: string; icon: string; hint: string; value: MediaRef | null; file?: File; onFile: (f: File) => void; onUrl: (type: 'image' | 'video', url: string) => void; onClear: () => void }) {
  const [type, setType] = useState<'image' | 'video'>('image')
  const [url,  setUrl]  = useState('')
  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--editor-row)', borderRadius: '6px', padding: '8px 12px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name || value.file_name || value.url || ''}</span>
        <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase' }}>{value.type}</span>
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px' }}>✕</button>
      </div>
    )
  }
  return (
    <div>
      <UploadZone accept={accept} label="Drop file here" icon={icon} hint={hint} onFile={onFile} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} /><span>or paste a URL</span><div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select className="fselect" value={type} onChange={e => setType(e.target.value as 'image' | 'video')} style={{ flexShrink: 0, width: '90px', padding: '7px 8px', fontSize: '12px' }}>
          <option value="image">Image</option><option value="video">Video</option>
        </select>
        <input className="finput" value={url} placeholder="https://…" onChange={e => setUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
        <button className="btn btn-red btn-sm" onClick={() => { if (url) { onUrl(type, url); setUrl('') } }}>Set</button>
      </div>
    </div>
  )
}

type AdderTab = 'file' | 'spotify'

interface SpotifyResult {
  uri: string; name: string; artist?: string; image: string | null
  type: 'track' | 'playlist'
}

function TrackAdder({ kind, onAdd }: { kind: Kind; onAdd: (t: Omit<TrackDraft, 'kind'>) => void }) {
  const [tab,  setTab]  = useState<AdderTab>('file')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [url,  setUrl]  = useState('')

  // Spotify search state
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SpotifyResult[]>([])
  const [searching, setSearching] = useState(false)
  const [noConn,   setNoConn]   = useState(false)
  const searchTimer = useState<ReturnType<typeof setTimeout> | null>(null)

  function submitFile() {
    const n = name || file?.name?.replace(/\.[^.]+$/, '') || 'Track'
    if (file) onAdd({ name: n, url: '', _file: file, loop: true, volume: 0.7 })
    else if (url) onAdd({ name: n, url, loop: true, volume: 0.7 })
    setFile(null); setName(''); setUrl('')
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    if (searchTimer[0]) clearTimeout(searchTimer[0])
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
        if (res.status === 403 || res.status === 404) { setNoConn(true); return }
        if (!res.ok) return
        const data = await res.json()
        const tracks:    SpotifyResult[] = data.tracks.map((t: any)    => ({ ...t, type: 'track'    as const }))
        const playlists: SpotifyResult[] = data.playlists.map((p: any) => ({ ...p, type: 'playlist' as const }))
        setResults([...tracks, ...playlists])
        setNoConn(false)
      } finally {
        setSearching(false)
      }
    }, 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ;(searchTimer as any)[0] = t
  }

  function pickSpotify(r: SpotifyResult) {
    onAdd({ name: r.name, url: '', spotify_uri: r.uri, spotify_type: r.type, loop: true, volume: 0.7 })
    setQuery(''); setResults([])
  }

  // Ambience tracks are played simultaneously — Spotify's single-stream limit
  // means a Spotify ambience track would steal the stream from music. File/URL only.
  const availableTabs: AdderTab[] = kind === 'ambience' ? ['file'] : ['file', 'spotify']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {availableTabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '5px', background: tab === t ? 'var(--accent-bg)' : 'none', color: tab === t ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer' }}>
            {t === 'spotify' ? '🎧 Spotify' : '📁 File / URL'}
          </button>
        ))}
      </div>

      {tab === 'file' && (
        <>
          <UploadZone accept="audio/*" label="Drop audio file here" icon="🎵" hint="MP3, OGG, WAV, FLAC" onFile={f => { setFile(f); setName(n => n || f.name.replace(/\.[^.]+$/, '')) }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <input className="finput" value={name} placeholder="Track name" onChange={e => setName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
          <input className="finput" value={url}  placeholder="https://…mp3" onChange={e => setUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-red btn-sm" onClick={submitFile} disabled={!file && !url}>Add {kind === 'ambience' ? 'Sound' : 'Track'}</button>
          </div>
        </>
      )}

      {tab === 'spotify' && (
        <>
          {noConn ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', background: 'var(--editor-row)', borderRadius: '6px' }}>
              Connect Spotify in the header first to search tracks.
            </div>
          ) : (
            <>
              <input
                autoFocus
                className="finput"
                value={query}
                placeholder="Search tracks or playlists…"
                onChange={e => handleQueryChange(e.target.value)}
                style={{ fontSize: '12px', padding: '7px 10px' }}
              />
              {searching && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', padding: '6px' }}>Searching…</div>
              )}
              {!searching && results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '220px', overflowY: 'auto' }}>
                  {results.map(r => (
                    <button key={r.uri} onClick={() => pickSpotify(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', width: '100%', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {r.image
                        ? <img src={r.image} alt="" width={36} height={36} style={{ borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '4px', background: 'var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🎵</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                        {r.artist && <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{r.artist}</div>}
                      </div>
                      <span style={{ fontSize: '9px', color: r.type === 'playlist' ? '#1ed760' : 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>{r.type}</span>
                    </button>
                  ))}
                </div>
              )}
              {!searching && query && results.length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', padding: '8px' }}>No results</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function TrackChip({ track, globalIdx, onRemove }: { track: TrackDraft; globalIdx: number; onRemove: (i: number) => void }) {
  const isSpotify = !!track.spotify_uri
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--editor-row)', borderRadius: '6px', padding: '7px 12px', marginTop: '4px' }}>
      {isSpotify
        ? <SpotifyMark />
        : <span>🎵</span>
      }
      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)' }}>{track.name}</span>
      {track._file   && <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase' }}>📁 local</span>}
      {isSpotify     && <span style={{ fontSize: '9px', color: '#1ed760', textTransform: 'uppercase', fontWeight: 700 }}>spotify</span>}
      <button onClick={() => onRemove(globalIdx)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', opacity: .6 }}>✕</button>
    </div>
  )
}

function SpotifyMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1ed760">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}

