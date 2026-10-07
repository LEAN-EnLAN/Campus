import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CircularDotMatrix } from '@/components/ui/dot-matrix'

import { useRuntime } from '@/lib/runtime/context'
import { cloudUnreachableMessage } from '@/features/auth/auth-errors'
import { descriptorFor } from '@/lib/runtime/resolve'
import { vaultErrorMessage } from '@/lib/vault/error-messages'

import { suggestFolder, type FolderSuggestion } from './default-folder'
import { FolderPicker } from './folder-picker'

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
  const { state, chooseVault, chooseCloud, forget, recent, vaultAvailable, listFolders } =
    useRuntime()
  const [path, setPath] = useState('')
  const [picking, setPicking] = useState(false)
  // Where Campus can offer to keep things without asking: known once the server
  // has said where the student's top folder is. Without it the typed path is the
  // only way in, so that field starts open.
  const [suggestion, setSuggestion] = useState<FolderSuggestion | null>(null)
  const [typing, setTyping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)

  // The suggestion needs a look at the top folder; a failure only means there is
  // no one-click folder, and the picker (which reports its own failure) remains.
  useEffect(() => {
    if (!vaultAvailable || !listFolders) return
    let cancelled = false
    listFolders().then(
      (top) => {
        if (cancelled) return
        setSuggestion(suggestFolder(top))
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [vaultAvailable, listFolders])

  // Still looking. NOT the same as "nothing configured": showing the picker
  // here would flash it at a student whose vault is about to open, and teach
  // them their setup was lost.
  if (state.status === 'resolving') {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        {/* `role="status"` on the wrapper, not the dots: the sentence is what
            carries the meaning, and it is announced once when it appears. */}
        <div role="status" className="flex flex-col items-center gap-4">
          <CircularDotMatrix size={56} dotSize={6} />
          <p className="text-ink-muted text-sm">
            {vaultAvailable ? 'Buscando tu carpeta…' : 'Cargando…'}
          </p>
        </div>
      </main>
    )
  }

  const open = async (target: string, options?: { create?: boolean }) => {
    setBusy(true)
    setError(null)
    try {
      await chooseVault(descriptorFor(target), options)
    } catch (cause) {
      // A Spanish sentence chosen by the error's CODE: which mistake it was
      // (no such folder, a file, outside the allowed folders, no permission).
      // The server's own text is English and never reaches the student.
      setError(vaultErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  // Campus Cloud is a choice that can fail on its own terms, and the failure
  // has to say whose it is: no connection is the student's to fix, a silent
  // service is not. (The Vault form above keeps its own error.)
  const startCloud = async () => {
    setBusy(true)
    setCloudError(null)
    try {
      await chooseCloud()
    } catch {
      setCloudError(cloudUnreachableMessage(navigator.onLine))
    } finally {
      setBusy(false)
    }
  }

  // A hosted build has no folder API, so keeping things on this computer is not a
  // choice here: offering it would only ever end in an error. Cloud is the
  // primary action, and one sentence says where the local option does work. The
  // decision was made once, in the composition root — this branch only renders it.
  if (!vaultAvailable) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-8 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Campus</h1>
          <p className="text-ink-muted">Entrá con tu cuenta para trabajar.</p>
        </header>

        <section aria-labelledby="startup-cloud" className="space-y-3">
          <h2 id="startup-cloud" className="font-medium">
            En la nube
          </h2>
          <p className="text-ink-muted text-sm">
            Con tu cuenta ves lo mismo desde cualquier dispositivo.
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={() => void startCloud()}
          >
            Entrar o crear cuenta
          </Button>
          {cloudError ? (
            <p className="text-danger text-sm" role="alert">
              {cloudError}
            </p>
          ) : null}
        </section>

        <p className="text-ink-muted border-t pt-6 text-sm">
          Si querés guardar todo en tu computadora, abrí Campus ahí.
        </p>
      </main>
    )
  }

  // The typed path is the shortcut: closed behind a button while the picker is
  // there to do the job, and the only way in when it is not.
  const typedOpen = typing || !listFolders
  // Written the way the machine that runs Campus writes paths, never a Linux one on Windows.
  const placeholder = suggestion?.path ?? 'Pegá la ruta de tu carpeta'

  return (
    <main className="mx-auto grid min-h-dvh max-w-3xl content-center gap-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Campus</h1>
        <p className="text-ink-muted">¿Dónde querés guardar tus materias y tus notas?</p>
      </header>

      {state.status === 'vault-unavailable' && (
        <section
          className="border-danger/40 bg-danger/5 space-y-3 rounded-lg border p-4"
          role="alert"
        >
          {/* Deliberately NOT "no lo encontramos": the folder may be exactly
              where it always was. Saying what actually happened is the only way
              the student can tell "reopen it" from "go find it". */}
          <h2 className="font-medium">No pudimos abrir «{state.vault.name}»</h2>
          <p className="text-ink-muted text-sm">
            La carpeta <code className="text-xs">{state.vault.path}</code> sigue anotada, pero
            el intento falló: {state.reason}. Tus notas no se tocaron.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void open(state.vault.path)}
              className="border-rule rounded-md border px-3 py-1.5 text-sm"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => forget(state.vault.path)}
              className="border-rule rounded-md border px-3 py-1.5 text-sm"
            >
              Quitar de recientes
            </button>
          </div>
        </section>
      )}

      {state.status === 'vault-missing' && (
        <section
          className="border-warning/40 bg-warning/5 space-y-3 rounded-lg border p-4"
          role="alert"
        >
          {/* Named, because the student had a working setup and is owed an
              explanation rather than a blank first-run screen. */}
          <h2 className="font-medium">No encontramos «{state.vault.name}»</h2>
          <p className="text-ink-muted text-sm">
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

      {recent().length > 0 && (
        <section aria-labelledby="startup-recent" className="space-y-2">
          <h2 id="startup-recent" className="font-medium">
            Recientes
          </h2>
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
                  className="text-ink-muted text-xs"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section
          aria-labelledby="startup-local"
          className="border-rule bg-paper-elevated flex flex-col gap-3 rounded-lg border p-5"
        >
          <h2 id="startup-local" className="font-serif text-lg">
            En esta computadora
          </h2>
          <p className="text-ink-muted text-sm">
            Todo queda en una carpeta tuya, como cualquier otro archivo. Funciona sin internet y
            no necesitás cuenta.
          </p>

          {suggestion ? (
            <p className="text-sm">
              Carpeta: <code className="text-xs">{suggestion.label}</code>
              <span className="text-ink-muted block text-xs">Si no existe, la creamos.</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {suggestion ? (
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => void open(suggestion.path, { create: true })}
              >
                Usar esta carpeta
              </Button>
            ) : null}
            {listFolders ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setPicking(true)}
              >
                Elegir otra carpeta…
              </Button>
            ) : null}
          </div>

          {listFolders ? (
            <button
              type="button"
              aria-expanded={typedOpen}
              aria-controls="vault-path-form"
              onClick={() => setTyping((v) => !v)}
              className="text-ink-muted hover:text-ink self-start text-sm underline-offset-4 hover:underline"
            >
              Escribir la ruta a mano
            </button>
          ) : null}

          {typedOpen ? (
            <form
              id="vault-path-form"
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!busy && path.trim().length > 0) void open(path.trim())
              }}
            >
              <label className="sr-only" htmlFor="vault-path">
                Ruta de la carpeta
              </label>
              <input
                id="vault-path"
                value={path}
                onChange={(e) => {
                  setPath(e.target.value)
                  // The error was about the OLD text; left under a new one it
                  // reads as if the new path had failed too.
                  setError(null)
                }}
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'vault-path-error' : undefined}
                className="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy || path.trim().length === 0}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Abrir
              </button>
            </form>
          ) : null}

          {/* Always in the page, with a line of height reserved: the card is
              vertically centred, so an error that ADDED a line moved everything
              up. It only becomes role="alert" while there is a sentence, so the
              page never carries an empty alert next to another one (the Cloud
              section's); an alert inserted with its text is announced on insertion.
              One line for every way of choosing a folder. */}
          <p
            id="vault-path-error"
            role={error ? 'alert' : undefined}
            className="text-danger min-h-5 text-sm"
          >
            {error}
          </p>
        </section>

        <section
          aria-labelledby="startup-cloud"
          className="border-rule bg-paper-elevated flex flex-col gap-3 rounded-lg border p-5"
        >
          <h2 id="startup-cloud" className="font-serif text-lg">
            En la nube
          </h2>
          <p className="text-ink-muted text-sm">
            Entrás con tu cuenta y ves lo mismo desde la compu y el celu. Necesitás un mail y
            una contraseña.
          </p>
          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void startCloud()}
            >
              Entrar o crear cuenta
            </Button>
          </div>
          {cloudError ? (
            <p className="text-danger text-sm" role="alert">
              {cloudError}
            </p>
          ) : null}
        </section>
      </div>

      <p className="text-ink-muted border-t pt-6 text-sm">
        Tus notas son archivos de texto: te los podés llevar cuando quieras.
      </p>

      {picking && listFolders ? (
        <FolderPicker
          listFolders={listFolders}
          onClose={() => setPicking(false)}
          onChoose={(chosen) => {
            setPicking(false)
            void open(chosen)
          }}
        />
      ) : null}
    </main>
  )
}
