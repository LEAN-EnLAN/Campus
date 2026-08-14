import { createClient } from '@supabase/supabase-js'

/**
 * The one Supabase client.
 *
 * Anon key only. `SUPABASE_SERVICE_ROLE_KEY` must never appear under `src/` and
 * must never be prefixed with `VITE_` — see the campus-supabase skill.
 */

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!configuredUrl || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y ' +
      'completalos con los valores que imprime `pnpm db:start`.',
  )
}

/**
 * An origin-relative URL (`/supabase-api`) is resolved against wherever the page
 * was actually loaded from.
 *
 * This matters when the app is reached by more than one address. Baking an
 * absolute host in means opening the app by LAN IP still sends every request to
 * the tailnet hostname, which a device without MagicDNS cannot resolve — so the
 * app loads and then fails on every query. Relative keeps it correct on
 * localhost, a LAN IP, a tailnet IP and a MagicDNS name without a rebuild.
 */
export const supabaseUrl = configuredUrl.startsWith('/')
  ? `${window.location.origin}${configuredUrl}`
  : configuredUrl

export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
