import { CircleUserRound, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useSignOut } from '@/features/auth/use-sign-out'
import { useBackend } from '@/lib/backends/context'
import { useRequiresAccount } from '@/lib/runtime/identity'

import { DeleteAccountRow } from './delete-account'
import { SettingsPanel, SettingsRow } from './settings-ui'

/**
 * Ajustes → Cuenta: who is signed in, signing out, and deleting the account.
 * Only offered where there is an account; Local has none.
 */
export function AccountSection() {
  const backend = useBackend()
  const requiresAccount = useRequiresAccount()

  return (
    <SettingsPanel
      id="settings-account"
      title="Tu cuenta"
      description="Con esta cuenta entrás a Campus Cloud."
      art={<CircleUserRound className="settings-chip-icon" />}
    >
      {requiresAccount ? <Identity /> : null}
      {backend.account ? <DeleteAccountRow /> : null}
    </SettingsPanel>
  )
}

function Identity() {
  const { session } = useAuth()
  const signOut = useSignOut()
  const email = session?.user.email || ''

  return (
    <>
      <SettingsRow label="Email">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="bg-accent text-on-tint grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold uppercase"
          >
            {email ? email.charAt(0) : '?'}
          </span>
          <div className="min-w-0">
            <p className="settings-value truncate">{email || 'Email no disponible'}</p>
            <p className="text-ink-muted text-xs">Campus Cloud</p>
          </div>
        </div>
      </SettingsRow>
      <SettingsRow label="Sesión" helper="Salís de Campus en este dispositivo.">
        <Button
          variant="danger-outline"
          disabled={signOut.pending}
          onClick={() => void signOut.signOut()}
        >
          <LogOut aria-hidden="true" />
          {signOut.pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
        {signOut.error ? (
          <p role="alert" className="settings-error">
            {signOut.error}
          </p>
        ) : null}
      </SettingsRow>
    </>
  )
}
