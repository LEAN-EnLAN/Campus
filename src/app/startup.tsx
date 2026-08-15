import { useState } from 'react'

import { useRuntime } from '@/lib/runtime/context'
import { descriptorFor } from '@/lib/runtime/resolve'

/**
 * The startup surface — the ONE place allowed to talk about local and cloud as
 * choices. Every screen below the composition root asks `useBackend()` and
 * never learns which one it got.
 *
 * This is a picker and nothing else. It does not write academic context, does
 * not seed courses, does not create default state: choosing where to work and
 * setting up a degree are different acts, and onboarding owns the second one.
 */
export function Startup() {
  const { state, chooseVault, chooseCloud, forget, recent } = useRuntime()
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Still looking. NOT the same as "nothing configured": showing the picker
  // here would flash it at a student whose vault is about to open, and teach
  // them their setup was lost.
  if (state.status === 'resolving') {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <p className="text-muted-foreground">Buscando tu Vault…</p>
      </main>
    )
  }

  const open = async (target: string) => {
    setBusy(true)
    setError(null)
    try {
      await chooseVault(descriptorFor(target))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Campus</h1>
        <p className="text-muted-foreground">¿Dónde querés trabajar?</p>
      </header>

      {state.status === 'vault-missing' && (
        <section
          className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
          role="alert"
        >
          {/* Named, because the student had a working setup and is owed an
              explanation rather than a blank first-run screen. */}
          <h2 className="font-medium">No encontramos «{state.vault.name}»</h2>
          <p className="text-muted-foreground text-sm">
            La carpeta <code className="text-xs">{state.vault.path}</code> ya no está donde
            estaba. Puede que la hayas movido o renombrado. Tus notas siguen ahí: decinos dónde.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => forget(state.vault.path)}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              Quitar de recientes
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Abrir un Vault</h2>
        <p className="text-muted-foreground text-sm">
          Un Vault es una carpeta común y corriente. Campus es un invitado en ella.
        </p>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="vault-path">
            Ruta de la carpeta
          </label>
          <input
            id="vault-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/home/vos/Campus"
            className="flex-1 rounded-md border px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={busy || path.trim().length === 0}
            onClick={() => void open(path.trim())}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Abrir
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      {recent().length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Recientes</h2>
          <ul className="space-y-1">
            {recent().map((vault) => (
              <li key={vault.path} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void open(vault.path)}
                  className="truncate text-left text-sm underline-offset-4 hover:underline"
                >
                  {vault.name}
                </button>
                <button
                  type="button"
                  onClick={() => forget(vault.path)}
                  className="text-muted-foreground text-xs"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 border-t pt-6">
        <h2 className="font-medium">Campus Cloud</h2>
        <p className="text-muted-foreground text-sm">
          Sincronizado, con cuenta. Es una elección, no un plan B.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void chooseCloud()}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          Usar Campus Cloud
        </button>
      </section>
    </main>
  )
}
