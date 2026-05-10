// Smooth audio crossfades for music-track switching. Without these,
// switching tracks during a live presentation does a hard pause + reset
// then a hard play, which sounds like a stutter — especially when the
// incoming track hasn't finished buffering yet.
//
// Used by both the viewer (the audio master during live) and the DM stage
// (for non-live local previewing).

const DEFAULT_FADE_MS = 500
const STEP_MS         = 25

export interface FadeHandle {
  cancel(): void
  /** Resolves when the fade completes — or immediately on cancel. */
  done: Promise<void>
}

/** Crossfade between two HTMLAudioElements. The outgoing element is paused
 *  and reset (currentTime=0) once the fade completes; its volume is restored
 *  so the next play starts at the user-set level. The incoming element is
 *  ensured to be playing (calls play() if paused) before the ramp begins.
 *  Either side can be null for a one-sided fade-in or fade-out. */
export function crossfadeAudio(
  from: HTMLAudioElement | null,
  to:   HTMLAudioElement | null,
  toVolume: number,
  durationMs = DEFAULT_FADE_MS,
): FadeHandle {
  const startFromVol = from?.volume ?? 0
  const steps = Math.max(1, Math.round(durationMs / STEP_MS))
  let cancelled = false
  let i = 0
  let resolveDone!: () => void
  const done = new Promise<void>(res => { resolveDone = res })

  if (to) {
    to.volume = 0
    if (to.paused) to.play().catch(() => {})
  }

  const id = setInterval(() => {
    if (cancelled) return
    i++
    const t = i / steps
    if (from) from.volume = clamp01(startFromVol * (1 - t))
    if (to)   to.volume   = clamp01(toVolume * t)
    if (i >= steps) {
      clearInterval(id)
      if (from) {
        try { from.pause(); from.currentTime = 0 } catch {}
        // Restore so the next manual play starts at the user-set level
        from.volume = clamp01(startFromVol)
      }
      if (to) to.volume = clamp01(toVolume)
      resolveDone()
    }
  }, STEP_MS)

  return {
    cancel() {
      if (cancelled) return
      cancelled = true
      clearInterval(id)
      resolveDone()
    },
    done,
  }
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }
