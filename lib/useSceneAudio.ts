'use client'

import { useEffect, useRef, useState } from 'react'
import type { Track, Scene } from '@/lib/types'

export interface TrackState {
  playing: boolean
  volume:  number
  loop:    boolean
}

export interface SceneAudio {
  states:       Record<string, TrackState>
  muted:        boolean
  playingCount: number
  toggle:       (t: Track) => void
  setVolume:    (t: Track, val: number) => void
  setLoop:      (t: Track, val: boolean) => void
  stopAll:      () => void
  toggleMute:   () => void
}

export function useSceneAudio(scene: Scene | null): SceneAudio {
  const refs    = useRef<Record<string, HTMLAudioElement>>({})
  const [states, setStates] = useState<Record<string, TrackState>>({})
  const [muted,  setMuted]  = useState(false)

  // Tear down + rebuild when scene changes, autoplay music
  useEffect(() => {
    // Stop and destroy existing audio
    Object.values(refs.current).forEach(a => { a.pause(); a.src = '' })
    refs.current = {}
    setStates({})

    if (!scene?.tracks?.length) return

    // Pre-create all audio elements so volume sliders work immediately
    scene.tracks.forEach(t => getOrCreate(t))

    // Autoplay music after short delay
    const musicTracks = scene.tracks.filter(
      t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3'
    )
    const timer = setTimeout(() => {
      musicTracks.forEach(t => {
        const a = refs.current[t.id]
        if (a?.paused) a.play().catch(() => {})
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function getOrCreate(t: Track): HTMLAudioElement {
    if (!refs.current[t.id]) {
      const src = t.signed_url || t.url || ''
      const a   = new Audio(src)
      a.loop    = t.loop
      a.volume  = t.volume
      a.muted   = muted

      const sync = () =>
        setStates(prev => ({
          ...prev,
          [t.id]: { playing: !a.paused, volume: a.volume, loop: a.loop },
        }))

      a.addEventListener('play',         sync)
      a.addEventListener('pause',        sync)
      a.addEventListener('volumechange', sync)
      refs.current[t.id] = a

      // Set initial state
      setStates(prev => ({
        ...prev,
        [t.id]: { playing: false, volume: t.volume, loop: t.loop },
      }))
    }
    return refs.current[t.id]
  }

  function toggle(t: Track) {
    const a = getOrCreate(t)
    if (a.paused) a.play().catch(() => {})
    else          a.pause()
  }

  function setVolume(t: Track, val: number) {
    const a  = getOrCreate(t)
    a.volume = Math.max(0, Math.min(1, val))
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], volume: a.volume } }))
  }

  function setLoop(t: Track, val: boolean) {
    const a = getOrCreate(t)
    a.loop  = val
    setStates(prev => ({ ...prev, [t.id]: { ...prev[t.id], loop: val } }))
  }

  function stopAll() {
    Object.values(refs.current).forEach(a => { a.pause(); a.currentTime = 0 })
    setStates(prev =>
      Object.fromEntries(
        Object.entries(prev).map(([id, s]) => [id, { ...s, playing: false }])
      )
    )
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    Object.values(refs.current).forEach(a => (a.muted = next))
  }

  const playingCount = Object.values(states).filter(s => s.playing).length

  return { states, muted, playingCount, toggle, setVolume, setLoop, stopAll, toggleMute }
}
