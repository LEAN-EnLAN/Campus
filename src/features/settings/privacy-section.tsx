import { Illustration } from '@/components/ui/illustration'
import { MetricsConsentCheckbox } from '@/features/account/metrics-consent-checkbox'
import { useAccountProfile, useSetMetricsConsent } from '@/features/account/queries'
import { useBackend } from '@/lib/backends/context'
import { useWorkspace } from '@/lib/runtime/workspace'

import { DeleteAccountCard } from './delete-account-card'

/**
 * Ajustes → Privacidad: what Campus keeps, what it counts, and the switch.
 *
 * The metrics switch and account deletion are capabilities of an account, so
 * a Local workspace simply does not get them — its data is the student's own
 * files and nothing is measured.
 */
export function PrivacySection() {
  const backend = useBackend()
  const workspace = useWorkspace()

  return (
    <>
      <section className="blue-settings-card" aria-labelledby="settings-privacy">
        <header className="blue-settings-card-head">
          <div className="min-w-0">
            <h2 id="settings-privacy">Privacidad</h2>
            <p>Qué guarda Campus, qué cuenta y qué no.</p>
          </div>
          <Illustration
            name="settings-privacy"
            decorative
            size="icon"
            className="-mt-1 w-16 shrink-0 sm:w-20"
          />
        </header>

        {backend.profile ? <MetricsConsentSetting /> : null}

        <div className="blue-settings-prose">
          {workspace.folder ? (
            <p>
              <strong>Qué se guarda:</strong> tus materias, fechas, material y notas quedan en
              archivos de tu carpeta, en esta computadora. Campus no los envía a ningún
              servidor.
            </p>
          ) : (
            <p>
              <strong>Qué se guarda:</strong> tu email, tu carrera y lo que cargás (estados de
              materias, fechas y material), para mostrártelo a vos. Cada dato queda protegido
              por usuario en la base de datos: nadie más lo puede leer.
            </p>
          )}
          <p>
            <strong>Qué se cuenta:</strong> si activás las métricas, contamos cuántas personas
            usan Campus por semana y cuántas veces se comparte una fecha. Contamos clics, sin
            leer el contenido de lo que escribís.
          </p>
          <p>El modo Local no mide nada.</p>
          <p>No vendemos tus datos.</p>
          <p>
            Datos agregados para universidades: no existe. Si algún día existe, va a estar
            apagado y vas a decidir vos.
          </p>
          <p>
            Campus nunca te pide las credenciales de tu autogestión universitaria ni se conecta
            con los sistemas de tu facultad. Los planes de estudio provienen de documentos
            oficiales; si falta información verificada, Campus lo indica.
          </p>
        </div>
      </section>

      {backend.account ? <DeleteAccountCard /> : null}
    </>
  )
}

function MetricsConsentSetting() {
  const profile = useAccountProfile()
  const setConsent = useSetMetricsConsent()

  return (
    <div className="mb-3">
      <MetricsConsentCheckbox
        checked={profile.data?.metricsConsent ?? false}
        disabled={!profile.data || setConsent.isPending}
        onChange={(next) => setConsent.mutate(next)}
      />
      {profile.isError ? (
        <p role="alert" className="blue-settings-error">
          No pudimos cargar tu preferencia de métricas.
        </p>
      ) : null}
      {setConsent.isError ? (
        <p role="alert" className="blue-settings-error">
          No pudimos guardar tu preferencia. Probá de nuevo.
        </p>
      ) : null}
    </div>
  )
}
