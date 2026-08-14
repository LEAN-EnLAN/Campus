import { createClient } from '@supabase/supabase-js'

/**
 * The one Supabase client.
 *
 * Anon key only. `SUPABASE_SERVICE_ROLE_KEY` must never appear under `src/` and
 * must never be prefixed with `VITE_` — see the campus-supabase skill.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y ' +
      'completalos con los valores que imprime `pnpm db:start`.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
