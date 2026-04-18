'use client'

import { useEffect, useRef, useState } from 'react'
import type { Track, Scene } from '@/lib/types'

export interface SpotifyTrackState {
  playing: boolean
  volume:  number
  loop:    boolean
}

export interface SpotifyPlayerApi {
  states:    Record<string, SpotifyTrackState>
  connected: boolean
  toggle:    (t: Track) => void
  setVolume: (t: Track, val: number) => void
  setLoop:   (t: Track, val: boolean) => void
  stopAll:   () => void
  mute:      (muted: boolean) => void
  autoPlay:  () => void   // call after user interaction (viewer tap-to-start)
}

declare global {
  interface Window {
    Spotify: any
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
// Always fetches a fresh token from our API route (which handles
// refresh if needed). Never stores the token in a long-lived ref.
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

export function useSpotifyPlayer(scene: Scene | null): SpotifyPlayerApi {
  const playerRef      = useRef<any>(null)
  const deviceIdRef    = useRef<string | null>(null)
  const activeTrackRef = useRef<Track | null>(null)
  const loopRef        = useRef<Record<string, boolean>>({})
  const volumeRef      = useRef<Record<string, number>>({})
  const mutedRef       = useRef(false)
  const prevSceneIdRef = useRef<string | null>(null)

  const [connected, setConnected] = useState(false)
  const [states,    setStates]    = useState<Record<string, SpotifyTrackState>>({})

  const spotifyTracks = (scene?.tracks ?? []).filter(t => !!t.spotify_uri)

  // ── Initialize per-track state on scene change ────────────────
  useEffect(() => {
    if (scene?.id === prevSceneIdRef.current) return
    prevSceneIdRef.current = scene?.id ?? null

    // Pause any active Spotify playback
    if (playerRef.current) playerRef.current.pause().catch(() => {})
    activeTrackRef.current = null

    const init: Record<string, SpotifyTrackState> = {}
    spotifyTracks.forEach(t => {
      // Restore saved volume from localStorage (same key as local tracks)
      const vol = scene?.id
        ? loadSavedVolume(scene.id, t.id, t.volume)
        : t.volume

      loopRef.current[t.id]   = t.loop
      volumeRef.current[t.id] = vol
      init[t.id] = { playing: false, volume: vol, loop: t.loop }
    })
    setStates(init)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-play music tracks when SDK connects (or scene changes while connected) ──
  useEffect(() => {
    if (!connected || !scene?.id) return
    const music = spotifyTracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )
    if (!music.length) return
    const timer = setTimeout(() => { playTrack(music[0]).catch(() => {}) }, 350)
    return () => clearTimeout(timer)
  }, [scene?.id, connected]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load SDK on mount ─────────────────────────────────────────
  useEffect(() => {
    // Only check if the user has connected Spotify — don't store the token.
    // The token is fetched fresh from the server each time it's needed.
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
        name: 'Sceneforge',
        // The SDK calls this whenever it needs a valid token (on connect and
        // after expiry). We always fetch fresh from the server — never from a
        // client-side cache — so the token is never stored longer than needed.
        getOAuthToken: async (cb: (token: string) => void) => {
          const token = await fetchToken()
          if (token) cb(token)
        },
        volume: 0.7,
      })

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id
        setConnected(true)
      })

      player.addListener('not_ready', () => {
        deviceIdRef.current = null
        setConnected(false)
      })

      player.addListener('player_state_changed', (state: any) => {
        if (!state || !activeTrackRef.current) return
        const t = activeTrackRef.current

        setStates(prev => ({
          ...prev,
          [t.id]: { ...prev[t.id], playing: !state.paused },
        }))

        // Loop: Spotify fires paused + position=0 when a track ends
        if (state.paused && state.position === 0 && loopRef.current[t.id]) {
          playTrack(t).catch(() => {})
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
  async function playTrack(t: Track) {
    if (!deviceIdRef.current || !t.spotify_uri || !playerRef.current) return

    // Fetch a fresh token from the server on every play call.
    // This means the token is never held in a long-lived client-side variable.
    const token = await fetchToken()
    if (!token) return

    const body = t.spotify_type === 'playlist'
      ? { context_uri: t.spotify_uri }
      : { uris: [t.spotify_uri] }

    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`,
      {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }
    )

    activeTrackRef.current = t

    const vol = mutedRef.current ? 0 : (volumeRef.current[t.id] ?? t.volume)
    await playerRef.current.setVolume(vol).catch(() => {})

    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], playing: true } }))
  }

  // ── Public API ────────────────────────────────────────────────
  function toggle(t: Track) {
    if (!t.spotify_uri || !playerRef.current) return

    const isActive  = activeTrackRef.current?.id === t.id
    const isPlaying = states[t.id]?.playing ?? false

    if (isActive && isPlaying) {
      playerRef.current.pause().catch(() => {})
      activeTrackRef.current = null
      setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], playing: false } }))
    } else {
      // Pause previous if different track
      if (activeTrackRef.current && activeTrackRef.current.id !== t.id) {
        const prevId = activeTrackRef.current.id
        setStates(prev => ({ ...prev, [prevId]: { ...prev[prevId], playing: false } }))
      }
      playTrack(t).catch(() => {})
    }
  }

  function setVolume(t: Track, val: number) {
    volumeRef.current[t.id] = val
    // Persist to localStorage using the same key as local tracks
    if (scene?.id) saveVolume(scene.id, t.id, val)
    if (activeTrackRef.current?.id === t.id && playerRef.current && !mutedRef.current) {
      playerRef.current.setVolume(val).catch(() => {})
    }
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], volume: val } }))
  }

  function setLoop(t: Track, val: boolean) {
    loopRef.current[t.id] = val
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], loop: val } }))
  }

  function stopAll() {
    if (playerRef.current) playerRef.current.pause().catch(() => {})
    activeTrackRef.current = null
    setStates(prev =>
      Object.fromEntries(Object.entries(prev).map(([id, s]) => [id, { ...s, playing: false }]))
    )
  }

  function mute(muted: boolean) {
    mutedRef.current = muted
    if (!playerRef.current || !activeTrackRef.current) return
    const t   = activeTrackRef.current
    const vol = muted ? 0 : (volumeRef.current[t.id] ?? 0.7)
    playerRef.current.setVolume(vol).catch(() => {})
  }

  // Called by viewer after first user interaction — plays music Spotify tracks
  function autoPlay() {
    const music = spotifyTracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )
    if (!music.length || !connected) return
    playTrack(music[0]).catch(() => {})
  }

  return { states, connected, toggle, setVolume, setLoop, stopAll, mute, autoPlay }
}
