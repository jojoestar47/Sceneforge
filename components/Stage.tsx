'use client'

import { useEffect, useRef, useState } from 'react'
import type { Scene, Track } from '@/lib/types'

interface Props {
  scene: Scene | null
  hasCampaign: boolean
  onEdit: () => void
}

function mediaUrl(m: Scene['bg']): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

const MIXER_BG       = 'rgba(13,14,22,0.96)'
const MIXER_BG_PANEL = 'rgba(18,20,30,0.98)'

export default function Stage({ scene, hasCampaign, onEdit }: Props) {
  const audioRefs             = useRef<Record<string, HTMLAudioElement>>({})
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [playing, setPlaying] = useState<Record<string, boolean>>({})
  const [muted,   setMuted]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.src = '' })
    audioRefs.current = {}
    setVolumes({})
    setPlaying({})

    if (!scene?.tracks?.length) return

    const musicTracks = scene.tracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )

    const timer = setTimeout(() => {
      musicTracks.forEach(t => {
        const src = t.signed_url || t.url
        if (!src) return
        getOrCreate(t).play().catch(() => {})
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function getOrCreate(t: Track): HTMLAudioElement {
    if (!audioRefs.current[t.id]) {
      const a = new Audio(t.signed_url || t.url || '')
      a.loop   = t.loop
      a.volume = t.volume
      a.muted  = muted
      a.addEventListener('play',  () => setPlaying(p => ({ ...p, [t.id]: true  })))
      a.addEventListener('pause', () => setPlaying(p => ({ ...p, [t.id]: false })))
      audioRefs.current[t.id] = a
      setVolumes(v => ({ ...v, [t.id]: t.volume }))
    }
    return audioRefs.current[t.id]
  }

  function toggleTrack(t: Track) {
    const a = getOrCreate(t)
    if (a.paused) {
      a.play().catch(() => {})
    } else {
      a.pause()
    }
  }

  function setVol(t: Track, val: number) {
    const a = getOrCreate(t)
    a.volume = val
    setVolumes(v => ({ ...v, [t.id]: val }))
  }

  function stopAll() {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.currentTime = 0 })
  }

  function handleMute() {
    const next = !muted
    setMuted(next)
    Object.values(audioRefs.current).forEach(a => (a.muted = next))
  }

  if (!scene) {
    return (
      <div style={{ flex: 1, background: '#080a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '44px', opacity: .2, marginBottom: '12px' }}>🎭</div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px' }}>
            {hasCampaign ? 'Select a Scene' : 'Select a Campaign'}
          </div>
        </div>
      </div>
    )
  }

  const bgUrl        = mediaUrl(scene.bg)
  const ovUrl        = mediaUrl(scene.overlay)
  const allTracks    = scene.tracks || []
  const music        = allTracks.filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3')
  const amb          = allTracks.filter(t => t.kind === 'ambience')
  const hasTracks    = allTracks.length > 0
  const playingCount = Object.values(playing).filter(Boolean).length

  return (
    <div style={{ flex: 1, position: 'relative', background: '#080a10', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {bgUrl && (
        scene.bg?.type === 'video'
          ? <video key={bgUrl} src={bgUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <img    key={bgUrl} src={bgUrl} alt=""  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}

      {bgUrl && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)', pointerEvents: 'none', zIndex: 2 }} />}

      {ovUrl && (
        scene.overlay?.type === 'video'
          ? <video key={ovUrl} src={ovUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 3, pointerEvents: 'none' }} />
          : <img    key={ovUrl} src={ovUrl} alt=""  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 3, pointerEvents: 'none' }} />
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', padding: '14px', fontFamily: "'Cinzel',serif", fontSize: '14px', letterSpacing: '5px', fontWeight: 500, color: 'rgba(255,255,255,.75)', textShadow: '0 1px 12px rgba(0,0,0,.9)', pointerEvents: 'none', zIndex: 5 }}>
        {scene.name}
      </div>

      {!bgUrl && (
        <div style={{ zIndex: 1, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '40px', opacity: .2, marginBottom: '12px' }}>🖼</div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '14px' }}>No Background</div>
          <button className="btn btn-outline" onClick={onEdit}>Edit Scene</button>
        </div>
      )}

      <button
        className="btn btn-ghost btn-sm"
        onClick={onEdit}
        style={{ position: 'absolute', bottom: '14px', right: '14px', zIndex: 20, minHeight: '44px', padding: '0 14px' }}
      >
        ⚙ Edit Scene
      </button>

      {hasTracks && (
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 20, width: '240px' }}>

          <div
            onClick={() => setExpanded(e => !e)}
            style={{
              background: MIXER_BG,
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: expanded ? '10px 10px 0 0' : '10px',
              padding: '0 14px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px', flexShrink: 0 }}>
              {[1, 0.6, 0.85, 0.45, 0.7].map((h, i) => (
                <div key={i} style={{
                  width: '3px',
                  borderRadius: '1px',
                  background: playingCount > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                  height: `${Math.round(h * 16)}px`,
                  animation: playingCount > 0 ? `audioBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate` : 'none',
                }} />
              ))}
            </div>

            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', flex: 1 }}>
              Audio
            </span>

            {playingCount > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>
                {playingCount} playing
              </span>
            )}

            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>

          {expanded && (
            <div style={{
              background: MIXER_BG_PANEL,
              border: '1px solid rgba(255,255,255,0.12)',
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              overflow: 'hidden',
            }}>
              {music.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                    🎵 Music
                  </div>
                  {music.map(t => (
                    <MiniTrackRow
                      key={t.id} t={t}
                      isPlaying={!!playing[t.id]}
                      volume={volumes[t.id] ?? t.volume}
                      onToggle={() => toggleTrack(t)}
                      onVol={v => setVol(t, v)}
                    />
                  ))}
                </div>
              )}

              {music.length > 0 && amb.length > 0 && (
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />
              )}

              {amb.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
                    🌊 Ambience
                  </div>
                  {amb.map(t => (
                    <MiniTrackRow
                      key={t.id} t={t}
                      isPlaying={!!playing[t.id]}
                      volume={volumes[t.id] ?? t.volume}
                      onToggle={() => toggleTrack(t)}
                      onVol={v => setVol(t, v)}
                    />
                  ))}
                </div>
              )}

              <div style={{ padding: '8px 14px 10px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={e => { e.stopPropagation(); stopAll() }}
                  style={{ flex: 1, height: '44px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px' }}
                >
                  ⏹ Stop All
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleMute() }}
                  style={{ width: '44px', height: '44px', background: muted ? 'var(--accent-bg)' : 'rgba(255,255,255,0.06)', border: `1px solid ${muted ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: muted ? 'var(--accent)' : 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {muted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes audioBar0 { from { height: 4px  } to { height: 16px } }
        @keyframes audioBar1 { from { height: 8px  } to { height: 5px  } }
        @keyframes audioBar2 { from { height: 13px } to { height: 6px  } }
        @keyframes audioBar3 { from { height: 5px  } to { height: 14px } }
        @keyframes audioBar4 { from { height: 11px } to { height: 4px  } }
      `}</style>
    </div>
  )
}

function MiniTrackRow({
  t, isPlaying, volume, onToggle, onVol,
}: {
  t: Track; isPlaying: boolean; volume: number
  onToggle: () => void; onVol: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          border: `1px solid ${isPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
          background: isPlaying ? 'var(--accent-bg)' : 'rgba(255,255,255,0.05)',
          color: isPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
          fontSize: '12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>
          {t.name}
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={volume}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onVol(Number(e.target.value)) }}
          style={{ width: '100%', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer', touchAction: 'none' }}
        />
      </div>
    </div>
  )
}
