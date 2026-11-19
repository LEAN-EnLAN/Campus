import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const configuredUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

const CONFIG_ERROR =
  'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env y ' +
  'completalos con los valores que imprime `pnpm db:start`.'

/** Whether this build carries the cloud's address and key at all. */
export const supabaseConfigured = Boolean(configuredUrl?.trim() && anonKey?.trim())

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
export const supabaseUrl =
  configuredUrl && configuredUrl.startsWith('/')
    ? `${window.location.origin}${configuredUrl}`
    : (configuredUrl ?? '')

let client: SupabaseClient | null = null

/**
 * Created on first use, not at import: the demo runs without a cloud and
 * still imports modules that mention one. A configured build behaves exactly
 * as before — the first call builds the client.
 */
function realClient(): SupabaseClient {
  if (!supabaseConfigured) throw new Error(CONFIG_ERROR)
  client ??= createClient(supabaseUrl, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The e-mail confirmation link lands on /login#access_token=…; consuming it
      // signs the student in, and the login screen then forwards them to /today.
      detectSessionInUrl: true,
    },
  })
  return client
}

/**
 * What an UNCONFIGURED build answers about auth: nobody is signed in, and no
 * session will ever arrive. Only reachable on `/demo` (main.tsx shows the
 * config error everywhere else); every other call still throws the config
 * error, so nothing can quietly pretend to be the cloud.
 */
const signedOutAuth = new Proxy(
  {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  } as Record<string, unknown>,
  {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) return target[prop]
      throw new Error(CONFIG_ERROR)
    },
  },
)

/**
 * The one Supabase client.
 *
 * Anon key only. `SUPABASE_SERVICE_ROLE_KEY` must never appear under `src/` and
 * must never be prefixed with `VITE_` — see the campus-supabase skill.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!supabaseConfigured && prop === 'auth') return signedOutAuth
    const real = realClient()
    const value: unknown = Reflect.get(real, prop, real)
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(real)
      : value
  },
})
