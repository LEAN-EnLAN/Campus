import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/styles/globals.css'

import { demoRequested } from '@/lib/demo/session'

import { missingSupabaseConfig } from './config-check'
import { ConfigError } from './config-error'

/**
 * Entry point. Decides, before anything reaches Supabase, whether the build can
 * run at all. A missing config renders a readable screen; otherwise the app
 * loads as before.
 *
 * The one exception is the demo: it needs no cloud, so `/demo` runs on a build
 * without the values too. Everything else on such a build still gets the
 * config error — the demo is not a way around it.
 */
const missing = missingSupabaseConfig(import.meta.env)

if (missing.length > 0 && !demoRequested()) {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('No se encontró el elemento #root')
  createRoot(rootElement).render(
    <StrictMode>
      <ConfigError missing={missing} />
    </StrictMode>,
  )
} else {
  void import('./app-entry')
}
