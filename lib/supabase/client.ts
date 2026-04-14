import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,       // keep session in localStorage
        autoRefreshToken: true,     // silently refresh before expiry
        detectSessionInUrl: true,   // handle magic link / OAuth callbacks
      },
    }
  )
}
