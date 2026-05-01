// Editor-local draft types. These differ from the canonical types in lib/types
// because they carry transient `_file` handles for pending uploads and a few
// fields are made optional during the editing flow.

import type { Character, MediaRef, Scene } from '@/lib/types'

export type Kind   = 'music' | 'ml2' | 'ml3' | 'ambience'
export type TabKey = 'scene' | 'handouts' | 'overlays'

export interface HandoutDraft {
  id?:    string
  name:   string
  media:  MediaRef | null
  _file?: File
}

export interface OverlayDraft {
  id?:           string
  name:          string
  source:        'library' | 'upload'
  library_key?:  string
  storage_path?: string
  url?:          string
  file_name?:    string
  blend_mode:    'screen' | 'lighten' | 'multiply' | 'overlay'
  opacity:       number
  playback_rate: number
  scale:         number
  pan_x:         number
  pan_y:         number
  enabled_default: boolean
  _file?:        File
}

export interface TrackDraft {
  id?:           string
  kind:          Kind
  name:          string
  url:           string
  storage_path?: string
  file_name?:    string
  spotify_uri?:  string
  spotify_type?: 'track' | 'playlist'
  loop:          boolean
  volume:        number
  _file?:        File
}

export interface CharPoolEntry {
  character: Character
  scale:     number
}

export interface Draft {
  name:           string
  location:       string
  bg:             MediaRef | null
  _bgFile?:       File
  tracks:         TrackDraft[]
  characterPool:  CharPoolEntry[]
  handouts:       HandoutDraft[]
  overlays:       OverlayDraft[]
}

export function blankDraft(scene: Scene | null): Draft {
  const existing = (kind: Kind): TrackDraft[] =>
    (scene?.tracks || []).filter(t => t.kind === kind).map(t => ({
      id:           t.id,
      kind,
      name:         t.name,
      url:          t.url || '',
      storage_path: t.storage_path,
      file_name:    t.file_name,
      spotify_uri:  t.spotify_uri,
      spotify_type: t.spotify_type,
      loop:         t.loop,
      volume:       t.volume,
    }))
  return {
    name:     scene?.name     || '',
    location: scene?.location || '',
    bg:       scene?.bg       || null,
    tracks:   [...existing('music'), ...existing('ml2'), ...existing('ml3'), ...existing('ambience')],
    characterPool: [],
    handouts: (scene?.handouts || []).map(h => ({ id: h.id, name: h.name, media: h.media })),
    overlays: (scene?.overlays || []).map(o => ({
      id:              o.id,
      name:            o.name,
      source:          o.source,
      library_key:     o.library_key  ?? undefined,
      storage_path:    o.storage_path ?? undefined,
      url:             o.url          ?? undefined,
      file_name:       o.file_name    ?? undefined,
      blend_mode:      o.blend_mode,
      opacity:         o.opacity,
      playback_rate:   o.playback_rate,
      scale:           o.scale,
      pan_x:           o.pan_x,
      pan_y:           o.pan_y,
      enabled_default: o.enabled_default,
    })),
  }
}
