export interface LibraryOverlay {
  key: string
  name: string
  category: string
  // Path in the public scene-media Supabase Storage bucket, or null until uploaded
  storage_path: string | null
  blend_mode: 'screen' | 'lighten' | 'multiply' | 'overlay'
  opacity: number
  playback_rate: number
}

export const OVERLAY_LIBRARY: LibraryOverlay[] = [
  {
    key: 'fog_thick',
    name: 'Thick Fog',
    category: 'Weather',
    storage_path: 'overlays/fog_thick.mp4',
    blend_mode: 'screen',
    opacity: 0.7,
    playback_rate: 0.6,
  },
  {
    key: 'fog_light',
    name: 'Light Mist',
    category: 'Weather',
    storage_path: 'overlays/fog_light.mp4',
    blend_mode: 'screen',
    opacity: 0.45,
    playback_rate: 0.5,
  },
  {
    key: 'rain',
    name: 'Rain',
    category: 'Weather',
    storage_path: 'overlays/rain.mp4',
    blend_mode: 'screen',
    opacity: 0.6,
    playback_rate: 1.0,
  },
  {
    key: 'embers',
    name: 'Embers',
    category: 'Fire',
    storage_path: 'overlays/embers.mp4',
    blend_mode: 'screen',
    opacity: 0.8,
    playback_rate: 0.8,
  },
  {
    key: 'smoke',
    name: 'Smoke',
    category: 'Fire',
    storage_path: 'overlays/smoke.mp4',
    blend_mode: 'screen',
    opacity: 0.5,
    playback_rate: 0.7,
  },
  {
    key: 'snow',
    name: 'Snow',
    category: 'Weather',
    storage_path: 'overlays/snow.mp4',
    blend_mode: 'lighten',
    opacity: 0.55,
    playback_rate: 0.8,
  },
  {
    key: 'magic_particles',
    name: 'Magic Particles',
    category: 'Magic',
    storage_path: 'overlays/magic_particles.mp4',
    blend_mode: 'screen',
    opacity: 0.65,
    playback_rate: 0.9,
  },
  {
    key: 'dust_motes',
    name: 'Dust Motes',
    category: 'Atmosphere',
    storage_path: 'overlays/dust_motes.mp4',
    blend_mode: 'screen',
    opacity: 0.4,
    playback_rate: 0.6,
  },
]

export const OVERLAY_CATEGORIES = [...new Set(OVERLAY_LIBRARY.map(o => o.category))]
