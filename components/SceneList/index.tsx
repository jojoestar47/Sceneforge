'use client'

// Scene-list orchestrator. Owns all the state — search, drag/hover, folder
// open/closed, in-progress folder rename — and threads it down to SceneCard
// and FolderRow. Per-scene rendering lives in SceneCard; the folder header +
// dropdown menu live in FolderRow.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Scene, SceneFolder } from '@/lib/types'
import { useIsTouchDevice } from '@/lib/useIsTouchDevice'
import SceneCard  from './SceneCard'
import FolderRow  from './FolderRow'

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

export default function SceneList({
  scenes, folders, activeSceneId, hasCampaign,
  onSelect, onDelete, onEdit, onAdd, onReorder, onFolderReorder,
  createFolderOpen, onCreateFolderOpenChange,
  onFolderCreate, onFolderRename, onFolderDelete, onFolderColor, onMoveToFolder,
}: Props) {
  // ── Search ──────────────────────────────────────────────────────
  const [q,          setQ]          = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  // ── Drag/hover state shared across SceneCards and FolderRows ────
  const [dragId,         setDragId]         = useState<string | null>(null)
  const [dragOverId,     setDragOverId]     = useState<string | null>(null)
  const [folderDragOver, setFolderDragOver] = useState<string | 'unfiled' | null>(null)
  const [hoveredId,      setHoveredId]      = useState<string | null>(null)
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)

  // ── Folder open/closed set ──────────────────────────────────────
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())

  // ── New-folder inline input ─────────────────────────────────────
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName,  setNewFolderName]  = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  const isTouchDevice = useIsTouchDevice()

  // Auto-open only newly *created* folders, not the initial campaign load
  const prevFolderIds  = useRef<Set<string>>(new Set())
  const folderLoadDone = useRef(false)
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

  useEffect(() => { if (creatingFolder) newFolderInputRef.current?.focus() }, [creatingFolder])

  // Sync with external trigger (header button in page.tsx)
  useEffect(() => { if (createFolderOpen) setCreatingFolder(true) }, [createFolderOpen])

  // Debounce the search input so filtering / folder-opening doesn't run on every keystroke.
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

  // ── Drag handlers (shared by every SceneCard) ──
  function handleSceneDragStart(id: string, e: React.DragEvent) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  function handleSceneDragOver(id: string, e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragId) setDragOverId(id)
  }
  function handleSceneDragLeave(id: string) {
    setDragOverId(p => p === id ? null : p)
  }
  function handleSceneDrop(targetId: string, e: React.DragEvent) {
    e.preventDefault()
    if (dragId && dragId !== targetId && onReorder) onReorder(dragId, targetId)
    setDragId(null); setDragOverId(null)
  }
  function handleSceneDragEnd() {
    setDragId(null); setDragOverId(null)
  }

  // ── Render ──────────────────────────────────────────────────────
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
        {hasFolders && folderedScenes.map(({ folder, scenes: fs }, i) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            folderScenes={fs}
            folderIndex={i}
            folders={folders}
            isOpen={openFolders.has(folder.id)}
            isDragTarget={folderDragOver === folder.id}
            isHovFolder={hoveredFolderId === folder.id}
            isTouchDevice={isTouchDevice}
            canDrag={canDrag}
            hasActiveDrag={!!dragId}
            onToggleOpen={toggleFolder}
            onHoverChange={setHoveredFolderId}
            onFolderRename={onFolderRename}
            onFolderDelete={onFolderDelete}
            onFolderColor={onFolderColor}
            onFolderReorder={onFolderReorder}
            onMoveToFolder={onMoveToFolder}
            onAdd={onAdd}
            onFolderDragOverChange={setFolderDragOver}
            activeSceneId={activeSceneId}
            onSelect={onSelect}
            onDelete={onDelete}
            onEdit={onEdit}
            onReorder={onReorder}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
            dragId={dragId}
            dragOverId={dragOverId}
            canReorder={canReorder}
            onSceneDragStart={handleSceneDragStart}
            onSceneDragOver={handleSceneDragOver}
            onSceneDragLeave={handleSceneDragLeave}
            onSceneDrop={handleSceneDrop}
            onSceneDragEnd={handleSceneDragEnd}
            allScenes={scenes}
          />
        ))}

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
            {unfiled.map((sc, i) => (
              <SceneCard
                key={sc.id}
                sc={sc}
                idx={i}
                inFolder={false}
                groupIdx={i}
                groupSize={unfiled.length}
                num={scenes.indexOf(sc) + 1}
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
                onDragStart={handleSceneDragStart}
                onDragOver={handleSceneDragOver}
                onDragLeave={handleSceneDragLeave}
                onDrop={handleSceneDrop}
                onDragEnd={handleSceneDragEnd}
                prevInGroup={unfiled[i - 1]}
                nextInGroup={unfiled[i + 1]}
              />
            ))}
          </div>
        )}

        {/* Flat list — no folders yet */}
        {!hasFolders && filtered.map((sc, i) => (
          <SceneCard
            key={sc.id}
            sc={sc}
            idx={i}
            inFolder={false}
            groupIdx={i}
            groupSize={filtered.length}
            num={scenes.indexOf(sc) + 1}
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
            onDragStart={handleSceneDragStart}
            onDragOver={handleSceneDragOver}
            onDragLeave={handleSceneDragLeave}
            onDrop={handleSceneDrop}
            onDragEnd={handleSceneDragEnd}
            prevInGroup={filtered[i - 1]}
            nextInGroup={filtered[i + 1]}
          />
        ))}

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
