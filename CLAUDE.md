# Reverie — Agent Map

> Companion to `README.md`. The README covers stack/install/deploy/schema basics.
> This file covers the things you have to grep around to figure out otherwise:
> architecture, file map, conventions, and gotchas.

> **Keeping this file current:** when a change would help future sessions —
> a new top-level file/hook/component, a changed convention, a new gotcha
> you spent more than ~15 min figuring out, or a schema tweak to the
> `sessions` row contract — update this file in the same PR. Fix stale
> entries when you spot them. The point is to keep the next agent from
> repeating the treasure hunt.

The product, package, repo, and Vercel project are all **Reverie**
(`github.com/jojoestar47/reverie`). Older clones may still reference
`Sceneforge` — GitHub auto-redirects, so they keep working.

## The 30-second mental model

A TTRPG DM tool. **One DM, many viewers.** Two parallel page implementations
share types and Supabase tables but render very different UIs:

- **DM page** — `app/(app)/page.tsx` + `components/Stage.tsx`. Authenticated.
  Edits campaigns/scenes/characters, drives the "stage."
- **Viewer page** — `app/view/[joinCode]/page.tsx`. Public, no auth. A read-only
  stage that mirrors what the DM is presenting.

They communicate **only through the `sessions` table**, via Supabase Realtime.
The DM writes, the viewer subscribes. No WebSocket of our own.

## Where to find things

| Looking for… | Live in… |
|---|---|
| Top-level routing, auth gate | `app/(app)/layout.tsx`, `middleware.ts` |
| DM main shell, CRUD handlers, Stage state | `app/(app)/page.tsx` (~1000 lines) |
| Viewer main shell | `app/view/[joinCode]/page.tsx` |
| Stage rendering, audio mixer, soundboard, character slots, overlays | `components/Stage.tsx` (large — split deferred) |
| Scene editor (modal) — orchestrator + 3 tabs | `components/SceneEditor/` (split into per-tab files) |
| Scene list / folders / drag-drop in sidebar | `components/SceneList.tsx` |
| Campaign characters page | `components/CharacterRoster.tsx` |
| Campaign list / new campaign / settings | `components/CampaignHome.tsx` |
| Campaign-data loading + Realtime subscription | `lib/useCampaignData.ts` |
| Spotify Web Playback SDK integration | `lib/useSpotifyPlayer.ts` |
| Supabase storage URL stamping + uploads | `lib/supabase/storage.ts` |
| Date formatter / media URL resolver / character image URL | `lib/format.ts`, `lib/media.ts` |
| Spotify type surface | `lib/spotify.ts` |
| Spotify token / search API routes | `app/api/spotify/{token,search}/route.ts` |
| All canonical types (DB row shapes + drafts) | `lib/types.ts` |
| Database schema & RLS | `supabase/migrations/*.sql` (date-prefixed, applied in order) |

## The `sessions` row contract (most important data flow)

One row per campaign at most (`UNIQUE(campaign_id)` enforced). The DM writes,
the viewer subscribes via `postgres_changes` on `id=eq.<sessionId>`.

| Column | Purpose |
|---|---|
| `id`, `campaign_id`, `join_code`, `is_live`, `created_by` | identity / lifecycle |
| `active_scene_id` | DM's currently-presented scene |
| `active_handout_id` | when set, viewer shows that handout in its lightbox |
| `active_music_track_id` | currently-selected music track (mostly for Spotify) |
| `character_state` JSONB | full character slots (left/center/right + scale/zoom/pan/flip per slot) |
| `active_overlays` JSONB | per-overlay live state `{ on, opacity }` keyed by overlay id |
| `active_sfx_event` JSONB | one-shot SFX trigger: `{ id, sound_id, played_at, volume?, stop? }` |

**SFX trigger shape:** `id` is unique-per-trigger so identical sounds re-play
register as a fresh row update. `stop: true` tells the viewer to pause every
in-flight playback of `sound_id` (used by tap-to-stop on the DM pad).

**Cross-tab DM sync:** if the DM has two tabs open, each tab subscribes to its
own session row, so scene changes / character moves in tab A surface in tab B
through the same Realtime path the viewer uses. `useCampaignData`'s
`onActiveSceneIdChange` callback exists for exactly this.

## Storage URL convention

The `scene-media` bucket is **public**. Public URLs are constructed
synchronously — no API roundtrip, no token expiry.

- `lib/supabase/storage.ts` exports `publicStorageUrl(path)` and per-collection
  resolvers (`resolveSceneUrls`, `resolveCharacterUrls`, etc.) that stamp
  `signed_url` onto every `MediaRef`-shaped field on rows after fetching them.
- The `signed_url` field is **runtime-only** — never written back to Postgres.
  `SceneEditor`'s `handleSave` strips it explicitly when persisting handouts.
- Read URLs through `mediaUrl(m)` (for `MediaRef`) or `characterImageUrl(c)`
  (for `Character`) in `lib/media.ts`. Don't reach into `m.signed_url || m.url`
  inline — that's how we ended up with five copies of the same logic.

## Conventions

- **One source of truth for shared logic.** If you find yourself writing the
  same helper in two components, move it to `lib/`. We've already paid this
  tax once (see commit `0625eba`).
- **Use `key={scene?.id}` to reset child form state on scene change** in the
  scene editor. Avoid duplicating the manual reset useEffect pattern.
- **Refs mirror state where Realtime callbacks need fresh values.** See
  `campaignCharactersRef` in `useCampaignData` and `pendingSceneDeletesRef` in
  `app/(app)/page.tsx`. The pattern: setter wrapper updates both the state and
  the ref so the channel callback never re-subscribes on stale-closure
  invalidation.
- **`memo()` is used judiciously, not by default.** `CampaignCard` and
  `CharacterCard` are memoized because they re-render in long lists.
- **Inline styles, not Tailwind.** Existing convention. Don't switch unilaterally.
- **No barrel `index.ts` exports** outside of `components/SceneEditor/` (where
  it's the orchestrator file). Keep imports explicit.

## Gotchas (in rough order of likelihood-to-bite-you)

1. **`Stage.tsx`'s audio crossfade uses two stable layers (A/B), not a `key=`
   swap.** Re-mounting a `<video>` element interrupts playback. The active
   layer's opacity goes from 0→1 while the outgoing fades 1→0. If you ever
   add a `key=` to those wrapper divs, you'll break crossfades.

2. **The Spotify SDK `ready` event doesn't reliably re-fire on subsequent
   `connect()` calls.** That's why `useSpotifyPlayer` lives at the page level
   and `disableAutoPlay` exists for the DM during live presenting (the viewer
   becomes the audio master so they don't fight over the same Spotify device).

3. **`pendingSceneDeletesRef` mirrors `pendingSceneDeletes` state.** When the
   active campaign changes, we flush pending undo-deletes via the ref before
   the React state setter has flushed. Use `setPendingDeletes()` (the wrapper
   function), not `setPendingSceneDeletes` directly.

4. **`useCampaignData`'s Realtime channel only fires on session UPDATEs, not
   the initial load.** The hook's `loadSession` calls `onActiveSceneIdChange`
   explicitly when a live session is found on load — without that, returning
   to a campaign with a live session wouldn't auto-jump to the saved scene.

5. **Stage always starts with empty character slots when a scene loads** —
   the DM places characters manually each session. The page clears
   `activeCharacters`, `slotScales`, `slotDisplayProps`, etc. on
   `activeSceneId` change. Don't try to auto-restore from the scene's saved
   roster — only the framing (zoom/pan/flip) is per-character defaulted.

6. **`SceneEditor` strips `signed_url` from handout media before persisting.**
   The runtime URL is regenerated on next read.

7. **`scene-media` is public** — RLS doesn't gate file access. RLS gates the
   metadata rows. If you need privacy-sensitive media, that's a separate bucket.

8. **Worktrees often have no `node_modules`.** If `npm run lint` / `tsc` fails
   immediately, run `npm install` in the worktree first. CI/Vercel installs
   automatically.

## Commands

```bash
npm install        # Once per fresh worktree
npm run dev        # Local dev — http://localhost:3000
npm run build      # Production build (also what Vercel runs)
npm run lint       # next lint
```

There are **no automated tests** in this repo. Vercel preview deploys are the
de-facto integration check — the bot comment on each PR runs `next build`
against the branch.

## Deploy

- **Preview:** every PR. Vercel auto-deploys on push.
- **Production:** Vercel auto-deploys when `main` is updated (typically via PR
  merge).

There is no manual deploy step. There is no staging environment.

## Supabase

The user has pre-authorized direct DB operations from this agent (see
`~/.claude/projects/.../memory/feedback_supabase_permission.md`). Apply
migrations and `execute_sql` without asking first.

Migrations live under `supabase/migrations/` and are name-prefixed with the
date the schema went in. They're applied via the Supabase MCP `apply_migration`
tool — see `mcp__22dcd3c5-...__apply_migration`.

## What NOT to do

- ❌ Don't add a new `formatDate` / `mediaUrl` / `characterImageUrl` to a
  component file. Use `lib/format.ts` / `lib/media.ts`.
- ❌ Don't add another `supabase.auth.onAuthStateChange` listener — the hook
  in `lib/useCampaignData.ts` owns the SIGNED_OUT redirect.
- ❌ Don't `key=` the audio layer wrappers in `Stage.tsx`.
- ❌ Don't persist `signed_url` to the DB. Strip it before any insert/update.
- ❌ Don't write to `sessions.character_state` from the viewer — it's DM-write,
  viewer-subscribe.
- ❌ Don't use `--amend` if a hook fails: the commit didn't happen, so the
  amend would target the previous commit.

## When in doubt, search…

- Soundboard logic: grep `Stage.tsx` for `playSfxLocal` / `stopSfxLocal` /
  `sfxAudioRef` / `onContextMenu` (right-click pad).
- Realtime subscription: grep for `postgres_changes` (only two — DM and
  viewer pages, plus `useCampaignData`).
- DM → viewer broadcast write: grep `update.*active_` or `update.*sessions`.
- A scene's content: `scenes` row + joined `tracks`, `handouts`, `scene_overlays`.
  The page fetches the join in `useCampaignData.loadScenes`.
