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
    // No z-index, no overflow:hidden, no isolation — anything that creates a
    // stacking context here would trap mix-blend-mode to blend against this
    // wrapper's (empty) backdrop instead of the bg layers painted below.
    // Stage adds `isolation: isolate` on its root so the blend stays scoped
    // to the scene and reads bg layers as the real backdrop.
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
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

  // mix-blend-mode and opacity go on a <div> wrapper, not the <video> itself.
  // Browsers apply blend modes after GPU compositing of the video, so putting
  // it directly on <video> is unreliable — the div wrapper is always reliable.
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'],
        opacity,
        transition: 'opacity 0.6s ease',
      }}
    >
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
          transform: scale > 1.01 ? `scale(${scale})` : undefined,
          transformOrigin: `${panX}% ${panY}%`,
        }}
      />
    </div>
  )
}
