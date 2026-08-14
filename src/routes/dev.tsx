/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  TESTER TOOLING — temporary. Delete this file and the whole feature is  │
 * │  gone: nothing in the app imports it, and the route only exists because │
 * │  TanStack Router picks up files in src/routes.                          │
 * │  See docs/TESTING.md § "Cómo sacar esto".                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * One-click login for every seeded scenario, including the states that are
 * otherwise unreachable — a brand-new account, a plan Campus does not have, and
 * the UNR plan whose correlativas the university has not published.
 *
 * Gated on `VITE_CAMPUS_TESTER`. Without that flag it renders a refusal, so an
 * accidental production build exposes nothing.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import scenarios from '@/features/dev/scenarios.generated.json'
import { useAuth } from '@/features/auth/auth-context'

export const Route = createFileRoute('/dev')({
  component: DevScreen,
})

const ENABLED = import.meta.env.VITE_CAMPUS_TESTER === '1'

function DevScreen() {
  const { signIn, signOut, session } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!ENABLED) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <EmptyState
          title="Las herramientas de tester están apagadas"
          description="Poné VITE_CAMPUS_TESTER=1 en .env y reiniciá el dev server."
        />
      </main>
    )
  }

  async function enter(email: string) {
    setBusy(email)
    setError(null)
    // Sign out first: switching scenarios while a session is live would land the
    // tester on the previous student's data.
    if (session) await signOut()
    const result = await signIn(email, scenarios.password)
    setBusy(null)
    if (result.error) {
      setError(`${result.error} — ¿corriste \`pnpm tester seed\`?`)
      return
    }
    void navigate({ to: '/today' })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-10 sm:px-6">
      <PageHeader
        eyebrow="Herramientas de tester"
        title="Escenarios"
        description="Cada uno es una cuenta real con datos reales en Postgres. Entrás con un clic."
      />

      {session ? (
        <p className="text-ink-muted mt-4 text-sm">
          Sesión activa: <span className="text-ink">{session.user.email}</span>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm font-medium">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="escenarios" className="mt-8 flex flex-col gap-1">
        <SectionHeading id="escenarios" aside={`${scenarios.scenarios.length}`}>
          Cuentas sembradas
        </SectionHeading>

        <ul>
          {scenarios.scenarios.map((scenario) => (
            <li
              key={scenario.key}
              className="border-rule-soft flex flex-wrap items-center gap-3 border-b py-3.5"
            >
              <span className="min-w-0 flex-1">
                <span className="text-ink block text-sm">{scenario.title}</span>
                <span className="text-ink-muted mt-0.5 block text-xs">{scenario.covers}</span>
                <span className="text-ink-muted text-2xs mt-0.5 block font-mono">
                  {scenario.email}
                </span>
              </span>
              <Button
                variant={busy === scenario.email ? 'secondary' : 'primary'}
                size="sm"
                disabled={busy !== null}
                onClick={() => void enter(scenario.email)}
              >
                {busy === scenario.email ? 'Entrando…' : 'Entrar'}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="como" className="mt-8 flex flex-col gap-2">
        <SectionHeading id="como">Cómo se regenera</SectionHeading>
        <pre
          tabIndex={0}
          className="border-rule bg-paper-elevated text-ink-muted overflow-x-auto rounded-lg border p-3 text-xs"
        >
          {`pnpm tester seed    # crea o refresca todas las cuentas
pnpm tester list    # muestra la tabla
pnpm tester purge   # las borra`}
        </pre>
        <p className="text-ink-muted text-xs">
          Contraseña de todas: <code className="text-ink">{scenarios.password}</code>. Sólo
          funciona contra el stack local.
        </p>
      </section>

      <section aria-labelledby="sacar" className="mt-8 flex flex-col gap-2">
        <SectionHeading id="sacar">Cómo sacar esto del proyecto</SectionHeading>
        <pre
          tabIndex={0}
          className="border-rule bg-paper-elevated text-ink-muted overflow-x-auto rounded-lg border p-3 text-xs"
        >
          {`rm src/routes/dev.tsx
rm -rf src/features/dev
rm scripts/tester.mjs
rm scripts/verify-frontend.mjs
# y borrar los scripts tester/verify:frontend de package.json`}
        </pre>
        <p className="text-ink-muted text-xs">
          Nada del resto de la app importa estos archivos. Detalle en{' '}
          <code className="text-ink">docs/TESTING.md</code>.
        </p>
      </section>
    </main>
  )
}
