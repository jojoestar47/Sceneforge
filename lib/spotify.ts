// Minimal Spotify type surface used by the app.
//
// We deliberately keep these narrow — only the fields useSpotifyPlayer or the
// search route actually consume. Pulling in @types/spotify-web-playback-sdk
// would be heavier than warranted, but if these grow further it's worth a look.

// ── Web Playback SDK ─────────────────────────────────────────────────────────

export interface SpotifySdkArtist  { name: string }
export interface SpotifySdkImage   { url: string }
export interface SpotifySdkAlbum   { images?: SpotifySdkImage[] }

export interface SpotifySdkTrack {
  name?:    string
  artists?: SpotifySdkArtist[]
  album?:   SpotifySdkAlbum
}

export interface SpotifySdkTrackWindow {
  current_track?: SpotifySdkTrack
}

export interface SpotifySdkPlayerState {
  paused:       boolean
  position:     number
  duration:     number
  track_window?: SpotifySdkTrackWindow
}

/**
 * The subset of the Web Playback SDK Player instance we actually use.
 * https://developer.spotify.com/documentation/web-playback-sdk/reference
 */
export interface SpotifySdkPlayer {
  connect():        Promise<boolean>
  disconnect():     void
  pause():          Promise<void>
  setVolume(v: number): Promise<void>
  nextTrack():      Promise<void>
  previousTrack():  Promise<void>
  getCurrentState(): Promise<SpotifySdkPlayerState | null>
  addListener(event: 'ready'                | 'not_ready', cb: (e: { device_id: string }) => void): void
  addListener(event: 'player_state_changed',                cb: (state: SpotifySdkPlayerState | null) => void): void
}

export interface SpotifySdkPlayerOptions {
  name:          string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?:       number
}

export interface SpotifySdkGlobal {
  Player: new (opts: SpotifySdkPlayerOptions) => SpotifySdkPlayer
}

// ── /api/spotify/search response ─────────────────────────────────────────────

export interface SpotifySearchTrack {
  uri:     string
  name:    string
  artist:  string
  image:   string | null
}

export interface SpotifySearchPlaylist {
  uri:    string
  name:   string
  image:  string | null
}

export interface SpotifySearchResponse {
  tracks:    SpotifySearchTrack[]
  playlists: SpotifySearchPlaylist[]
}
