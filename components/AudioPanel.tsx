'use client'

import type { Scene, Track } from '@/lib/types'
import type { SceneAudio }   from '@/lib/useSceneAudio'

interface Props {
  scene:       Scene | null
  audio:       SceneAudio
  onEditScene: () => void
}

export default function AudioPanel({ scene, audio, onEditScene }: Props) {
  const { states, muted, playingCount, toggle, setVolume, setLoop, stopAll, toggleMute } = audio

  if (!scene) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: '11px', textAlign: 'center', padding: '20px' }}>
          Select a scene to manage audio
        </p>
      </div>
    )
  }

  const allTracks = scene.tracks || []
  const music     = allTracks.filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3')
  const ambience  = allTracks.filter(t => t.kind === 'ambience')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Status bar */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
        flexShrink: 0,
      }}>
        <button
          onClick={toggleMute}
          style={{ background: 'none', border: 'none', fontSize: '15px', cursor: 'pointer', color: muted ? 'var(--accent)' : 'var(--text-2)', flexShrink: 0 }}
          title={muted ? 'Unmute' : 'Mute all'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
          {playingCount > 0 ? (
            <>
              <EqBars />
              <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                {playingCount} track{playingCount > 1 ? 's' : ''} playing
              </span>
            </>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>No audio playing</span>
          )}
        </div>

        {playingCount > 0 && (
          <button
            onClick={stopAll}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-2)', fontSize: '10px', padding: '3px 7px', cursor: 'pointer', flexShrink: 0 }}
          >
            ⏹ Stop
          </button>
        )}
      </div>

      {/* Track lists */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        <TrackSection
          icon="🎵" label="Music" tracks={music}
          states={states} onToggle={toggle} onVolume={setVolume} onLoop={setLoop}
        />

        <TrackSection
          icon="🌊" label="Ambience" tracks={ambience}
          states={states} onToggle={toggle} onVolume={setVolume} onLoop={setLoop}
        />

        {allTracks.length === 0 && (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px' }}>
            No audio tracks — open the scene editor to add music or sounds.
          </div>
        )}
      </div>

      {/* Edit button */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-block btn-sm" onClick={onEditScene}>
          ⚙ Edit Scene Audio
        </button>
      </div>

    </div>
  )
}

// ── Section ──────────────────────────────────────────
function TrackSection({ icon, label, tracks, states, onToggle, onVolume, onLoop }: {
  icon: string; label: string; tracks: Track[]
  states: Record<string, { playing: boolean; volume: number; loop: boolean }>
  onToggle: (t: Track) => void
  onVolume: (t: Track, v: number) => void
  onLoop:   (t: Track, v: boolean) => void
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px 6px', gap: '7px' }}>
        <span style={{ fontSize: '12px' }}>{icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-2)', flex: 1 }}>
          {label}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{tracks.length}</span>
      </div>

      {tracks.length === 0 && (
        <div style={{ padding: '2px 14px 10px', fontSize: '11px', color: 'var(--text-3)' }}>None added</div>
      )}

      {tracks.map(t => (
        <TrackRow
          key={t.id} t={t}
          state={states[t.id]}
          onToggle={() => onToggle(t)}
          onVolume={v => onVolume(t, v)}
          onLoop={v   => onLoop(t, v)}
        />
      ))}
    </div>
  )
}

// ── Track row ─────────────────────────────────────────
function TrackRow({ t, state, onToggle, onVolume, onLoop }: {
  t: Track
  state?: { playing: boolean; volume: number; loop: boolean }
  onToggle: () => void
  onVolume: (v: number) => void
  onLoop:   (v: boolean) => void
}) {
  const playing = state?.playing ?? false
  const volume  = state?.volume  ?? t.volume
  const loop    = state?.loop    ?? t.loop

  return (
    <div style={{ padding: '6px 14px 10px' }}>

      {/* Top row: play button + name + loop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={onToggle}
          style={{
            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
            border: `1px solid ${playing ? 'var(--accent)' : 'var(--border)'}`,
            background: playing ? 'var(--accent)' : 'var(--bg-raised)',
            color: playing ? '#fff' : 'var(--text-2)',
            fontSize: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playing ? '0 0 10px rgba(229,53,53,.4)' : 'none',
            transition: 'all .15s',
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '12px', color: playing ? 'var(--text)' : 'var(--text-2)', fontWeight: playing ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color .15s' }}>
            {t.name}
            {t.storage_path && <span style={{ fontSize: '9px', color: 'var(--text-3)', marginLeft: '5px' }}>📁</span>}
          </div>
        </div>

        <button
          onClick={() => onLoop(!loop)}
          title={loop ? 'Loop on' : 'Loop off'}
          style={{
            background: loop ? 'var(--accent-bg)' : 'none',
            border: `1px solid ${loop ? 'var(--accent)' : 'var(--border)'}`,
            color: loop ? 'var(--accent)' : 'var(--text-3)',
            fontSize: '11px', padding: '2px 5px', borderRadius: '3px',
            cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
          }}
        >↺</button>
      </div>

      {/* Volume slider row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-3)', width: '12px', textAlign: 'center', flexShrink: 0 }}>
          {volume === 0 ? '🔇' : volume < 0.5 ? '🔈' : '🔉'}
        </span>
        <div style={{ flex: 1, position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
          {/* Track fill */}
          <div style={{
            position: 'absolute', left: 0, height: '4px',
            width: `${volume * 100}%`,
            background: playing ? 'var(--accent)' : 'var(--border-lt)',
            borderRadius: '2px', pointerEvents: 'none',
            transition: 'background .15s',
          }} />
          {/* Track background */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '4px',
            background: 'var(--border)', borderRadius: '2px',
            zIndex: -1,
          }} />
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => onVolume(Number(e.target.value))}
            style={{
              position: 'absolute', left: 0, right: 0,
              width: '100%', height: '20px',
              opacity: 0, cursor: 'pointer', margin: 0, padding: 0,
            }}
          />
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-3)', width: '28px', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(volume * 100)}%
        </span>
      </div>

    </div>
  )
}

// ── Animated EQ bars ──────────────────────────────────
function EqBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '12px', flexShrink: 0 }}>
      {[0.8, 0.4, 1, 0.6, 0.9].map((h, i) => (
        <div key={i} style={{
          width: '3px', borderRadius: '1px',
          background: 'var(--accent)',
          height: `${h * 12}px`,
          animation: `eqBar${i} ${0.5 + i * 0.13}s ease-in-out infinite alternate`,
        }} />
      ))}
      <style>{`
        @keyframes eqBar0 { to { height: 4px  } }
        @keyframes eqBar1 { to { height: 10px } }
        @keyframes eqBar2 { to { height: 5px  } }
        @keyframes eqBar3 { to { height: 11px } }
        @keyframes eqBar4 { to { height: 3px  } }
      `}</style>
    </div>
  )
}
