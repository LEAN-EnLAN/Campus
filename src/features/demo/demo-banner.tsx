import { X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useDemo } from '@/lib/runtime/demo'

const DISMISSED_KEY = 'campus.demo.banner-dismissed'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * "Estás en la demo": on every screen of the demo, above the app, so nobody
 * types a real deadline into a workspace that forgets it. Dismissible for the
 * tab (the account menu's "Cambiar de espacio" still leaves the demo).
 */
export function DemoBanner() {
  const demo = useDemo()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [leaving, setLeaving] = useState(false)

  if (!demo.active || dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Dismissed for this render only.
    }
  }

  async function createAccount() {
    setLeaving(true)
    try {
      await demo.toCloud()
    } catch {
      // This build has no cloud to sign up in: just leave the demo.
      demo.leave()
    }
  }

  return (
    <div className="campus-blue">
      <aside
        aria-label="Demo de Campus"
        className="border-rule bg-paper-elevated text-ink flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-sm"
      >
        <p className="min-w-0 flex-1 basis-56">
          <strong className="font-medium">Estás en la demo</strong>
          <span className="text-ink-muted"> · nada se guarda</span>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={demo.leave} disabled={leaving}>
            Salir de la demo
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void createAccount()}
            disabled={leaving}
          >
            Crear cuenta gratis
          </Button>
          <Button
            variant="ghost"
            onClick={dismiss}
            aria-label="Ocultar aviso de la demo"
            size="icon"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </aside>
    </div>
  )
}
