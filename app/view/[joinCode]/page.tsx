'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Scene, Track } from '@/lib/types'

// ── Public URL helper ─────────────────────────────────────────────
// Viewer has no auth — uses public bucket URLs instead of signed URLs
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function pubUrl(media: { url?: string; storage_path?: string } | null | undefined): string | null {
  if (!media) return null
  if (media.storage_path)
    return `${SUPABASE_URL}/storage/v1/object/public/scene-media/${media.storage_path}`
  return media.url || null
}

type Status = 'loading' | 'waiting' | 'live' | 'ended'

const MIXER_BG       = 'rgba(13,14,22,0.96)'
const MIXER_BG_PANEL = 'rgba(18,20,30,0.98)'

export default function ViewerPage() {
  const params   = useParams()
  const joinCode = (params.joinCode as string).toUpperCase()
  const supabase = createClient()

  const [status,    setStatus]    = useState<Status>('loading')
  const [scene,     setScene]     = useState<Scene | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // ── Audio (independent from DM) ───────────────────────────────
  const audioRefs              = useRef<Record<string, HTMLAudioElement>>({})
  const [volumes, setVolumes]  = useState<Record<string, number>>({})
  const [playing, setPlaying]  = useState<Record<string, boolean>>({})
  const [muted,   setMuted]    = useState(false)
  const [mixerOpen, setMixerOpen] = useState(false)

  // ── Fullscreen ────────────────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    function onFsChange() {
      setIsFs(!!(document.fullscreenElement || (document as any).webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  function toggleFs() {
    const el = wrapperRef.current
    if (!el) return
    if (isFs) {
      document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.()
    } else {
      el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.()
    }
  }

  // ── Load scene by ID ──────────────────────────────────────────
  const loadScene = useCallback(async (sceneId: string | null) => {
    if (!sceneId) { setScene(null); setStatus('live'); return }

    const { data } = await supabase
      .from('scenes')
      .select('*, tracks(*)')
      .eq('id', sceneId)
      .single()

    if (data) {
      setScene(data as Scene)
      setStatus('live')
    }
  }, [])

  // ── Load session + subscribe ──────────────────────────────────
  const loadSession = useCallback(async () => {
    const { data } = await supabase
      .from('sessions')
      .select('id, active_scene_id, is_live')
      .eq('join_code', joinCode)
      .maybeSingle()

    if (!data) {
      setStatus('waiting')
      return
    }

    if (!data.is_live) {
      setStatus('ended')
      return
    }

    setSessionId(data.id)
    await loadScene(data.active_scene_id)
  }, [joinCode, loadScene])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // Poll every 6s when waiting so we detect when DM starts presenting
  useEffect(() => {
    if (status !== 'waiting') return
    const t = setInterval(loadSession, 6000)
    return () => clearInterval(t)
  }, [status, loadSession])

  // ── Realtime: listen for scene changes ────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('viewer-' + joinCode)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `join_code=eq.${joinCode}` },
        (payload) => {
          const row = payload.new as { active_scene_id: string | null; is_live: boolean }
          if (!row.is_live) {
            setStatus('ended')
            return
          }
          loadScene(row.active_scene_id)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [joinCode, loadScene])

  // ── Reset audio when scene changes ───────────────────────────
  useEffect(() => {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.src = '' })
    audioRefs.current = {}
    setVolumes({})
    setPlaying({})
  }, [scene?.id])

  // ── Audio helpers ─────────────────────────────────────────────
  function getOrCreate(t: Track): HTMLAudioElement {
    if (!audioRefs.current[t.id]) {
      const src = pubUrl({ url: t.url || undefined, storage_path: t.storage_path || undefined }) || ''
      const a   = new Audio(src)
      a.loop    = t.loop
      a.volume  = t.volume
      a.muted   = muted
      a.addEventListener('play',  () => setPlaying(p => ({ ...p, [t.id]: true  })))
      a.addEventListener('pause', () => setPlaying(p => ({ ...p, [t.id]: false })))
      audioRefs.current[t.id] = a
      setVolumes(v => ({ ...v, [t.id]: t.volume }))
    }
    return audioRefs.current[t.id]
  }

  function toggleTrack(t: Track) {
    const a = getOrCreate(t)
    if (a.paused) { a.play().catch(() => {}) } else { a.pause() }
  }

  function setVol(t: Track, val: number) {
    const a = getOrCreate(t)
    a.volume = val
    setVolumes(v => ({ ...v, [t.id]: val }))
  }

  function stopAll() {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.currentTime = 0 })
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    Object.values(audioRefs.current).forEach(a => (a.muted = next))
  }

  const allTracks    = scene?.tracks || []
  const music        = allTracks.filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3')
  const amb          = allTracks.filter(t => t.kind === 'ambience')
  const playingCount = Object.values(playing).filter(Boolean).length
  const bgUrl        = pubUrl(scene?.bg)
  const ovUrl        = pubUrl(scene?.overlay)

  // ── Status screens ────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={fullscreenStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '22px', color: '#e53535', letterSpacing: '2px', marginBottom: '14px' }}>
            SceneForge
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Connecting…
          </div>
        </div>
      </div>
    )
  }

  if (status === 'waiting') {
    return (
      <div style={fullscreenStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '18px', opacity: .3 }}>🎭</div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: '13px', color: 'rgba(255,255,255,0.5)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Waiting for DM
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>
            Session code: {joinCode}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e53535', animation: `dot ${0.8}s ease-in-out ${i * 0.2}s infinite alternate`, opacity: .4 }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes dot { from{opacity:.2;transform:scale(.8)} to{opacity:1;transform:scale(1.1)} }`}</style>
      </div>
    )
  }

  if (status === 'ended') {
    return (
      <div style={fullscreenStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '18px', opacity: .2 }}>⚔️</div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '4px', textTransform: 'uppercase' }}>
            Session Ended
          </div>
        </div>
      </div>
    )
  }

  // ── Live viewer ───────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={{ ...fullscreenStyle, overflow: 'hidden' }}>

      {/* Background clip layer */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
        {bgUrl && (
          scene?.bg?.type === 'video'
            ? <video key={bgUrl} src={bgUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img    key={bgUrl} src={bgUrl} alt=""  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {bgUrl && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
        {ovUrl && (
          scene?.overlay?.type === 'video'
            ? <video key={ovUrl} src={ovUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img    key={ovUrl} src={ovUrl} alt=""  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      {/* Scene name */}
      {scene && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          textAlign: 'center', padding: '18px',
          fontFamily: "'Cinzel',serif", fontSize: '16px', letterSpacing: '6px', fontWeight: 500,
          color: 'rgba(255,255,255,.8)', textShadow: '0 1px 16px rgba(0,0,0,.9)',
          pointerEvents: 'none', zIndex: 5,
        }}>
          {scene.name}
        </div>
      )}

      {/* No scene yet */}
      {!scene && (
        <div style={{ zIndex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.2)', position: 'relative' }}>
          <div style={{ fontSize: '44px', opacity: .3, marginBottom: '12px' }}>🎭</div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px' }}>Awaiting Scene</div>
        </div>
      )}

      {/* Top-right: fullscreen toggle */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 20, display: 'flex', gap: '8px' }}>
        <button
          onClick={toggleFs}
          style={{ width: '44px', height: '44px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: MIXER_BG, color: 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={isFs ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFs ? '✕' : '⛶'}
        </button>
      </div>

      {/* ── AUDIO MIXER (independent) ── */}
      {allTracks.length > 0 && (
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 20, width: '240px' }}>

          {/* Collapsed bar */}
          <div
            onClick={() => setMixerOpen(o => !o)}
            style={{ background: MIXER_BG, border: '1px solid rgba(255,255,255,0.14)', borderRadius: mixerOpen ? '10px 10px 0 0' : '10px', height: '44px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px', flexShrink: 0 }}>
              {[1, 0.6, 0.85, 0.45, 0.7].map((h, i) => (
                <div key={i} style={{ width: '3px', borderRadius: '1px', background: playingCount > 0 ? '#e53535' : 'rgba(255,255,255,0.2)', height: `${Math.round(h * 16)}px`, animation: playingCount > 0 ? `audioBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate` : 'none' }} />
              ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', flex: 1 }}>Audio</span>
            {playingCount > 0 && <span style={{ fontSize: '10px', color: '#e53535', fontWeight: 700 }}>{playingCount} playing</span>}
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>{mixerOpen ? '▲' : '▼'}</span>
          </div>

          {/* Expanded */}
          {mixerOpen && (
            <div style={{ background: MIXER_BG_PANEL, border: '1px solid rgba(255,255,255,0.14)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {music.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🎵 Music</div>
                  {music.map(t => <TrackRow key={t.id} t={t} isPlaying={!!playing[t.id]} volume={volumes[t.id] ?? t.volume} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} />)}
                </div>
              )}
              {music.length > 0 && amb.length > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />}
              {amb.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🌊 Ambience</div>
                  {amb.map(t => <TrackRow key={t.id} t={t} isPlaying={!!playing[t.id]} volume={volumes[t.id] ?? t.volume} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} />)}
                </div>
              )}
              <div style={{ padding: '8px 14px 10px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={e => { e.stopPropagation(); stopAll() }} style={{ flex: 1, height: '44px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  ⏹ Stop All
                </button>
                <button onClick={e => { e.stopPropagation(); toggleMute() }} style={{ width: '44px', height: '44px', background: muted ? 'rgba(229,53,53,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${muted ? '#e53535' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: muted ? '#e53535' : 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {muted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes audioBar0 { from{height:4px}  to{height:16px} }
        @keyframes audioBar1 { from{height:8px}  to{height:5px}  }
        @keyframes audioBar2 { from{height:13px} to{height:6px}  }
        @keyframes audioBar3 { from{height:5px}  to{height:14px} }
        @keyframes audioBar4 { from{height:11px} to{height:4px}  }
      `}</style>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────
const fullscreenStyle: React.CSSProperties = {
  width: '100dvw',
  height: '100dvh',
  background: '#070810',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
}

function TrackRow({ t, isPlaying, volume, onToggle, onVol }: {
  t: Track; isPlaying: boolean; volume: number
  onToggle: () => void; onVol: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, border: `1px solid ${isPlaying ? '#e53535' : 'rgba(255,255,255,0.15)'}`, background: isPlaying ? 'rgba(229,53,53,0.15)' : 'rgba(255,255,255,0.05)', color: isPlaying ? '#e53535' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>{t.name}</div>
        <input type="range" min={0} max={1} step={0.01} value={volume} onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onVol(Number(e.target.value)) }} style={{ width: '100%', height: '20px', accentColor: '#e53535', cursor: 'pointer', touchAction: 'none' }} />
      </div>
    </div>
  )
}
