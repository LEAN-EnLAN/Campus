import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Illustration } from '@/components/ui/illustration'
import { useAcademicPlan } from '@/features/academic/queries'

import { SettingsDetail, SettingsPanel, SettingsRow } from './settings-ui'

/** Ajustes → Carrera: the active plan, its official source, and the way to change it. */
export function CareerSection() {
  const plan = useAcademicPlan()
  const academicName =
    plan.curriculum?.version ?? plan.curriculum?.name ?? plan.context?.unmappedLabel ?? '—'

  return (
    <SettingsPanel
      id="settings-academic"
      title="Tu carrera"
      description="Información del plan académico activo."
      art={<Illustration name="settings-career" decorative fit="crop" />}
    >
      {plan.hasContext ? (
        <>
          {plan.programName ? (
            <SettingsRow label="Carrera">
              <p className="settings-value">{plan.programName}</p>
            </SettingsRow>
          ) : null}
          <SettingsRow label="Plan de estudios" align="start">
            <p className="settings-value">{academicName}</p>
            {plan.curriculum?.version && plan.curriculum.name ? (
              <SettingsDetail>
                <p>{plan.curriculum.name}</p>
              </SettingsDetail>
            ) : null}
          </SettingsRow>
          {plan.curriculum?.sourceUrl ? (
            <SettingsRow label="Fuente" helper="El documento del que sale este plan.">
              <a
                className="settings-link"
                href={plan.curriculum.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Documento oficial
                <ExternalLink aria-hidden="true" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </SettingsRow>
          ) : null}
        </>
      ) : (
        <SettingsRow label="Carrera">
          <p className="settings-value settings-value-muted">Todavía no elegiste tu carrera.</p>
        </SettingsRow>
      )}
      <SettingsRow
        label={plan.hasContext ? 'Cambiar de carrera' : 'Elegir tu carrera'}
        helper="Universidad, facultad, carrera y plan."
      >
        <Link
          to="/onboarding"
          search={{ from: 'settings' }}
          className={buttonVariants({ variant: 'secondary' })}
        >
          {plan.hasContext ? 'Cambiar mi carrera' : 'Elegir mi carrera'}
        </Link>
      </SettingsRow>
    </SettingsPanel>
  )
}
