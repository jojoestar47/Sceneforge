'use client'

import { useState, useEffect } from 'react'
import type { Scene, Track, MediaRef } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { uploadMedia } from '@/lib/supabase/storage'
import UploadZone from './UploadZone'

interface Props {
  scene: Scene | null       // null = new scene
  campaignId: string
  userId: string
  onSave: (scene: Scene) => void
  onClose: () => void
}

type Kind = 'music' | 'ml2' | 'ml3' | 'ambience'
type TabKey = 'scene' | 'tactical' | 'notes'

interface TrackDraft {
  id?: string
  kind: Kind
  name: string
  url: string
  storage_path?: string
  file_name?: string
  loop: boolean
  volume: number
  _file?: File
}

interface Draft {
  name: string
  location: string
  notes: string
  dynamic_music: boolean
  bg: MediaRef | null
  overlay: MediaRef | null
  tracks: TrackDraft[]
  _bgFile?: File
  _ovFile?: File
}

function blankDraft(scene: Scene | null): Draft {
  const existing = (kind: Kind): TrackDraft[] =>
    (scene?.tracks || [])
      .filter(t => t.kind === kind)
      .map(t => ({ id: t.id, kind, name: t.name, url: t.url || '', storage_path: t.storage_path, file_name: t.file_name, loop: t.loop, volume: t.volume }))

  return {
    name:          scene?.name || '',
    location:      scene?.location || '',
    notes:         scene?.notes || '',
    dynamic_music: scene?.dynamic_music || false,
    bg:            scene?.bg || null,
    overlay:       scene?.overlay || null,
    tracks: [
      ...existing('music'),
      ...existing('ml2'),
      ...existing('ml3'),
      ...existing('ambience'),
    ],
  }
}

export default function SceneEditor({ scene, campaignId, userId, onSave, onClose }: Props) {
  const supabase = createClient()
  const [tab, setTab]       = useState<TabKey>('scene')
  const [draft, setDraft]   = useState<Draft>(blankDraft(scene))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { setDraft(blankDraft(scene)); setTab('scene'); setError('') }, [scene?.id])

  const tracksOf = (kind: Kind) => draft.tracks.filter(t => t.kind === kind)
  const addTrack = (kind: Kind, t: Omit<TrackDraft, 'kind'>) =>
    setDraft(d => ({ ...d, tracks: [...d.tracks, { ...t, kind }] }))
  const removeTrack = (idx: number) =>
    setDraft(d => ({ ...d, tracks: d.tracks.filter((_, i) => i !== idx) }))

  async function handleSave() {
    setSaving(true); setError('')
    try {
      // Upload bg file if pending
      let bg = draft.bg
      if (draft._bgFile) {
        const path = await uploadMedia(supabase, userId, draft._bgFile)
        bg = { type: draft._bgFile.type.startsWith('video') ? 'video' : 'image', storage_path: path, file_name: draft._bgFile.name }
      }

      // Upload overlay file if pending
      let overlay = draft.overlay
      if (draft._ovFile) {
        const path = await uploadMedia(supabase, userId, draft._ovFile)
        overlay = { type: draft._ovFile.type.startsWith('video') ? 'video' : 'image', storage_path: path, file_name: draft._ovFile.name }
      }

      // Upsert scene
      const scenePayload = {
        campaign_id:   campaignId,
        name:          draft.name || 'Untitled Scene',
        location:      draft.location || null,
        notes:         draft.notes || null,
        dynamic_music: draft.dynamic_music,
        bg:            bg ? { type: bg.type, url: bg.url, storage_path: bg.storage_path, file_name: bg.file_name } : null,
        overlay:       overlay ? { type: overlay.type, url: overlay.url, storage_path: overlay.storage_path, file_name: overlay.file_name } : null,
        order_index:   scene?.order_index ?? 0,
      }

      let sceneId = scene?.id
      if (sceneId) {
        await supabase.from('scenes').update(scenePayload).eq('id', sceneId)
      } else {
        const { data } = await supabase.from('scenes').insert(scenePayload).select('id').single()
        sceneId = data!.id
      }

      // Delete old tracks and re-insert (simple but effective)
      if (scene?.id) {
        await supabase.from('tracks').delete().eq('scene_id', sceneId!)
      }

      // Upload any track files + insert
      const trackInserts = await Promise.all(
        draft.tracks.map(async (t, i) => {
          let storagePath = t.storage_path
          let fileName    = t.file_name
          let url         = t.url || null
          if (t._file) {
            storagePath = await uploadMedia(supabase, userId, t._file)
            fileName    = t._file.name
            url         = null
          }
          return {
            scene_id:     sceneId!,
            kind:         t.kind,
            name:         t.name,
            url,
            storage_path: storagePath || null,
            file_name:    fileName || null,
            loop:         t.loop,
            volume:       t.volume,
            order_index:  i,
          }
        })
      )

      if (trackInserts.length) {
        await supabase.from('tracks').insert(trackInserts)
      }

      // Fetch the full updated scene with tracks to pass back
      const { data: savedScene } = await supabase
        .from('scenes')
        .select('*, tracks(*)')
        .eq('id', sceneId!)
        .single()

      onSave(savedScene as Scene)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save scene')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10,11,18,.85)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxHeight: '90vh' }}>

        {/* Panel */}
        <div style={{
          width: '680px', maxWidth: '95vw',
          background: 'var(--editor-bg)', border: '1px solid var(--border-lt)',
          borderRadius: '10px', display: 'flex', flexDirection: 'column',
          maxHeight: '90vh', boxShadow: '0 32px 80px rgba(0,0,0,.9)', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', padding: '12px 20px 0', fontFamily: "'Cinzel',serif", fontSize: '13px', letterSpacing: '4px', color: 'var(--text-2)', textTransform: 'uppercase' }}>
              {scene ? scene.name : 'New Scene'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
              {(['scene', 'tactical', 'notes'] as TabKey[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px',
                  textTransform: 'uppercase', color: tab === t ? 'var(--text)' : 'var(--text-2)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: '-1px',
                }}>
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
                    <MediaField
                      slot="bg"
                      value={draft.bg}
                      file={draft._bgFile}
                      accept="image/*,video/*"
                      icon="🖼"
                      hint="JPG, PNG, WebP, MP4, WebM"
                      onFile={f => setDraft(d => ({ ...d, _bgFile: f, bg: { type: f.type.startsWith('video') ? 'video' : 'image', file_name: f.name } }))}
                      onUrl={(type, url) => setDraft(d => ({ ...d, _bgFile: undefined, bg: { type, url } }))}
                      onClear={() => setDraft(d => ({ ...d, _bgFile: undefined, bg: null }))}
                    />
                  </PropRow>
                  <PropRow label="Scene Overlay" desc="Motion overlay or image.">
                    <MediaField
                      slot="overlay"
                      value={draft.overlay}
                      file={draft._ovFile}
                      accept="image/*,video/*"
                      icon="✨"
                      hint="PNG with alpha works best"
                      onFile={f => setDraft(d => ({ ...d, _ovFile: f, overlay: { type: f.type.startsWith('video') ? 'video' : 'image', file_name: f.name } }))}
                      onUrl={(type, url) => setDraft(d => ({ ...d, _ovFile: undefined, overlay: { type, url } }))}
                      onClear={() => setDraft(d => ({ ...d, _ovFile: undefined, overlay: null }))}
                    />
                  </PropRow>
                </Section>

                {/* AUDIO */}
                <Section title="Audio">
                  <PropRow label="Music" desc="Looping background music.">
                    <TrackAdder kind="music" onAdd={t => addTrack('music', t)} />
                  </PropRow>
                  {tracksOf('music').map((t, i) => <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />)}

                  {/* Dynamic music toggle */}
                  <div style={{ background: 'var(--editor-card)', border: '1px solid var(--border-lt)', borderRadius: '8px', padding: '14px 16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>Enable Dynamic Music</span>
                      <ToggleSwitch checked={draft.dynamic_music} onChange={v => setDraft(d => ({ ...d, dynamic_music: v }))} />
                    </div>
                    {draft.dynamic_music && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        {(['ml2', 'ml3'] as Kind[]).map(kind => (
                          <div key={kind}>
                            <PropRow label={kind === 'ml2' ? 'Music Layer 2' : 'Music Layer 3'} desc={kind === 'ml2' ? 'Medium intensity layer.' : 'Highest intensity layer.'}>
                              <TrackAdder kind={kind} onAdd={t => addTrack(kind, t)} />
                            </PropRow>
                            {tracksOf(kind).map((t, i) => <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <PropRow label="Sound" desc="Ambient background sound.">
                    <TrackAdder kind="ambience" onAdd={t => addTrack('ambience', t)} />
                  </PropRow>
                  {tracksOf('ambience').map((t, i) => <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />)}
                </Section>
              </>
            )}

            {tab === 'tactical' && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🗺</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px' }}>Tactical View Coming Soon</div>
              </div>
            )}

            {tab === 'notes' && (
              <div style={{ paddingTop: '20px' }}>
                <label className="flabel">Scene Notes</label>
                <textarea
                  className="ftextarea finput"
                  rows={10}
                  placeholder="GM notes, scene descriptions, NPC details…"
                  value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                />
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
          <button onClick={onClose} title="Discard" style={{
            width: '38px', height: '38px', borderRadius: '50%',
            border: '1px solid var(--border-lt)', background: 'var(--bg-raised)',
            color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
          <button onClick={handleSave} disabled={saving} title="Save" style={{
            width: '38px', height: '38px', borderRadius: '50%',
            border: '1px solid var(--accent)', background: 'var(--accent)',
            color: '#fff', fontSize: '16px', cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: saving ? .6 : 1,
          }}>{saving ? '…' : '✓'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '28px' }}>
      <div style={{
        fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: '15px', fontWeight: 700,
        color: 'var(--text)', letterSpacing: '1px', paddingBottom: '10px',
        borderBottom: '2px solid var(--accent)', display: 'block', marginBottom: 0,
      }}>
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

function MediaField({ accept, icon, hint, onFile, onUrl, onClear, value, file }: {
  slot: string; accept: string; icon: string; hint: string
  value: MediaRef | null; file?: File
  onFile: (f: File) => void
  onUrl:  (type: 'image' | 'video', url: string) => void
  onClear: () => void
}) {
  const [urlMode, setUrlMode] = useState(false)
  const [type, setType]       = useState<'image' | 'video'>('image')
  const [url, setUrl]         = useState('')

  if (value) {
    const display = file?.name || value.file_name || value.url || ''
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--editor-row)', borderRadius: '6px', padding: '8px 12px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
        <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase' }}>{value.type}</span>
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px' }}>✕</button>
      </div>
    )
  }

  return (
    <div>
      {!urlMode && <UploadZone accept={accept} label="Drop file here" icon={icon} hint={hint} onFile={onFile} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span>or paste a URL</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select className="fselect" value={type} onChange={e => setType(e.target.value as 'image' | 'video')} style={{ flexShrink: 0, width: '90px', padding: '7px 8px', fontSize: '12px' }}>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
        <input className="finput" value={url} placeholder="https://…" onChange={e => setUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
        <button className="btn btn-red btn-sm" onClick={() => { if (url) { onUrl(type, url); setUrl('') } }}>Set</button>
      </div>
    </div>
  )
}

function TrackAdder({ kind, onAdd }: { kind: Kind; onAdd: (t: Omit<TrackDraft, 'kind'>) => void }) {
  const [file, setFile]   = useState<File | null>(null)
  const [name, setName]   = useState('')
  const [url, setUrl]     = useState('')

  function submit() {
    const trackName = name || file?.name?.replace(/\.[^.]+$/, '') || 'Track'
    if (file) {
      onAdd({ name: trackName, url: '', _file: file, loop: true, volume: 0.7 })
    } else if (url) {
      onAdd({ name: trackName, url, loop: true, volume: 0.7 })
    }
    setFile(null); setName(''); setUrl('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <UploadZone accept="audio/*" label="Drop audio file here" icon="🎵" hint="MP3, OGG, WAV, FLAC" onFile={f => { setFile(f); setName(n => n || f.name.replace(/\.[^.]+$/, '')) }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <input className="finput" value={name} placeholder="Track name" onChange={e => setName(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
      <input className="finput" value={url}  placeholder="https://…mp3" onChange={e => setUrl(e.target.value)} style={{ fontSize: '12px', padding: '7px 10px' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
        <button className="btn btn-red btn-sm" onClick={submit} disabled={!file && !url}>
          Add {kind === 'ambience' ? 'Sound' : 'Track'}
        </button>
      </div>
    </div>
  )
}

function TrackChip({ track, globalIdx, onRemove }: { track: TrackDraft; globalIdx: number; onRemove: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--editor-row)', borderRadius: '6px', padding: '7px 12px', marginTop: '4px' }}>
      <span style={{ fontSize: '14px' }}>🎵</span>
      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)' }}>{track.name}</span>
      {track._file && <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase' }}>📁 local</span>}
      <button onClick={() => onRemove(globalIdx)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', opacity: .6 }}>✕</button>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ position: 'relative', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '12px', background: checked ? 'var(--accent)' : 'var(--border-lt)', transition: 'background .2s' }} />
      <div style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
    </div>
  )
}
