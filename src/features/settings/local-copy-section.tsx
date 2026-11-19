import { HardDriveDownload } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useLocalCopy, type LocalCopyValue } from '@/lib/runtime/local-copy'

const ONE_WAY_NOTE =
  'Es una copia de un solo sentido: lo que cambies en esa carpeta todavía no se sube a la nube, y la próxima copia lo reemplaza.'

function statusLine(copy: LocalCopyValue): string | null {
  if (copy.status === 'copying') return 'Copiando…'
  if (copy.status === 'error') return `No pudimos copiar: ${copy.error ?? 'probá de nuevo'}.`
  if (copy.lastCopiedAt) {
    const time = copy.lastCopiedAt.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `Última copia: hoy a las ${time}.`
  }
  return null
}

/**
 * Ajustes → "Copia en esta computadora". Renders nothing where a local copy
 * does not apply (a local workspace, the demo, a build without folder access).
 */
export function LocalCopySection() {
  const copy = useLocalCopy()
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  if (!copy) return null

  const on = copy.enabled === true
  const line = on ? statusLine(copy) : null

  async function turnOn() {
    if (!copy) return
    setBusy(true)
    try {
      await copy.enable()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="border-rule bg-paper-elevated space-y-3 rounded-lg border p-5"
    >
      <h2 id={titleId} className="text-ink font-medium">
        Copia en esta computadora
      </h2>
      <p className="text-ink-muted text-sm">
        Guardá también una copia de tus materias y fechas en una carpeta de esta computadora,
        como archivos que podés abrir sin Campus. Se actualiza sola cuando cambiás algo.
      </p>
      {on && copy.folder ? (
        <p className="text-sm">
          Carpeta: <code className="text-xs break-all">{copy.folder}</code>
        </p>
      ) : null}
      <p className="text-ink-muted text-xs">{ONE_WAY_NOTE}</p>
      <p
        aria-live="polite"
        className={copy.status === 'error' ? 'text-danger text-sm' : 'text-sm'}
      >
        {line}
      </p>
      <div className="flex flex-wrap gap-2">
        {on ? (
          <>
            <Button
              variant="secondary"
              onClick={() => void copy.copyNow()}
              disabled={copy.status === 'copying'}
            >
              Copiar ahora
            </Button>
            <Button variant="ghost" onClick={copy.disable}>
              Dejar de guardar la copia
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void turnOn()} disabled={busy}>
            <HardDriveDownload aria-hidden="true" />
            Guardar también una copia en esta computadora
          </Button>
        )}
      </div>
    </section>
  )
}

/**
 * The once-per-device question, after signing in to the cloud on a computer
 * that can keep a folder. Answered either way, it does not come back here;
 * Ajustes can change it later.
 */
export function LocalCopyPrompt() {
  const copy = useLocalCopy()
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  if (!copy?.shouldAsk) return null

  async function accept() {
    if (!copy) return
    setBusy(true)
    try {
      await copy.enable()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="campus-blue">
      <aside
        aria-labelledby={titleId}
        className="border-rule bg-paper-elevated text-ink flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm"
      >
        <div className="min-w-0 flex-1 basis-64">
          <h2 id={titleId} className="font-medium">
            ¿Guardar también una copia en esta computadora?
          </h2>
          <p className="text-ink-muted text-xs">
            Tus materias y fechas, como archivos en una carpeta tuya. {ONE_WAY_NOTE}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={copy.disable} disabled={busy}>
            No, solo en la nube
          </Button>
          <Button variant="primary" size="sm" onClick={() => void accept()} disabled={busy}>
            Sí, guardar una copia
          </Button>
        </div>
      </aside>
    </div>
  )
}
