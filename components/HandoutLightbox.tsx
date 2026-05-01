'use client'

import { useState, useRef, useEffect } from 'react'
import type { Handout } from '@/lib/types'
import { mediaUrl } from '@/lib/media'

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
  const hasMoved  = useRef(false)   // true if pointer/touch moved since pointerdown
  const lastXY    = useRef({ x: 0, y: 0 })
  const lastPinch = useRef<number | null>(null)

  const imgUrl     = mediaUrl(handout.media)
  const isZoomed   = zoom > 1.02
  const isModified = Math.abs(zoom - 1) > 0.02

  function dismiss() {
    setClosing(true)
    setTimeout(onClose, 260)
  }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  useEffect(() => { if (!isZoomed) setPan({ x: 0, y: 0 }) }, [isZoomed])

  // Lock body scroll while the lightbox is open so the background page
  // doesn't scroll behind the overlay on desktop and mobile.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Drag / pan helpers ────────────────────────────────────────
  function startDrag(x: number, y: number) {
    dragging.current  = true
    hasMoved.current  = false
    lastXY.current    = { x, y }
    setIsDragging(true)
  }

  function moveDrag(x: number, y: number) {
    if (!dragging.current) return
    const dx = x - lastXY.current.x
    const dy = y - lastXY.current.y
    // Always track movement — even when not panning — so we can distinguish
    // a tap (no movement) from a swipe (moved), regardless of zoom level.
    if (Math.abs(dx) + Math.abs(dy) > 4) hasMoved.current = true
    lastXY.current = { x, y }
    if (isZoomed) setPan(p => ({ x: p.x + dx, y: p.y + dy }))
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
        hasMoved.current = true   // pinch counts as a gesture, not a tap
      }
      lastPinch.current = d
    } else if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    endDrag()
    lastPinch.current = null
    // Single-finger tap on the background (not the image) → dismiss.
    // e.target is where the touch started; if it's the overlay wrapper
    // itself (not a child like the image or a button) and the finger
    // didn't move, treat it as a "tap outside" and close.
    if (
      e.changedTouches.length === 1 &&
      !hasMoved.current &&
      (e.target as HTMLElement).dataset.dismiss === 'true'
    ) {
      dismiss()
    }
    hasMoved.current = false
  }

  // ── Click outside to close (desktop) ─────────────────────────
  // The overlay wrapper covers inset:0 but the image is smaller and
  // flex-centered. Clicks that land on the wrapper itself (not a child)
  // are "outside" the image — dismiss on those.
  function handleOverlayClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset.dismiss === 'true' && !hasMoved.current) {
      dismiss()
    }
    hasMoved.current = false
  }

  return (
    <>
      {/* Backdrop — fades in */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.92)',
          animation: closing
            ? 'lbBdOut 0.26s ease forwards'
            : 'lbBdIn  0.2s  ease forwards',
        }}
      >
        {/* Overlay wrapper — fills backdrop, flex-centers the image.
            Clicks/taps that land directly on this wrapper (data-dismiss="true")
            are "outside" the image and should close. Children that want to
            prevent closing (image, buttons) stop propagation themselves. */}
        <div
          data-dismiss="true"
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            animation: closing
              ? 'lbSlideOut 0.26s cubic-bezier(0.4, 0, 1, 1)    forwards'
              : 'lbSlideIn  0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onClick={handleOverlayClick}
          onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image — stopPropagation prevents image taps from triggering dismiss */}
          {imgUrl && (
            <img
              src={imgUrl}
              alt={handout.name}
              draggable={false}
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '92%',
                maxHeight: '88%',
                objectFit: 'contain',
                display: 'block',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.12s ease',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                // Raise pointer events so clicks are absorbed by the image, not
                // the wrapper behind it.
                position: 'relative',
                zIndex: 1,
              }}
            />
          )}

          {/* Floating header — pointerEvents:none on the gradient, all on buttons */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '16px 16px 52px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, transparent 100%)',
              display: 'flex', alignItems: 'center', gap: '10px',
              pointerEvents: 'none',
              zIndex: 2,
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
                    padding: '0 12px', borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.65)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    // Minimum tap target for mobile
                    minHeight: '44px', minWidth: '44px',
                  }}
                >
                  {Math.round(zoom * 100)}% · Reset
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); dismiss() }}
                style={{
                  background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px', color: 'rgba(255,255,255,0.85)',
                  fontSize: '16px', cursor: 'pointer',
                  // 44px minimum touch target (Apple HIG / WCAG 2.5.5)
                  width: '44px', height: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
                aria-label="Close handout"
              >✕</button>
            </div>
          </div>

          {/* Floating footer hint */}
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '52px 20px 18px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              fontSize: '10px', color: 'rgba(255,255,255,0.22)',
              textAlign: 'center', letterSpacing: '.5px',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            Pinch to zoom · Drag to pan · Tap outside to close
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
