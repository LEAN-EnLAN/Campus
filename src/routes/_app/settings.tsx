import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsScreen,
})

function SettingsScreen() {
  const { session, signOut } = useAuth()
  const plan = useAcademicPlan()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Ajustes" />

      <section aria-labelledby="cuenta" className="flex flex-col gap-3">
        <SectionHeading id="cuenta">Tu cuenta</SectionHeading>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
            <dt className="text-ink-muted">Email</dt>
            <dd className="text-ink truncate">{session?.user.email}</dd>
          </div>
        </dl>
        <Button
          variant="secondary"
          className="self-start"
          onClick={async () => {
            await signOut()
            void navigate({ to: '/login' })
          }}
        >
          Cerrar sesión
        </Button>
      </section>

      <section aria-labelledby="carrera" className="flex flex-col gap-3">
        <SectionHeading id="carrera">Tu carrera</SectionHeading>
        {plan.hasContext ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
              <dt className="text-ink-muted">Plan</dt>
              <dd className="text-ink text-right">
                {plan.curriculum?.name ?? plan.context?.unmappedLabel ?? '—'}
              </dd>
            </div>
            {plan.curriculum?.sourceUrl ? (
              <div className="border-rule-soft flex justify-between gap-4 border-b py-2">
                <dt className="text-ink-muted">Fuente</dt>
                <dd className="text-right">
                  <a
                    href={plan.curriculum.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent underline underline-offset-4"
                  >
                    Documento oficial
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-ink-muted text-sm">Todavía no elegiste tu carrera.</p>
        )}
        <Link
          to="/onboarding"
          className="text-accent self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Cambiar mi carrera
        </Link>
      </section>

      <section aria-labelledby="privacidad" className="flex flex-col gap-3">
        <SectionHeading id="privacidad">Privacidad</SectionHeading>
        <div className="text-ink-muted flex flex-col gap-2 text-sm">
          <p>
            Campus nunca te va a pedir las credenciales de tu autogestión universitaria, ni se
            conecta con los sistemas de tu facultad.
          </p>
          <p>
            Tus materias, entregas y material son tuyos: nadie más que vos puede verlos, y eso
            está garantizado en la base de datos, no solo en la interfaz.
          </p>
          <p>
            Los planes de estudio salen de documentos oficiales publicados por cada universidad.
            Si algo no lo pudimos verificar, lo decimos en vez de inventarlo.
          </p>
        </div>
      </section>
    </div>
  )
}
