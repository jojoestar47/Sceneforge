'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Scene, Track, Character, CharacterState } from '@/lib/types'
import type { SpotifyNowPlaying } from '@/lib/useSpotifyPlayer'
import CharacterDisplay, { characterImageUrl } from '@/components/CharacterDisplay'
import AppIcon from '@/components/AppIcon'
import { useSpotifyPlayer } from '@/lib/useSpotifyPlayer'

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

// AudioContext unlock for Android/iOS
let _audioCtx: AudioContext | null = null
function unlockAudioContext() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    if (!_audioCtx) _audioCtx = new AC()
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
    const buf = _audioCtx.createBuffer(1, 1, 22050)
    const src = _audioCtx.createBufferSource()
    src.buffer = buf; src.connect(_audioCtx.destination); src.start(0)
  } catch (_) {}
}

export default function ViewerPage() {
  const params   = useParams()
  const joinCode = (params.joinCode as string).toUpperCase()
  const supabase = createClient()

  const [status, setStatus] = useState<Status>('loading')
  const [scene,  setScene]  = useState<Scene | null>(null)

  // ── Characters ────────────────────────────────────────────────
  const [characters,       setCharacters]       = useState<{ left: Character | null; center: Character | null; right: Character | null }>({ left: null, center: null, right: null })
  const [viewerScales,     setViewerScales]     = useState<{ left: number; center: number; right: number }>({ left: 1, center: 1, right: 1 })
  const [viewerDisplay,    setViewerDisplay]    = useState<{
    left:   { zoom: number; panX: number; panY: number; flipped: boolean }
    center: { zoom: number; panX: number; panY: number; flipped: boolean }
    right:  { zoom: number; panX: number; panY: number; flipped: boolean }
  }>({
    left:   { zoom: 1, panX: 50, panY: 100, flipped: false },
    center: { zoom: 1, panX: 50, panY: 100, flipped: false },
    right:  { zoom: 1, panX: 50, panY: 100, flipped: false },
  })

  const loadCharactersFromState = useCallback(async (state: CharacterState | null) => {
    if (!state) {
      setCharacters({ left: null, center: null, right: null })
      setViewerScales({ left: 1, center: 1, right: 1 })
      return
    }
    const fetchChar = async (id: string | null): Promise<Character | null> => {
      if (!id) return null
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      return data as Character | null
    }
    const [l, c, r] = await Promise.all([fetchChar(state.left), fetchChar(state.center), fetchChar(state.right)])
    setCharacters({ left: l, center: c, right: r })
    setViewerScales({
      left:   state.leftScale   ?? 1,
      center: state.centerScale ?? 1,
      right:  state.rightScale  ?? 1,
    })
    setViewerDisplay({
      left:   { zoom: state.leftZoom   ?? 1, panX: state.leftPanX   ?? 50, panY: state.leftPanY   ?? 100, flipped: state.leftFlipped   ?? false },
      center: { zoom: state.centerZoom ?? 1, panX: state.centerPanX ?? 50, panY: state.centerPanY ?? 100, flipped: state.centerFlipped ?? false },
      right:  { zoom: state.rightZoom  ?? 1, panX: state.rightPanX  ?? 50, panY: state.rightPanY  ?? 100, flipped: state.rightFlipped  ?? false },
    })
  }, [supabase])

  // ── Audio ─────────────────────────────────────────────────────
  const audioRefs             = useRef<Record<string, HTMLAudioElement>>({})
  const audioHandlers         = useRef<Record<string, { play: () => void; pause: () => void }>>({})
  const hasInteracted         = useRef(false)
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [playing, setPlaying] = useState<Record<string, boolean>>({})
  const [muted,   setMuted]   = useState(false)
  const [mixerOpen, setMixerOpen] = useState(false)
  const [needsTap,  setNeedsTap]  = useState(false)
  const [mixerPos, setMixerPos] = useState<'top-left' | 'top-right'>(() => {
    if (typeof window === 'undefined') return 'top-left'
    return (localStorage.getItem('sf_mixer_pos') as 'top-left' | 'top-right') || 'top-left'
  })
  const prevSceneIdForVolRef = useRef<string | null>(null)

  // ── Spotify player ────────────────────────────────────────────
  const spotify = useSpotifyPlayer(scene)

  // ── Fullscreen ────────────────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    function onChange() { setIsFs(!!(document.fullscreenElement || (document as any).webkitFullscreenElement)) }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange) }
  }, [])

  function toggleFs() {
    const el = wrapperRef.current; if (!el) return
    if (isFs) { document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.() }
    else { el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.() }
  }

  // ── Audio helpers ─────────────────────────────────────────────
  function getOrCreate(t: Track): HTMLAudioElement {
    if (t.spotify_uri) return new Audio() // Spotify tracks handled by SDK
    if (!audioRefs.current[t.id]) {
      const src = pubUrl({ url: t.url || undefined, storage_path: t.storage_path || undefined }) || ''
      const a   = new Audio(src)
      a.loop = t.loop; a.muted = muted
      let vol = t.volume
      if (scene?.id) {
        try {
          const saved = JSON.parse(localStorage.getItem(`sf_vol_${scene.id}`) || '{}')
          if (typeof saved[t.id] === 'number') vol = saved[t.id]
        } catch {}
      }
      a.volume = vol
      const playHandler  = () => setPlaying(p => ({ ...p, [t.id]: true  }))
      const pauseHandler = () => setPlaying(p => ({ ...p, [t.id]: false }))
      a.addEventListener('play',  playHandler)
      a.addEventListener('pause', pauseHandler)
      audioHandlers.current[t.id] = { play: playHandler, pause: pauseHandler }
      audioRefs.current[t.id] = a
      setVolumes(v => ({ ...v, [t.id]: vol }))
    }
    return audioRefs.current[t.id]
  }

  function toggleTrack(t: Track) {
    if (t.spotify_uri) { spotify.toggle(t); return }
    const a = getOrCreate(t)
    if (a.paused) { a.play().catch(() => {}) } else { a.pause() }
  }
  function setVol(t: Track, val: number) {
    if (t.spotify_uri) { spotify.setVolume(t, val); return }
    const a = getOrCreate(t); a.volume = val; setVolumes(v => ({ ...v, [t.id]: val }))
    if (scene?.id) {
      try {
        const key = `sf_vol_${scene.id}`
        const saved = JSON.parse(localStorage.getItem(key) || '{}')
        saved[t.id] = val
        localStorage.setItem(key, JSON.stringify(saved))
      } catch {}
    }
  }
  function stopAll() {
    Object.values(audioRefs.current).forEach(a => { a.pause(); a.currentTime = 0 })
    spotify.stopAll()
  }
  function toggleMute() {
    const next = !muted; setMuted(next)
    Object.values(audioRefs.current).forEach(a => (a.muted = next))
    spotify.mute(next)
  }

  function trackPlaying(t: Track) { return t.spotify_uri ? (spotify.states[t.id]?.playing ?? false) : (playing[t.id] ?? false) }
  function trackVolume(t: Track)  { return t.spotify_uri ? (spotify.states[t.id]?.volume  ?? t.volume) : (volumes[t.id] ?? t.volume) }

  // ── Combined reset + autoplay ─────────────────────────────────
  useEffect(() => {
    // Save outgoing scene's volumes before cleanup
    if (prevSceneIdForVolRef.current && Object.keys(audioRefs.current).length > 0) {
      const savedVols: Record<string, number> = {}
      Object.entries(audioRefs.current).forEach(([id, a]) => { savedVols[id] = a.volume })
      try { localStorage.setItem(`sf_vol_${prevSceneIdForVolRef.current}`, JSON.stringify(savedVols)) } catch {}
    }
    prevSceneIdForVolRef.current = scene?.id ?? null

    Object.entries(audioRefs.current).forEach(([id, a]) => {
      const handlers = audioHandlers.current[id]
      if (handlers) {
        a.removeEventListener('play',  handlers.play)
        a.removeEventListener('pause', handlers.pause)
      }
      a.pause(); a.src = ''
    })
    audioRefs.current = {}; audioHandlers.current = {}; setVolumes({}); setPlaying({})

    if (!scene?.tracks?.length) return
    const musicTracks = scene.tracks.filter(
      t => (t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3') && !t.spotify_uri
    )
    if (!musicTracks.length) return

    if (hasInteracted.current) {
      musicTracks.forEach(t => { const a = getOrCreate(t); if (a.paused) a.play().catch(() => {}) })
      return
    }
    getOrCreate(musicTracks[0]).play()
      .then(() => {
        hasInteracted.current = true; setNeedsTap(false)
        musicTracks.slice(1).forEach(t => getOrCreate(t).play().catch(() => {}))
      })
      .catch(() => setNeedsTap(true))
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFirstTap() {
    hasInteracted.current = true; setNeedsTap(false)
    unlockAudioContext()
    const musicTracks = (scene?.tracks || []).filter(
      t => (t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3') && !t.spotify_uri
    )
    musicTracks.forEach(t => { const a = getOrCreate(t); if (a.paused) a.play().catch(() => {}) })
    spotify.autoPlay()
  }

  // ── Load scene ────────────────────────────────────────────────
  const loadScene = useCallback(async (sceneId: string | null) => {
    if (!sceneId) { setScene(null); setStatus('live'); return }
    const { data } = await supabase.from('scenes').select('*, tracks(*)').eq('id', sceneId).single()
    if (data) { setScene(data as Scene); setStatus('live') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load session ──────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    const { data } = await supabase.from('sessions')
      .select('id, active_scene_id, is_live, character_state')
      .eq('join_code', joinCode).maybeSingle()
    if (!data)         { setStatus('waiting'); return }
    if (!data.is_live) { setStatus('ended');   return }
    await Promise.all([
      loadScene(data.active_scene_id),
      loadCharactersFromState(data.character_state as CharacterState | null),
    ])
  }, [joinCode, loadScene, loadCharactersFromState])

  useEffect(() => { loadSession() }, [loadSession])

  useEffect(() => {
    if (status !== 'waiting') return
    const t = setInterval(loadSession, 6000)
    return () => clearInterval(t)
  }, [status, loadSession])

  // ── Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('viewer-' + joinCode)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `join_code=eq.${joinCode}`,
      }, (payload) => {
        const row = payload.new as { active_scene_id: string | null; is_live: boolean; character_state: CharacterState | null }
        if (!row.is_live) { setStatus('ended'); return }
        loadScene(row.active_scene_id)
        loadCharactersFromState(row.character_state)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [joinCode, loadScene, loadCharactersFromState])

  // ── Scene crossfade (two stable layers) ─────────────────────
  interface VBgLayer { scene: Scene | null; opacity: number }
  const [vLayerA, setVLayerA] = useState<VBgLayer>({ scene: null, opacity: 0 })
  const [vLayerB, setVLayerB] = useState<VBgLayer>({ scene: null, opacity: 0 })
  const vFrontRef      = useRef<'a' | 'b'>('a')
  const vPrevSceneId   = useRef<string | null>(null)

  if (scene?.id !== vPrevSceneId.current) {
    vPrevSceneId.current = scene?.id ?? null
    if (scene) {
      if (vFrontRef.current === 'a') {
        setVLayerB({ scene, opacity: 1 })
        setVLayerA(prev => ({ ...prev, opacity: 0 }))
        vFrontRef.current = 'b'
      } else {
        setVLayerA({ scene, opacity: 1 })
        setVLayerB(prev => ({ ...prev, opacity: 0 }))
        vFrontRef.current = 'a'
      }
    }
  }

  const allTracks    = scene?.tracks || []
  const music        = allTracks.filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3')
  const amb          = allTracks.filter(t => t.kind === 'ambience')
  const hasSpotifyTracks = allTracks.some(t => !!t.spotify_uri)
  const spotifyPlayingCount = Object.values(spotify.states).filter(s => s.playing).length
  const playingCount = Object.values(playing).filter(Boolean).length + spotifyPlayingCount

  // ── Status screens ────────────────────────────────────────────
  if (status === 'loading') return (
    <div style={fsStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '22px', color: '#c9a84c', letterSpacing: '2px', marginBottom: '14px' }}>Reverie</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px' }}>Connecting…</div>
      </div>
    </div>
  )

  if (status === 'waiting') return (
    <div style={fsStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '18px' }}><AppIcon size={48} opacity={0.25} /></div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '13px', color: 'rgba(255,255,255,0.5)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '10px' }}>Waiting for DM</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>Session code: {joinCode}</div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '5px', justifyContent: 'center' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c9a84c', animation: `dot .8s ease-in-out ${i*.2}s infinite alternate`, opacity: .4 }} />)}
        </div>
      </div>
      <style>{`@keyframes dot{from{opacity:.2;transform:scale(.8)}to{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  )

  if (status === 'ended') return (
    <div style={fsStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '42px', marginBottom: '18px', opacity: .2 }}>⚔️</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '4px', textTransform: 'uppercase' }}>Session Ended</div>
      </div>
    </div>
  )

  // ── Live viewer ───────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={{ ...fsStyle, overflow: 'hidden' }}>

      {/* Background layer A — isolation:isolate prevents Android Chrome's GPU-
          composited video layer from breaking above UI siblings in z-index. */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: vLayerA.opacity, transition: 'opacity 1s ease', pointerEvents: 'none', isolation: 'isolate' }}>
        {vLayerA.scene && (() => {
          const lBg = pubUrl(vLayerA.scene.bg);  const lOv = pubUrl(vLayerA.scene.overlay)
          return (<>
            {lBg && (vLayerA.scene.bg?.type === 'video'
              ? <video key={lBg} src={lBg} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img   key={lBg} src={lBg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            {lBg && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
            {lOv && (vLayerA.scene.overlay?.type === 'video'
              ? <video key={lOv} src={lOv} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img   key={lOv} src={lOv} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </>)
        })()}
      </div>

      {/* Background layer B */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: vLayerB.opacity, transition: 'opacity 1s ease', pointerEvents: 'none', isolation: 'isolate' }}>
        {vLayerB.scene && (() => {
          const lBg = pubUrl(vLayerB.scene.bg);  const lOv = pubUrl(vLayerB.scene.overlay)
          return (<>
            {lBg && (vLayerB.scene.bg?.type === 'video'
              ? <video key={lBg} src={lBg} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img   key={lBg} src={lBg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            {lBg && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
            {lOv && (vLayerB.scene.overlay?.type === 'video'
              ? <video key={lOv} src={lOv} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img   key={lOv} src={lOv} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </>)
        })()}
      </div>

      {/* ── Characters ── */}
      {characters.left && (
        <CharacterDisplay
          character={characters.left}
          position="left"
          imageUrl={characterImageUrl(characters.left)}
          scale={viewerScales.left}
          imgZoom={viewerDisplay.left.zoom}
          imgPanX={viewerDisplay.left.panX}
          imgPanY={viewerDisplay.left.panY}
          flipped={viewerDisplay.left.flipped}
        />
      )}
      {characters.center && (
        <CharacterDisplay
          character={characters.center}
          position="center"
          imageUrl={characterImageUrl(characters.center)}
          scale={viewerScales.center}
          imgZoom={viewerDisplay.center.zoom}
          imgPanX={viewerDisplay.center.panX}
          imgPanY={viewerDisplay.center.panY}
          flipped={viewerDisplay.center.flipped}
        />
      )}
      {characters.right && (
        <CharacterDisplay
          character={characters.right}
          position="right"
          imageUrl={characterImageUrl(characters.right)}
          scale={viewerScales.right}
          imgZoom={viewerDisplay.right.zoom}
          imgPanX={viewerDisplay.right.panX}
          imgPanY={viewerDisplay.right.panY}
          flipped={viewerDisplay.right.flipped}
        />
      )}

      {/* Scene name */}
      {scene && (
        <div key={scene.id} style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', padding: '18px', fontFamily: "'Playfair Display',serif", fontSize: '16px', letterSpacing: '6px', fontWeight: 500, color: 'rgba(255,255,255,.8)', textShadow: '0 1px 16px rgba(0,0,0,.9)', pointerEvents: 'none', zIndex: 5, animation: 'sceneFadeIn 1s ease forwards' }}>
          {scene.name}
        </div>
      )}

      {!scene && (
        <div style={{ zIndex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.2)', position: 'relative' }}>
          <div style={{ marginBottom: '12px' }}><AppIcon size={48} opacity={0.2} /></div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px' }}>Awaiting Scene</div>
        </div>
      )}

      {/* Fullscreen button — opposite corner from mixer */}
      <button onClick={toggleFs} style={{ position: 'absolute', top: '14px', [mixerPos === 'top-left' ? 'right' : 'left']: '14px', zIndex: 20, width: '44px', height: '44px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: MIXER_BG, color: 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isFs ? '✕' : '⛶'}
      </button>

      {/* Spotify connect prompt — shown when scene has Spotify tracks but player isn't connected */}
      {hasSpotifyTracks && !spotify.connected && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: MIXER_BG, border: '1px solid rgba(30,215,96,0.3)', borderRadius: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1ed760"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>This scene has Spotify music</span>
          <a href="/auth/spotify" style={{ fontSize: '11px', fontWeight: 700, color: '#1ed760', textDecoration: 'none', border: '1px solid rgba(30,215,96,0.5)', borderRadius: '5px', padding: '4px 10px' }}>Connect Spotify</a>
        </div>
      )}

      {/* Tap to start audio overlay */}
      {needsTap && (
        <div onClick={handleFirstTap} style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(7,8,16,0.65)' }}>
          <div style={{ textAlign: 'center', padding: '28px 36px', background: MIXER_BG, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🎵</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '13px', color: 'rgba(255,255,255,0.9)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '8px' }}>Tap to Start Audio</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>Tap anywhere on this card</div>
          </div>
        </div>
      )}

      {/* Audio Mixer */}
      {allTracks.length > 0 && (
        <div style={{ position: 'absolute', top: '14px', [mixerPos === 'top-left' ? 'left' : 'right']: '14px', zIndex: 20, width: '240px' }}>
          <div onClick={() => setMixerOpen(o => !o)} style={{ background: MIXER_BG, border: '1px solid rgba(255,255,255,0.14)', borderRadius: mixerOpen ? '10px 10px 0 0' : '10px', height: '44px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px', flexShrink: 0 }}>
              {[1,0.6,0.85,0.45,0.7].map((h,i) => <div key={i} style={{ width: '3px', borderRadius: '1px', background: playingCount > 0 ? '#c9a84c' : 'rgba(255,255,255,0.2)', height: `${Math.round(h*16)}px`, animation: playingCount > 0 ? `audioBar${i} ${0.6+i*0.15}s ease-in-out infinite alternate` : 'none' }} />)}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', flex: 1, minWidth: 0 }}>Audio</span>
            {playingCount > 0 && <span style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>{playingCount}</span>}
            <button
              onClick={e => {
                e.stopPropagation()
                const next = mixerPos === 'top-left' ? 'top-right' : 'top-left'
                setMixerPos(next)
                localStorage.setItem('sf_mixer_pos', next)
              }}
              title={mixerPos === 'top-left' ? 'Move to top right' : 'Move to top left'}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '13px', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
            >
              {mixerPos === 'top-left' ? '▷' : '◁'}
            </button>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{mixerOpen ? '▲' : '▼'}</span>
          </div>
          {mixerOpen && (
            <div style={{ background: MIXER_BG_PANEL, border: '1px solid rgba(255,255,255,0.14)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {music.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🎵 Music</div>
                  {music.map(t => <TrackRow key={t.id} t={t} isPlaying={trackPlaying(t)} volume={trackVolume(t)} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} nowPlaying={t.spotify_uri && trackPlaying(t) ? spotify.nowPlaying : null} progress={t.spotify_uri && trackPlaying(t) ? spotify.progress : undefined} onSkip={t.spotify_uri ? d => spotify.skip(d) : undefined} />)}
                </div>
              )}
              {music.length > 0 && amb.length > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />}
              {amb.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🌊 Ambience</div>
                  {amb.map(t => <TrackRow key={t.id} t={t} isPlaying={trackPlaying(t)} volume={trackVolume(t)} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} nowPlaying={t.spotify_uri && trackPlaying(t) ? spotify.nowPlaying : null} progress={t.spotify_uri && trackPlaying(t) ? spotify.progress : undefined} onSkip={t.spotify_uri ? d => spotify.skip(d) : undefined} />)}
                </div>
              )}
              <div style={{ padding: '8px 14px 10px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={e => { e.stopPropagation(); stopAll() }} style={{ flex: 1, height: '44px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>⏹ Stop All</button>
                <button onClick={e => { e.stopPropagation(); toggleMute() }} style={{ width: '44px', height: '44px', background: muted ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${muted ? '#c9a84c' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: muted ? '#c9a84c' : 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {muted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes audioBar0{from{height:4px}to{height:16px}}
        @keyframes audioBar1{from{height:8px}to{height:5px}}
        @keyframes audioBar2{from{height:13px}to{height:6px}}
        @keyframes audioBar3{from{height:5px}to{height:14px}}
        @keyframes audioBar4{from{height:11px}to{height:4px}}
        @keyframes sceneFadeIn{from{opacity:0}to{opacity:1}}
      `}</style>
    </div>
  )
}

const fsStyle: React.CSSProperties = {
  width: '100dvw', height: '100dvh', background: '#070810',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  position: 'relative',
}

interface TrackRowProps {
  t:          Track
  isPlaying:  boolean
  volume:     number
  onToggle:   () => void
  onVol:      (v: number) => void
  nowPlaying?: SpotifyNowPlaying | null
  progress?:  number
  onSkip?:    (direction: 'next' | 'previous') => void
}

function TrackRow({ t, isPlaying, volume, onToggle, onVol, nowPlaying, progress, onSkip }: TrackRowProps) {
  const isSpotify    = !!t.spotify_uri
  const showMeta     = isSpotify && isPlaying && !!nowPlaying
  const showProgress = isSpotify && isPlaying && typeof progress === 'number'
  const showSkip     = isSpotify && isPlaying && !!onSkip && t.spotify_type === 'playlist'

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {showMeta && nowPlaying?.albumArt && (
          <img src={nowPlaying.albumArt} alt="" width={36} height={36} style={{ borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }} />
        )}
        <button onClick={e => { e.stopPropagation(); onToggle() }} style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, border: `1px solid ${isPlaying ? '#c9a84c' : 'rgba(255,255,255,0.15)'}`, background: isPlaying ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)', color: isPlaying ? '#c9a84c' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: showMeta ? '2px' : '6px' }}>
            {showMeta ? nowPlaying!.name : t.name}
          </div>
          {showMeta && (
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
              {nowPlaying!.artist}
            </div>
          )}
          <input type="range" min={0} max={1} step={0.01} value={volume} onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onVol(Number(e.target.value)) }} style={{ width: '100%', height: '20px', accentColor: '#c9a84c', cursor: 'pointer', touchAction: 'none' }} />
        </div>
      </div>
      {showProgress && (
        <div style={{ marginTop: '6px', height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(progress ?? 0) * 100}%`, background: '#1ed760', borderRadius: '1px', transition: 'width 0.5s linear' }} />
        </div>
      )}
      {showSkip && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'center' }}>
          <button onClick={e => { e.stopPropagation(); onSkip!('previous') }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '3px 10px', cursor: 'pointer' }}>⏮</button>
          <button onClick={e => { e.stopPropagation(); onSkip!('next')     }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '3px 10px', cursor: 'pointer' }}>⏭</button>
        </div>
      )}
    </div>
  )
}
