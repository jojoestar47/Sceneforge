export interface Campaign {
  id: string
  user_id: string
  name: string
  description?:      string | null
  cover_path?:       string | null
  cover_file_name?:  string | null
  cover_signed_url?: string        // resolved client-side, not stored in DB
  created_at: string
  updated_at: string
}

export interface MediaRef {
  type: 'image' | 'video'
  url?: string
  storage_path?: string
  file_name?: string
  signed_url?: string
}

export interface Scene {
  id: string
  campaign_id: string
  name: string
  location?: string
  notes?: string
  order_index: number
  bg?: MediaRef | null
  overlay?: MediaRef | null
  dynamic_music: boolean
  created_at: string
  updated_at: string
  tracks?: Track[]
}

export interface Track {
  id: string
  scene_id: string
  kind: 'music' | 'ml2' | 'ml3' | 'ambience'
  name: string
  url?: string
  storage_path?: string
  file_name?: string
  signed_url?: string
  spotify_uri?: string
  spotify_type?: 'track' | 'playlist'
  loop: boolean
  volume: number
  order_index: number
  created_at: string
}

// ── Characters ────────────────────────────────────────────────

export interface Character {
  id: string
  campaign_id: string
  name: string
  url?: string            // external URL
  storage_path?: string   // Supabase Storage path
  file_name?: string
  created_at: string
  updated_at: string
}

export interface SceneCharacter {
  id: string
  scene_id: string
  character_id: string
  position: string | null   // null for pool entries (no pre-assigned slot)
  created_at: string
  character?: Character   // joined
}

// Live character state stored in sessions.character_state
export interface CharacterState {
  left:        string | null   // character ID or null
  center:      string | null
  right:       string | null
  leftScale:   number          // display scale (0.5 – 2.5), default 1.0
  centerScale: number
  rightScale:  number
  // Image display overrides (optional for backwards compatibility)
  leftZoom?:    number   // 1.0 – 3.0
  centerZoom?:  number
  rightZoom?:   number
  leftPanX?:    number   // 0–100, transform-origin X
  centerPanX?:  number
  rightPanX?:   number
  leftPanY?:    number   // 0–100, transform-origin Y
  centerPanY?:  number
  rightPanY?:   number
  leftFlipped?:   boolean
  centerFlipped?: boolean
  rightFlipped?:  boolean
}

// ── Editor draft types ────────────────────────────────────────

export type SceneDraft = Omit<Scene, 'created_at' | 'updated_at' | 'tracks'> & {
  tracks_music:    TrackDraft[]
  tracks_ml2:      TrackDraft[]
  tracks_ml3:      TrackDraft[]
  tracks_ambience: TrackDraft[]
}

export interface TrackDraft {
  id: string
  name: string
  url?: string
  storage_path?: string
  file_name?: string
  signed_url?: string
  loop: boolean
  volume: number
}
