// Global audio preferences persisted via localStorage. Currently just the
// scene-transition crossfade duration. Lives in lib/ because both the Stage
// (which consumes the value at scene-change time) and the SceneEditor (which
// renders the slider) need to read/write it.

export const CROSSFADE_DEFAULT = 1500
export const CROSSFADE_MAX     = 5000
const STORAGE_KEY              = 'sf_crossfade_ms'

export function readCrossfadePref(): number {
  if (typeof window === 'undefined') return CROSSFADE_DEFAULT
  try {
    const xf = Number(localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(xf) && xf >= 0 && xf <= CROSSFADE_MAX) return xf
  } catch {}
  return CROSSFADE_DEFAULT
}

export function writeCrossfadePref(ms: number): number {
  const clamped = Math.max(0, Math.min(CROSSFADE_MAX, Math.round(ms)))
  try { localStorage.setItem(STORAGE_KEY, String(clamped)) } catch {}
  return clamped
}
