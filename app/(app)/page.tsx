'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveSceneUrls, resolveCampaignCovers, uploadMedia, deleteMedia, deleteMediaBatch } from '@/lib/supabase/storage'
import type { Campaign, Scene, Character, CharacterState } from '@/lib/types'
import Stage        from '@/components/Stage'
import SceneList    from '@/components/SceneList'
import SceneEditor  from '@/components/SceneEditor'
import CampaignHome from '@/components/CampaignHome'

function makeJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

interface ActiveCharacters {
  left:   Character | null
  center: Character | null
  right:  Character | null
}

export default function AppPage() {
  const supabase = createClient()

  const [userId,        setUserId]        = useState<string>('')
  const [campaigns,     setCampaigns]     = useState<Campaign[]>([])
  const [activeCampId,  setActiveCampId]  = useState<string>('')
  const [scenes,        setScenes]        = useState<Scene[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string>('')
  const [editorOpen,    setEditorOpen]    = useState(false)
  const [editorSceneId, setEditorSceneId] = useState<string | null>(null)
  const [newCampName,   setNewCampName]   = useState('')
  const [campModalOpen, setCampModalOpen] = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [copied,        setCopied]        = useState(false)

  // ── Characters ────────────────────────────────────────────────
  const [campaignCharacters, setCampaignCharacters] = useState<Character[]>([])
  const [sceneRosterChars,   setSceneRosterChars]   = useState<Character[]>([])
  // Scale per character ID (from pool) — used to auto-set slot scale when placed
  const [characterScales,    setCharacterScales]    = useState<Record<string, number>>({})
  const [slotScales,         setSlotScales]         = useState({ left: 1, center: 1, right: 1 })
  const [activeCharacters,   setActiveCharacters]   = useState<ActiveCharacters>({ left: null, center: null, right: null })
  // Ref so the Realtime callback always reads the current roster without
  // needing campaignCharacters in the effect's dependency array (which would
  // tear down and re-subscribe the channel on every roster change).
  const campaignCharactersRef = useRef<Character[]>([])

  // Mirror scenes in a ref so the URL-refresh interval always sees the latest list
  // without needing scenes in its dependency array (which would reset the timer).
  const scenesRef = useRef<Scene[]>([])
  useEffect(() => { scenesRef.current = scenes }, [scenes])

  // ── Session / Live Presenting ──────────────────────────────────
  const [sessionId,      setSessionId]      = useState<string | null>(null)
  const [joinCode,       setJoinCode]       = useState<string | null>(null)
  const [isLive,         setIsLive]         = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // ── Load campaigns ────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase.from('campaigns').select('*').order('created_at')
    if (data) {
      const resolved = await resolveCampaignCovers(supabase, data)
      setCampaigns(resolved)
    }
  }, [])

  useEffect(() => { loadCampaigns().finally(() => setLoading(false)) }, [loadCampaigns])

  // ── Load scenes ───────────────────────────────────────────────
  const loadScenes = useCallback(async (campId: string) => {
    const { data } = await supabase
      .from('scenes').select('*, tracks(*)').eq('campaign_id', campId).order('order_index')
    if (data) {
      const resolved = await resolveSceneUrls(supabase, data as Scene[])
      setScenes(resolved)
    } else setScenes([])
  }, [])

  useEffect(() => {
    if (activeCampId) { setActiveSceneId(''); loadScenes(activeCampId) }
    else setScenes([])
  }, [activeCampId, loadScenes])

  // ── Refresh signed URLs every 6 hours so media never expires mid-session ──
  useEffect(() => {
    if (!activeCampId) return
    const interval = setInterval(async () => {
      if (!scenesRef.current.length) return
      const refreshed = await resolveSceneUrls(supabase, scenesRef.current)
      setScenes(refreshed)
    }, 6 * 60 * 60 * 1000) // matches the 8h expiry with margin
    return () => clearInterval(interval)
  }, [activeCampId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the ref in sync with state so closures always see fresh data
  useEffect(() => { campaignCharactersRef.current = campaignCharacters }, [campaignCharacters])

  // ── Load campaign characters ──────────────────────────────────
  useEffect(() => {
    if (!activeCampId) { setCampaignCharacters([]); return }
    supabase.from('characters').select('*').eq('campaign_id', activeCampId).order('name')
      .then(({ data }) => { if (data) setCampaignCharacters(data as Character[]) })
  }, [activeCampId])

  // ── On scene change: clear stage slots + load this scene's character pool ──
  // Stage slots always start empty — the DM places characters manually.
  // sceneRosterChars is the pool of characters for this scene.
  // characterScales maps character_id → default scale (set in the editor).
  useEffect(() => {
    setActiveCharacters({ left: null, center: null, right: null })
    setSlotScales({ left: 1, center: 1, right: 1 })
    if (!activeSceneId) { setSceneRosterChars([]); setCharacterScales({}); return }
    supabase.from('scene_characters')
      .select('*, character:characters(*)')
      .eq('scene_id', activeSceneId)
      .then(({ data }) => {
        if (!data) { setSceneRosterChars([]); setCharacterScales({}); return }
        setSceneRosterChars(data.map(r => r.character as Character).filter(Boolean))
        const scales: Record<string, number> = {}
        data.forEach(r => { if (r.character_id) scales[r.character_id] = r.scale ?? 1 })
        setCharacterScales(scales)
      })
  }, [activeSceneId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load existing live session ────────────────────────────────
  const loadSession = useCallback(async (campId: string) => {
    const { data } = await supabase.from('sessions')
      .select('id, join_code, active_scene_id, is_live, character_state')
      .eq('campaign_id', campId).eq('is_live', true).maybeSingle()
    if (data) {
      setSessionId(data.id); setJoinCode(data.join_code); setIsLive(true)
      if (data.active_scene_id) setActiveSceneId(data.active_scene_id)
    } else {
      setSessionId(null); setJoinCode(null); setIsLive(false)
    }
  }, [])

  useEffect(() => {
    if (activeCampId) loadSession(activeCampId)
    else { setSessionId(null); setJoinCode(null); setIsLive(false) }
  }, [activeCampId, loadSession])

  // ── Sync character state from a Realtime payload ─────────────
  // Uses campaignCharactersRef (not state) so it never goes stale in the
  // Realtime callback without requiring a channel re-subscribe.
  const syncCharacterState = useCallback(async (state: CharacterState) => {
    const fetchIfNeeded = async (id: string | null): Promise<Character | null> => {
      if (!id) return null
      const found = campaignCharactersRef.current.find(c => c.id === id)
      if (found) return found
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      return data as Character | null
    }
    const [l, c, r] = await Promise.all([fetchIfNeeded(state.left), fetchIfNeeded(state.center), fetchIfNeeded(state.right)])
    setActiveCharacters({ left: l, center: c, right: r })
  }, [supabase])

  // ── Realtime: sync from other devices ────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel('dm-session-' + sessionId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { active_scene_id: string | null; is_live: boolean; character_state: CharacterState | null }
          if (!row.is_live) { setIsLive(false); setSessionId(null); setJoinCode(null); return }
          if (row.active_scene_id) setActiveSceneId(row.active_scene_id)
          if (row.character_state) syncCharacterState(row.character_state)
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, syncCharacterState])

  const activeCampaign = campaigns.find(c => c.id === activeCampId) || null
  const activeScene    = scenes.find(s => s.id === activeSceneId)   || null
  const editorScene    = editorSceneId ? (scenes.find(s => s.id === editorSceneId) || null) : null
  const viewerUrl      = typeof window !== 'undefined' && joinCode ? `${window.location.origin}/view/${joinCode}` : null
  const qrUrl          = viewerUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(viewerUrl)}&margin=12` : null

  // ── Session: Start / Stop Presenting ─────────────────────────
  async function startPresenting() {
    if (!activeCampId || !userId) return
    if (sessionId && isLive) { setShareModalOpen(true); return }
    const code = makeJoinCode()
    const cs: CharacterState = { left: activeCharacters.left?.id || null, center: activeCharacters.center?.id || null, right: activeCharacters.right?.id || null, leftScale: slotScales.left, centerScale: slotScales.center, rightScale: slotScales.right }
    const { data } = await supabase.from('sessions').upsert({
      campaign_id: activeCampId, join_code: code,
      active_scene_id: activeSceneId || null, is_live: true,
      created_by: userId, character_state: cs,
    }, { onConflict: 'campaign_id' }).select('id, join_code').single()
    if (data) { setSessionId(data.id); setJoinCode(data.join_code); setIsLive(true); setShareModalOpen(true) }
  }

  async function stopPresenting() {
    if (!sessionId) return
    await supabase.from('sessions').update({ is_live: false }).eq('id', sessionId)
    setIsLive(false); setSessionId(null); setJoinCode(null)
  }

  // ── Scene + character selection ───────────────────────────────
  async function handleSelectScene(id: string) {
    setActiveSceneId(id)
    if (isLive && sessionId) {
      // Clear character state when switching scenes — DM places characters
      // manually on the stage rather than auto-loading saved assignments.
      const cs: CharacterState = { left: null, center: null, right: null, leftScale: 1, centerScale: 1, rightScale: 1 }
      await supabase.from('sessions').update({ active_scene_id: id, character_state: cs }).eq('id', sessionId)
    }
  }

  async function handleCharactersChange(chars: ActiveCharacters) {
    // Scale follows the character — look up each character's saved scale from the pool
    const newScales = {
      left:   chars.left   ? (characterScales[chars.left.id]   ?? 1) : 1,
      center: chars.center ? (characterScales[chars.center.id] ?? 1) : 1,
      right:  chars.right  ? (characterScales[chars.right.id]  ?? 1) : 1,
    }
    setSlotScales(newScales)
    setActiveCharacters(chars)
    if (isLive && sessionId) {
      const cs: CharacterState = { left: chars.left?.id || null, center: chars.center?.id || null, right: chars.right?.id || null, leftScale: newScales.left, centerScale: newScales.center, rightScale: newScales.right }
      await supabase.from('sessions').update({ character_state: cs }).eq('id', sessionId)
    }
  }

  // ── Campaign CRUD ─────────────────────────────────────────────
  async function updateCampaignCover(campId: string, file: File) {
    const camp = campaigns.find(c => c.id === campId)
    if (!camp || !userId) return
    // Delete old cover if present
    if (camp.cover_path) await deleteMedia(supabase, camp.cover_path).catch(() => {})
    const path = await uploadMedia(supabase, userId, file)
    await supabase.from('campaigns').update({ cover_path: path, cover_file_name: file.name }).eq('id', campId)
    const { data: signedData } = await supabase.storage.from('scene-media').createSignedUrl(path, 8 * 60 * 60)
    setCampaigns(prev => prev.map(c => c.id === campId
      ? { ...c, cover_path: path, cover_file_name: file.name, cover_signed_url: signedData?.signedUrl }
      : c
    ))
  }

  async function createCampaign() {
    if (!newCampName.trim()) return
    const { data } = await supabase.from('campaigns').insert({ name: newCampName.trim(), user_id: userId }).select('*').single()
    if (data) { setCampaigns(prev => [...prev, data]); setActiveCampId(data.id); setNewCampName(''); setCampModalOpen(false) }
  }

  async function deleteCampaign() {
    if (!activeCampId) return
    if (!confirm(`Delete campaign "${activeCampaign?.name}" and all its scenes?`)) return

    // Collect all storage paths before deleting rows
    const { data: campScenes } = await supabase.from('scenes').select('id, bg, overlay').eq('campaign_id', activeCampId)
    const sceneIds = (campScenes ?? []).map(s => s.id)

    const [{ data: allTracks }, { data: allChars }] = await Promise.all([
      sceneIds.length ? supabase.from('tracks').select('storage_path').in('scene_id', sceneIds) : Promise.resolve({ data: [] }),
      supabase.from('characters').select('storage_path').eq('campaign_id', activeCampId),
    ])

    const storagePaths = [
      activeCampaign?.cover_path,
      ...(campScenes ?? []).flatMap(s => [s.bg?.storage_path, s.overlay?.storage_path]),
      ...(allTracks ?? []).map((t: { storage_path?: string | null }) => t.storage_path),
      ...(allChars ?? []).map((c: { storage_path?: string | null }) => c.storage_path),
    ].filter((p): p is string => !!p)

    await deleteMediaBatch(supabase, storagePaths).catch(() => {})

    // Delete child rows then the campaign (order respects FK constraints)
    if (sceneIds.length) {
      await supabase.from('scene_characters').delete().in('scene_id', sceneIds)
      await supabase.from('tracks').delete().in('scene_id', sceneIds)
    }
    await Promise.all([
      supabase.from('scenes').delete().eq('campaign_id', activeCampId),
      supabase.from('characters').delete().eq('campaign_id', activeCampId),
      supabase.from('sessions').delete().eq('campaign_id', activeCampId),
    ])
    await supabase.from('campaigns').delete().eq('id', activeCampId)

    setCampaigns(prev => prev.filter(c => c.id !== activeCampId))
    setActiveCampId(''); setScenes([]); setIsLive(false); setSessionId(null); setJoinCode(null)
  }

  async function signOut() { await supabase.auth.signOut(); window.location.href = '/login' }

  async function handleReorder(dragId: string, targetId: string) {
    const copy     = [...scenes]
    const fromIdx  = copy.findIndex(s => s.id === dragId)
    const toIdx    = copy.findIndex(s => s.id === targetId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const [item]   = copy.splice(fromIdx, 1)
    copy.splice(toIdx, 0, item)
    const updated  = copy.map((s, i) => ({ ...s, order_index: i }))
    setScenes(updated)
    await Promise.all(updated.map(s =>
      supabase.from('scenes').update({ order_index: s.order_index }).eq('id', s.id)
    ))
  }

  async function deleteScene(id: string) {
    const sc = scenes.find(s => s.id === id)
    if (!sc || !confirm(`Delete scene "${sc.name}"?`)) return

    // Fetch tracks before deleting so we can clean their storage files
    const { data: sceneTracks } = await supabase.from('tracks').select('storage_path').eq('scene_id', id)

    const storagePaths = [
      sc.bg?.storage_path,
      sc.overlay?.storage_path,
      ...(sceneTracks ?? []).map((t: { storage_path?: string | null }) => t.storage_path),
    ].filter((p): p is string => !!p)

    await deleteMediaBatch(supabase, storagePaths).catch(() => {})

    await supabase.from('scene_characters').delete().eq('scene_id', id)
    await supabase.from('tracks').delete().eq('scene_id', id)
    await supabase.from('scenes').delete().eq('id', id)

    setScenes(prev => prev.filter(s => s.id !== id))
    if (activeSceneId === id) setActiveSceneId('')
  }

  function handleSceneSaved(saved: Scene) {
    setScenes(prev => { const e = prev.find(s => s.id === saved.id); return e ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved] })
    handleSelectScene(saved.id)
    setEditorOpen(false)
    resolveSceneUrls(supabase, [saved]).then(([r]) => setScenes(prev => prev.map(s => s.id === r.id ? r : s)))
    // Reload campaign characters in case a new one was created
    if (activeCampId) {
      supabase.from('characters').select('*').eq('campaign_id', activeCampId).order('name')
        .then(({ data }) => { if (data) setCampaignCharacters(data as Character[]) })
    }
    // Refresh this scene's character pool — the editor may have changed entries or scales.
    supabase.from('scene_characters')
      .select('*, character:characters(*)')
      .eq('scene_id', saved.id)
      .then(({ data }) => {
        if (!data) { setSceneRosterChars([]); setCharacterScales({}); return }
        setSceneRosterChars(data.map(r => r.character as Character).filter(Boolean))
        const scales: Record<string, number> = {}
        data.forEach(r => { if (r.character_id) scales[r.character_id] = r.scale ?? 1 })
        setCharacterScales(scales)
      })
  }

  function copyUrl() {
    if (!viewerUrl) return
    navigator.clipboard?.writeText(viewerUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'var(--bg)' }}>
      <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '22px', color: 'var(--accent)', letterSpacing: '2px' }}>SceneForge</div>
      <div style={{ width: '160px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', animation: 'loadBar 1.2s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes loadBar{0%{width:0%}50%{width:80%}100%{width:100%}}`}</style>
    </div>
  )

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{ height: '46px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--bg-raised)', border: '1px solid var(--border-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>🎭</div>
        <select value={activeCampId} onChange={e => setActiveCampId(e.target.value)} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '12px', padding: '5px 9px', outline: 'none', cursor: 'pointer', maxWidth: '200px' }}>
          <option value="">Select Campaign</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => setCampModalOpen(true)}>+ New</button>
        {activeCampId && <button className="btn btn-ghost btn-sm" onClick={deleteCampaign} style={{ color: 'var(--accent)', borderColor: 'rgba(229,53,53,.4)' }}>Delete</button>}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: "'Cinzel',serif", fontSize: '14px', letterSpacing: '5px', fontWeight: 500, color: 'var(--text)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {activeCampaign ? activeCampaign.name.toUpperCase() : 'SCENEFORGE'}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {activeCampId && <button className="btn btn-red btn-sm" onClick={() => { setEditorSceneId(null); setEditorOpen(true) }}>+ Scene</button>}
          {activeCampId && !isLive && (
            <button className="btn btn-ghost btn-sm" onClick={startPresenting} style={{ borderColor: 'rgba(74,158,101,0.5)', color: '#6ec48a' }}>▶ Start Presenting</button>
          )}
          {activeCampId && isLive && (
            <>
              <button onClick={() => setShareModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(229,53,53,0.1)', border: '1px solid rgba(229,53,53,0.4)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: 'var(--accent)', fontSize: '11px', fontWeight: 700 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'livePulse 1.5s ease-in-out infinite', display: 'inline-block' }} />
                LIVE · {joinCode}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={stopPresenting} style={{ color: 'var(--accent)', borderColor: 'rgba(229,53,53,0.4)' }}>⏹ Stop</button>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">⏻</button>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      {!activeCampId ? (
        <CampaignHome
          campaigns={campaigns}
          onSelect={setActiveCampId}
          onNew={() => setCampModalOpen(true)}
          onUpdateCover={updateCampaignCover}
        />
      ) : (
        <>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <Stage
              scene={activeScene}
              hasCampaign={!!activeCampId}
              onEdit={() => { setEditorSceneId(activeSceneId || null); setEditorOpen(true) }}
              characters={activeCharacters}
              slotScales={slotScales}
              campaignCharacters={sceneRosterChars}
              onCharactersChange={handleCharactersChange}
            />
            <div style={{ width: '300px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '11px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-2)' }}>Scenes</span>
                  {scenes.length > 0 && (
                    <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1px 7px', color: 'var(--text-3)' }}>{scenes.length}</span>
                  )}
                </div>
                <button
                  onClick={() => { setEditorSceneId(null); setEditorOpen(true) }}
                  title="New scene"
                  style={{
                    width: '24px', height: '24px', borderRadius: '6px',
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    color: 'var(--text-2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', lineHeight: 1,
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(229,53,53,0.5)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(229,53,53,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
                >+</button>
              </div>
              <SceneList scenes={scenes} activeSceneId={activeSceneId} hasCampaign={!!activeCampId} onSelect={handleSelectScene} onDelete={deleteScene} onEdit={id => { setEditorSceneId(id); setEditorOpen(true) }} onAdd={() => { setEditorSceneId(null); setEditorOpen(true) }} onReorder={handleReorder} />
            </div>
          </div>

          {/* ── BOTTOM BAR ── */}
          <div style={{ minHeight: '54px', paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: '16px', paddingRight: '16px', flexShrink: 0, position: 'relative' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{activeScene ? activeScene.name : 'No scene selected'}</div>
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid var(--border-lt)', background: 'var(--bg-raised)', color: 'var(--accent)', fontFamily: "'Cinzel',serif", fontSize: '11px', fontWeight: 600, letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SF</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-3)' }}>{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</div>
          </div>
        </>
      )}

      {/* ── SCENE EDITOR ── */}
      {editorOpen && activeCampId && (
        <SceneEditor scene={editorScene} campaignId={activeCampId} userId={userId} onSave={handleSceneSaved} onClose={() => setEditorOpen(false)} />
      )}

      {/* ── SHARE / LIVE MODAL ── */}
      {shareModalOpen && joinCode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShareModalOpen(false) }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '460px', maxWidth: '94vw', boxShadow: '0 24px 70px rgba(0,0,0,.9)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'livePulse 1.5s ease-in-out infinite', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Session Live</span>
              </div>
              <button onClick={() => setShareModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '22px 24px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                {qrUrl && <div style={{ background: '#fff', borderRadius: '10px', padding: '8px', display: 'inline-block', lineHeight: 0 }}>
                  <img src={qrUrl} alt="Scan to open viewer" width={160} height={160} style={{ display: 'block', borderRadius: '4px' }} />
                </div>}
                <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.5px' }}>Scan with tablet</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '14px' }}>
                  Scan the QR code or open the URL on any device. Switch scenes from <strong style={{ color: 'var(--text)' }}>any logged-in device</strong>.
                </div>
                <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>Join Code</div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: '20px', letterSpacing: '6px', color: 'var(--accent)', fontWeight: 600 }}>{joinCode}</div>
                </div>
                <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{viewerUrl}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }} onClick={copyUrl}>{copied ? '✓ Copied!' : 'Copy URL'}</button>
                  <button className="btn btn-red" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }} onClick={() => { if (viewerUrl) window.open(viewerUrl, '_blank') }}>Open Viewer ↗</button>
                </div>
              </div>
            </div>
            <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)', borderColor: 'rgba(229,53,53,0.3)' }} onClick={() => { stopPresenting(); setShareModalOpen(false) }}>⏹ Stop Presenting</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW CAMPAIGN MODAL ── */}
      {campModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setCampModalOpen(false) }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '10px', width: '400px', maxWidth: '94vw', boxShadow: '0 24px 70px rgba(0,0,0,.85)' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>New Campaign</span>
              <button onClick={() => setCampModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <label className="flabel">Campaign Name</label>
              <input className="finput" placeholder="The Lost Mines of Phandelver…" value={newCampName} onChange={e => setNewCampName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCampaign()} autoFocus />
            </div>
            <div style={{ padding: '12px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setCampModalOpen(false)}>Cancel</button>
              <button className="btn btn-red" onClick={createCampaign}>Create Campaign</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}`}</style>
    </div>
  )
}
