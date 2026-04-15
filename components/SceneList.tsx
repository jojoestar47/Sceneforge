'use client'

import { useState } from 'react'
import type { Scene } from '@/lib/types'

interface Props {
  scenes: Scene[]
  activeSceneId: string | null
  hasCampaign: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onEdit:   (id: string) => void
  onAdd:    () => void
  onReorder?: (dragId: string, targetId: string) => void
}

export default function SceneList({
  scenes, activeSceneId, hasCampaign,
  onSelect, onDelete, onEdit, onAdd, onReorder,
}: Props) {
  const [q, setQ] = useState('')
  const [dragId,     setDragId]     = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const filtered = scenes.filter(s =>
    !q || s.name.toLowerCase().includes(q.toLowerCase())
  )

  const canDrag = !q && !!onReorder

  function mediaUrl(m: Scene['bg']): string | null {
    if (!m) return null
    return m.signed_url || m.url || null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Filter */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          className="finput"
          style={{ padding: '6px 10px', fontSize: '12px' }}
          placeholder="Filter Scenes"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasCampaign && (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px' }}>
            No campaign selected
          </div>
        )}
        {hasCampaign && !filtered.length && (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px' }}>
            {q ? 'No scenes match your filter' : 'No scenes yet'}
          </div>
        )}
        {filtered.map(sc => {
          const active  = sc.id === activeSceneId
          const bgUrl   = mediaUrl(sc.bg)
          const musicN  = (sc.tracks || []).filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3').length
          const ambN    = (sc.tracks || []).filter(t => t.kind === 'ambience').length
          const isDragging = sc.id === dragId
          const isOver     = sc.id === dragOverId && sc.id !== dragId

          return (
            <div
              key={sc.id}
              draggable={canDrag}
              onDragStart={canDrag ? e => {
                setDragId(sc.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', sc.id)
              } : undefined}
              onDragOver={canDrag ? e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (sc.id !== dragId) setDragOverId(sc.id)
              } : undefined}
              onDragLeave={canDrag ? () => {
                setDragOverId(prev => prev === sc.id ? null : prev)
              } : undefined}
              onDrop={canDrag ? e => {
                e.preventDefault()
                if (dragId && dragId !== sc.id && onReorder) onReorder(dragId, sc.id)
                setDragId(null)
                setDragOverId(null)
              } : undefined}
              onDragEnd={canDrag ? () => {
                setDragId(null)
                setDragOverId(null)
              } : undefined}
              onClick={() => onSelect(sc.id)}
              onDoubleClick={() => onEdit(sc.id)}
              style={{
                display: 'flex', alignItems: 'stretch', height: '60px',
                borderBottom: '1px solid var(--border)', cursor: canDrag ? 'grab' : 'pointer',
                transition: 'background .11s, opacity .11s', position: 'relative', overflow: 'hidden',
                background: active ? 'var(--accent-bg)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                borderTop: isOver ? '2px solid var(--accent)' : undefined,
                opacity: isDragging ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* Drag handle */}
              {canDrag && (
                <div style={{
                  width: '14px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-3)', fontSize: '9px', letterSpacing: '-1px', userSelect: 'none', WebkitUserSelect: 'none',
                }}>
                  ⠿
                </div>
              )}

              {/* Thumb */}
              <div style={{ width: '84px', flexShrink: 0, background: 'var(--bg-raised)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {bgUrl
                  ? sc.bg?.type === 'video'
                    ? <video src={bgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="metadata" />
                    : <img src={bgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '20px', color: 'var(--text-3)' }}>🎭</span>
                }
              </div>

              {/* Body */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px', overflow: 'hidden', minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
                  {sc.name}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {musicN > 0 && <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>♪ {musicN}</span>}
                  {ambN > 0   && <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>🌊 {ambN}</span>}
                  {sc.bg && <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>{sc.bg.storage_path ? '📁' : sc.bg.type === 'image' ? '📷' : '🎬'}</span>}
                  {sc.overlay && <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>✨</span>}
                </div>
              </div>

              {/* Active badge */}
              <div style={{ width: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {active && (
                  <div style={{
                    width: '20px', height: '20px', background: 'var(--accent)',
                    borderRadius: '3px 3px 0 0', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '8px', color: '#fff',
                    position: 'relative',
                  }}>
                    ▶
                    <div style={{
                      position: 'absolute', bottom: '-5px', left: 0, right: 0,
                      borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                      borderTop: '5px solid var(--accent)',
                    }} />
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={e => { e.stopPropagation(); onDelete(sc.id) }}
                style={{
                  position: 'absolute', top: '6px', right: '30px',
                  background: 'none', border: 'none', color: 'var(--accent)',
                  fontSize: '11px', cursor: 'pointer', opacity: 0, transition: 'opacity .1s', zIndex: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                className="scene-del"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      {/* Add button */}
      {hasCampaign && (
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-block" onClick={onAdd}>+ Add Scene</button>
        </div>
      )}
    </div>
  )
}
