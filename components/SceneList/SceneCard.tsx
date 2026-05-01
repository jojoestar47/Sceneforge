'use client'

import type { Scene } from '@/lib/types'
import { mediaUrl } from '@/lib/media'
import AppIcon from '@/components/AppIcon'

interface Props {
  sc:           Scene
  /** Position within the rendered list (folder body, unfiled, or flat) — drives staggered fade-in. */
  idx:          number
  /** True when nested under a folder; adds the indent margin. */
  inFolder:     boolean
  /** Position of this scene within its rendering group (folder body or unfiled). */
  groupIdx:     number
  /** Size of the rendering group; used for canMoveDown bounds. */
  groupSize:    number
  /** 1-based index in the *full* scenes list; renders as the small "01" badge. */
  num:          number
  active:       boolean
  isHov:        boolean
  isDragging:   boolean
  isOver:       boolean
  canDrag:      boolean
  canReorder:   boolean
  isTouchDevice: boolean
  onSelect:     (id: string) => void
  onDelete:     (id: string) => void
  onEdit:       (id: string) => void
  onReorder:    ((dragId: string, targetId: string) => void) | undefined
  onHoverChange: (id: string | null) => void
  /** Drag begin: caller stashes the dragId and configures dataTransfer. */
  onDragStart:  (id: string, e: React.DragEvent) => void
  onDragOver:   (id: string, e: React.DragEvent) => void
  onDragLeave:  (id: string) => void
  onDrop:       (targetId: string, e: React.DragEvent) => void
  onDragEnd:    () => void
  /** Group-relative neighbours so reorder buttons can call onReorder with the right targets. */
  prevInGroup:  Scene | undefined
  nextInGroup:  Scene | undefined
}

export default function SceneCard({
  sc, idx, inFolder, groupIdx, groupSize, num,
  active, isHov, isDragging, isOver,
  canDrag, canReorder, isTouchDevice,
  onSelect, onDelete, onEdit, onReorder,
  onHoverChange, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  prevInGroup, nextInGroup,
}: Props) {
  const bgUrl       = mediaUrl(sc.bg)
  const musicN      = (sc.tracks || []).filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3').length
  const ambN        = (sc.tracks || []).filter(t => t.kind === 'ambience').length
  const canMoveUp   = canReorder && groupIdx > 0
  const canMoveDown = canReorder && groupIdx < groupSize - 1

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? e => onDragStart(sc.id, e) : undefined}
      onDragOver={canDrag ? e => onDragOver(sc.id, e) : undefined}
      onDragLeave={canDrag ? () => onDragLeave(sc.id) : undefined}
      onDrop={canDrag ? e => onDrop(sc.id, e) : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={() => onSelect(sc.id)}
      onDoubleClick={() => !isTouchDevice && onEdit(sc.id)}
      onMouseEnter={() => !isTouchDevice && onHoverChange(sc.id)}
      onMouseLeave={() => !isTouchDevice && onHoverChange(null)}
      style={{
        display: 'flex', alignItems: 'stretch',
        margin: inFolder ? '3px 8px 3px 20px' : '3px 8px',
        height: '72px',
        borderRadius: '10px',
        cursor: canDrag ? 'grab' : 'pointer',
        position: 'relative', overflow: 'hidden',
        background: active ? 'rgba(201,168,76,0.07)' : isHov ? 'var(--bg-hover)' : 'var(--bg-raised)',
        border: `1px solid ${active ? 'rgba(201,168,76,0.32)' : isOver ? 'var(--accent)' : isHov ? 'var(--border-lt)' : 'var(--border)'}`,
        boxShadow: active ? 'inset 3px 0 0 var(--accent)' : 'none',
        opacity: isDragging ? 0.3 : 1,
        transition: 'background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease',
        touchAction: 'manipulation',
        animation: `sceneIn 0.18s ease both`,
        animationDelay: `${idx * 0.04}s`,
      }}
    >
      {/* Reorder controls — drag handle on desktop, tap arrows on touch */}
      {canReorder && (
        <div style={{
          width: isTouchDevice ? '30px' : '20px', flexShrink: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: isTouchDevice ? '4px' : '2px', userSelect: 'none', WebkitUserSelect: 'none',
        }}>
          {isTouchDevice ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveUp && prevInGroup) onReorder!(sc.id, prevInGroup.id) }}
                style={{
                  width: '28px', height: '28px', border: 'none', borderRadius: '6px', padding: 0,
                  background: canMoveUp ? 'var(--bg-hover)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canMoveUp ? 'pointer' : 'default',
                  color: canMoveUp ? 'var(--text-2)' : 'var(--text-3)',
                  opacity: canMoveUp ? 1 : 0.25, touchAction: 'manipulation',
                }}
              >
                <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
                  <path d="M1 6l4-5 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveDown && nextInGroup) onReorder!(sc.id, nextInGroup.id) }}
                style={{
                  width: '28px', height: '28px', border: 'none', borderRadius: '6px', padding: 0,
                  background: canMoveDown ? 'var(--bg-hover)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canMoveDown ? 'pointer' : 'default',
                  color: canMoveDown ? 'var(--text-2)' : 'var(--text-3)',
                  opacity: canMoveDown ? 1 : 0.25, touchAction: 'manipulation',
                }}
              >
                <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
                  <path d="M1 1l4 5 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveUp && prevInGroup) onReorder!(sc.id, prevInGroup.id) }}
                style={{
                  width: '14px', height: '14px', border: 'none', background: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canMoveUp ? 'pointer' : 'default',
                  opacity: isHov && canMoveUp ? 0.7 : 0,
                  transition: 'opacity 0.14s ease, color 0.14s ease',
                  color: 'var(--text-2)',
                }}
                onMouseEnter={e => { if (canMoveUp) e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = isHov && canMoveUp ? '0.7' : '0' }}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 5l3-4 3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div style={{
                color: isHov ? 'var(--text-3)' : 'rgba(255,255,255,0.12)',
                fontSize: '10px', lineHeight: 1, transition: 'color 0.14s ease',
              }}>⠿</div>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveDown && nextInGroup) onReorder!(sc.id, nextInGroup.id) }}
                style={{
                  width: '14px', height: '14px', border: 'none', background: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canMoveDown ? 'pointer' : 'default',
                  opacity: isHov && canMoveDown ? 0.7 : 0,
                  transition: 'opacity 0.14s ease, color 0.14s ease',
                  color: 'var(--text-2)',
                }}
                onMouseEnter={e => { if (canMoveDown) e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = isHov && canMoveDown ? '0.7' : '0' }}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 1l3 4 3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Thumbnail */}
      <div style={{
        width: '86px', flexShrink: 0, background: 'var(--bg)',
        overflow: 'hidden', display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative',
      }}>
        {bgUrl
          ? sc.bg?.type === 'video'
            ? <video src={bgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
            : <img src={bgUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHov ? 'scale(1.07)' : 'scale(1)' }} />
          : <AppIcon size={22} opacity={0.2} />
        }
        <div style={{
          position: 'absolute', bottom: '4px', left: '5px',
          background: 'rgba(0,0,0,0.6)', borderRadius: '4px',
          padding: '1px 5px', fontSize: '9px', fontWeight: 700,
          color: 'rgba(255,255,255,0.65)', letterSpacing: '0.3px',
        }}>
          {String(num).padStart(2, '0')}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px 0 10px', overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: '5px', lineHeight: 1.2,
        }}>
          {sc.name}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', overflow: 'hidden' }}>
          {active && (
            <span style={{
              fontSize: '8px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase',
              color: 'var(--accent)', background: 'rgba(201,168,76,0.15)',
              borderRadius: '4px', padding: '2px 5px', flexShrink: 0,
            }}>ON</span>
          )}
          {musicN > 0 && (
            <span style={{ fontSize: '9px', color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
              ♪ {musicN}
            </span>
          )}
          {ambN > 0 && (
            <span style={{ fontSize: '9px', color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
              ~ {ambN}
            </span>
          )}
          {sc.location && (
            <span style={{ fontSize: '9px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sc.location}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: isTouchDevice ? '6px 6px' : '8px 7px',
        flexShrink: 0, justifyContent: 'center',
        opacity: isHov || isTouchDevice ? 1 : 0,
        transition: 'opacity 0.14s ease',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit(sc.id) }}
          title="Edit scene"
          style={{
            width: isTouchDevice ? '36px' : '26px', height: isTouchDevice ? '36px' : '26px',
            borderRadius: '7px', background: 'var(--bg-panel)', border: '1px solid var(--border)',
            color: 'var(--text-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s ease', flexShrink: 0, touchAction: 'manipulation',
          }}
          onMouseEnter={e => { if (!isTouchDevice) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-lt)'; e.currentTarget.style.color = 'var(--text)' } }}
          onMouseLeave={e => { if (!isTouchDevice) { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' } }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(sc.id) }}
          onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); onDelete(sc.id) }}
          title="Delete scene"
          style={{
            width: isTouchDevice ? '36px' : '26px', height: isTouchDevice ? '36px' : '26px',
            borderRadius: '7px', background: 'var(--bg-panel)', border: '1px solid var(--border)',
            color: 'var(--text-3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s ease', flexShrink: 0, touchAction: 'manipulation',
          }}
          onMouseEnter={e => { if (!isTouchDevice) { e.currentTarget.style.background = 'rgba(201,168,76,0.1)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.color = 'var(--accent)' } }}
          onMouseLeave={e => { if (!isTouchDevice) { e.currentTarget.style.background = 'var(--bg-panel)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' } }}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
