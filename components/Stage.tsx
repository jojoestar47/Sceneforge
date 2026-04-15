'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Scene, Track, Character } from '@/lib/types'
import CharacterDisplay, { characterImageUrl } from '@/components/CharacterDisplay'

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

interface Props {
  scene:              Scene | null
  hasCampaign:        boolean
  onEdit:             () => void
  // Character props (DM only — undefined on viewer)
  characters?:        ActiveCharacters
  slotScales?:        SlotScales
  campaignCharacters?: Character[]
  onCharactersChange?: (c: ActiveCharacters) => void
}

function mediaUrl(m: Scene['bg']): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

const MIXER_BG       = 'rgba(13,14,22,0.96)'
const MIXER_BG_PANEL = 'rgba(18,20,30,0.98)'

export default function Stage({
  scene, hasCampaign, onEdit,
  characters, slotScales, campaignCharacters, onCharactersChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Scene crossfade transition ───────────────────────────────
  const prevSceneRef   = useRef<Scene | null>(null)
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fadingOutScene, setFadingOutScene] = useState<Scene | null>(null)

  useEffect(() => {
    const prev = prevSceneRef.current
    prevSceneRef.current = scene ?? null
    if (prev && prev.id !== scene?.id) {
      setFadingOutScene(prev)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = setTimeout(() => setFadingOutScene(null), 700)
    }
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current) }, [])

  // ── Audio ────────────────────────────────────────────────────
  const audioRefs              = useRef<Record<string, HTMLAudioElement>>({})
  const audioHandlers          = useRef<Record<string, { play: () => void; pause: () => void }>>({})
  const [volumes, setVolumes]  = useState<Record<string, number>>({})
  const [playing, setPlaying]  = useState<Record<string, boolean>>({})
  const [muted,   setMuted]    = useState(false)
  const [expanded, setExpanded] = useState(false)

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

  // ── Character picker state (DM only) ─────────────────────────
  const [pickerSlot, setPickerSlot]   = useState<'left' | 'center' | 'right' | null>(null)
  const [charSearch, setCharSearch]   = useState('')
  // Track whether this device has touch so we can disable autoFocus (which
  // opens the keyboard on Android and resizes the stage, hiding the popup).
  const isTouchDevice = useRef(false)
  useEffect(() => {
    isTouchDevice.current = navigator.maxTouchPoints > 0
  }, [])

  const filteredChars = (campaignCharacters || []).filter(c =>
    !charSearch || c.name.toLowerCase().includes(charSearch.toLowerCase())
  )

  function pickCharacter(c: Character) {
    if (!pickerSlot || !onCharactersChange || !characters) return
    onCharactersChange({ ...characters, [pickerSlot]: c })
    setPickerSlot(null)
    setCharSearch('')
  }

  function removeCharacter(slot: 'left' | 'center' | 'right') {
    if (!onCharactersChange || !characters) return
    onCharactersChange({ ...characters, [slot]: null })
  }

  // ── Audio: combined reset + autoplay ─────────────────────────
  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([id, a]) => {
      const handlers = audioHandlers.current[id]
      if (handlers) {
        a.removeEventListener('play',  handlers.play)
        a.removeEventListener('pause', handlers.pause)
      }
      a.pause(); a.src = ''
    })
    audioRefs.current = {}
    audioHandlers.current = {}
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
      a.loop = t.loop; a.volume = t.volume; a.muted = muted
      const playHandler  = () => setPlaying(p => ({ ...p, [t.id]: true  }))
      const pauseHandler = () => setPlaying(p => ({ ...p, [t.id]: false }))
      a.addEventListener('play',  playHandler)
      a.addEventListener('pause', pauseHandler)
      audioHandlers.current[t.id] = { play: playHandler, pause: pauseHandler }
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
    const a = getOrCreate(t); a.volume = val
    setVolumes(v => ({ ...v, [t.id]: val }))
  }
  function stopAll() { Object.values(audioRefs.current).forEach(a => { a.pause(); a.currentTime = 0 }) }
  function handleMute() {
    const next = !muted; setMuted(next)
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
  const hasDMControls = !!onCharactersChange

  return (
    <div
      ref={wrapperRef}
      style={{ flex: 1, position: 'relative', background: '#080a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* ── Fading-out previous scene background ── */}
      {fadingOutScene && (() => {
        const fBgUrl = mediaUrl(fadingOutScene.bg)
        const fOvUrl = mediaUrl(fadingOutScene.overlay)
        return (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, animation: 'sceneFadeOut 0.7s ease forwards', pointerEvents: 'none' }}>
            {fBgUrl && (fadingOutScene.bg?.type === 'video'
              ? <video src={fBgUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={fBgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            {fBgUrl && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
            {fOvUrl && (fadingOutScene.overlay?.type === 'video'
              ? <video src={fOvUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={fOvUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        )
      })()}

      {/* ── Background (clipped) ── */}
      <div key={scene.id} style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1, animation: 'sceneFadeIn 0.7s ease forwards' }}>
        {bgUrl && (
          scene.bg?.type === 'video'
            ? <video key={bgUrl} src={bgUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img    key={bgUrl} src={bgUrl} alt=""  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {bgUrl && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,.55) 100%)' }} />}
        {ovUrl && (
          scene.overlay?.type === 'video'
            ? <video key={ovUrl} src={ovUrl} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img    key={ovUrl} src={ovUrl} alt=""  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      {/* ── Characters ── */}
      {characters?.left && (
        <CharacterDisplay
          character={characters.left}
          position="left"
          imageUrl={characterImageUrl(characters.left)}
          scale={slotScales?.left ?? 1}
        />
      )}
      {characters?.center && (
        <CharacterDisplay
          character={characters.center}
          position="center"
          imageUrl={characterImageUrl(characters.center)}
          scale={slotScales?.center ?? 1}
        />
      )}
      {characters?.right && (
        <CharacterDisplay
          character={characters.right}
          position="right"
          imageUrl={characterImageUrl(characters.right)}
          scale={slotScales?.right ?? 1}
        />
      )}

      {/* ── Scene name ── */}
      <div key={scene.id} style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', padding: '14px', fontFamily: "'Cinzel',serif", fontSize: '14px', letterSpacing: '5px', fontWeight: 500, color: 'rgba(255,255,255,.75)', textShadow: '0 1px 12px rgba(0,0,0,.9)', pointerEvents: 'none', zIndex: 5, animation: 'sceneFadeIn 0.7s ease forwards' }}>
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

      {/* ── Top-right: fullscreen + edit ── */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 20, display: 'flex', gap: '8px' }}>
        <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          style={{ height: '44px', padding: '0 14px', background: 'rgba(13,14,22,0.82)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', color: 'rgba(255,255,255,0.75)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>

      {/* ── Bottom-right: Edit Scene ── */}
      {!isFullscreen && (
        <button className="btn btn-ghost btn-sm" onClick={onEdit}
          style={{ position: 'absolute', bottom: '14px', right: '14px', zIndex: 20, minHeight: '44px', padding: '0 14px' }}>
          ⚙ Edit Scene
        </button>
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
                  onClick={() => setPickerSlot(pickerSlot === slot ? null : slot)}
                  onTouchEnd={e => { e.preventDefault(); setPickerSlot(prev => prev === slot ? null : slot) }}
                  title={char ? `Change ${slot} character` : `Add ${slot} character`}
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

      {/* ── Character Picker Popup ─────────────────────────────── */}
      {pickerSlot && hasDMControls && (
        <div style={{ position: 'absolute', bottom: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: '260px', background: 'rgba(18,20,30,0.98)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.8)' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', flex: 1 }}>
              {pickerSlot === 'left' ? 'Left' : pickerSlot === 'center' ? 'Center' : 'Right'} Character
            </span>
            <button onClick={() => setPickerSlot(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
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

      {/* Click away to close picker */}
      {pickerSlot && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 25 }} onClick={() => setPickerSlot(null)} />
      )}

      {/* ── Audio Mixer ── */}
      {hasTracks && (
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 20, width: '240px' }}>
          <div onClick={() => setExpanded(e => !e)}
            style={{ background: MIXER_BG, border: '1px solid rgba(255,255,255,0.14)', borderRadius: expanded ? '10px 10px 0 0' : '10px', padding: '0 14px', height: '44px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px', flexShrink: 0 }}>
              {[1, 0.6, 0.85, 0.45, 0.7].map((h, i) => (
                <div key={i} style={{ width: '3px', borderRadius: '1px', background: playingCount > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)', height: `${Math.round(h * 16)}px`, animation: playingCount > 0 ? `audioBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate` : 'none' }} />
              ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', flex: 1 }}>Audio</span>
            {playingCount > 0 && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>{playingCount} playing</span>}
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>{expanded ? '▲' : '▼'}</span>
          </div>

          {expanded && (
            <div style={{ background: MIXER_BG_PANEL, border: '1px solid rgba(255,255,255,0.14)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {music.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🎵 Music</div>
                  {music.map(t => <MiniTrackRow key={t.id} t={t} isPlaying={!!playing[t.id]} volume={volumes[t.id] ?? t.volume} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} />)}
                </div>
              )}
              {music.length > 0 && amb.length > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />}
              {amb.length > 0 && (
                <div style={{ padding: '10px 14px 6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>🌊 Ambience</div>
                  {amb.map(t => <MiniTrackRow key={t.id} t={t} isPlaying={!!playing[t.id]} volume={volumes[t.id] ?? t.volume} onToggle={() => toggleTrack(t)} onVol={v => setVol(t, v)} />)}
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
        @keyframes sceneFadeOut{from{opacity:1}to{opacity:0}}
      `}</style>
    </div>
  )
}

function MiniTrackRow({ t, isPlaying, volume, onToggle, onVol }: { t: Track; isPlaying: boolean; volume: number; onToggle: () => void; onVol: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <button onClick={e => { e.stopPropagation(); onToggle() }} style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, border: `1px solid ${isPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`, background: isPlaying ? 'var(--accent-bg)' : 'rgba(255,255,255,0.05)', color: isPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>{t.name}</div>
        <input type="range" min={0} max={1} step={0.01} value={volume} onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onVol(Number(e.target.value)) }} style={{ width: '100%', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer', touchAction: 'none' }} />
      </div>
    </div>
  )
}
