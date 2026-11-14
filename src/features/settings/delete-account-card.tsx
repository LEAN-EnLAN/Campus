import { useNavigate } from '@tanstack/react-router'
import { Download, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { rememberAccountDeleted } from '@/features/account/account-deleted-notice'
import { useDeleteAccount } from '@/features/account/queries'
import { useAuth } from '@/features/auth/auth-context'

/** The word the student types. Exact, upper case — a deliberate act, not a click. */
const DELETE_CONFIRMATION_WORD = 'BORRAR'

/**
 * Where WP1's "Exportar mis datos" section lives in Ajustes. The link sits next
 * to the destructive action so nobody deletes without the chance to keep a copy.
 */
const EXPORT_SECTION_ANCHOR = '#settings-export'

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false)

  return (
    <section className="blue-settings-card" aria-labelledby="settings-delete-account">
      <header className="blue-settings-card-head">
        <div className="min-w-0">
          <h2 id="settings-delete-account">Borrar mi cuenta</h2>
          <p>Borra tu cuenta de Campus Cloud y todos tus datos. No se puede deshacer.</p>
        </div>
      </header>
      <div className="blue-settings-actions">
        <a className="blue-settings-link" href={EXPORT_SECTION_ANCHOR}>
          <Download aria-hidden="true" />
          Descargar mis datos
        </a>
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden="true" />
          Borrar mi cuenta
        </Button>
      </div>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </section>
  )
}

export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId()
  const [typed, setTyped] = useState('')
  const deleteAccount = useDeleteAccount()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const confirmed = typed === DELETE_CONFIRMATION_WORD
  const pending = deleteAccount.isPending

  function close() {
    if (pending) return
    setTyped('')
    deleteAccount.reset()
    onClose()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!confirmed || pending) return
    try {
      await deleteAccount.mutateAsync()
    } catch {
      return // shown below; the account is still there
    }
    rememberAccountDeleted()
    try {
      // The user no longer exists; the server may refuse to end the session,
      // but the client drops it either way.
      await signOut()
    } catch {
      /* nothing left to protect */
    }
    void navigate({ to: '/login', replace: true })
  }

  return (
    <Modal open={open} onClose={close} labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-6">
        <h2 id={titleId} className="text-ink font-serif text-lg">
          ¿Borrar tu cuenta?
        </h2>
        <p className="text-ink-muted -mt-2 text-sm">
          Se borran tu cuenta, tu carrera, los estados de tus materias, tus fechas y tu
          material. No se puede deshacer. Si querés quedarte con una copia, primero{' '}
          <a
            className="text-accent-ink underline underline-offset-4"
            href={EXPORT_SECTION_ANCHOR}
            onClick={close}
          >
            descargá tus datos
          </a>
          .
        </p>
        <TextField
          label={`Escribí ${DELETE_CONFIRMATION_WORD} para confirmar`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={pending}
        />
        {deleteAccount.isError ? (
          <p role="alert" className="text-danger text-sm font-medium">
            No pudimos borrar tu cuenta. Probá de nuevo.
          </p>
        ) : null}
        <div className="border-rule-soft mt-1 flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" disabled={pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={!confirmed || pending}>
            {pending ? 'Borrando…' : 'Borrar mi cuenta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
