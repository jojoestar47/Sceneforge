'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Scene, SceneFolder } from '@/lib/types'
import { thumbUrl } from '@/lib/supabase/storage'
import AppIcon from '@/components/AppIcon'

interface Props {
  scenes:                  Scene[]
  folders:                 SceneFolder[]
  activeSceneId:           string | null
  hasCampaign:             boolean
  onSelect:                (id: string) => void
  onDelete:                (id: string) => void
  onEdit:                  (id: string) => void
  onAdd:                   (folderId?: string | null) => void
  onReorder?:              (dragId: string, targetId: string) => void
  onFolderReorder?:        (dragId: string, targetId: string) => void
  createFolderOpen?:       boolean
  onCreateFolderOpenChange?: (open: boolean) => void
  onFolderCreate?:         (name: string) => void
  onFolderRename?:         (id: string, name: string) => void
  onFolderDelete?:         (id: string) => void
  onFolderColor?:          (id: string, color: string) => void
  onMoveToFolder?:         (sceneId: string, folderId: string | null) => void
}

function mediaUrl(m: Scene['bg'], thumbWidth?: number): string | null {
  if (!m) return null
  const url = m.signed_url || m.url || null
  if (url && thumbWidth) return thumbUrl(url, thumbWidth)
  return url
}

export default function SceneList({
  scenes, folders, activeSceneId, hasCampaign,
  onSelect, onDelete, onEdit, onAdd, onReorder, onFolderReorder,
  createFolderOpen, onCreateFolderOpenChange,
  onFolderCreate, onFolderRename, onFolderDelete, onFolderColor, onMoveToFolder,
}: Props) {
  const [q,               setQ]               = useState('')
  const [debouncedQ,      setDebouncedQ]      = useState('')
  const [dragId,          setDragId]          = useState<string | null>(null)
  const [dragOverId,      setDragOverId]      = useState<string | null>(null)
  const [folderDragOver,  setFolderDragOver]  = useState<string | 'unfiled' | null>(null)
  const [hoveredId,       setHoveredId]       = useState<string | null>(null)
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const [openFolders,     setOpenFolders]     = useState<Set<string>>(new Set())
  const [renamingId,      setRenamingId]      = useState<string | null>(null)
  const [renameVal,       setRenameVal]       = useState('')
  const [creatingFolder,  setCreatingFolder]  = useState(false)
  const [newFolderName,   setNewFolderName]   = useState('')
  const [menuFolderId,    setMenuFolderId]    = useState<string | null>(null)
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )

  const renameInputRef    = useRef<HTMLInputElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const prevFolderIds     = useRef<Set<string>>(new Set())
  const folderLoadDone    = useRef(false)

  // Auto-open only newly *created* folders, not the initial campaign load
  useEffect(() => {
    if (folders.length === 0) {
      folderLoadDone.current = false
      prevFolderIds.current  = new Set()
      return
    }
    if (!folderLoadDone.current) {
      // First non-empty load — record IDs silently, start all closed
      folderLoadDone.current = true
      prevFolderIds.current  = new Set(folders.map(f => f.id))
      return
    }
    const newIds = folders.filter(f => !prevFolderIds.current.has(f.id)).map(f => f.id)
    if (newIds.length) {
      setOpenFolders(prev => { const n = new Set(prev); newIds.forEach(id => n.add(id)); return n })
    }
    prevFolderIds.current = new Set(folders.map(f => f.id))
  }, [folders])

  useEffect(() => { if (renamingId) renameInputRef.current?.focus() }, [renamingId])
  useEffect(() => { if (creatingFolder) newFolderInputRef.current?.focus() }, [creatingFolder])

  // Sync with external trigger (header button in page.tsx)
  useEffect(() => { if (createFolderOpen) setCreatingFolder(true) }, [createFolderOpen])

  // Close folder menu on outside click
  useEffect(() => {
    if (!menuFolderId) return
    const close = (e: globalThis.MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-folder-menu]')) setMenuFolderId(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuFolderId])

  // Debounce the search input so filtering/folder-opening doesn't run on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 150)
    return () => clearTimeout(t)
  }, [q])

  // Auto-open any folder whose scenes match the current search query
  useEffect(() => {
    if (!debouncedQ) return
    const ql = debouncedQ.toLowerCase()
    const matchingFolderIds = new Set<string>()
    for (const s of scenes) {
      if (s.folder_id && s.name.toLowerCase().includes(ql)) matchingFolderIds.add(s.folder_id)
    }
    if (matchingFolderIds.size > 0) {
      setOpenFolders(prev => { const n = new Set(prev); matchingFolderIds.forEach(id => n.add(id)); return n })
    }
  }, [debouncedQ, scenes])

  const filtered = useMemo(() => {
    if (!debouncedQ) return scenes
    const ql = debouncedQ.toLowerCase()
    return scenes.filter(s => s.name.toLowerCase().includes(ql))
  }, [scenes, debouncedQ])
  const canDrag    = !debouncedQ && !!onReorder && !isTouchDevice
  const canReorder = !debouncedQ && !!onReorder
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
    onCreateFolderOpenChange?.(false)
  }

  function cancelNewFolder() {
    setCreatingFolder(false)
    setNewFolderName('')
    onCreateFolderOpenChange?.(false)
  }

  // Scene card shared across folder and unfiled sections
  function renderScene(sc: Scene, idx: number, inFolder: boolean, sceneGroup: Scene[]) {
    const active     = sc.id === activeSceneId
    const bgUrl      = mediaUrl(sc.bg, 400)
    const musicN     = (sc.tracks || []).filter(t => t.kind === 'music' || t.kind === 'ml2' || t.kind === 'ml3').length
    const ambN       = (sc.tracks || []).filter(t => t.kind === 'ambience').length
    const isDragging = sc.id === dragId
    const isOver     = sc.id === dragOverId && sc.id !== dragId
    const isHov      = hoveredId === sc.id
    const num        = scenes.indexOf(sc) + 1
    const groupIdx   = sceneGroup.indexOf(sc)
    const canMoveUp   = canReorder && groupIdx > 0
    const canMoveDown = canReorder && groupIdx < sceneGroup.length - 1

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
                  onClick={e => { e.stopPropagation(); if (canMoveUp) onReorder!(sc.id, sceneGroup[groupIdx - 1].id) }}
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
                  onClick={e => { e.stopPropagation(); if (canMoveDown) onReorder!(sc.id, sceneGroup[groupIdx + 1].id) }}
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
                  onClick={e => { e.stopPropagation(); if (canMoveUp) onReorder!(sc.id, sceneGroup[groupIdx - 1].id) }}
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
                  onClick={e => { e.stopPropagation(); if (canMoveDown) onReorder!(sc.id, sceneGroup[groupIdx + 1].id) }}
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

  // Folder row with animated expand/collapse
  function renderFolder(folder: SceneFolder, folderScenes: Scene[], folderIndex: number) {
    const isOpen       = openFolders.has(folder.id)
    const isRenaming   = renamingId === folder.id
    const isDragTarget = folderDragOver === folder.id
    const color        = folder.color || null
    const iconColor    = color || (isOpen ? 'var(--accent)' : 'var(--text-3)')
    const iconFill     = isOpen ? (color ? `${color}22` : 'rgba(201,168,76,0.12)') : 'none'
    const isHovFolder  = hoveredFolderId === folder.id
    const canMoveUp    = !!onFolderReorder && folderIndex > 0
    const canMoveDown  = !!onFolderReorder && folderIndex < folders.length - 1

    const menuOpen = menuFolderId === folder.id

    return (
      <div key={folder.id} style={{ marginBottom: '2px', position: 'relative' }}>
        {/* ── Folder header ── */}
        <div
          onMouseEnter={() => !isTouchDevice && setHoveredFolderId(folder.id)}
          onMouseLeave={() => !isTouchDevice && setHoveredFolderId(p => p === folder.id ? null : p)}
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
            background: isDragTarget ? 'rgba(201,168,76,0.08)' : 'transparent',
            border: `1px solid ${isDragTarget ? 'rgba(201,168,76,0.4)' : 'transparent'}`,
            boxShadow: color ? `inset 3px 0 0 ${color}` : 'none',
            transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.2s ease',
          }}
        >
          {/* Chevron */}
          <div onClick={() => !isRenaming && toggleFolder(folder.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ color: iconColor, transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), color 0.2s ease', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Folder icon */}
          <div onClick={() => !isRenaming && toggleFolder(folder.id)} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: iconColor, transition: 'color 0.2s ease' }}>
              <path d="M1 3.5C1 2.67 1.67 2 2.5 2h2.17a1 1 0 0 1 .71.29L6.09 3H10.5C11.33 3 12 3.67 12 4.5v5c0 .83-.67 1.5-1.5 1.5h-8C1.67 11 1 10.33 1 9.5v-6z" stroke="currentColor" strokeWidth="1.1" fill={iconFill}/>
            </svg>
          </div>

          {/* Name */}
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
          {!isRenaming && (
            <span style={{
              fontSize: '9px', fontWeight: 700,
              color: color || 'var(--text)',
              background: color ? `${color}22` : 'rgba(255,255,255,0.1)',
              border: `1px solid ${color ? `${color}44` : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '10px', padding: '1px 6px', flexShrink: 0,
              transition: 'all 0.2s ease',
            }}>{folderScenes.length}</span>
          )}

          {/* Folder reorder arrows */}
          {!isRenaming && onFolderReorder && (
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
          )}

          {/* Ellipsis menu button */}
          {!isRenaming && (
            <button
              data-folder-menu="true"
              onClick={e => { e.stopPropagation(); setMenuFolderId(menuOpen ? null : folder.id) }}
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
              onClick={() => { setMenuFolderId(null); onAdd(folder.id) }}
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
              onClick={() => { setMenuFolderId(null); startRename(folder) }}
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
                onClick={() => { setMenuFolderId(null); onFolderDelete(folder.id) }}
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
            ? folderScenes.map((sc, i) => renderScene(sc, i, true, folderScenes))
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
        {hasFolders && folderedScenes.map(({ folder, scenes: fs }, i) => renderFolder(folder, fs, i))}

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
            {unfiled.map((sc, i) => renderScene(sc, i, false, unfiled))}
          </div>
        )}

        {/* Flat list — no folders yet */}
        {!hasFolders && filtered.map((sc, i) => renderScene(sc, i, false, filtered))}

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
