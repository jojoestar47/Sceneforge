'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import Image from 'next/image'
import type { CampaignTag, Character, MediaRef } from '@/lib/types'
import type { SpotifySearchResponse } from '@/lib/spotify'
import { characterImageUrl } from '@/lib/media'
import { tagColor } from '@/lib/tagColor'
import UploadZone from '@/components/UploadZone'
import { Section, PropRow } from './parts'
import type { Draft, Kind, TrackDraft } from './types'

interface Props {
  draft:           Draft
  setDraft:        Dispatch<SetStateAction<Draft>>
  campaignChars:   Character[]
  campaignTags:    CampaignTag[]
  charsLoading:    boolean
  /** Returns the created Character on success so the tab can close its form. */
  createCharacter: (input: { name: string; file: File | null; url: string }) => Promise<Character | null>
}

export default function SceneTab({ draft, setDraft, campaignChars, campaignTags, charsLoading, createCharacter }: Props) {
  // ── Character picker / new-character form state ──────────────
  const [charSearch,     setCharSearch]     = useState('')
  const [charPickerOpen, setCharPickerOpen] = useState(false)
  const [newCharOpen,    setNewCharOpen]    = useState(false)
  const [newCharName,    setNewCharName]    = useState('')
  const [newCharFile,    setNewCharFile]    = useState<File | null>(null)
  const [newCharUrl,     setNewCharUrl]     = useState('')
  const [newCharSaving,  setNewCharSaving]  = useState(false)
  const [filterTags,     setFilterTags]     = useState<Set<string>>(new Set())

  const poolIds       = new Set(draft.characterPool.map(e => e.character.id))
  const filteredChars = campaignChars.filter(c => {
    if (poolIds.has(c.id)) return false
    if (charSearch && !c.name.toLowerCase().includes(charSearch.toLowerCase())) return false
    if (filterTags.size > 0 && !(c.tags ?? []).some(t => filterTags.has(t))) return false
    return true
  })

  const tracksOf = (kind: Kind) => draft.tracks.filter(t => t.kind === kind)
  const addTrack = (kind: Kind, t: Omit<TrackDraft, 'kind'>) =>
    setDraft(d => ({ ...d, tracks: [...d.tracks, { ...t, kind }] }))
  const removeTrack = (idx: number) =>
    setDraft(d => ({ ...d, tracks: d.tracks.filter((_, i) => i !== idx) }))

  async function handleCreateCharacter() {
    if ((!newCharFile && !newCharUrl) || !newCharName.trim()) return
    setNewCharSaving(true)
    try {
      const created = await createCharacter({ name: newCharName.trim(), file: newCharFile, url: newCharUrl })
      if (created) {
        setNewCharOpen(false); setNewCharName(''); setNewCharFile(null); setNewCharUrl('')
      }
    } finally {
      setNewCharSaving(false)
    }
  }

  return (
    <>
      {/* Name + Location */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', paddingTop: '20px' }}>
        <div>
          <label className="flabel">Name</label>
          <input className="finput" value={draft.name} placeholder="New Scene"
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
        </div>
        <div>
          <label className="flabel">Location</label>
          <input className="finput" value={draft.location} placeholder="Location"
            onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} />
        </div>
      </div>

      {/* Hide title from viewers */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-2)', userSelect: 'none' }}>
        <input
          type="checkbox"
          className="fcheckbox"
          checked={draft.hide_title}
          onChange={e => setDraft(d => ({ ...d, hide_title: e.target.checked }))}
        />
        Hide stage name from viewers
      </label>

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
              style={{ fontSize: '12px', padding: '7px 10px', marginBottom: campaignTags.length > 0 ? '8px' : '10px' }}
            />

            {/* Tag filter chips */}
            {campaignTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginRight: '2px' }}>
                  <svg viewBox="0 0 104 104" xmlns="http://www.w3.org/2000/svg" width="11" height="11" style={{ flexShrink: 0 }}>
                    <path d="M12 12 L12 52 L52 92 Q56 96 60 92 L92 60 Q96 56 92 52 L52 12 Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
                    <circle cx="32" cy="32" r="6" fill="currentColor"/>
                  </svg>
                  Filter
                </span>
                {campaignTags.map(tag => {
                  const col    = tagColor(tag.color)
                  const active = filterTags.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setFilterTags(prev => {
                        const n = new Set(prev)
                        if (active) n.delete(tag.id); else n.add(tag.id)
                        return n
                      })}
                      style={{
                        padding: '3px 9px', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.4px',
                        background: active ? col.bg  : 'rgba(255,255,255,0.04)',
                        border:     active ? `1px solid ${col.border}` : '1px solid rgba(255,255,255,0.1)',
                        color:      active ? col.text : 'var(--text-2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
                {filterTags.size > 0 && (
                  <button
                    onClick={() => setFilterTags(new Set())}
                    style={{ padding: '3px 8px', borderRadius: '20px', cursor: 'pointer', fontSize: '10px', color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border)' }}
                  >clear</button>
                )}
              </div>
            )}

            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {charsLoading && (
                <div style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>
                  Loading characters…
                </div>
              )}
              {!charsLoading && filteredChars.length === 0 && (
                <div style={{ padding: '10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-3)' }}>
                  {campaignChars.length === 0
                    ? 'No characters yet — create one below'
                    : campaignChars.length === draft.characterPool.length
                    ? 'All characters already added'
                    : filterTags.size > 0 || charSearch
                    ? 'No matches for current filters'
                    : 'No matches'}
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
            <input className="finput" placeholder="Character name" value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              style={{ fontSize: '12px', padding: '7px 10px', marginBottom: '10px' }} />
            <UploadZone accept="image/*" label="Drop character art here" icon="🧑"
              hint="PNG with transparency recommended — tall portrait works best"
              onFile={f => setNewCharFile(f)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <input className="finput" placeholder="https://… image URL" value={newCharUrl}
              onChange={e => setNewCharUrl(e.target.value)}
              style={{ fontSize: '12px', padding: '7px 10px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setNewCharOpen(false); setNewCharName(''); setNewCharFile(null); setNewCharUrl('') }}>Cancel</button>
              <button className="btn btn-red btn-sm" onClick={handleCreateCharacter}
                disabled={!newCharName.trim() || (!newCharFile && !newCharUrl) || newCharSaving}>
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
        {tracksOf('music').map((t, i) => (
          <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />
        ))}
        <PropRow label="Sound" desc="Ambient background sound.">
          <TrackAdder kind="ambience" onAdd={t => addTrack('ambience', t)} />
        </PropRow>
        {tracksOf('ambience').map((t, i) => (
          <TrackChip key={i} track={t} globalIdx={draft.tracks.indexOf(t)} onRemove={removeTrack} />
        ))}
      </Section>
    </>
  )
}

// ── Scene-tab-only sub-components ────────────────────────────────────────────

interface MediaFieldProps {
  slot: string
  accept: string
  icon: string
  hint: string
  value: MediaRef | null
  file?: File
  onFile: (f: File) => void
  onUrl: (type: 'image' | 'video', url: string) => void
  onClear: () => void
}

function MediaField({ accept, icon, hint, onFile, onUrl, onClear, value, file }: MediaFieldProps) {
  const [type, setType] = useState<'image' | 'video'>('image')
  const [url,  setUrl]  = useState('')
  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--editor-row)', borderRadius: '6px', padding: '8px 12px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file?.name || value.file_name || value.url || ''}
        </span>
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
        <select className="fselect" value={type} onChange={e => setType(e.target.value as 'image' | 'video')}
          style={{ flexShrink: 0, width: '90px', padding: '7px 8px', fontSize: '12px' }}>
          <option value="image">Image</option><option value="video">Video</option>
        </select>
        <input className="finput" value={url} placeholder="https://…"
          onChange={e => setUrl(e.target.value)}
          style={{ fontSize: '12px', padding: '7px 10px' }} />
        <button className="btn btn-red btn-sm" onClick={() => { if (url) { onUrl(type, url); setUrl('') } }}>Set</button>
      </div>
    </div>
  )
}

type AdderTab = 'file' | 'spotify'

interface SpotifyResult {
  uri:     string
  name:    string
  artist?: string
  image:   string | null
  type:    'track' | 'playlist'
}

function TrackAdder({ kind, onAdd }: { kind: Kind; onAdd: (t: Omit<TrackDraft, 'kind'>) => void }) {
  const [tab,  setTab]  = useState<AdderTab>('file')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [url,  setUrl]  = useState('')

  // Spotify search state
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SpotifyResult[]>([])
  const [searching, setSearching] = useState(false)
  const [noConn,    setNoConn]    = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSeqRef   = useRef(0)   // increments each search; stale responses are discarded
  // Clear pending timer on unmount so setState is never called on a dead component
  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }, [])

  function submitFile() {
    const n = name || file?.name?.replace(/\.[^.]+$/, '') || 'Track'
    if      (file) onAdd({ name: n, url: '', _file: file, loop: true, volume: 0.7 })
    else if (url)  onAdd({ name: n, url,                 loop: true, volume: 0.7 })
    setFile(null); setName(''); setUrl('')
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!q.trim()) { setResults([]); return }
    const seq = ++searchSeqRef.current
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
        if (searchSeqRef.current !== seq) return  // stale — a newer search superseded this one
        if (res.status === 403 || res.status === 404) { setNoConn(true); return }
        if (!res.ok) return
        const data = await res.json() as SpotifySearchResponse
        const tracks:    SpotifyResult[] = data.tracks.map(t    => ({ ...t, type: 'track'    as const }))
        const playlists: SpotifyResult[] = data.playlists.map(p => ({ ...p, type: 'playlist' as const }))
        setResults([...tracks, ...playlists])
        setNoConn(false)
      } finally {
        if (searchSeqRef.current === seq) setSearching(false)
      }
    }, 400)
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
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '5px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', background: tab === t ? 'var(--accent-bg)' : 'none', color: tab === t ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer' }}>
            {t === 'spotify' ? '🎧 Spotify' : '📁 File / URL'}
          </button>
        ))}
      </div>

      {tab === 'file' && (
        <>
          <UploadZone accept="audio/*" label="Drop audio file here" icon="🎵" hint="MP3, OGG, WAV, FLAC"
            onFile={f => { setFile(f); setName(n => n || f.name.replace(/\.[^.]+$/, '')) }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />or paste a URL<div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <input className="finput" value={name} placeholder="Track name"
            onChange={e => setName(e.target.value)}
            style={{ fontSize: '12px', padding: '7px 10px' }} />
          <input className="finput" value={url}  placeholder="https://…mp3"
            onChange={e => setUrl(e.target.value)}
            style={{ fontSize: '12px', padding: '7px 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-red btn-sm" onClick={submitFile} disabled={!file && !url}>
              Add {kind === 'ambience' ? 'Sound' : 'Track'}
            </button>
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
      {isSpotify ? <SpotifyMark /> : <span>🎵</span>}
      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)' }}>{track.name}</span>
      {track._file && <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase' }}>📁 local</span>}
      {isSpotify   && <span style={{ fontSize: '9px', color: '#1ed760', textTransform: 'uppercase', fontWeight: 700 }}>spotify</span>}
      <button onClick={() => onRemove(globalIdx)}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', opacity: .6 }}>✕</button>
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
