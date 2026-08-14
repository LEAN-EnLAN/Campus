import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  },
  preview: { port: 4173, strictPort: true },
})
