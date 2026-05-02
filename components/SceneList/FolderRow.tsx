'use client'

import { useEffect, useRef, useState } from 'react'
import type { Scene, SceneFolder } from '@/lib/types'
import SceneCard from './SceneCard'

interface Props {
  folder:        SceneFolder
  folderScenes:  Scene[]
  /** Index of this folder in the full folders list — drives canMoveUp/Down. */
  folderIndex:   number
  /** Full folders list so reorder buttons can identify their neighbour. */
  folders:       SceneFolder[]
  isOpen:        boolean
  isDragTarget:  boolean
  isHovFolder:   boolean
  isTouchDevice: boolean
  canDrag:       boolean
  /** True when something is currently being dragged (so onDrop drag-over highlights work). */
  hasActiveDrag: boolean
  /**
   * Single-folder-menu invariant: the orchestrator owns "which folder's
   * ⋯ menu is open" so opening folder B's menu auto-closes folder A's.
   * Lifting this avoids the case where two FolderRow's outside-click
   * listeners both treat the other folder's menu as "inside a menu".
   */
  menuOpenFolderId:    string | null
  setMenuOpenFolderId: (id: string | null) => void

  /** Toggle open/closed via the chevron / icon / name click. */
  onToggleOpen:    (id: string) => void
  onHoverChange:   (id: string | null) => void

  // Folder-level callbacks
  onFolderRename?: (id: string, name: string) => void
  onFolderDelete?: (id: string) => void
  onFolderColor?:  (id: string, color: string) => void
  onFolderReorder?: (dragId: string, targetId: string) => void
  onMoveToFolder?: (sceneId: string, folderId: string | null) => void
  onAdd:           (folderId?: string | null) => void

  /**
   * Folder-level drag-over state setter (Dispatch from the orchestrator's
   * useState). Typed as a Dispatch so FolderRow can pass an updater
   * function — `setFolderDragOver(p => p === folder.id ? null : p)` —
   * which is what makes adjacent-folder drag-leave events safe. Replacing
   * with `(null)` would clobber the highlight on the folder you just
   * entered when leaving the previous one.
   */
  setFolderDragOver: React.Dispatch<React.SetStateAction<string | 'unfiled' | null>>

  // Per-scene props (we forward these to SceneCard)
  activeSceneId: string | null
  onSelect:    (id: string) => void
  onDelete:    (id: string) => void
  onEdit:      (id: string) => void
  onReorder?:  (dragId: string, targetId: string) => void
  hoveredId:   string | null
  setHoveredId: (id: string | null) => void
  dragId:      string | null
  dragOverId:  string | null
  canReorder:  boolean
  /** SceneCard's drag handlers — orchestrator owns the drag state. */
  onSceneDragStart: (id: string, e: React.DragEvent) => void
  onSceneDragOver:  (id: string, e: React.DragEvent) => void
  onSceneDragLeave: (id: string) => void
  onSceneDrop:      (targetId: string, e: React.DragEvent) => void
  onSceneDragEnd:   () => void
  /** Full scenes list — used for the 1-based "01" badge index. */
  allScenes: Scene[]
}

export default function FolderRow({
  folder, folderScenes, folderIndex, folders,
  isOpen, isDragTarget, isHovFolder, isTouchDevice,
  canDrag, hasActiveDrag,
  menuOpenFolderId, setMenuOpenFolderId,
  onToggleOpen, onHoverChange,
  onFolderRename, onFolderDelete, onFolderColor, onFolderReorder, onMoveToFolder,
  onAdd, setFolderDragOver,
  activeSceneId,
  onSelect, onDelete, onEdit, onReorder,
  hoveredId, setHoveredId, dragId, dragOverId, canReorder,
  onSceneDragStart, onSceneDragOver, onSceneDragLeave, onSceneDrop, onSceneDragEnd,
  allScenes,
}: Props) {
  const [renaming,  setRenaming]  = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const menuOpen = menuOpenFolderId === folder.id

  // Auto-focus the rename input when entering rename mode
  useEffect(() => { if (renaming) renameInputRef.current?.focus() }, [renaming])

  function startRename() {
    setRenameVal(folder.name)
    setRenaming(true)
  }

  function commitRename() {
    if (renameVal.trim() && onFolderRename) onFolderRename(folder.id, renameVal.trim())
    setRenaming(false)
    setRenameVal('')
  }

  function cancelRename() {
    setRenaming(false)
    setRenameVal('')
  }

  const color       = folder.color || null
  const iconColor   = color || (isOpen ? 'var(--accent)' : 'var(--text-3)')
  const iconFill    = isOpen ? (color ? `${color}22` : 'rgba(201,168,76,0.12)') : 'none'
  const canMoveUp   = !!onFolderReorder && folderIndex > 0
  const canMoveDown = !!onFolderReorder && folderIndex < folders.length - 1

  return (
    <div style={{ marginBottom: '2px', position: 'relative' }}>
      {/* ── Folder header ── */}
      <div
        onMouseEnter={() => !isTouchDevice && onHoverChange(folder.id)}
        onMouseLeave={() => !isTouchDevice && onHoverChange(null)}
        onDragOver={canDrag && hasActiveDrag ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setFolderDragOver(folder.id) } : undefined}
        onDragLeave={canDrag ? () => setFolderDragOver(p => p === folder.id ? null : p) : undefined}
        onDrop={canDrag && hasActiveDrag ? e => {
          e.preventDefault()
          if (dragId && onMoveToFolder) onMoveToFolder(dragId, folder.id)
          setFolderDragOver(null)
        } : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          margin: '2px 8px', padding: '0 8px',
          height: '34px', borderRadius: '8px',
          cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
          background: isDragTarget ? 'rgba(201,168,76,0.08)' : 'transparent',
          border: `1px solid ${isDragTarget ? 'rgba(201,168,76,0.4)' : 'transparent'}`,
          boxShadow: color ? `inset 3px 0 0 ${color}` : 'none',
          transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.2s ease',
        }}
      >
        {/* Chevron */}
        <div onClick={() => !renaming && onToggleOpen(folder.id)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ color: iconColor, transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), color 0.2s ease', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Folder icon */}
        <div onClick={() => !renaming && onToggleOpen(folder.id)} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: iconColor, transition: 'color 0.2s ease' }}>
            <path d="M1 3.5C1 2.67 1.67 2 2.5 2h2.17a1 1 0 0 1 .71.29L6.09 3H10.5C11.33 3 12 3.67 12 4.5v5c0 .83-.67 1.5-1.5 1.5h-8C1.67 11 1 10.33 1 9.5v-6z" stroke="currentColor" strokeWidth="1.1" fill={iconFill}/>
          </svg>
        </div>

        {/* Name */}
        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
            onBlur={commitRename}
            onClick={e => e.stopPropagation()}
            className="finput"
            style={{ flex: 1, fontSize: '11px', fontWeight: 700, padding: '3px 6px', minWidth: 0 }}
          />
        ) : (
          <span
            onClick={() => onToggleOpen(folder.id)}
            style={{
              flex: 1, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: color || 'var(--text-2)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              transition: 'color 0.2s ease',
            }}
          >
            {folder.name}
          </span>
        )}

        {/* Scene count badge */}
        {!renaming && (
          <span style={{
            fontSize: '9px', fontWeight: 700,
            color: color || 'var(--text)',
            background: color ? `${color}22` : 'rgba(255,255,255,0.1)',
            border: `1px solid ${color ? `${color}44` : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '10px', padding: '1px 6px', flexShrink: 0,
            transition: 'all 0.2s ease',
          }}>{folderScenes.length}</span>
        )}

        {/* Folder reorder arrows — desktop fades in on hover, touch always shows them */}
        {!renaming && onFolderReorder && (
          isTouchDevice ? (
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveUp) onFolderReorder(folder.id, folders[folderIndex - 1].id) }}
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
                onClick={e => { e.stopPropagation(); if (canMoveDown) onFolderReorder(folder.id, folders[folderIndex + 1].id) }}
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveUp) onFolderReorder(folder.id, folders[folderIndex - 1].id) }}
                style={{
                  width: '14px', height: '13px', border: 'none', background: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canMoveUp ? 'pointer' : 'default',
                  opacity: isHovFolder && canMoveUp ? 0.7 : 0,
                  transition: 'opacity 0.14s ease', color: 'var(--text-2)',
                }}
                onMouseEnter={e => { if (canMoveUp) e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = isHovFolder && canMoveUp ? '0.7' : '0' }}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 5l3-4 3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); if (canMoveDown) onFolderReorder(folder.id, folders[folderIndex + 1].id) }}
                style={{
                  width: '14px', height: '13px', border: 'none', background: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canMoveDown ? 'pointer' : 'default',
                  opacity: isHovFolder && canMoveDown ? 0.7 : 0,
                  transition: 'opacity 0.14s ease', color: 'var(--text-2)',
                }}
                onMouseEnter={e => { if (canMoveDown) e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = isHovFolder && canMoveDown ? '0.7' : '0' }}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 1l3 4 3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )
        )}

        {/* Ellipsis menu button */}
        {!renaming && (
          <button
            data-folder-menu="true"
            onClick={e => { e.stopPropagation(); setMenuOpenFolderId(menuOpen ? null : folder.id) }}
            style={{
              width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
              background: menuOpen ? 'var(--bg-hover)' : 'transparent',
              border: `1px solid ${menuOpen ? 'var(--border-lt)' : 'transparent'}`,
              color: 'var(--text-3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', letterSpacing: '1px', lineHeight: 1,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-lt)'; e.currentTarget.style.color = 'var(--text-2)' }}
            onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' } }}
          >···</button>
        )}
      </div>

      {/* ── Folder actions popover ── */}
      {menuOpen && (
        <div
          data-folder-menu="true"
          style={{
            position: 'absolute', right: '8px', top: '36px', zIndex: 100,
            background: 'var(--bg-card, var(--bg-raised))', border: '1px solid var(--border)',
            borderRadius: '9px', padding: '4px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
            minWidth: '160px',
            animation: 'sceneIn 0.12s ease both',
          }}
        >
          {/* Color picker row */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
              background: color || 'var(--border-lt)', border: `1px solid ${color || 'var(--border)'}`,
            }} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)', flex: 1 }}>Folder color</span>
            <input
              type="color"
              value={color || '#c9a84c'}
              onChange={e => onFolderColor && onFolderColor(folder.id, e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 'none', borderRadius: '6px' }}
            />
          </div>

          {/* New scene in folder */}
          <button
            onClick={() => { setMenuOpenFolderId(null); onAdd(folder.id) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: '11px',
              textAlign: 'left', transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M5 2.5v5M2.5 5h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            New scene here
          </button>

          {/* Rename */}
          <button
            onClick={() => { setMenuOpenFolderId(null); startRename() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: '11px',
              textAlign: 'left', transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
              <path d="M7 1.5l1.5 1.5L3 8.5H1.5V7L7 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
            Rename
          </button>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '3px 6px' }} />

          {/* Delete */}
          {onFolderDelete && (
            <button
              onClick={() => { setMenuOpenFolderId(null); onFolderDelete(folder.id) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderRadius: '6px', border: 'none',
                background: 'transparent', color: 'rgba(229,53,53,0.8)', cursor: 'pointer', fontSize: '11px',
                textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.08)'; e.currentTarget.style.color = '#e53535' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(229,53,53,0.8)' }}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Delete folder
            </button>
          )}
        </div>
      )}

      {/* ── Animated content ── */}
      <div style={{
        maxHeight: isOpen ? '4000px' : '0px',
        overflow: 'hidden',
        transition: isOpen
          ? 'max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease'
          : 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease',
        opacity: isOpen ? 1 : 0,
      }}>
        {folderScenes.length > 0
          ? folderScenes.map((sc, i) => (
              <SceneCard
                key={sc.id}
                sc={sc}
                idx={i}
                inFolder={true}
                groupIdx={i}
                groupSize={folderScenes.length}
                num={allScenes.indexOf(sc) + 1}
                active={sc.id === activeSceneId}
                isHov={hoveredId === sc.id}
                isDragging={dragId === sc.id}
                isOver={dragOverId === sc.id && dragId !== sc.id}
                canDrag={canDrag}
                canReorder={canReorder}
                isTouchDevice={isTouchDevice}
                onSelect={onSelect}
                onDelete={onDelete}
                onEdit={onEdit}
                onReorder={onReorder}
                onHoverChange={setHoveredId}
                onDragStart={onSceneDragStart}
                onDragOver={onSceneDragOver}
                onDragLeave={onSceneDragLeave}
                onDrop={onSceneDrop}
                onDragEnd={onSceneDragEnd}
                prevInGroup={folderScenes[i - 1]}
                nextInGroup={folderScenes[i + 1]}
              />
            ))
          : (
            <div style={{
              margin: '4px 8px 4px 20px', padding: '10px 14px',
              borderRadius: '8px', border: '1px dashed var(--border)',
              fontSize: '10px', color: 'var(--text-3)', textAlign: 'center',
              letterSpacing: '0.3px',
            }}>
              Drop scenes here
            </div>
          )
        }
        <div style={{ height: '4px' }} />
      </div>
    </div>
  )
}
