'use client'

// Campaign data hook.
//
// Owns the persistent backend slice of the campaign UI: campaigns, scenes,
// folders, characters, tags, sounds, and the live session (incl. its Realtime
// subscription). Returns the data along with setters/refresh helpers so the
// page can push CRUD results back without re-fetching.
//
// Stays out of:
//   - active scene/handout selection (UI state)
//   - stage character framing (slotScales, slotDisplayProps, activeOverlays)
//   - editor modal state, toasts, confirm modals
//
// Those live in the page because they're either ephemeral UI or tightly
// coupled to user action handlers.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  resolveCampaignCovers,
  resolveCharacterUrls,
  resolveSceneUrls,
  resolveSoundUrls,
} from '@/lib/supabase/storage'
import type {
  Campaign,
  CampaignSound,
  CampaignTag,
  Character,
  CharacterState,
  Scene,
  SceneFolder,
} from '@/lib/types'

interface ActiveCharacters {
  left:   Character | null
  center: Character | null
  right:  Character | null
}

interface SceneCharacterRow {
  character_id: string | null
  scale?:       number  | null
  zoom?:        number  | null
  pan_x?:       number  | null
  pan_y?:       number  | null
  flipped?:     boolean | null
  character?:   Character | null
}

interface SceneRow extends Scene {
  // The Postgres `scene_overlays` join column comes back under that key but
  // we expose it on the Scene type as `overlays`.
  scene_overlays?: Scene['overlays']
}

export interface UseCampaignData {
  // ── Persistent data ──
  campaigns:           Campaign[]
  scenes:              Scene[]
  folders:             SceneFolder[]
  campaignCharacters:  Character[]
  campaignTags:        CampaignTag[]
  campaignSounds:      CampaignSound[]
  loading:             boolean

  // ── Live session ──
  sessionId:           string | null
  joinCode:            string | null
  isLive:              boolean
  activeCharacters:    ActiveCharacters

  // ── Per-scene roster (loaded by loadSceneRoster) ──
  sceneRosterChars:         Character[]
  characterScales:          Record<string, number>
  characterDisplayDefaults: Record<string, { zoom: number; panX: number; panY: number; flipped: boolean }>

  // ── Setters (page CRUD pushes results through these) ──
  setCampaigns:                React.Dispatch<React.SetStateAction<Campaign[]>>
  setScenes:                   React.Dispatch<React.SetStateAction<Scene[]>>
  setFolders:                  React.Dispatch<React.SetStateAction<SceneFolder[]>>
  setCampaignCharacters:       React.Dispatch<React.SetStateAction<Character[]>>
  setCampaignTags:             React.Dispatch<React.SetStateAction<CampaignTag[]>>
  setCampaignSounds:           React.Dispatch<React.SetStateAction<CampaignSound[]>>
  setSessionId:                React.Dispatch<React.SetStateAction<string | null>>
  setJoinCode:                 React.Dispatch<React.SetStateAction<string | null>>
  setIsLive:                   React.Dispatch<React.SetStateAction<boolean>>
  setActiveCharacters:         React.Dispatch<React.SetStateAction<ActiveCharacters>>
  setSceneRosterChars:         React.Dispatch<React.SetStateAction<Character[]>>
  setCharacterScales:          React.Dispatch<React.SetStateAction<Record<string, number>>>
  setCharacterDisplayDefaults: React.Dispatch<React.SetStateAction<Record<string, { zoom: number; panX: number; panY: number; flipped: boolean }>>>

  // ── Imperative refresh helpers ──
  loadScenes:        (campId: string) => Promise<void>
  loadSceneRoster:   (sceneId: string) => Promise<void>
}

interface Options {
  /** Called when the user signs out from another tab. */
  onSignedOut?: () => void
  /**
   * Called once before activeCampId switches, with any scenes still in the
   * "pending delete" undo window. Lets the page flush them to the DB before
   * the previous campaign's data is replaced.
   */
  flushPendingDeletes?: () => void
  /**
   * Called when a Realtime session update reports a different active scene
   * (e.g. another DM tab switched scenes). The page owns activeSceneId so
   * we surface this as a callback rather than driving the state from here.
   */
  onActiveSceneIdChange?: (id: string) => void
}

export function useCampaignData(activeCampId: string, opts: Options = {}): UseCampaignData {
  const supabase = createClient()

  // ── Persistent data ──
  const [campaigns,          setCampaigns]          = useState<Campaign[]>([])
  const [scenes,             setScenes]             = useState<Scene[]>([])
  const [folders,            setFolders]            = useState<SceneFolder[]>([])
  const [campaignCharacters, setCampaignCharacters] = useState<Character[]>([])
  const [campaignTags,       setCampaignTags]       = useState<CampaignTag[]>([])
  const [campaignSounds,     setCampaignSounds]     = useState<CampaignSound[]>([])
  const [loading,            setLoading]            = useState(true)

  // ── Live session ──
  const [sessionId,        setSessionId]        = useState<string | null>(null)
  const [joinCode,         setJoinCode]         = useState<string | null>(null)
  const [isLive,           setIsLive]           = useState(false)
  const [activeCharacters, setActiveCharacters] = useState<ActiveCharacters>({ left: null, center: null, right: null })

  // ── Per-scene roster ──
  const [sceneRosterChars,         setSceneRosterChars]         = useState<Character[]>([])
  const [characterScales,          setCharacterScales]          = useState<Record<string, number>>({})
  const [characterDisplayDefaults, setCharacterDisplayDefaults] = useState<Record<string, { zoom: number; panX: number; panY: number; flipped: boolean }>>({})

  // Ref so the Realtime callback always reads the current roster without
  // needing campaignCharacters in the effect's dependency array (which would
  // tear down and re-subscribe the channel on every roster change).
  const campaignCharactersRef = useRef<Character[]>([])
  useEffect(() => { campaignCharactersRef.current = campaignCharacters }, [campaignCharacters])

  // Stable refs to callbacks — callers may not memoize.
  const onSignedOutRef           = useRef(opts.onSignedOut)
  const flushPendingDeletesRef   = useRef(opts.flushPendingDeletes)
  const onActiveSceneIdChangeRef = useRef(opts.onActiveSceneIdChange)
  useEffect(() => { onSignedOutRef.current           = opts.onSignedOut })
  useEffect(() => { flushPendingDeletesRef.current   = opts.flushPendingDeletes })
  useEffect(() => { onActiveSceneIdChangeRef.current = opts.onActiveSceneIdChange })

  // ── Auth: redirect on sign-out from another tab ──
  // Without this the page silently continues showing stale data.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') onSignedOutRef.current?.()
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load campaigns on mount ──
  useEffect(() => {
    supabase.from('campaigns').select('*').order('created_at')
      .then(({ data }) => { if (data) setCampaigns(resolveCampaignCovers(data)) })
      .then(() => setLoading(false), () => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load scenes + folders for the active campaign ──
  const loadScenes = useCallback(async (campId: string) => {
    const [{ data: scenesData }, { data: foldersData }] = await Promise.all([
      supabase.from('scenes').select('*, tracks(*), handouts(*), scene_overlays(*)').eq('campaign_id', campId).order('order_index'),
      supabase.from('scene_folders').select('*').eq('campaign_id', campId).order('order_index'),
    ])
    if (scenesData) {
      const mapped = (scenesData as SceneRow[]).map(s => ({ ...s, overlays: s.scene_overlays ?? [] }))
      setScenes(resolveSceneUrls(mapped))
    } else setScenes([])
    setFolders((foldersData as SceneFolder[]) || [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Give the page a chance to flush any pending deletes from the previous
    // campaign so their timers don't fire against scenes the user is no
    // longer viewing.
    flushPendingDeletesRef.current?.()
    if (activeCampId) loadScenes(activeCampId)
    else { setScenes([]); setFolders([]) }
  }, [activeCampId, loadScenes])

  // ── Load campaign characters + tags + soundboard (parallel) ──
  useEffect(() => {
    if (!activeCampId) { setCampaignCharacters([]); setCampaignTags([]); setCampaignSounds([]); return }
    Promise.all([
      supabase.from('characters').select('*').eq('campaign_id', activeCampId).order('name'),
      supabase.from('campaign_tags').select('*').eq('campaign_id', activeCampId).order('name'),
      supabase.from('campaign_sounds').select('*').eq('campaign_id', activeCampId).order('order_index'),
    ]).then(([{ data: chars }, { data: tags }, { data: sounds }]) => {
      if (chars)  setCampaignCharacters(resolveCharacterUrls(chars as Character[]))
      if (tags)   setCampaignTags(tags as CampaignTag[])
      if (sounds) setCampaignSounds(resolveSoundUrls(sounds as CampaignSound[]))
    })
  }, [activeCampId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-scene roster + framing defaults ──
  const loadSceneRoster = useCallback(async (sceneId: string) => {
    const { data } = await supabase.from('scene_characters')
      .select('*, character:characters(*)')
      .eq('scene_id', sceneId)
    if (!data) { setSceneRosterChars([]); setCharacterScales({}); setCharacterDisplayDefaults({}); return }
    const rows = data as SceneCharacterRow[]
    setSceneRosterChars(rows.map(r => r.character).filter((c): c is Character => !!c))

    const scales:      Record<string, number> = {}
    const displayDefs: Record<string, { zoom: number; panX: number; panY: number; flipped: boolean }> = {}
    rows.forEach(r => {
      if (!r.character_id) return
      scales[r.character_id]      = r.scale ?? 1
      displayDefs[r.character_id] = { zoom: r.zoom ?? 1, panX: r.pan_x ?? 50, panY: r.pan_y ?? 100, flipped: r.flipped ?? false }
    })
    setCharacterScales(scales)
    setCharacterDisplayDefaults(displayDefs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live session: load existing + clear stale character state ──
  const loadSession = useCallback(async (campId: string) => {
    const { data } = await supabase.from('sessions')
      .select('id, join_code, active_scene_id, is_live, character_state')
      .eq('campaign_id', campId).eq('is_live', true).maybeSingle()
    if (data) {
      setSessionId(data.id); setJoinCode(data.join_code); setIsLive(true)
      // Initial-load scene jump: the Realtime subscription only fires on
      // session UPDATEs, so without this the DM returning to a campaign with
      // a live session wouldn't auto-jump to the saved active scene until
      // someone updated the session row from another tab.
      if (data.active_scene_id) onActiveSceneIdChangeRef.current?.(data.active_scene_id)
      // Clear stale character state in DB — characters are placed manually each session.
      // Without this, the viewer shows leftover characters from before a page refresh.
      const cs: CharacterState = {
        left: null, center: null, right: null,
        leftScale: 1, centerScale: 1, rightScale: 1,
        leftZoom: 1, centerZoom: 1, rightZoom: 1,
        leftPanX: 50, centerPanX: 50, rightPanX: 50,
        leftPanY: 100, centerPanY: 100, rightPanY: 100,
        leftFlipped: false, centerFlipped: false, rightFlipped: false,
      }
      await supabase.from('sessions').update({ character_state: cs }).eq('id', data.id)
    } else {
      setSessionId(null); setJoinCode(null); setIsLive(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeCampId) loadSession(activeCampId)
    else { setSessionId(null); setJoinCode(null); setIsLive(false) }
  }, [activeCampId, loadSession])

  // ── Sync character state from a Realtime payload ──
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
    const [l, c, r] = await Promise.all([
      fetchIfNeeded(state.left),
      fetchIfNeeded(state.center),
      fetchIfNeeded(state.right),
    ])
    setActiveCharacters({ left: l, center: c, right: r })
  }, [supabase])

  // ── Realtime: sync from other devices ──
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel('dm-session-' + sessionId)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        payload => {
          const row = payload.new as { active_scene_id: string | null; is_live: boolean; character_state: CharacterState | null }
          if (!row.is_live) { setIsLive(false); setSessionId(null); setJoinCode(null); return }
          // activeSceneId is owned by the page (UI state) — surface scene
          // changes via callback so multi-tab DM sessions stay in sync.
          if (row.active_scene_id) onActiveSceneIdChangeRef.current?.(row.active_scene_id)
          if (row.character_state) syncCharacterState(row.character_state)
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, syncCharacterState]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    campaigns, scenes, folders, campaignCharacters, campaignTags, campaignSounds, loading,
    sessionId, joinCode, isLive, activeCharacters,
    sceneRosterChars, characterScales, characterDisplayDefaults,
    setCampaigns, setScenes, setFolders, setCampaignCharacters, setCampaignTags, setCampaignSounds,
    setSessionId, setJoinCode, setIsLive, setActiveCharacters,
    setSceneRosterChars, setCharacterScales, setCharacterDisplayDefaults,
    loadScenes, loadSceneRoster,
  }
}
