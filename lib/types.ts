export interface Campaign {
  id: string
  user_id: string
  name: string
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
  position: 'left' | 'right'
  created_at: string
  character?: Character   // joined
}

// Live character state stored in sessions.character_state
export interface CharacterState {
  left:  string | null   // character ID or null
  right: string | null
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
