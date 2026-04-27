'use client'

import { useEffect, useRef } from 'react'
import type { SceneOverlay, OverlayLiveState } from '@/lib/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function overlayVideoUrl(o: SceneOverlay): string | null {
  if (o.storage_path)
    return `${SUPABASE_URL}/storage/v1/object/public/scene-media/${o.storage_path}`
  return o.url || null
}

interface Props {
  overlays: SceneOverlay[]
  liveStates: Record<string, OverlayLiveState>
}

export default function OverlayStack({ overlays, liveStates }: Props) {
  if (!overlays.length) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {overlays.map(o => {
        const src = overlayVideoUrl(o)
        if (!src) return null
        const state   = liveStates[o.id]
        const isOn    = state ? state.on : o.enabled_default
        const opacity = isOn ? (state ? state.opacity : o.opacity) : 0

        return (
          <OverlayVideo
            key={o.id}
            src={src}
            blendMode={o.blend_mode}
            opacity={opacity}
            scale={o.scale}
            panX={o.pan_x}
            panY={o.pan_y}
            playbackRate={o.playback_rate}
          />
        )
      })}
    </div>
  )
}

interface OverlayVideoProps {
  src: string
  blendMode: string
  opacity: number
  scale: number
  panX: number
  panY: number
  playbackRate: number
}

function OverlayVideo({ src, blendMode, opacity, scale, panX, panY, playbackRate }: OverlayVideoProps) {
  const vidRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (vidRef.current) vidRef.current.playbackRate = playbackRate
  }, [playbackRate])

  return (
    <video
      ref={vidRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'],
        opacity,
        transition: 'opacity 0.6s ease',
        transform: scale > 1.01 ? `scale(${scale})` : undefined,
        transformOrigin: `${panX}% ${panY}%`,
      }}
    />
  )
}
