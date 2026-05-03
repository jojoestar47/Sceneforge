'use client'

import { useEffect, useRef, useState } from 'react'
import type { Track, Scene } from '@/lib/types'
import type {
  SpotifySdkGlobal,
  SpotifySdkPlayer,
  SpotifySdkPlayerState,
} from '@/lib/spotify'
import { isIosWebkit } from '@/lib/platform'
import { readCrossfadePref } from '@/lib/audioPrefs'

export interface SpotifyTrackState {
  playing: boolean
  volume:  number
  loop:    boolean
}

export interface SpotifyNowPlaying {
  name:     string
  artist:   string
  albumArt: string | null
}

export interface SpotifyPlayerApi {
  states:     Record<string, SpotifyTrackState>
  connected:  boolean
  /**
   * True when the runtime is iOS/iPadOS WebKit, where the Spotify Web
   * Playback SDK silently fails to initialize. Consumers should display a
   * "use a desktop browser" message instead of a Connect button.
   */
  unsupported: boolean
  // Now-playing metadata, updated from the SDK's player_state_changed event
  nowPlaying: SpotifyNowPlaying | null
  // Playback position (0–1) and total duration (ms), polled every 500ms
  progress:   number
  duration:   number
  toggle:     (t: Track) => void
  setVolume:  (t: Track, val: number) => void
  setLoop:    (t: Track, val: boolean) => void
  stopAll:    () => void
  mute:       (muted: boolean) => void
  autoPlay:   () => void   // call after user interaction (viewer tap-to-start)
  skip:       (direction: 'next' | 'previous') => void
}

declare global {
  interface Window {
    Spotify: SpotifySdkGlobal
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

// ── localStorage helpers ──────────────────────────────────────
function loadSavedVolume(sceneId: string, trackId: string, fallback: number): number {
  try {
    const saved = JSON.parse(localStorage.getItem(`sf_vol_${sceneId}`) || '{}')
    return typeof saved[trackId] === 'number' ? saved[trackId] : fallback
  } catch { return fallback }
}

function saveVolume(sceneId: string, trackId: string, volume: number) {
  try {
    const key   = `sf_vol_${sceneId}`
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    saved[trackId] = volume
    localStorage.setItem(key, JSON.stringify(saved))
  } catch {}
}

// ── Server token fetch ────────────────────────────────────────
async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/spotify/token')
    if (!res.ok) return null
    const { access_token } = await res.json()
    return access_token ?? null
  } catch {
    return null
  }
}

// ── Volume ramp ───────────────────────────────────────────────
// Spotify's SDK gives us a single `setVolume()` per device. True overlap
// crossfade isn't possible on one device — best we can do is sequential:
// fade outgoing track to 0, pause, then fade incoming track up from 0.
// Returns a cancel fn so a newer ramp can preempt one in flight.
function rampSpotifyVolume(
  player:  SpotifySdkPlayer,
  fromVol: number,
  toVol:   number,
  durMs:   number,
  onDone?: () => void,
): () => void {
  if (durMs <= 0) {
    player.setVolume(toVol).catch(() => {})
    onDone?.()
    return () => {}
  }
  const startTime = performance.now()
  const id = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - startTime) / durMs)
    const v = Math.max(0, Math.min(1, fromVol + (toVol - fromVol) * t))
    player.setVolume(v).catch(() => {})
    if (t >= 1) {
      window.clearInterval(id)
      onDone?.()
    }
  }, 50)
  return () => window.clearInterval(id)
}

// ── Repeat mode helper ────────────────────────────────────────
async function applyRepeatMode(
  loop:        boolean,
  spotifyType: string | undefined,
  deviceId:    string,
  token:       string
): Promise<void> {
  const state = !loop
    ? 'off'
    : spotifyType === 'playlist' ? 'context' : 'track'
  await fetch(
    `https://api.spotify.com/v1/me/player/repeat?state=${state}&device_id=${deviceId}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => {})
}

export function useSpotifyPlayer(scene: Scene | null, { disableAutoPlay = false } = {}): SpotifyPlayerApi {
  const playerRef      = useRef<SpotifySdkPlayer | null>(null)
  const deviceIdRef    = useRef<string | null>(null)
  const activeTrackRef = useRef<Track | null>(null)
  const loopRef        = useRef<Record<string, boolean>>({})
  const volumeRef      = useRef<Record<string, number>>({})
  const mutedRef       = useRef(false)
  const prevSceneIdRef = useRef<string | null>(null)
  // If play is requested before the device is ready, we queue the track here
  // and flush it as soon as the 'ready' event fires.
  const pendingPlayRef = useRef<Track | null>(null)
  // Cancel fn for the active volume ramp (fade-out on scene change, fade-in
  // on auto-play). A newer scene change preempts an in-flight ramp.
  const rampCancelRef = useRef<(() => void) | null>(null)

  const [connected,   setConnected]   = useState(false)
  const [states,      setStates]      = useState<Record<string, SpotifyTrackState>>({})
  const [nowPlaying,  setNowPlaying]  = useState<SpotifyNowPlaying | null>(null)
  const [progress,    setProgress]    = useState(0)
  const [duration,    setDuration]    = useState(0)
  // One-shot platform check. The SDK's `connect()` resolves successfully on
  // iOS but no `ready` event ever fires, so we'd otherwise spin forever
  // showing "Connecting…". Detect up-front and skip SDK load entirely.
  const [unsupported] = useState(() => isIosWebkit())

  const spotifyTracks = (scene?.tracks ?? []).filter(t => !!t.spotify_uri)

  // ── Initialize per-track state on scene change ────────────────
  useEffect(() => {
    if (scene?.id === prevSceneIdRef.current) return
    prevSceneIdRef.current = scene?.id ?? null

    // Cancel any in-flight ramp from a previous scene change.
    if (rampCancelRef.current) { rampCancelRef.current(); rampCancelRef.current = null }

    if (playerRef.current) {
      const xfade   = readCrossfadePref()
      const outgoing = activeTrackRef.current
      const player   = playerRef.current
      if (xfade > 0 && outgoing) {
        const fromVol = mutedRef.current ? 0 : (volumeRef.current[outgoing.id] ?? outgoing.volume)
        rampCancelRef.current = rampSpotifyVolume(player, fromVol, 0, xfade, () => {
          rampCancelRef.current = null
          player.pause().catch(() => {})
        })
      } else {
        player.pause().catch(() => {})
      }
    }
    activeTrackRef.current = null
    setNowPlaying(null)
    setProgress(0)
    setDuration(0)

    const init: Record<string, SpotifyTrackState> = {}
    spotifyTracks.forEach(t => {
      const vol = scene?.id
        ? loadSavedVolume(scene.id, t.id, t.volume)
        : t.volume
      loopRef.current[t.id]   = t.loop
      volumeRef.current[t.id] = vol
      init[t.id] = { playing: false, volume: vol, loop: t.loop }
    })
    setStates(init)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-play music tracks when SDK connects ─────────────────
  // Disabled on the DM stage (disableAutoPlay=true) so only the viewer
  // device drives Spotify playback. Both pages create a virtual Spotify
  // device; if both auto-play on scene change they race — last write wins
  // and the wrong device may end up with audio. The DM can still manually
  // toggle tracks from the mixer.
  useEffect(() => {
    if (disableAutoPlay || !connected || !scene?.id) return
    const music = spotifyTracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )
    if (!music.length) return
    // Delay past the outgoing fade-out so we don't interrupt it. (Spotify
    // can only play one track at a time per device — starting the new track
    // would otherwise cancel the fade-out.)
    const xfade = readCrossfadePref()
    const delay = Math.max(350, xfade + 100)
    const timer = setTimeout(() => {
      playTrack(music[0], { fadeInMs: xfade }).catch(() => {})
    }, delay)
    return () => clearTimeout(timer)
  }, [scene?.id, connected, disableAutoPlay]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Progress polling (500ms) ──────────────────────────────────
  // player_state_changed alone isn't frequent enough for a smooth bar.
  useEffect(() => {
    if (!connected) return
    const interval = setInterval(async () => {
      if (!playerRef.current) return
      const state = await playerRef.current.getCurrentState().catch(() => null)
      if (!state || state.paused || state.duration === 0) return
      setProgress(state.position / state.duration)
      setDuration(state.duration)
    }, 500)
    return () => clearInterval(interval)
  }, [connected])

  // ── Load SDK on mount ─────────────────────────────────────────
  useEffect(() => {
    // iOS/iPadOS WebKit: SDK is non-functional. Skip the script load and the
    // pointless network call so consumers can render an "unsupported" state
    // immediately.
    if (unsupported) return
    fetch('/api/spotify/token').then(r => {
      if (r.ok) loadSDK()
    }).catch(() => {})

    function loadSDK() {
      if (window.Spotify) { initPlayer(); return }
      if (!document.getElementById('spotify-sdk')) {
        const script  = document.createElement('script')
        script.id     = 'spotify-sdk'
        script.src    = 'https://sdk.scdn.co/spotify-player.js'
        script.async  = true
        document.body.appendChild(script)
      }
      window.onSpotifyWebPlaybackSDKReady = initPlayer
    }

    function initPlayer() {
      if (playerRef.current) return
      const player = new window.Spotify.Player({
        name: 'Reverie',
        getOAuthToken: async (cb: (token: string) => void) => {
          const token = await fetchToken()
          if (token) cb(token)
        },
        volume: 0.7,
      })

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id
        setConnected(true)
        // Flush any play that was requested before the device was ready
        if (pendingPlayRef.current) {
          const queued = pendingPlayRef.current
          pendingPlayRef.current = null
          setTimeout(() => playTrack(queued).catch(() => {}), 350)
        }
      })

      player.addListener('not_ready', () => {
        deviceIdRef.current = null
        setConnected(false)
      })

      player.addListener('player_state_changed', (state: SpotifySdkPlayerState | null) => {
        if (!state || !activeTrackRef.current) return
        const t = activeTrackRef.current

        setStates(prev => ({
          ...prev,
          [t.id]: { ...prev[t.id], playing: !state.paused },
        }))

        // Update now-playing metadata from the SDK event payload
        const sdkTrack = state.track_window?.current_track
        if (sdkTrack) {
          setNowPlaying({
            name:     sdkTrack.name ?? '',
            artist:   sdkTrack.artists?.[0]?.name ?? '',
            albumArt: sdkTrack.album?.images?.[0]?.url ?? null,
          })
          if (state.duration > 0) {
            setDuration(state.duration)
            setProgress(state.position / state.duration)
          }
        }

        if (state.paused) {
          setProgress(state.duration > 0 ? state.position / state.duration : 0)
        }
      })

      player.connect()
      playerRef.current = player
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
        setConnected(false)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playback helpers ──────────────────────────────────────────
  async function playTrack(t: Track, opts?: { fadeInMs?: number }) {
    if (!t.spotify_uri) return
    // Device not ready yet — queue the track and return. The 'ready' listener
    // will flush it once the virtual device has a device_id.
    if (!deviceIdRef.current || !playerRef.current) {
      pendingPlayRef.current = t
      return
    }

    const sceneIdAtStart = prevSceneIdRef.current
    const fadeInMs       = opts?.fadeInMs ?? 0

    const token = await fetchToken()
    if (!token) return
    if (prevSceneIdRef.current !== sceneIdAtStart) return

    const body = t.spotify_type === 'playlist'
      ? { context_uri: t.spotify_uri }
      : { uris: [t.spotify_uri] }

    const targetVol = mutedRef.current ? 0 : (volumeRef.current[t.id] ?? t.volume)

    // If we're fading in, start the player at 0 BEFORE the play call so the
    // first audio frames aren't audible at full volume.
    if (fadeInMs > 0) {
      await playerRef.current.setVolume(0).catch(() => {})
    }

    const playRes = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
      {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }
    )

    // 204 = success, 202 = accepted (device waking up) — anything else is a
    // real failure. Don't update local state if Spotify rejected the request,
    // or we'd show the track as playing when nothing is audible.
    if (!playRes.ok && playRes.status !== 202) return

    if (prevSceneIdRef.current !== sceneIdAtStart) return

    await applyRepeatMode(
      loopRef.current[t.id] ?? false,
      t.spotify_type,
      deviceIdRef.current,
      token
    )

    activeTrackRef.current = t
    setProgress(0)

    if (fadeInMs > 0) {
      if (rampCancelRef.current) { rampCancelRef.current(); rampCancelRef.current = null }
      rampCancelRef.current = rampSpotifyVolume(playerRef.current, 0, targetVol, fadeInMs, () => {
        rampCancelRef.current = null
      })
    } else {
      await playerRef.current.setVolume(targetVol).catch(() => {})
    }

    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], playing: true } }))
  }

  // ── Public API ────────────────────────────────────────────────
  // Manual user actions (toggle, volume, mute, stop) preempt any in-flight
  // crossfade ramp — otherwise the ramp would keep ticking and override the
  // user's input.
  function cancelRamp() {
    if (rampCancelRef.current) { rampCancelRef.current(); rampCancelRef.current = null }
  }

  function toggle(t: Track) {
    if (!t.spotify_uri || !playerRef.current) return
    const isActive  = activeTrackRef.current?.id === t.id
    const isPlaying = states[t.id]?.playing ?? false
    if (isActive && isPlaying) {
      cancelRamp()
      playerRef.current.pause().catch(() => {})
      activeTrackRef.current = null
      setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], playing: false } }))
    } else {
      if (activeTrackRef.current && activeTrackRef.current.id !== t.id) {
        const prevId = activeTrackRef.current.id
        setStates(prev => ({ ...prev, [prevId]: { ...prev[prevId], playing: false } }))
      }
      playTrack(t).catch(() => {})
    }
  }

  function setVolume(t: Track, val: number) {
    volumeRef.current[t.id] = val
    if (scene?.id) saveVolume(scene.id, t.id, val)
    if (activeTrackRef.current?.id === t.id && playerRef.current && !mutedRef.current) {
      cancelRamp()
      playerRef.current.setVolume(val).catch(() => {})
    }
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], volume: val } }))
  }

  function setLoop(t: Track, val: boolean) {
    loopRef.current[t.id] = val
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], loop: val } }))
    if (activeTrackRef.current?.id === t.id && deviceIdRef.current) {
      const deviceId = deviceIdRef.current
      fetchToken().then(token => {
        if (token && deviceId) applyRepeatMode(val, t.spotify_type, deviceId, token)
      }).catch(() => {})
    }
  }

  function stopAll() {
    cancelRamp()
    if (playerRef.current) playerRef.current.pause().catch(() => {})
    activeTrackRef.current = null
    setNowPlaying(null)
    setProgress(0)
    setStates(prev =>
      Object.fromEntries(Object.entries(prev).map(([id, s]) => [id, { ...s, playing: false }]))
    )
  }

  function mute(muted: boolean) {
    mutedRef.current = muted
    if (!playerRef.current || !activeTrackRef.current) return
    cancelRamp()
    const t   = activeTrackRef.current
    const vol = muted ? 0 : (volumeRef.current[t.id] ?? 0.7)
    playerRef.current.setVolume(vol).catch(() => {})
  }

  function autoPlay() {
    if (disableAutoPlay) return
    const music = spotifyTracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )
    if (!music.length || !connected) return
    playTrack(music[0]).catch(() => {})
  }

  function skip(direction: 'next' | 'previous') {
    if (!playerRef.current) return
    if (direction === 'next') playerRef.current.nextTrack().catch(() => {})
    else                      playerRef.current.previousTrack().catch(() => {})
  }

  return { states, connected, unsupported, nowPlaying, progress, duration, toggle, setVolume, setLoop, stopAll, mute, autoPlay, skip }
}
