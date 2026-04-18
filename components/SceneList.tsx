'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import type { Scene, SceneFolder } from '@/lib/types'
import AppIcon from '@/components/AppIcon'

interface Props {
  scenes:          Scene[]
  folders:         SceneFolder[]
  activeSceneId:   string | null
  hasCampaign:     boolean
  onSelect:        (id: string) => void
  onDelete:        (id: string) => void
  onEdit:          (id: string) => void
  onAdd:           () => void
  onReorder?:      (dragId: string, targetId: string) => void
  onFolderCreate?: (name: string) => void
  onFolderRename?: (id: string, name: string) => void
  onFolderDelete?: (id: string) => void
  onMoveToFolder?: (sceneId: string, folderId: string | null) => void
}

function mediaUrl(m: Scene['bg']): string | null {
  if (!m) return null
  return m.signed_url || m.url || null
}

export default function SceneList({
  scenes, folders, activeSceneId, hasCampaign,
  onSelect, onDelete, onEdit, onAdd, onReorder,
  onFolderCreate, onFolderRename, onFolderDelete, onMoveToFolder,
}: Props) {
  const [q,              setQ]              = useState('')
  const [dragId,         setDragId]         = useState<string | null>(null)
  const [dragOverId,     setDragOverId]     = useState<string | null>(null)
  const [folderDragOver, setFolderDragOver] = useState<string | 'unfiled' | null>(null)
  const [hoveredId,      setHoveredId]      = useState<string | null>(null)
  const [openFolders,    setOpenFolders]    = useState<Set<string>>(new Set())
  const [renamingId,     setRenamingId]     = useState<string | null>(null)
  const [renameVal,      setRenameVal]      = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName,  setNewFolderName]  = useState('')
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )

  const renameInputRef    = useRef<HTMLInputElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const prevFolderIds     = useRef<Set<string>>(new Set())

  // Auto-open newly added folders
  useEffect(() => {
    const newIds = folders.filter(f => !prevFolderIds.current.has(f.id)).map(f => f.id)
    if (newIds.length) {
      setOpenFolders(prev => { const n = new Set(prev); newIds.forEach(id => n.add(id)); return n })
    }
    prevFolderIds.current = new Set(folders.map(f => f.id))
  }, [folders])

  useEffect(() => { if (renamingId) renameInputRef.current?.focus() }, [renamingId])
  useEffect(() => { if (creatingFolder) newFolderInputRef.current?.focus() }, [creatingFolder])

  const filtered = scenes.filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()))
  const canDrag  = !q && !!onReorder && !isTouchDevice
  const hasFolders = folders.length > 0

  function toggleFolder(id: string) {
    setOpenFolders(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function startRename(folder: SceneFolder) {
    setRenamingId(folder.id)
    setRenameVal(folder.name)
  }

  function commitRename() {
    if (renamingId && renameVal.trim() && onFolderRename) {
      onFolderRename(renamingId, renameVal.trim())
    }
    setRenamingId(null)
    setRenameVal('')
  }

  function commitNewFolder() {
    const name = newFolderName.trim()
    if (name && onFolderCreate) onFolderCreate(name)
    setCreatingFolder(false)
    setNewFolderName('')
  }

  function cancelNewFolder() {
    setCreatingFolder(false)
    setNewFolderName('')
  }

  // Scene card shared across folder and unfiled sections
  function renderScene(sc: Scene, idx: number, inFolder: boolean) {
    const active     = sc.id === activeSceneId
    const bgUrl      = mediaUrl(sc.bg)
    const musicN     = (sc.tracks || []).filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3').length
    const ambN       = (sc.tracks || []).filter(t => t.kind === 'ambience').length
    const isDragging = sc.id === dragId
    const isOver     = sc.id === dragOverId && sc.id !== dragId
    const isHov      = hoveredId === sc.id
    const num        = scenes.indexOf(sc) + 1

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
        onDragLeave={canDrag ? () => setDragOverId(p => p === sc.id ? null : p) : undefined}
        onDrop={canDrag ? e => {
          e.preventDefault()
          if (dragId && dragId !== sc.id && onReorder) onReorder(dragId, sc.id)
          setDragId(null); setDragOverId(null)
        } : undefined}
        onDragEnd={canDrag ? () => { setDragId(null); setDragOverId(null) } : undefined}
        onClick={() => onSelect(sc.id)}
        onDoubleClick={() => !isTouchDevice && onEdit(sc.id)}
        onMouseEnter={() => !isTouchDevice && setHoveredId(sc.id)}
        onMouseLeave={() => !isTouchDevice && setHoveredId(null)}
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
        {/* Drag handle */}
        {canDrag && (
          <div style={{
            width: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isHov ? 'var(--text-3)' : 'transparent',
            fontSize: '10px', userSelect: 'none', WebkitUserSelect: 'none',
            transition: 'color 0.14s ease',
          }}>⠿</div>
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
              : <img src={bgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHov ? 'scale(1.07)' : 'scale(1)' }} />
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

  // Folder row with animated expand/collapse
  function renderFolder(folder: SceneFolder, folderScenes: Scene[]) {
    const isOpen       = openFolders.has(folder.id)
    const isRenaming   = renamingId === folder.id
    const isDragTarget = folderDragOver === folder.id

    return (
      <div key={folder.id} style={{ marginBottom: '2px' }}>
        {/* ── Folder header ── */}
        <div
          onDragOver={canDrag && dragId ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setFolderDragOver(folder.id) } : undefined}
          onDragLeave={canDrag ? () => setFolderDragOver(p => p === folder.id ? null : p) : undefined}
          onDrop={canDrag && dragId ? e => {
            e.preventDefault()
            if (dragId && onMoveToFolder) onMoveToFolder(dragId, folder.id)
            setDragId(null); setFolderDragOver(null)
          } : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            margin: '2px 8px', padding: '0 8px',
            height: '34px', borderRadius: '8px',
            cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
            background: isDragTarget ? 'rgba(201,168,76,0.1)' : 'transparent',
            border: `1px solid ${isDragTarget ? 'rgba(201,168,76,0.4)' : 'transparent'}`,
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
        >
          {/* Chevron — click to toggle */}
          <div
            onClick={() => !isRenaming && toggleFolder(folder.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ color: 'var(--text-3)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Folder icon */}
          <div onClick={() => !isRenaming && toggleFolder(folder.id)} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: isOpen ? 'var(--accent)' : 'var(--text-3)', transition: 'color 0.2s ease' }}>
              <path d="M1 3.5C1 2.67 1.67 2 2.5 2h2.17a1 1 0 0 1 .71.29L6.09 3H10.5C11.33 3 12 3.67 12 4.5v5c0 .83-.67 1.5-1.5 1.5h-8C1.67 11 1 10.33 1 9.5v-6z" stroke="currentColor" strokeWidth="1.1" fill={isOpen ? 'rgba(201,168,76,0.12)' : 'none'}/>
            </svg>
          </div>

          {/* Name — double-click to rename */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameVal('') } }}
              onBlur={commitRename}
              onClick={e => e.stopPropagation()}
              className="finput"
              style={{ flex: 1, fontSize: '11px', fontWeight: 700, padding: '3px 6px', minWidth: 0 }}
            />
          ) : (
            <span
              onClick={() => toggleFolder(folder.id)}
              onDoubleClick={() => !isTouchDevice && startRename(folder)}
              title="Double-click to rename"
              style={{
                flex: 1, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', color: 'var(--text-2)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                transition: 'color 0.15s ease',
              }}
            >
              {folder.name}
            </span>
          )}

          {/* Scene count badge */}
          {!isRenaming && folderScenes.length > 0 && (
            <span style={{
              fontSize: '9px', fontWeight: 700, color: 'var(--text-3)',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '1px 6px', flexShrink: 0,
            }}>{folderScenes.length}</span>
          )}

          {/* Delete folder button */}
          {!isRenaming && onFolderDelete && (
            <FolderActionButton
              title="Delete folder"
              onClick={e => { e.stopPropagation(); onFolderDelete(folder.id) }}
              isTouchDevice={isTouchDevice}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </FolderActionButton>
          )}
        </div>

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
            ? folderScenes.map((sc, i) => renderScene(sc, i, true))
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

  // ── Render ────────────────────────────────────────────────────────
  const folderedScenes = folders.map(f => ({
    folder: f,
    scenes: filtered.filter(s => s.folder_id === f.id),
  }))
  const unfiled = filtered.filter(s => !s.folder_id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Search bar ── */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 8l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            className="finput"
            style={{ padding: '6px 28px 6px 28px', fontSize: '11px' }}
            placeholder="Search scenes…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ('')} style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer',
              padding: '2px', fontSize: '11px', lineHeight: 1, display: 'flex',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>

        {!hasCampaign && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '0.3px' }}>
            No campaign selected
          </div>
        )}
        {hasCampaign && !filtered.length && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '0.3px' }}>
            {q ? 'No scenes match' : 'No scenes yet'}
          </div>
        )}

        {/* New folder inline input */}
        {creatingFolder && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            margin: '2px 8px', padding: '0 8px', height: '34px',
            borderRadius: '8px', border: '1px solid rgba(201,168,76,0.4)',
            background: 'rgba(201,168,76,0.05)', animation: 'sceneIn 0.15s ease both',
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--accent)', flexShrink: 0 }}>
              <path d="M1 3.5C1 2.67 1.67 2 2.5 2h2.17a1 1 0 0 1 .71.29L6.09 3H10.5C11.33 3 12 3.67 12 4.5v5c0 .83-.67 1.5-1.5 1.5h-8C1.67 11 1 10.33 1 9.5v-6z" stroke="currentColor" strokeWidth="1.1" fill="rgba(201,168,76,0.12)"/>
            </svg>
            <input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitNewFolder(); if (e.key === 'Escape') cancelNewFolder() }}
              onBlur={commitNewFolder}
              placeholder="Folder name…"
              className="finput"
              style={{ flex: 1, fontSize: '11px', fontWeight: 700, padding: '3px 6px', minWidth: 0 }}
            />
          </div>
        )}

        {/* Folders */}
        {hasFolders && folderedScenes.map(({ folder, scenes: fs }) => renderFolder(folder, fs))}

        {/* Unfiled section — only shown when folders exist */}
        {hasFolders && unfiled.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            {/* Unfiled header */}
            <div
              onDragOver={canDrag && dragId ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setFolderDragOver('unfiled') } : undefined}
              onDragLeave={canDrag ? () => setFolderDragOver(p => p === 'unfiled' ? null : p) : undefined}
              onDrop={canDrag && dragId ? e => {
                e.preventDefault()
                if (dragId && onMoveToFolder) onMoveToFolder(dragId, null)
                setDragId(null); setFolderDragOver(null)
              } : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                margin: '2px 8px', padding: '0 8px', height: '28px',
                borderRadius: '6px',
                background: folderDragOver === 'unfiled' ? 'rgba(139,159,232,0.1)' : 'transparent',
                border: `1px solid ${folderDragOver === 'unfiled' ? 'rgba(139,159,232,0.4)' : 'transparent'}`,
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                Unfiled
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-3)', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 6px' }}>
                {unfiled.length}
              </span>
            </div>
            {unfiled.map((sc, i) => renderScene(sc, i, false))}
          </div>
        )}

        {/* Flat list — no folders yet */}
        {!hasFolders && filtered.map((sc, i) => renderScene(sc, i, false))}

        {/* Buttons */}
        {hasCampaign && (
          <div style={{ margin: '8px 8px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {onFolderCreate && (
              <AddFolderButton
                onClick={() => { setCreatingFolder(true); setNewFolderName('') }}
                disabled={creatingFolder}
              />
            )}
            <AddSceneButton onClick={onAdd} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes sceneIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function FolderActionButton({ title, onClick, isTouchDevice, children }: {
  title: string
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  isTouchDevice: boolean
  children: ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => !isTouchDevice && setHov(true)}
      onMouseLeave={() => !isTouchDevice && setHov(false)}
      style={{
        width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
        background: hov ? 'rgba(201,168,76,0.1)' : 'transparent',
        border: `1px solid ${hov ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
        color: hov ? 'var(--accent)' : 'var(--text-3)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s ease',
      }}
    >
      {children}
    </button>
  )
}

function AddFolderButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false)
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !isTouchDevice && setHov(true)}
      onMouseLeave={() => !isTouchDevice && setHov(false)}
      style={{
        width: '100%', height: isTouchDevice ? '48px' : '38px', borderRadius: '10px',
        touchAction: 'manipulation',
        border: `1px dashed ${hov ? 'rgba(139,159,232,0.5)' : 'var(--border-lt)'}`,
        background: hov ? 'rgba(139,159,232,0.04)' : 'transparent',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        color: hov ? 'var(--accent-2)' : 'var(--text-3)',
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px',
        transition: 'all 0.15s ease',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M1 3.5C1 2.67 1.67 2 2.5 2h2.17a1 1 0 0 1 .71.29L6.09 3H10.5C11.33 3 12 3.67 12 4.5v5c0 .83-.67 1.5-1.5 1.5h-8C1.67 11 1 10.33 1 9.5v-6z" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M6.5 5.5v3M5 7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      New Folder
    </button>
  )
}

function AddSceneButton({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => !isTouchDevice && setHov(true)}
      onMouseLeave={() => !isTouchDevice && setHov(false)}
      style={{
        width: '100%', height: isTouchDevice ? '60px' : '52px', borderRadius: '10px',
        touchAction: 'manipulation',
        border: `1px dashed ${hov ? 'rgba(201,168,76,0.5)' : 'var(--border-lt)'}`,
        background: hov ? 'rgba(201,168,76,0.04)' : 'transparent',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        color: hov ? 'var(--accent)' : 'var(--text-3)',
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px',
        transition: 'all 0.15s ease',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7 4.5v5M4.5 7h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
      New Scene
    </button>
  )
}
