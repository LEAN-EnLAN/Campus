/**
 * Build-time capabilities, read in ONE place.
 *
 * A hosted build (Vercel + hosted Supabase) is a static bundle: there is no Vite
 * dev server behind it, so there is no Vault API. `VITE_CAMPUS_VAULT=off` says
 * so at build time. Everything else learns it through `RuntimeCapabilities`
 * (`vaultAvailable`) — screens never read this env var themselves.
 *
 * Both functions take the env as an argument so they are testable without
 * stubbing `import.meta.env`.
 */
export interface BuildEnv {
  VITE_CAMPUS_VAULT?: string
  VITE_CAMPUS_TESTER?: string
}

/**
 * Can this build reach a Vault API? Yes unless explicitly turned off. Only the
 * exact value `off` disables it: a typo must not silently remove local mode.
 */
export function isVaultAvailable(env: BuildEnv): boolean {
  return env.VITE_CAMPUS_VAULT !== 'off'
}

/**
 * Is the tester tooling (`/dev`, one-click login with a published password)
 * enabled? Never on a hosted build, whatever the flag says.
 */
export function isTesterEnabled(env: BuildEnv): boolean {
  return isVaultAvailable(env) && env.VITE_CAMPUS_TESTER === '1'
}
