import { Illustration } from '@/components/ui/illustration'
import { MetricsConsentCheckbox } from '@/features/account/metrics-consent-checkbox'
import { useAccountProfile, useSetMetricsConsent } from '@/features/account/queries'
import { useBackend } from '@/lib/backends/context'
import { useWorkspace } from '@/lib/runtime/workspace'

import { SettingsCallout, SettingsPanel, SettingsRow, SettingsStatement } from './settings-ui'

/**
 * Ajustes → Privacidad: what Campus keeps, what it counts, and the switch.
 * One statement per row; the long version waits behind "Ver detalle".
 *
 * The metrics switch is a capability of an account, so a Local workspace
 * simply does not get it — its data is the student's own files and nothing is
 * measured. Deleting the account lives in Cuenta.
 */
export function PrivacySection() {
  const backend = useBackend()
  const workspace = useWorkspace()

  return (
    <SettingsPanel
      id="settings-privacy"
      title="Privacidad"
      description="Qué guarda Campus, qué cuenta y qué no."
      art={<Illustration name="settings-privacy" decorative fit="crop" />}
    >
      {backend.profile ? <MetricsConsentSetting /> : null}

      <SettingsRow label="Qué se guarda" align="start">
        {workspace.folder ? (
          <SettingsStatement detail="Tus materias, fechas, material y notas. Campus no los envía a ningún servidor.">
            Todo queda en archivos de tu carpeta, en esta computadora.
          </SettingsStatement>
        ) : (
          <SettingsStatement detail="Lo que cargás son los estados de tus materias, tus fechas y tu material.">
            Tu email, tu carrera y lo que cargás, para mostrártelo a vos.
          </SettingsStatement>
        )}
      </SettingsRow>
      <SettingsRow label="Qué se cuenta" align="start">
        <SettingsStatement detail="Si activás las métricas, contamos cuántas personas usan Campus por semana y cuántas veces se comparte una fecha.">
          Clics, solo si activás las métricas, y sin leer el contenido de lo que escribís.
        </SettingsStatement>
      </SettingsRow>
      <SettingsRow label="Modo Local">
        <SettingsStatement>El modo Local no mide nada.</SettingsStatement>
      </SettingsRow>
      <SettingsRow label="Venta de datos">
        <SettingsStatement>No vendemos tus datos.</SettingsStatement>
      </SettingsRow>
      <SettingsRow label="Universidades" align="start">
        <SettingsStatement detail="Si algún día existe, va a estar apagado y vas a decidir vos.">
          Datos agregados para universidades: no existe.
        </SettingsStatement>
      </SettingsRow>
      <SettingsRow label="Tu facultad" align="start">
        <SettingsStatement detail="Los planes de estudio provienen de documentos oficiales; si falta información verificada, Campus lo indica.">
          Campus nunca te pide las credenciales de tu autogestión universitaria ni se conecta
          con los sistemas de tu facultad.
        </SettingsStatement>
      </SettingsRow>

      {workspace.folder ? null : (
        <SettingsCallout title="Nadie más puede leer tus datos">
          Cada dato queda protegido por usuario en la base de datos.
        </SettingsCallout>
      )}
    </SettingsPanel>
  )
}

function MetricsConsentSetting() {
  const profile = useAccountProfile()
  const setConsent = useSetMetricsConsent()

  return (
    <SettingsRow label="Métricas de uso" helper="Podés cambiarlo cuando quieras." align="start">
      <MetricsConsentCheckbox
        checked={profile.data?.metricsConsent ?? false}
        disabled={!profile.data || setConsent.isPending}
        onChange={(next) => setConsent.mutate(next)}
      />
      {profile.isError ? (
        <p role="alert" className="settings-error">
          No pudimos cargar tu preferencia de métricas.
        </p>
      ) : null}
      {setConsent.isError ? (
        <p role="alert" className="settings-error">
          No pudimos guardar tu preferencia. Probá de nuevo.
        </p>
      ) : null}
    </SettingsRow>
  )
}
