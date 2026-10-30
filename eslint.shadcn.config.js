import { defineConfig } from 'eslint/config'
import { plugin as shadcn } from '@shadcn/lint'
import base from './eslint.config.js'

// Design-system audit. Opt-in (`pnpm lint:shadcn`), separate from `pnpm lint`
// so adopting a rule is a deliberate decision. See docs/design/DESIGN_SYSTEM.md.
export default defineConfig([
  ...base,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/routeTree.gen.ts'],
    plugins: { shadcn },
    rules: {
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-arbitrary-values': 'error',
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/require-static-classes': 'error',
      'shadcn/no-restyle': ['error', { allow: ['layout'] }],
    },
  },
  {
    // Primitives own their own styling.
    files: ['src/components/ui/**'],
    rules: { 'shadcn/no-restyle': 'off' },
  },
])
