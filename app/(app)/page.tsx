'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveSceneUrls } from '@/lib/supabase/storage'
import type { Campaign, Scene } from '@/lib/types'
import Stage      from '@/components/Stage'
import SceneList  from '@/components/SceneList'
import AudioPanel from '@/components/AudioPanel'
import SceneEditor from '@/components/SceneEditor'

type PanelTab = 'scenes' | 'audio'

export default function AppPage() {
  const supabase = createClient()

  const [userId,          setUserId]          = useState<string>('')
  const [campaigns,       setCampaigns]       = useState<Campaign[]>([])
  const [activeCampId,    setActiveCampId]    = useState<string>('')
  const [scenes,          setScenes]          = useState<Scene[]>([])
  const [activeSceneId,   setActiveSceneId]   = useState<string>('')
  const [panelTab,        setPanelTab]        = useState<PanelTab>('scenes')
  const [editorOpen,      setEditorOpen]      = useState(false)
  const [editorSceneId,   setEditorSceneId]   = useState<string | null>(null)
  const [newCampName,     setNewCampName]      = useState('')
  const [campModalOpen,   setCampModalOpen]    = useState(false)
  const [loading,         setLoading]         = useState(true)

  // ── Auth ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // ── Load campaigns ────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at')
    if (data) setCampaigns(data)
  }, [])

  useEffect(() => {
    loadCampaigns().finally(() => setLoading(false))
  }, [loadCampaigns])

  // ── Load scenes when campaign changes ─────────────
  const loadScenes = useCallback(async (campId: string) => {
    const { data } = await supabase
      .from('scenes')
      .select('*, tracks(*)')
      .eq('campaign_id', campId)
      .order('order_index')
    if (data) {
      const resolved = await resolveSceneUrls(supabase, data as Scene[])
      setScenes(resolved)
    } else {
      setScenes([])
    }
  }, [])

  useEffect(() => {
    if (activeCampId) { setActiveSceneId(''); loadScenes(activeCampId) }
    else              { setScenes([]) }
  }, [activeCampId, loadScenes])

  const activeCampaign = campaigns.find(c => c.id === activeCampId) || null
  const activeScene    = scenes.find(s => s.id === activeSceneId)   || null
  const editorScene    = editorSceneId ? (scenes.find(s => s.id === editorSceneId) || null) : null

  // ── Campaign CRUD ─────────────────────────────────
  async function createCampaign() {
    if (!newCampName.trim()) return
    const { data } = await supabase
      .from('campaigns')
      .insert({ name: newCampName.trim(), user_id: userId })
      .select('*')
      .single()
    if (data) {
      setCampaigns(prev => [...prev, data])
      setActiveCampId(data.id)
      setNewCampName('')
      setCampModalOpen(false)
    }
  }

  async function deleteCampaign() {
    if (!activeCampId) return
    if (!confirm(`Delete campaign "${activeCampaign?.name}" and all its scenes?`)) return
    await supabase.from('campaigns').delete().eq('id', activeCampId)
    setCampaigns(prev => prev.filter(c => c.id !== activeCampId))
    setActiveCampId('')
    setScenes([])
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Scene CRUD ────────────────────────────────────
  async function deleteScene(id: string) {
    const sc = scenes.find(s => s.id === id)
    if (!sc || !confirm(`Delete scene "${sc.name}"?`)) return
    await supabase.from('scenes').delete().eq('id', id)
    setScenes(prev => prev.filter(s => s.id !== id))
    if (activeSceneId === id) setActiveSceneId('')
  }

  function handleSceneSaved(saved: Scene) {
    setScenes(prev => {
      const exists = prev.find(s => s.id === saved.id)
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]
    })
    setActiveSceneId(saved.id)
    setEditorOpen(false)
    // Re-resolve signed URLs for the saved scene
    resolveSceneUrls(supabase, [saved]).then(([resolved]) => {
      setScenes(prev => prev.map(s => s.id === resolved.id ? resolved : s))
    })
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'var(--bg)' }}>
        <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '22px', color: 'var(--accent)', letterSpacing: '2px' }}>SceneForge</div>
        <div style={{ width: '160px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '2px', animation: 'loadBar 1.2s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes loadBar { 0%{width:0%} 50%{width:80%} 100%{width:100%} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{
        height: '46px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px',
        flexShrink: 0, position: 'relative', zIndex: 10,
      }}>
        <span style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: '16px', color: 'var(--accent)', flexShrink: 0 }}>A</span>

        <select
          value={activeCampId}
          onChange={e => setActiveCampId(e.target.value)}
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'Inter,sans-serif', fontSize: '12px', padding: '5px 9px', outline: 'none', cursor: 'pointer', maxWidth: '200px' }}
        >
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
          <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">⏻</button>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Stage */}
        <Stage
          scene={activeScene}
          hasCampaign={!!activeCampId}
          onEdit={() => { setEditorSceneId(activeSceneId || null); setEditorOpen(true) }}
        />

        {/* Right panel */}
        <div style={{ width: '280px', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

          {/* Icon toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', gap: '2px', borderBottom: '1px solid var(--border)' }}>
            {(['scenes', 'audio'] as PanelTab[]).map(t => (
              <button key={t} onClick={() => setPanelTab(t)} style={{
                width: '30px', height: '30px', borderRadius: '6px', border: 'none',
                background: panelTab === t ? 'var(--bg-raised)' : 'transparent',
                color: panelTab === t ? 'var(--accent)' : 'var(--text-2)',
                fontSize: t === 'scenes' ? '14px' : '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t === 'scenes' ? '⬛' : '🎵'}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', flexShrink: 0 }}>
            {(['scenes', 'audio'] as PanelTab[]).map(t => (
              <button key={t} onClick={() => setPanelTab(t)} style={{
                flex: 1, padding: '9px 4px', textAlign: 'center',
                fontSize: '10px', fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase',
                color: panelTab === t ? 'var(--text)' : 'var(--text-2)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${panelTab === t ? 'var(--accent)' : 'transparent'}`,
                marginBottom: '-2px',
              }}>
                {t}
              </button>
            ))}
          </div>

          {/* Panel content */}
          {panelTab === 'scenes'
            ? <SceneList
                scenes={scenes}
                activeSceneId={activeSceneId}
                hasCampaign={!!activeCampId}
                onSelect={setActiveSceneId}
                onDelete={deleteScene}
                onEdit={id => { setEditorSceneId(id); setEditorOpen(true) }}
                onAdd={() => { setEditorSceneId(null); setEditorOpen(true) }}
              />
            : <AudioPanel
                scene={activeScene}
                onEditScene={() => { setEditorSceneId(activeSceneId || null); setEditorOpen(true) }}
              />
          }
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        height: '54px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        flexShrink: 0, position: 'relative',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
          {activeScene ? activeScene.name : 'No scene selected'}
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%',
            border: '2px solid var(--border-lt)', background: 'var(--bg-raised)',
            color: 'var(--accent)', fontFamily: "'Cinzel',serif",
            fontSize: '11px', fontWeight: 600, letterSpacing: '1px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>SF</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-3)' }}>
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── SCENE EDITOR ── */}
      {editorOpen && activeCampId && (
        <SceneEditor
          scene={editorScene}
          campaignId={activeCampId}
          userId={userId}
          onSave={handleSceneSaved}
          onClose={() => setEditorOpen(false)}
        />
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
              <input
                className="finput"
                placeholder="The Lost Mines of Phandelver…"
                value={newCampName}
                onChange={e => setNewCampName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCampaign()}
                autoFocus
              />
            </div>
            <div style={{ padding: '12px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setCampModalOpen(false)}>Cancel</button>
              <button className="btn btn-red" onClick={createCampaign}>Create Campaign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
