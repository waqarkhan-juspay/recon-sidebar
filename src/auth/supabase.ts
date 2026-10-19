import { createClient } from '@supabase/supabase-js'

export const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
export const key: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * The shared backend for the sidebar demo, or null when it is not configured — which only
 * local development tolerates (src/auth/session.ts).
 *
 * The session lives in sessionStorage, not localStorage, so every new visit asks for a sign-in
 * again. Implicit flow: Google hands the session straight back in the URL of the tab that
 * left for it, with no verifier to keep track of in between.
 */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: window.sessionStorage,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      })
    : null
