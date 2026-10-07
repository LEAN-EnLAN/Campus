import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/styles/globals.css'

import { missingSupabaseConfig } from './config-check'
import { ConfigError } from './config-error'

/**
 * Entry point. Decides, before anything imports Supabase, whether the build can
 * run at all. A missing config renders a readable screen; otherwise the app
 * loads as before.
 */
const missing = missingSupabaseConfig(import.meta.env)

if (missing.length > 0) {
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
