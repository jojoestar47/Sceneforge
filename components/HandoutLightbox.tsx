'use client'

import { useState, useRef, useEffect } from 'react'
import type { Handout } from '@/lib/types'

interface Props {
  handout: Handout
  onClose: () => void
}

export default function HandoutLightbox({ handout, onClose }: Props) {
  const [closing, setClosing]     = useState(false)
  const [zoom, setZoom]           = useState(1)
  const [pan, setPan]             = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const dragging   = useRef(false)
  const hasMoved   = useRef(false)
  const lastXY     = useRef({ x: 0, y: 0 })
  const lastPinch  = useRef<number | null>(null)

  const imgUrl = handout.media?.signed_url || handout.media?.url || null
  const isZoomed = zoom > 1.02

  function dismiss() {
    setClosing(true)
    setTimeout(onClose, 180)
  }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  // Reset pan when zoomed all the way out
  useEffect(() => { if (!isZoomed) setPan({ x: 0, y: 0 }) }, [isZoomed])

  // ── Drag ─────────────────────────────────────────────────────
  function startDrag(x: number, y: number) {
    dragging.current = true
    hasMoved.current = false
    lastXY.current = { x, y }
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
    e.preventDefault()
    e.stopPropagation()
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    setZoom(z => Math.min(6, Math.max(1, z * factor)))
  }

  // ── Touch pinch/pan ──────────────────────────────────────────
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
        setZoom(z => Math.min(6, Math.max(1, z * (d / lastPinch.current!))))
      }
      lastPinch.current = d
    } else if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '14px', padding: '28px',
          boxSizing: 'border-box',
          animation: `${closing ? 'lbFadeOut' : 'lbFadeIn'} 0.18s ease forwards`,
        }}
        onMouseMove={e => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClick={() => {
          const moved = hasMoved.current
          hasMoved.current = false
          if (!moved) dismiss()
        }}
      >
        {/* Header row */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            width: '100%', maxWidth: '85vw', flexShrink: 0,
            animation: `${closing ? 'lbContentOut' : 'lbContentIn'} 0.18s ease forwards`,
          }}
        >
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: "'Cinzel',serif", letterSpacing: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {handout.name}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {isZoomed && (
              <button
                onClick={resetView}
                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {Math.round(zoom * 100)}% · Reset
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); dismiss() }}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '14px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >✕</button>
          </div>
        </div>

        {/* Image */}
        {imgUrl && (
          <div
            onClick={e => e.stopPropagation()}
            onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => { endDrag(); lastPinch.current = null }}
            style={{
              overflow: 'hidden',
              borderRadius: '8px',
              boxShadow: '0 20px 80px rgba(0,0,0,0.8)',
              maxWidth: '85vw',
              maxHeight: 'calc(85vh - 80px)',
              lineHeight: 0,
              flexShrink: 0,
              cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              animation: `${closing ? 'lbContentOut' : 'lbContentIn'} 0.18s ease forwards`,
            }}
          >
            <img
              src={imgUrl}
              alt={handout.name}
              draggable={false}
              style={{
                display: 'block',
                maxWidth: '85vw',
                maxHeight: 'calc(85vh - 80px)',
                objectFit: 'contain',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.12s ease',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />
          </div>
        )}

        {/* Hint */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', letterSpacing: '.5px', flexShrink: 0 }}
        >
          Scroll to zoom · Drag to pan · Click outside to close
        </div>
      </div>

      <style>{`
        @keyframes lbFadeIn     { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lbFadeOut    { from { opacity: 1 } to { opacity: 0 } }
        @keyframes lbContentIn  { from { opacity: 0; transform: scale(0.93) } to { opacity: 1; transform: scale(1) } }
        @keyframes lbContentOut { from { opacity: 1; transform: scale(1)    } to { opacity: 0; transform: scale(0.93) } }
      `}</style>
    </>
  )
}
