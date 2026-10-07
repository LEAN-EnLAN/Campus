/**
 * The two values Campus needs from the build. They are inlined by Vite at BUILD
 * time, so on a hosted deployment a missing one means a redeploy, not a restart.
 */
export const REQUIRED_SUPABASE_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

export function missingSupabaseConfig(
  env: Partial<Record<(typeof REQUIRED_SUPABASE_ENV)[number], string | undefined>>,
): string[] {
  return REQUIRED_SUPABASE_ENV.filter((name) => (env[name] ?? '').trim().length === 0)
}
