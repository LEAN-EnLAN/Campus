/** Optional build-time flags; see `src/lib/runtime/build-flags.ts`. */
interface ImportMetaEnv {
  /** `off` on a hosted build: there is no Vault API behind a static bundle. */
  readonly VITE_CAMPUS_VAULT?: string
  /** `1` enables the tester tooling on a non-hosted build. */
  readonly VITE_CAMPUS_TESTER?: string
}

/** Build-time literal defined in `vite.config.ts` / `vitest.config.ts`. */
declare const __CAMPUS_TESTER__: boolean
