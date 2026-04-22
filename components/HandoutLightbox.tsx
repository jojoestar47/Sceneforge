'use client'

import { useState, useRef, useEffect } from 'react'
import type { Handout } from '@/lib/types'

interface Props {
  handout: Handout
  onClose: () => void
}

export default function HandoutLightbox({ handout, onClose }: Props) {
  const [closing, setClosing]       = useState(false)
  const [zoom, setZoom]             = useState(1)
  const [pan, setPan]               = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const dragging  = useRef(false)
  const hasMoved  = useRef(false)
  const lastXY    = useRef({ x: 0, y: 0 })
  const lastPinch = useRef<number | null>(null)

  const imgUrl     = handout.media?.signed_url || handout.media?.url || null
  const isZoomed   = zoom > 1.02          // controls drag-to-pan behaviour
  const isModified = Math.abs(zoom - 1) > 0.02 // controls Reset button visibility

  function dismiss() {
    setClosing(true)
    setTimeout(onClose, 260) // matches slide-out duration
  }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  useEffect(() => { if (!isZoomed) setPan({ x: 0, y: 0 }) }, [isZoomed])

  // ── Drag ─────────────────────────────────────────────────────
  function startDrag(x: number, y: number) {
    dragging.current  = true
    hasMoved.current  = false
    lastXY.current    = { x, y }
    setIsDragging(true)
  }

  function moveDrag(x: number, y: number) {
    if (!dragging.current || !isZoomed) return
    const dx = x - lastXY.current.x
    const dy = y - lastXY.current.y
    if (Math.abs(dx) + Math.abs(dy) > 3) hasMoved.current = true
    lastXY.current = { x, y }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }

  function endDrag() { dragging.current = false; setIsDragging(false) }

  // ── Wheel zoom ───────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault(); e.stopPropagation()
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    setZoom(z => Math.min(6, Math.max(0.25, z * factor)))
  }

  // ── Touch pinch / pan ────────────────────────────────────────
  function pinchDist(e: React.TouchEvent) {
    if (e.touches.length < 2) return null
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function handleTouchStart(e: React.TouchEvent) {
    lastPinch.current = pinchDist(e)
    if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY)
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 2) {
      const d = pinchDist(e)
      if (d !== null && lastPinch.current !== null) {
        setZoom(z => Math.min(6, Math.max(0.25, z * (d / lastPinch.current!))))
      }
      lastPinch.current = d
    } else if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  return (
    <>
      {/* Backdrop — fades in, click outside to close */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.92)',
          animation: closing
            ? 'lbBdOut 0.26s ease forwards'
            : 'lbBdIn  0.2s  ease forwards',
        }}
        onClick={() => { if (!hasMoved.current) dismiss(); hasMoved.current = false }}
        onMouseMove={e => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        {/* Content sheet — slides up from bottom */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            animation: closing
              ? 'lbSlideOut 0.26s cubic-bezier(0.4, 0, 1, 1)    forwards'
              : 'lbSlideIn  0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => { endDrag(); lastPinch.current = null }}
        >
          {/* Image — fills the viewport, contained with correct aspect ratio */}
          {imgUrl && (
            <img
              src={imgUrl}
              alt={handout.name}
              draggable={false}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.12s ease',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              }}
            />
          )}

          {/* Floating header with top-fade gradient */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '20px 20px 52px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, transparent 100%)',
              display: 'flex', alignItems: 'center', gap: '12px',
              pointerEvents: 'none',
            }}
          >
            <span style={{
              flex: 1, fontSize: '13px', fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              fontFamily: "'Cinzel',serif", letterSpacing: '2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {handout.name}
            </span>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, pointerEvents: 'all' }}>
              {isModified && (
                <button
                  onClick={e => { e.stopPropagation(); resetView() }}
                  style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '.5px',
                    padding: '4px 10px', borderRadius: '5px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.65)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {Math.round(zoom * 100)}% · Reset
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); dismiss() }}
                style={{
                  background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px', color: 'rgba(255,255,255,0.75)',
                  fontSize: '14px', cursor: 'pointer',
                  width: '34px', height: '34px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >✕</button>
            </div>
          </div>

          {/* Floating footer hint with bottom-fade gradient */}
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '52px 20px 18px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              fontSize: '10px', color: 'rgba(255,255,255,0.22)',
              textAlign: 'center', letterSpacing: '.5px',
              pointerEvents: 'none',
            }}
          >
            Scroll to zoom · Drag to pan · Click outside to close
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lbBdIn    { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lbBdOut   { from { opacity: 1 } to { opacity: 0 } }
        @keyframes lbSlideIn  { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes lbSlideOut { from { transform: translateY(0)    } to { transform: translateY(100%) } }
      `}</style>
    </>
  )
}
