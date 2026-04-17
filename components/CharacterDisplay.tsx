'use client'

import type { Character } from '@/lib/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export function characterImageUrl(c: Character): string | null {
  if (c.storage_path)
    return `${SUPABASE_URL}/storage/v1/object/public/scene-media/${c.storage_path}`
  return c.url || null
}

interface Props {
  character: Character
  position: 'left' | 'center' | 'right'
  imageUrl: string | null
  scale?: number          // 0.5 – 2.5, default 1.0
  objectFit?: 'contain' | 'cover'
  objectPosition?: string // CSS object-position, e.g. '50% 20%'
  flipped?: boolean       // horizontal mirror
}

export default function CharacterDisplay({
  character, position, imageUrl,
  scale = 1, objectFit = 'contain', objectPosition = '50% 100%', flipped = false,
}: Props) {
  // Center slot: translateX(-50%) must come before scale so the scale origin
  // stays at the visual center. Left/right just need scale.
  // Previously the center's translateX was lost because positionStyle.transform
  // was overridden by the explicit transform key — this builds it correctly.
  const transform =
    position === 'center'
      ? `translateX(-50%) scale(${scale})`
      : `scale(${scale})`

  const positionStyle =
    position === 'left'   ? { left: '8%' } :
    position === 'right'  ? { right: '8%' } :
    /* center */            { left: '50%' }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        ...positionStyle,
        height: '88%',
        width: '22%',
        minWidth: '120px',
        maxWidth: '280px',
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
        transform,
        transformOrigin: 'bottom center',
      }}
    >
      {imageUrl && (
        // Flip wrapper is separate from the outer container so the name label
        // (positioned absolute on the outer div) is never mirrored.
        <div
          style={{
            height: '100%',
            width: '100%',
            transform: flipped ? 'scaleX(-1)' : undefined,
          }}
        >
          <img
            key={imageUrl}
            src={imageUrl}
            alt={character.name}
            style={{
              height: '100%',
              width: '100%',
              objectFit,
              objectPosition,
              filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.8)) drop-shadow(0 0 20px rgba(0,0,0,0.5))',
              // Only translateY + opacity — scale is on the parent so it
              // loads at the correct size from the very first frame.
              animation: 'charFadeIn 0.4s ease-out',
            }}
          />
        </div>
      )}

      {/* Name label — sits at the feet of the character */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          background: 'rgba(7,8,16,0.82)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          padding: '4px 14px',
          fontSize: '12px',
          fontFamily: "'Cinzel', serif",
          letterSpacing: '2px',
          color: 'rgba(255,255,255,0.92)',
          textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        {character.name}
      </div>

      <style>{`
        @keyframes charFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
