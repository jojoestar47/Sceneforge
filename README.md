# SceneForge

TTRPG Scene Director — Next.js 15 + Supabase + Vercel

## Stack

| Layer    | Service                                        |
|----------|------------------------------------------------|
| Frontend | Next.js 15 (App Router, TypeScript)            |
| Database | Supabase PostgreSQL (campaigns, scenes, tracks)|
| Storage  | Supabase Storage (`scene-media` bucket)        |
| Auth     | Supabase Auth (email + password)               |
| Hosting  | Vercel                                         |

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

Open `.env.local` and fill in your Supabase project URL and anon key.
Find these at: **Supabase Dashboard → Project Settings → API**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import your repo
3. Add environment variables in Vercel's dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**

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
  url           text
  storage_path  text
  file_name     text
  loop          boolean
  volume        numeric
  order_index   integer
  created_at    timestamptz
```

All tables use Row Level Security — users only access their own data.

## Storage

Bucket: `scene-media` (private, 500 MB per file)  
Files stored at `{user_id}/{timestamp}-{random}.{ext}`  
Signed URLs generated at runtime (1-hour expiry).

---

## Project Structure

```
sceneforge/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx        # Server: checks auth
│   │   └── page.tsx          # Main SceneForge UI
│   ├── login/
│   │   └── page.tsx          # Email + password login
│   ├── auth/callback/
│   │   └── route.ts          # Auth callback handler
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
