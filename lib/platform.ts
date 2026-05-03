/**
 * Runtime platform sniffing for the few features where we can't progressively
 * enhance our way out of a problem (Spotify Web Playback SDK, Fullscreen API).
 *
 * iPadOS ≥13 reports the desktop UA, so we have to combine UA strings with
 * `maxTouchPoints` to catch it. Anything WebKit on iOS is affected — Chrome,
 * Edge, Firefox on iPhone/iPad are all WebKit shells with the same limits.
 */
export function isIosWebkit(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // Classic iPhone/iPod
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS desktop-mode masquerade: Mac UA + a touchscreen
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true
  return false
}
