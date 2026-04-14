'use client'

import { useEffect, useRef, useState } from 'react'
import type { Scene, Track } from '@/lib/types'

interface Props {
  scene: Scene | null
  onEditScene: () => void
}

type AudioState = { playing: boolean; loop: boolean; volume: number }

export default function AudioPanel({ scene, onEditScene }: Props) {
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const [states, setStates] = useState<Record<string, AudioState>>({})
  const [muted, setMuted]   = useState(false)

  // Stop all audio when scene changes
  useEffect(() => {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.src = '' })
    audioRefs.current = {}
    setStates({})
  }, [scene?.id])

  // Auto-play all music tracks when scene loads
  useEffect(() => {
    if (!scene?.tracks?.length) return

    const musicTracks = scene.tracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )

    const timer = setTimeout(() => {
      musicTracks.forEach(t => {
        const src = t.signed_url || t.url
        if (!src) return
        const a = getOrCreate(t)
        if (a.paused) a.play().catch(() => {})
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function getOrCreate(t: Track): HTMLAudioElement {
    if (!audioRefs.current[t.id]) {
      const src = t.signed_url || t.url || ''
      const a = new Audio(src)
      a.loop   = t.loop
      a.volume = t.volume
      a.muted  = muted
      a.addEventListener('pause', () => sync(t.id, a))
      a.addEventListener('play',  () => sync(t.id, a))
      audioRefs.current[t.id] = a
    }
    return audioRefs.current[t.id]
  }

  function sync(id: string, a: HTMLAudioElement) {
    setStates(prev => ({
      ...prev,
      [id]: { playing: !a.paused, loop: a.loop, volume: a.volume },
    }))
  }

  function toggle(t: Track) {
    const a = getOrCreate(t)
    if (a.paused) a.play().catch(() => {})
    else          a.pause()
  }

  function setVol(t: Track, val: number) {
    const a = getOrCreate(t)
    a.volume = val
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], volume: val } }))
  }

  function toggleLoop(t: Track) {
    const a = getOrCreate(t)
    a.loop = !a.loop
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], loop: a.loop } }))
  }

  function stopAll() {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.currentTime = 0 })
    setStates(prev =>
      Object.fromEntries(Object.entries(prev).map(([id, s]) => [id, { ...s, playing: false }]))
    )
  }

  function handleMute() {
    const next = !muted
    setMuted(next)
    Object.values(audioRefs.current).forEach(a => (a.muted = next))
  }

  if (!scene) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>Select a scene to manage audio</div>
      </div>
    )
  }

  const allTracks = scene.tracks || []
  const music     = allTracks.filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3')
  const ambience  = allTracks.filter(t => t.kind === 'ambience')
  const playingN  = Object.values(states).filter(s => s.playing).length

  function TrackRow({ t }: { t: Track }) {
    const s       = states[t.id]
    const playing = s?.playing ?? false
    const loop    = s?.loop    ?? t.loop
    const volume  = s?.volume  ?? t.volume

    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', gap: '8px' }}>
        <button
          onClick={() => toggle(t)}
          style={{
            width: '26px', height: '26px', borderRadius: '50%',
            border: `1px solid ${playing ? 'var(--accent)' : 'var(--border)'}`,
            background: playing ? 'var(--accent-bg)' : 'var(--bg-raised)',
            color: playing ? 'var(--accent)' : 'var(--text-2)',
            fontSize: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: playing ? '0 0 8px rgba(229,53,53,.25)' : 'none',
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
            {t.name}
            {t.storage_path && <span style={{ fontSize: '9px', color: 'var(--text-3)', marginLeft: '4px' }}>📁</span>}
          </div>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => setVol(t, Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: '3px' }}
          />
        </div>
        <button
          onClick={() => toggleLoop(t)}
          style={{
            background: 'none',
            border: `1px solid ${loop ? 'var(--accent)' : 'var(--border)'}`,
            color: loop ? 'var(--accent)' : 'var(--text-3)',
            fontSize: '10px', padding: '2px 4px', borderRadius: '3px', cursor: 'pointer', flexShrink: 0,
          }}
        >↺</button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>

        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px 8px', gap: '8px' }}>
            <span>🎵</span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)', flex: 1 }}>Music</span>
            <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{music.length}</span>
          </div>
          {music.length
            ? music.map(t => <TrackRow key={t.id} t={t} />)
            : <div style={{ padding: '4px 12px 8px', fontSize: '11px', color: 'var(--text-3)' }}>No music tracks</div>}
        </div>

        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px 8px', gap: '8px' }}>
            <span>🌊</span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-2)', flex: 1 }}>Ambience</span>
            <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{ambience.length}</span>
          </div>
          {ambience.length
            ? ambience.map(t => <TrackRow key={t.id} t={t} />)
            : <div style={{ padding: '4px 12px 8px', fontSize: '11px', color: 'var(--text-3)' }}>No ambient sounds</div>}
        </div>

        <div style={{ padding: '10px 12px' }}>
          <button className="btn btn-ghost btn-block btn-sm" style={{ marginBottom: '6px' }} onClick={onEditScene}>
            ⚙ Edit Scene Audio
          </button>
          {playingN > 0 && (
            <button className="btn btn-ghost btn-block btn-sm" onClick={stopAll}>⏹ Stop All</button>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={handleMute} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-2)' }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <span style={{ fontSize: '11px', color: playingN > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
          {playingN > 0
            ? <><span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', marginRight: '6px', animation: 'pulse 1.2s ease-in-out infinite' }} />{playingN} track{playingN > 1 ? 's' : ''} playing</>
            : 'No audio playing'}
        </span>
      </div>
    </div>
  )
}
