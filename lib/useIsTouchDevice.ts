'use client'

import { useState } from 'react'

/**
 * One-shot detection of whether the current device reports any touch points.
 *
 * Read once on first render via lazy initial state — `navigator` isn't
 * available during SSR, so the `typeof window` guard returns false on the
 * server. Hot-plugging touch input mid-session isn't supported (and isn't
 * a real concern on any platform we ship to).
 */
export function useIsTouchDevice(): boolean {
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  )
  return isTouchDevice
}
