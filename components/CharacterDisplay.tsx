'use client'

import type { Character } from '@/lib/types'

interface Props {
  character: Character
  position: 'left' | 'center' | 'right'
  imageUrl: string | null
  scale?: number    // 0.5 – 2.5, overall slot scale, default 1.0
  imgZoom?: number  // 1.0 – 3.0, crops within the slot via transform, default 1.0
  imgPanX?: number  // 0–100, transform-origin X (% of image), default 50
  imgPanY?: number  // 0–100, transform-origin Y (% of image), default 100
  flipped?: boolean // horizontal mirror
}

export default function CharacterDisplay({
  character, position, imageUrl,
  scale = 1, imgZoom = 1, imgPanX = 50, imgPanY = 100, flipped = false,
}: Props) {
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
        // No zIndex: characters paint at auto (above bg by DOM order) but
        // *below* OverlayStack, which renders after them. That lets overlay
        // blend modes wash over characters as part of the scene atmosphere.
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
        // Flip wrapper keeps the name label unmirrored.
        <div
          style={{
            height: '100%',
            width: '100%',
            transform: flipped ? 'scaleX(-1)' : undefined,
          }}
        >
          {/* Zoom wrapper: scales the image from the chosen anchor point.
              No overflow:hidden here — that would hard-clip the drop-shadow
              filter against the slot edge and cause a visible black line.
              The Stage wrapper's overflow:hidden is the final boundary. */}
          <div
            style={{
              height: '100%',
              width: '100%',
              transform: imgZoom !== 1 ? `scale(${imgZoom})` : undefined,
              transformOrigin: `${imgPanX}% ${imgPanY}%`,
            }}
          >
            <img
              key={imageUrl}
              src={imageUrl}
              alt={character.name}
              style={{
                height: '100%',
                width: '100%',
                objectFit: 'contain',
                objectPosition: '50% 100%',
                filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.8)) drop-shadow(0 0 20px rgba(0,0,0,0.5))',
                animation: 'charFadeIn 0.4s ease-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Name label — sits at the feet of the character.
          Wraps onto multiple lines for long names rather than truncating. */}
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
          textAlign: 'center',
          maxWidth: 'min(260px, 92%)',
          lineHeight: 1.25,
          wordBreak: 'break-word',
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
