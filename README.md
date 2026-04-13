# SceneForge

TTRPG Scene Director — Next.js 15 + Supabase + Vercel

## Stack

| Layer    | Service                                       |
|----------|-----------------------------------------------|
| Frontend | Next.js 15 (App Router, TypeScript)           |
| Database | Supabase PostgreSQL (campaigns, scenes, tracks)|
| Storage  | Supabase Storage (`scene-media` bucket)        |
| Auth     | Supabase Auth (magic link / email OTP)         |
| Hosting  | Vercel                                         |

## Supabase Project

- **Project:** sceneforge
- **URL:** https://wfndtpyrpdulqulvlnuq.supabase.co
- **Region:** us-east-1

All migrations (tables + RLS + storage bucket) have already been applied.

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo>
cd sceneforge
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

The `.env.local.example` already contains the correct values for this project.
Just rename it — no changes needed.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll be redirected to `/login`. Enter your email to receive a magic link.

---

## Deploy to Vercel

### Option A — One-click from GitHub (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Add these environment variables in Vercel's dashboard:

| Variable                        | Value                                         |
|---------------------------------|-----------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://wfndtpyrpdulqulvlnuq.supabase.co`   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(from `.env.local.example`)*                 |

5. Click **Deploy**. Done.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel
# Follow prompts, then add env vars:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```

---

## Database Schema

```
campaigns
  id           uuid PK
  user_id      uuid → auth.users
  name         text
  created_at   timestamptz
  updated_at   timestamptz

scenes
  id           uuid PK
  campaign_id  uuid → campaigns
  name         text
  location     text
  notes        text
  order_index  integer
  bg           jsonb  { type, url?, storage_path?, file_name? }
  overlay      jsonb  { type, url?, storage_path?, file_name? }
  dynamic_music boolean
  created_at   timestamptz
  updated_at   timestamptz

tracks
  id            uuid PK
  scene_id      uuid → scenes
  kind          text  (music | ml2 | ml3 | ambience)
  name          text
  url           text   -- external URL
  storage_path  text   -- Supabase Storage path
  file_name     text
  loop          boolean
  volume        numeric
  order_index   integer
  created_at    timestamptz
```

All tables have Row Level Security — users only access their own data.

## Storage

Bucket: `scene-media` (private, 500 MB per file)

Files are stored at `{user_id}/{timestamp}-{random}.{ext}`.
Signed URLs are generated at runtime (1-hour expiry) so files are
never publicly accessible without a valid session.

Accepted types: JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, OGG, WAV, FLAC, AAC, M4A

---

## Project Structure

```
sceneforge/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx        # Server: checks auth
│   │   └── page.tsx          # Main SceneForge UI
│   ├── login/
│   │   └── page.tsx          # Magic link login
│   ├── auth/callback/
│   │   └── route.ts          # OAuth/OTP callback
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── AudioPanel.tsx        # Audio playback + volume
│   ├── SceneEditor.tsx       # Alchemy-style scene editor
│   ├── SceneList.tsx         # Scene cards in right panel
│   ├── Stage.tsx             # Full-screen scene viewer
│   └── UploadZone.tsx        # Drag-and-drop file upload
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Browser Supabase client
│   │   ├── server.ts         # Server Supabase client
│   │   └── storage.ts        # Upload + signed URL helpers
│   └── types.ts              # TypeScript types
├── middleware.ts              # Auth redirect middleware
├── next.config.ts
├── package.json
└── tsconfig.json
```
