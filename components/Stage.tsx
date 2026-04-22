'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Scene, Track, Character, Handout } from '@/lib/types'
import CharacterDisplay, { characterImageUrl } from '@/components/CharacterDisplay'
import AppIcon from '@/components/AppIcon'
import HandoutLightbox from '@/components/HandoutLightbox'
import type { SpotifyPlayerApi } from '@/lib/useSpotifyPlayer'

interface ActiveCharacters {
  left:   Character | null
  center: Character | null
  right:  Character | null
}

interface SlotScales {
  left:   number
  center: number
  right:  number
}

interface SlotDisplay {
  zoom?:    number   // 1.0 – 3.0
  panX?:    number   // 0–100
  panY?:    number   // 0–100
  flipped?: boolean
}

interface SlotDisplayProps {
  left:   SlotDisplay
  center: SlotDisplay
  right:  SlotDisplay
}

interface Props {
  scene:              Scene | null
  hasCampaign:        boolean
  onEdit:             () => void
  // Spotify player owned by the parent (page.tsx) so it survives navigation
  // between the home view and the campaign view without disconnecting.
  spotify:            SpotifyPlayerApi
  // Character props (DM only — undefined on viewer)
  characters?:        ActiveCharacters
  slotScales?:        SlotScales
  slotDisplayProps?:  SlotDisplayProps
  campaignCharacters?: Character[]
  onCharactersChange?: (c: ActiveCharacters) => void
  onSlotDisplayChange?: (slot: 'left'|'center'|'right', scale: number, display: SlotDisplay) => void
  onSaveSlotDisplay?: (slot: 'left'|'center'|'right') => Promise<void>
  onHandoutShow?: (handoutId: string | null) => void
  onMusicTrackChange?: (trackId: string | null) => void
  isLive?: boolean
}

const DEFAULT_CHAR_DISPLAY: SlotDisplay = { zoom: 1, panX: 50, panY: 100, flipped: false }

function mediaUrl(m: Scene['bg']): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

interface BgLayer { scene: Scene | null; opacity: number }

const MIXER_BG       = 'rgba(13,14,22,0.96)'
const MIXER_BG_PANEL = 'rgba(18,20,30,0.98)'

export default function Stage({
  scene, hasCampaign, onEdit, spotify,
  characters, slotScales, slotDisplayProps, campaignCharacters,
  onCharactersChange, onSlotDisplayChange, onSaveSlotDisplay, onHandoutShow, onMusicTrackChange, isLive,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Scene crossfade (two stable layers) ─────────────────────
  // Two always-mounted bg divs (A and B) swap opacity via CSS transition.
  // The inactive layer (opacity 0) receives the new scene content; because
  // it's invisible the video remount is undetectable. No key changes on the
  // layer wrappers means running videos are never interrupted.
  const [layerA, setLayerA] = useState<BgLayer>(() => ({ scene: scene ?? null, opacity: scene ? 1 : 0 }))
  const [layerB, setLayerB] = useState<BgLayer>(() => ({ scene: null, opacity: 0 }))
  const frontLayerRef  = useRef<'a' | 'b'>('a')
  const prevSceneIdRef = useRef<string | null>(scene?.id ?? null)

  // Derived-state swap: runs during render so both layers commit together
  if (scene?.id !== prevSceneIdRef.current) {
    prevSceneIdRef.current = scene?.id ?? null
    if (scene) {
      if (frontLayerRef.current === 'a') {
        setLayerB({ scene, opacity: 1 })
        setLayerA(prev => ({ ...prev, opacity: 0 }))
        frontLayerRef.current = 'b'
      } else {
        setLayerA({ scene, opacity: 1 })
        setLayerB(prev => ({ ...prev, opacity: 0 }))
        frontLayerRef.current = 'a'
      }
    }
  }

  // ── Audio ────────────────────────────────────────────────────
  const audioRefs              = useRef<Record<string, HTMLAudioElement>>({})
  const audioHandlers          = useRef<Record<string, { play: () => void; pause: () => void; ended?: () => void }>>({})
  const [volumes, setVolumes]  = useState<Record<string, number>>({})
  const [playing, setPlaying]  = useState<Record<string, boolean>>({})
  const [muted,   setMuted]    = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [mixerPos, setMixerPos] = useState<'top-left' | 'top-right'>(() => {
    if (typeof window === 'undefined') return 'top-left'
    return (localStorage.getItem('sf_mixer_pos') as 'top-left' | 'top-right') || 'top-left'
  })
  const prevSceneIdForVolRef = useRef<string | null>(null)
  // Playlist: tracks the currently active base-music track index
  const [musicIdx, setMusicIdx] = useState(0)
  const musicIdxRef            = useRef(0)
  const sceneMusicRef          = useRef<Track[]>([])
  // Stable ref so the endedHandler closure always calls the latest prop
  const onMusicTrackChangeRef  = useRef(onMusicTrackChange)
  useEffect(() => { onMusicTrackChangeRef.current = onMusicTrackChange }, [onMusicTrackChange])

  // ── Handouts ─────────────────────────────────────────────────
  const [handoutsOpen,   setHandoutsOpen]   = useState(false)
  const [activeHandout,  setActiveHandout]  = useState<Handout | null>(null)

  function showHandout(h: Handout | null) {
    setActiveHandout(h)
    onHandoutShow?.(h?.id ?? null)
  }

  // ── Fullscreen ───────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false)

  const enterFullscreen = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    if (el.requestFullscreen) el.requestFullscreen()
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) document.exitFullscreen()
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen()
  }, [])

  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // ── Character slot panel state (DM only) ─────────────────────
  // activeSlot: which slot's panel is open; panelMode: adjust existing or pick new
  const [activeSlot,    setActiveSlot]    = useState<'left' | 'center' | 'right' | null>(null)
  const [panelMode,     setPanelMode]     = useState<'adjust' | 'pick'>('pick')
  const [savedConfirm,  setSavedConfirm]  = useState(false)
  const [charSearch, setCharSearch]   = useState('')
  // Track whether this device has touch so we can disable autoFocus (which
  // opens the keyboard on Android and resizes the stage, hiding the popup).
  const isTouchDevice = useRef(false)
  useEffect(() => {
    isTouchDevice.current = navigator.maxTouchPoints > 0
  }, [])
  // Timestamp of when the picker was last opened. Used to guard the
  // click-away overlay against closing the picker within the same touch
  // gesture that opened it (Android synthesizes a click after touchend even
  // when preventDefault is called in some WebView versions).
  const pickerOpenTimeRef = useRef(0)

  // Close panels whenever the scene changes.
  useEffect(() => {
    setActiveSlot(null)
    setCharSearch('')
    setHandoutsOpen(false)
    showHandout(null)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredChars = (campaignCharacters || []).filter(c =>
    !charSearch || c.name.toLowerCase().includes(charSearch.toLowerCase())
  )

  function pickCharacter(c: Character) {
    if (!activeSlot || !onCharactersChange || !characters) return
    onCharactersChange({ ...characters, [activeSlot]: c })
    // After picking, switch to adjust mode so DM can fine-tune immediately.
    setPanelMode('adjust')
    setCharSearch('')
  }

  function removeCharacter(slot: 'left' | 'center' | 'right') {
    if (!onCharactersChange || !characters) return
    onCharactersChange({ ...characters, [slot]: null })
    if (activeSlot === slot) setActiveSlot(null)
  }

  // Keep refs in sync for stable event-handler callbacks
  useEffect(() => { musicIdxRef.current = musicIdx }, [musicIdx])

  // ── Audio: combined reset + autoplay ─────────────────────────
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
        if (handlers.ended) a.removeEventListener('ended', handlers.ended)
      }
      a.pause(); a.src = ''
    })
    audioRefs.current = {}
    audioHandlers.current = {}
    setVolumes({})
    setPlaying({})

    // Reset music playlist index
    setMusicIdx(0)
    musicIdxRef.current = 0

    if (!scene?.tracks?.length) return

    const baseMusic = scene.tracks.filter(t => t.kind === 'music' && !t.spotify_uri)
    const layers    = scene.tracks.filter(t => (t.kind === 'ml2' || t.kind === 'ml3') && !t.spotify_uri)
    sceneMusicRef.current = scene.tracks.filter(t => t.kind === 'music')

    const timer = setTimeout(() => {
      // Pre-create ALL base music tracks so onended can reference them,
      // but only start playing from index 0.
      baseMusic.forEach((t, i) => {
        const a = getOrCreate(t)
        if (i === 0 && (t.signed_url || t.url)) a.play().catch(() => {})
      })
      // All intensity layers play simultaneously
      layers.forEach(t => {
        if (t.signed_url || t.url) getOrCreate(t).play().catch(() => {})
      })
      // Ambience tracks always play simultaneously
      const amb = scene.tracks.filter(t => t.kind === 'ambience' && !t.spotify_uri)
      amb.forEach(t => {
        if (t.signed_url || t.url) getOrCreate(t).play().catch(() => {})
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop all audio when Stage unmounts (e.g. navigating back to campaign home)
  useEffect(() => {
    return () => {
      Object.entries(audioRefs.current).forEach(([id, a]) => {
        const handlers = audioHandlers.current[id]
        if (handlers) {
          a.removeEventListener('play',  handlers.play)
          a.removeEventListener('pause', handlers.pause)
          if (handlers.ended) a.removeEventListener('ended', handlers.ended)
        }
        a.pause(); a.src = ''
      })
      audioRefs.current   = {}
      audioHandlers.current = {}
    }
  }, [])

  function getOrCreate(t: Track): HTMLAudioElement {
    if (t.spotify_uri) return new Audio() // never used — Spotify tracks go through SDK
    if (!audioRefs.current[t.id]) {
      const a = new Audio(t.signed_url || t.url || '')
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

      // Base music tracks auto-advance to next when they end (if not looping)
      let endedHandler: (() => void) | undefined
      if (t.kind === 'music') {
        endedHandler = () => {
          const tracks = sceneMusicRef.current
          if (tracks.length <= 1) return
          const nextIdx = (musicIdxRef.current + 1) % tracks.length
          const next = tracks[nextIdx]
          if (next && !next.spotify_uri) {
            const nextAudio = audioRefs.current[next.id]
            if (nextAudio) { nextAudio.currentTime = 0; nextAudio.play().catch(() => {}) }
          }
          setMusicIdx(nextIdx)
          musicIdxRef.current = nextIdx
          onMusicTrackChangeRef.current?.(next?.id ?? null)
        }
        a.addEventListener('ended', endedHandler)
      }

      audioHandlers.current[t.id] = { play: playHandler, pause: pauseHandler, ended: endedHandler }
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
    const a = getOrCreate(t); a.volume = val
    setVolumes(v => ({ ...v, [t.id]: val }))
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
  function handleMute() {
    const next = !muted; setMuted(next)
    Object.values(audioRefs.current).forEach(a => (a.muted = next))
    spotify.mute(next)
  }

  function switchMusicTrack(newIdx: number) {
    const baseTracks = (scene?.tracks || []).filter(t => t.kind === 'music')
    if (newIdx < 0 || newIdx >= baseTracks.length || newIdx === musicIdx) return
    const current = baseTracks[musicIdx]
    const next    = baseTracks[newIdx]
    // Stop current
    if (current) {
      if (!current.spotify_uri) {
        const a = audioRefs.current[current.id]
        if (a) { a.pause(); a.currentTime = 0 }
      } else if (!isLive && spotify.states[current.id]?.playing) {
        // When live the viewer is the audio master — don't touch Spotify on DM side
        spotify.toggle(current)
      }
    }
    // Start next
    if (next) {
      if (!next.spotify_uri) {
        getOrCreate(next).play().catch(() => {})
      } else if (!isLive && !spotify.states[next.id]?.playing) {
        // When live, viewer receives the track ID via active_music_track_id and plays it
        spotify.toggle(next)
      }
    }
    setMusicIdx(newIdx)
    musicIdxRef.current = newIdx
    onMusicTrackChange?.(next?.id ?? null)
  }

  if (!scene) {
    return (
      <div style={{ flex: 1, background: '#080a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ marginBottom: '14px' }}><AppIcon size={48} opacity={0.2} /></div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px' }}>
            {hasCampaign ? 'Select a Scene' : 'Select a Campaign'}
          </div>
        </div>
      </div>
    )
  }

  const bgUrl        = mediaUrl(scene.bg)
  const allTracks    = scene.tracks || []
  const baseMusic    = allTracks.filter(t => t.kind === 'music')
  const layers       = allTracks.filter(t => t.kind === 'ml2' || t.kind === 'ml3')
  const amb          = allTracks.filter(t => t.kind === 'ambience')
  const handouts     = scene.handouts || []
  const hasTracks    = allTracks.length > 0
  // Keep sceneMusicRef in sync for the onended callback (can't use useEffect here as it's in render)
  sceneMusicRef.current = baseMusic
  const clampedMusicIdx     = Math.min(musicIdx, Math.max(0, baseMusic.length - 1))
  const currentMusicTrack   = baseMusic[clampedMusicIdx] ?? null
  const spotifyPlayingCount = Object.values(spotify.states).filter(s => s.playing).length
  const playingCount = Object.values(playing).filter(Boolean).length + spotifyPlayingCount

  // Helpers to read merged state for any track
  function trackPlaying(t: Track) { return t.spotify_uri ? (spotify.states[t.id]?.playing ?? false) : (playing[t.id] ?? false) }
  function trackVolume(t: Track)  { return t.spotify_uri ? (spotify.states[t.id]?.volume  ?? t.volume) : (volumes[t.id] ?? t.volume) }
  function trackLoop(t: Track)    { return t.spotify_uri ? (spotify.states[t.id]?.loop    ?? t.loop)   : t.loop }
  const hasDMControls = !!onCharactersChange

  return (
    <div
      ref={wrapperRef}
      style={{
        // When fullscreen, flex:1 loses its meaning (the parent flex container
        // is no longer in play). Android Chrome doesn't resolve flex-based
        // height for the fullscreen element's containing block, so absolute
        // children with height:'88%' collapse to 0. Use explicit viewport
        // dimensions instead so position:absolute children size correctly.
        flex: isFullscreen ? undefined : 1,
        width:  isFullscreen ? '100dvw' : undefined,
        height: isFullscreen ? '100dvh' : undefined,
        position: 'relative',
        overflow: 'hidden',
        background: '#080a10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── Background layer A — isolation:isolate prevents Android Chrome's
          GPU-composited video layer from breaking above UI siblings. ── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: layerA.opacity, transition: 'opacity 1s ease', pointerEvents: 'none', isolation: 'isolate' }}>
        {layerA.scene && (() => {
          const lBg = mediaUrl(layerA.scene.bg)
          return (<>
            {lBg && (layerA.scene.bg?.type === 'video'
              ? <video key={lBg} src={lBg} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img   key={lBg} src={lBg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            {lBg && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
          </>)
        })()}
      </div>

      {/* ── Background layer B ── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: layerB.opacity, transition: 'opacity 1s ease', pointerEvents: 'none', isolation: 'isolate' }}>
        {layerB.scene && (() => {
          const lBg = mediaUrl(layerB.scene.bg)
          return (<>
            {lBg && (layerB.scene.bg?.type === 'video'
              ? <video key={lBg} src={lBg} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img   key={lBg} src={lBg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            {lBg && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
          </>)
        })()}
      </div>

      {/* ── Characters ── */}
      {characters?.left && (
        <CharacterDisplay
          character={characters.left}
          position="left"
          imageUrl={characterImageUrl(characters.left)}
          scale={slotScales?.left ?? 1}
          imgZoom={slotDisplayProps?.left.zoom}
          imgPanX={slotDisplayProps?.left.panX}
          imgPanY={slotDisplayProps?.left.panY}
          flipped={slotDisplayProps?.left.flipped}
        />
      )}
      {characters?.center && (
        <CharacterDisplay
          character={characters.center}
          position="center"
          imageUrl={characterImageUrl(characters.center)}
          scale={slotScales?.center ?? 1}
          imgZoom={slotDisplayProps?.center.zoom}
          imgPanX={slotDisplayProps?.center.panX}
          imgPanY={slotDisplayProps?.center.panY}
          flipped={slotDisplayProps?.center.flipped}
        />
      )}
      {characters?.right && (
        <CharacterDisplay
          character={characters.right}
          position="right"
          imageUrl={characterImageUrl(characters.right)}
          scale={slotScales?.right ?? 1}
          imgZoom={slotDisplayProps?.right.zoom}
          imgPanX={slotDisplayProps?.right.panX}
          imgPanY={slotDisplayProps?.right.panY}
          flipped={slotDisplayProps?.right.flipped}
        />
      )}

      {/* ── Scene name ── */}
      <div key={scene.id} style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', padding: '14px', fontFamily: "'Cinzel',serif", fontSize: '14px', letterSpacing: '5px', fontWeight: 500, color: 'rgba(255,255,255,.75)', textShadow: '0 1px 12px rgba(0,0,0,.9)', pointerEvents: 'none', zIndex: 5, animation: 'sceneFadeIn 1s ease forwards' }}>
        {scene.name}
      </div>

      {/* ── No background placeholder ── */}
      {!bgUrl && (
        <div style={{ zIndex: 1, textAlign: 'center', color: 'var(--text-3)', position: 'relative' }}>
          <div style={{ fontSize: '40px', opacity: .2, marginBottom: '12px' }}>🖼</div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '14px' }}>No Background</div>
          <button className="btn btn-outline" onClick={onEdit}>Edit Scene</button>
        </div>
      )}

      {/* ── Top corner: Edit + Handouts + Fullscreen (opposite corner from mixer) ── */}
      <div style={{ position: 'absolute', top: '14px', [mixerPos === 'top-left' ? 'right' : 'left']: '14px', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: mixerPos === 'top-left' ? 'flex-end' : 'flex-start', gap: '8px' }}>
        {/* Button row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {handouts.length > 0 && (
            <button
              onClick={() => setHandoutsOpen(o => !o)}
              title="Handouts"
              style={{ width: '44px', height: '44px', borderRadius: '8px', border: `1px solid ${handoutsOpen ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.14)'}`, background: handoutsOpen ? 'rgba(201,168,76,0.12)' : 'rgba(13,14,22,0.82)', color: handoutsOpen ? 'var(--accent)' : 'rgba(255,255,255,0.75)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="1" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4.5 5h6M4.5 7.5h6M4.5 10h3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <button
            onClick={onEdit}
            title="Edit Scene"
            style={{ width: '44px', height: '44px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(13,14,22,0.82)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 1.5L12.5 4.5L4.5 12.5H1.5V9.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M8 3L11 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            style={{ width: '44px', height: '44px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(13,14,22,0.82)', color: 'rgba(255,255,255,0.75)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>

        {/* Handouts dropdown panel */}
        {handoutsOpen && handouts.length > 0 && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ width: '260px', background: 'rgba(18,20,30,0.98)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.8)' }}
          >
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', flex: 1 }}>Handouts</span>
              <button onClick={() => setHandoutsOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            </div>
            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '6px 8px' }}>
              {handouts.map(h => {
                const imgUrl = h.media?.signed_url || h.media?.url || null
                return (
                  <button
                    key={h.id}
                    onClick={() => { showHandout(h); setHandoutsOpen(false) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '5px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {imgUrl
                        ? <img src={imgUrl} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '16px', opacity: 0.5 }}>🗺</span>
                      }
                    </div>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>Show</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Handout lightbox ── */}
      {activeHandout && (
        <HandoutLightbox handout={activeHandout} onClose={() => showHandout(null)} />
      )}

      {/* ── DM Character Slots ──────────────────────────────────
          Two small slot buttons at bottom-center for live character control.
          Only shown when onCharactersChange is provided (DM view).
      ──────────────────────────────────────────────────────── */}
      {hasDMControls && (
        <div style={{ position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: '8px' }}>
          {(['left', 'center', 'right'] as const).map(slot => {
            const char = characters?.[slot] ?? null
            const imgUrl = char ? characterImageUrl(char) : null
            return (
              <div key={slot} style={{ position: 'relative' }}>
                {/* Slot button */}
                <button
                  onPointerDown={e => {
                    e.preventDefault() // blocks subsequent synthetic click on Android
                    if (activeSlot === slot) { setActiveSlot(null); return }
                    const mode = char ? 'adjust' : 'pick'
                    if (mode === 'pick') pickerOpenTimeRef.current = Date.now()
                    setActiveSlot(slot)
                    setPanelMode(mode)
                  }}
                  title={char ? `Adjust ${slot} character` : `Add ${slot} character`}
                  style={{
                    width: '44px', height: '44px', borderRadius: '8px',
                    border: `1px solid ${char ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.14)'}`,
                    background: char ? 'rgba(201,168,76,0.08)' : MIXER_BG,
                    cursor: 'pointer', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, touchAction: 'manipulation',
                  }}
                >
                  {imgUrl
                    ? <img src={imgUrl} alt={char!.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{slot === 'left' ? 'L' : slot === 'center' ? 'C' : 'R'}+</span>
                  }
                </button>

                {/* Remove button on hover */}
                {char && (
                  <button
                    onClick={e => { e.stopPropagation(); removeCharacter(slot) }}
                    onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); removeCharacter(slot) }}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, zIndex: 2, touchAction: 'manipulation' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Adjust panel (character in slot) ──────────────────── */}
      {activeSlot && panelMode === 'adjust' && hasDMControls && characters?.[activeSlot] && (() => {
        const slot    = activeSlot
        const char    = characters[slot]!
        const imgUrl  = characterImageUrl(char)
        const scale   = slotScales?.[slot] ?? 1
        const display = slotDisplayProps?.[slot] ?? DEFAULT_CHAR_DISPLAY
        const zoom    = display.zoom  ?? 1
        const panX    = display.panX  ?? 50
        const panY    = display.panY  ?? 100
        const zoomed  = zoom > 1.05
        function fire(newScale: number, newDisplay: SlotDisplay) {
          onSlotDisplayChange?.(slot, newScale, newDisplay)
        }
        return (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: '300px', background: 'rgba(18,20,30,0.98)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.8)' }}
          >
            {/* Header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {imgUrl ? <img src={imgUrl} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>🧑</span>}
              </div>
              <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{char.name}</span>
              <button
                onClick={() => { setPanelMode('pick'); pickerOpenTimeRef.current = Date.now() }}
                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', padding: '5px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0 }}
              >Change</button>
              <button onClick={() => setActiveSlot(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px', flexShrink: 0, touchAction: 'manipulation' }}>✕</button>
            </div>

            {/* Controls */}
            <div style={{ padding: '10px 14px 14px' }}>
              {/* Scale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', width: '34px', flexShrink: 0 }}>Scale</span>
                <input type="range" min={0.5} max={2.5} step={0.05} value={scale}
                  onChange={e => fire(Number(e.target.value), display)}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: '44px', touchAction: 'none' }}
                />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', width: '34px', textAlign: 'right', flexShrink: 0 }}>{Math.round(scale * 100)}%</span>
              </div>

              {/* Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', width: '34px', flexShrink: 0 }}>Zoom</span>
                <input type="range" min={1} max={3} step={0.05} value={zoom}
                  onChange={e => fire(scale, { ...display, zoom: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: '44px', touchAction: 'none' }}
                />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', width: '34px', textAlign: 'right', flexShrink: 0 }}>{zoom.toFixed(1)}x</span>
              </div>

              {/* Pan sliders — only shown when zoomed in */}
              {zoomed && [
                { label: 'Pan X', val: panX, onChange: (v: number) => fire(scale, { ...display, panX: v }) },
                { label: 'Pan Y', val: panY, onChange: (v: number) => fire(scale, { ...display, panY: v }) },
              ].map(({ label, val, onChange }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', width: '34px', flexShrink: 0 }}>{label}</span>
                  <input type="range" min={0} max={100} step={1} value={val}
                    onChange={e => onChange(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: '44px', touchAction: 'none' }}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', width: '34px', textAlign: 'right', flexShrink: 0 }}>{val}%</span>
                </div>
              ))}

              {/* Flip row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', width: '34px', flexShrink: 0 }}>Flip</span>
                <button onClick={() => fire(scale, { ...display, flipped: !display.flipped })}
                  style={{
                    fontSize: '10px', minHeight: '36px', padding: '0 14px', borderRadius: '5px', cursor: 'pointer', touchAction: 'manipulation',
                    background: display.flipped ? 'var(--accent-bg)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${display.flipped ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                    color: display.flipped ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                  }}
                >↔ Mirror</button>
              </div>

              {/* Save button */}
              {onSaveSlotDisplay && (
                <button
                  onClick={async () => {
                    await onSaveSlotDisplay(slot)
                    setSavedConfirm(true)
                    setTimeout(() => setSavedConfirm(false), 1800)
                  }}
                  style={{
                    width: '100%', minHeight: '40px', borderRadius: '7px', cursor: 'pointer',
                    touchAction: 'manipulation', fontWeight: 700, fontSize: '11px',
                    letterSpacing: '1px', textTransform: 'uppercase', border: 'none',
                    background: savedConfirm ? 'rgba(201,168,76,0.2)' : 'var(--accent)',
                    color: savedConfirm ? 'var(--accent)' : '#13151d',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  {savedConfirm ? '✓ Saved' : 'Save Position'}
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Character Picker Popup ──────────────────────────────── */}
      {activeSlot && panelMode === 'pick' && hasDMControls && (
        <div
          onPointerDown={e => e.stopPropagation()}
          style={{ position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: '260px', background: 'rgba(18,20,30,0.98)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.8)' }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', flex: 1 }}>
              {activeSlot === 'left' ? 'Left' : activeSlot === 'center' ? 'Center' : 'Right'} Character
            </span>
            {characters?.[activeSlot] && (
              <button onClick={() => setPanelMode('adjust')} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', touchAction: 'manipulation' }}>← Back</button>
            )}
            <button onClick={() => setActiveSlot(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <input
              autoFocus={!isTouchDevice.current}
              placeholder="Search characters…"
              value={charSearch}
              onChange={e => setCharSearch(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px', outline: 'none' }}
            />
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0 8px 8px' }}>
            {filteredChars.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                {campaignCharacters?.length === 0 ? 'No characters yet — add them in the scene editor' : 'No matches'}
              </div>
            )}
            {filteredChars.map(c => {
              const img = characterImageUrl(c)
              return (
                <button
                  key={c.id}
                  onClick={() => pickCharacter(c)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px', textAlign: 'left', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {img
                      ? <img src={img} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '16px' }}>🧑</span>
                    }
                  </div>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Click-away to close panel.
          Time guard: ignore pointer events within 300ms of the picker opening —
          catches the synthetic click Android fires after touchend. */}
      {activeSlot && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 25 }}
          onPointerDown={() => {
            if (panelMode === 'pick' && Date.now() - pickerOpenTimeRef.current <= 300) return
            setActiveSlot(null)
          }}
        />
      )}

      {/* ── Audio Mixer ── */}
      {hasTracks && (
        <div style={{ position: 'absolute', top: '14px', [mixerPos === 'top-left' ? 'left' : 'right']: '14px', zIndex: 20, width: '240px' }}>
          <div onClick={() => setExpanded(e => !e)}
            style={{ background: MIXER_BG, border: '1px solid rgba(255,255,255,0.14)', borderRadius: expanded ? '10px 10px 0 0' : '10px', padding: '0 10px', height: '44px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px', flexShrink: 0 }}>
              {[1, 0.6, 0.85, 0.45, 0.7].map((h, i) => (
                <div key={i} style={{ width: '3px', borderRadius: '1px', background: playingCount > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)', height: `${Math.round(h * 16)}px`, animation: playingCount > 0 ? `audioBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate` : 'none' }} />
              ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', flex: 1, minWidth: 0 }}>Audio</span>
            {playingCount > 0 && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{playingCount}</span>}
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
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
          </div>

          {expanded && (
            <div style={{ background: MIXER_BG_PANEL, border: '1px solid rgba(255,255,255,0.14)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {/* ── Base music (playlist) ── */}
              {baseMusic.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', flex: 1 }}>🎵 Music</span>
                    {baseMusic.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={e => { e.stopPropagation(); switchMusicTrack(clampedMusicIdx - 1) }} disabled={clampedMusicIdx === 0}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: clampedMusicIdx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', fontSize: '11px', height: '22px', width: '22px', cursor: clampedMusicIdx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏮</button>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', minWidth: '28px', textAlign: 'center' }}>{clampedMusicIdx + 1}/{baseMusic.length}</span>
                        <button onClick={e => { e.stopPropagation(); switchMusicTrack(clampedMusicIdx + 1) }} disabled={clampedMusicIdx === baseMusic.length - 1}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: clampedMusicIdx === baseMusic.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', fontSize: '11px', height: '22px', width: '22px', cursor: clampedMusicIdx === baseMusic.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏭</button>
                      </div>
                    )}
                  </div>
                  {currentMusicTrack && (
                    <MiniTrackRow key={currentMusicTrack.id} t={currentMusicTrack} isPlaying={trackPlaying(currentMusicTrack)} volume={trackVolume(currentMusicTrack)} onToggle={() => toggleTrack(currentMusicTrack)} onVol={v => setVol(currentMusicTrack, v)} nowPlaying={currentMusicTrack.spotify_uri && trackPlaying(currentMusicTrack) ? spotify.nowPlaying : null} progress={currentMusicTrack.spotify_uri && trackPlaying(currentMusicTrack) ? spotify.progress : undefined} onSkip={currentMusicTrack.spotify_uri ? d => spotify.skip(d) : undefined} />
                  )}
                </div>
              )}

              {/* ── Dynamic layers (ml2/ml3) ── */}
              {layers.length > 0 && (
                <>
                  {(baseMusic.length > 0) && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />}
                  <div style={{ padding: '10px 14px 6px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🎚 Layers</div>
                    {layers.map(t => <MiniTrackRow key={t.id} t={t} isPlaying={trackPlaying(t)} volume={trackVolume(t)} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} nowPlaying={t.spotify_uri && trackPlaying(t) ? spotify.nowPlaying : null} progress={t.spotify_uri && trackPlaying(t) ? spotify.progress : undefined} onSkip={t.spotify_uri ? d => spotify.skip(d) : undefined} />)}
                  </div>
                </>
              )}

              {/* ── Ambience (all simultaneous) ── */}
              {(baseMusic.length > 0 || layers.length > 0) && amb.length > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />}
              {amb.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🌊 Ambience</div>
                  {amb.map(t => <MiniTrackRow key={t.id} t={t} isPlaying={trackPlaying(t)} volume={trackVolume(t)} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} nowPlaying={t.spotify_uri && trackPlaying(t) ? spotify.nowPlaying : null} progress={t.spotify_uri && trackPlaying(t) ? spotify.progress : undefined} onSkip={t.spotify_uri ? d => spotify.skip(d) : undefined} />)}
                </div>
              )}

              <div style={{ padding: '8px 14px 10px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={e => { e.stopPropagation(); stopAll() }} style={{ flex: 1, height: '44px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>⏹ Stop All</button>
                <button onClick={e => { e.stopPropagation(); handleMute() }} style={{ width: '44px', height: '44px', background: muted ? 'var(--accent-bg)' : 'rgba(255,255,255,0.06)', border: `1px solid ${muted ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: muted ? 'var(--accent)' : 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

import type { SpotifyNowPlaying } from '@/lib/useSpotifyPlayer'

interface MiniTrackRowProps {
  t:          Track
  isPlaying:  boolean
  volume:     number
  onToggle:   () => void
  onVol:      (v: number) => void
  nowPlaying?: SpotifyNowPlaying | null
  progress?:  number   // 0–1, only for active Spotify tracks
  onSkip?:    (direction: 'next' | 'previous') => void
}

function MiniTrackRow({ t, isPlaying, volume, onToggle, onVol, nowPlaying, progress, onSkip }: MiniTrackRowProps) {
  const isSpotify    = !!t.spotify_uri
  const showMeta     = isSpotify && isPlaying && !!nowPlaying
  const showProgress = isSpotify && isPlaying && typeof progress === 'number'
  const showSkip     = isSpotify && isPlaying && !!onSkip && t.spotify_type === 'playlist'

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Album art — shown for active Spotify tracks */}
        {showMeta && nowPlaying?.albumArt && (
          <img
            src={nowPlaying.albumArt}
            alt=""
            width={36} height={36}
            style={{ borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }}
          />
        )}
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, border: `1px solid ${isPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`, background: isPlaying ? 'var(--accent-bg)' : 'rgba(255,255,255,0.05)', color: isPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Track name — real Spotify title when playing, label name otherwise */}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: showMeta ? '2px' : '6px' }}>
            {showMeta ? nowPlaying!.name : t.name}
          </div>
          {/* Artist name */}
          {showMeta && (
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
              {nowPlaying!.artist}
            </div>
          )}
          <input type="range" min={0} max={1} step={0.01} value={volume} onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onVol(Number(e.target.value)) }} style={{ width: '100%', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer', touchAction: 'none' }} />
        </div>
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div style={{ marginTop: '6px', height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(progress ?? 0) * 100}%`, background: '#1ed760', borderRadius: '1px', transition: 'width 0.5s linear' }} />
        </div>
      )}

      {/* Skip controls — only shown for playlists */}
      {showSkip && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'center' }}>
          <button onClick={e => { e.stopPropagation(); onSkip!('previous') }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', height: '32px', padding: '0 14px', cursor: 'pointer' }}>⏮</button>
          <button onClick={e => { e.stopPropagation(); onSkip!('next')     }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', height: '32px', padding: '0 14px', cursor: 'pointer' }}>⏭</button>
        </div>
      )}
    </div>
  )
}
