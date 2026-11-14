import { Smartphone } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'

import { useInstallOffer } from './use-install-offer'

/**
 * "Agregar a inicio", inline at the top of the content: it scrolls away with
 * the page and never covers the tab bar, the capture button or a toast.
 */
export function InstallOfferBanner() {
  const offer = useInstallOffer()
  const titleId = useId()
  if (!offer.visible) return null

  return (
    <section
      aria-labelledby={titleId}
      className="border-rule bg-paper-elevated mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
    >
      <Smartphone aria-hidden="true" className="text-accent-ink size-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <h2 id={titleId} className="text-ink text-sm font-medium">
          Agregá Campus a tu pantalla de inicio
        </h2>
        <p className="text-ink-muted text-xs">Se abre como una app, sin buscar la pestaña.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={offer.dismiss}>
          Ahora no
        </Button>
        <Button variant="primary" size="sm" onClick={offer.install}>
          Agregar a inicio
        </Button>
      </div>
    </section>
  )
}
