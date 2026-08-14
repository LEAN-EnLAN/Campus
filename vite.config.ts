import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ServerOptions } from 'vite'

/**
 * Serving over the tailnet — see `scripts/dev-tailnet.mjs`, which sets these.
 *
 * Browsers with HTTPS-First enabled upgrade `http://host:5173` to HTTPS and then
 * fail the handshake against a plain-HTTP dev server (ERR_SSL_PROTOCOL_ERROR), so
 * the dev server has to actually speak TLS.
 *
 * Supabase is proxied through this same origin rather than exposed on its own
 * port. That buys three things at once: no mixed content, no CORS, and the
 * database API never has to be reachable from the network at all.
 */
const certFile = process.env.CAMPUS_TLS_CERT
const keyFile = process.env.CAMPUS_TLS_KEY
const supabaseTarget = process.env.CAMPUS_SUPABASE_TARGET
const hmrHost = process.env.CAMPUS_HMR_HOST

const https: ServerOptions['https'] =
  certFile && keyFile ? { cert: readFileSync(certFile), key: readFileSync(keyFile) } : undefined

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Vite rejects Host headers it does not recognise. Allow MagicDNS names so the
    // dev server is reachable as `casa.tail<id>.ts.net`, not only by tailnet IP.
    allowedHosts: ['.ts.net'],
    ...(https ? { https } : {}),
    ...(hmrHost ? { hmr: { protocol: 'wss', host: hmrHost, clientPort: 5173 } } : {}),
    ...(supabaseTarget
      ? {
          proxy: {
            '/supabase-api': {
              target: supabaseTarget,
              changeOrigin: true,
              // Realtime is unused today, but a proxy that silently drops websocket
              // upgrades is a trap for whoever turns it on.
              ws: true,
              rewrite: (path: string) => path.replace(/^\/supabase-api/, ''),
            },
          },
        }
      : {}),
  },
  preview: { port: 4173, strictPort: true },
})
