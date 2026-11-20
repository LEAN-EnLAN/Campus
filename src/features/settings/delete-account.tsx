import { Link, useNavigate } from '@tanstack/react-router'
import { Download, Trash2, UserX } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/modal'
import { rememberAccountDeleted } from '@/features/account/account-deleted-notice'
import { useDeleteAccount } from '@/features/account/queries'
import { useAuth } from '@/features/auth/auth-context'

import { SettingsRow } from './settings-ui'

/** The word the student types. Exact, upper case — a deliberate act, not a click. */
const DELETE_CONFIRMATION_WORD = 'BORRAR'

/**
 * Ajustes → Cuenta → "Borrar mi cuenta". The way to download the data sits
 * right next to the destructive action, so nobody deletes without the chance
 * to keep a copy.
 */
export function DeleteAccountRow() {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const helperId = useId()

  return (
    <section aria-labelledby={titleId} aria-describedby={helperId}>
      <SettingsRow
        label="Borrar mi cuenta"
        labelId={titleId}
        headingLevel="h3"
        helper="Borra tu cuenta de Campus Cloud y todos tus datos. No se puede deshacer."
        helperId={helperId}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ExportDataLink className="settings-link">
            <Download aria-hidden="true" />
            Descargar mis datos
          </ExportDataLink>
          <Button variant="danger-outline" onClick={() => setOpen(true)}>
            <Trash2 aria-hidden="true" />
            Borrar mi cuenta
          </Button>
        </div>
      </SettingsRow>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </section>
  )
}

/** Ajustes → Tus datos, where the export lives. */
function ExportDataLink({
  className,
  onClick,
  children,
}: {
  className?: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <Link to="/settings" search={{ seccion: 'datos' }} className={className} onClick={onClick}>
      {children}
    </Link>
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
        <ModalHeader
          titleId={titleId}
          title="¿Borrar tu cuenta?"
          description="Es definitivo: no se puede deshacer."
          icon={<UserX />}
          tone="danger"
        />
        <p className="text-ink-muted text-sm">
          Se borran tu cuenta, tu carrera, los estados de tus materias, tus fechas y tu
          material. No se puede deshacer. Si querés quedarte con una copia, primero{' '}
          <ExportDataLink
            className="text-accent-ink underline underline-offset-4"
            onClick={close}
          >
            descargá tus datos
          </ExportDataLink>
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
        <ModalFooter>
          <Button variant="ghost" disabled={pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={!confirmed || pending}>
            {pending ? 'Borrando…' : 'Borrar mi cuenta'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
