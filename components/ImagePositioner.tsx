'use client'

import { useRef, useState, type CSSProperties } from 'react'

interface Props {
  src:      string
  x:        number   // 0–100, object-position X %
  y:        number   // 0–100, object-position Y %
  onChange: (x: number, y: number) => void
  /** Visual frame styling — defaults match a generic preview tile. */
  borderRadius?: number | string
  className?:    string
  style?:        CSSProperties
}

/**
 * Drag-to-reposition image frame. Uses object-fit: cover and shifts
 * object-position with the drag delta so the image follows the cursor.
 *
 * Layout is opt-in — the parent sets width/height (or aspectRatio) via `style`.
 */
export default function ImagePositioner({
  src, x, y, onChange,
  borderRadius = 8, className, style,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, bx: x, by: y }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dxPct = ((e.clientX - dragRef.current.sx) / rect.width)  * 100
    const dyPct = ((e.clientY - dragRef.current.sy) / rect.height) * 100
    // Subtract: drag right → image moves right → less of right gets cropped → X% decreases.
    const nx = Math.max(0, Math.min(100, dragRef.current.bx - dxPct))
    const ny = Math.max(0, Math.min(100, dragRef.current.by - dyPct))
    onChange(nx, ny)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null
    setDragging(false)
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        background: 'var(--bg-raised)',
        ...style,
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: `${x}% ${y}%`,
          pointerEvents: 'none',
          display: 'block',
        }}
      />
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
        color: 'rgba(255,255,255,0.9)',
        background: 'rgba(0,0,0,0.6)', padding: '3px 9px', borderRadius: '4px',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        opacity: dragging ? 0 : 1,
        transition: 'opacity 0.15s',
        textTransform: 'uppercase',
      }}>
        Drag to reposition
      </div>
    </div>
  )
}
