import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, Cloud, FolderOpen, GraduationCap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import {
  useAcademicContext,
  useAcademicUnits,
  useCurricula,
  useInstitutions,
  usePrograms,
  useSaveAcademicContext,
} from '@/features/academic/queries'
import { useDocumentTitle } from '@/lib/hooks/use-document-title'
import { useRequiresAccount } from '@/lib/runtime/identity'
import { useWorkspace } from '@/lib/runtime/workspace'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

import '@/styles/blue-onboarding.css'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingScreen,
})

const STEPS = ['Universidad', 'Facultad', 'Carrera', 'Plan'] as const

/**
 * CAP-ONBOARD-001 / CAP-ONBOARD-002 — 60–120 seconds, four choices, no avatar,
 * no interests, no bio before value.
 *
 * Every step is picked from real seeded data. The escape hatch at the bottom
 * writes an `unmapped` context so a student whose plan we do not have can still
 * use Campus — and the gap is recorded rather than invented around.
 */
function OnboardingScreen() {
  const { session, loading } = useAuth()
  const requiresAccount = useRequiresAccount()
  const workspace = useWorkspace()
  useDocumentTitle('Tu carrera · Campus')
  const navigate = useNavigate()

  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [programId, setProgramId] = useState<string | null>(null)
  const [curriculumId, setCurriculumId] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [manualLabel, setManualLabel] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const [confirmed, setConfirmed] = useState(false)

  const institutions = useInstitutions()
  const units = useAcademicUnits(institutionId)
  const programs = usePrograms(unitId)
  const curricula = useCurricula(programId)
  const existing = useAcademicContext()
  const save = useSaveAcademicContext()

  useEffect(() => {
    // Same rule as the app layout: LOCAL mode has no account, and a student
    // choosing their carrera does not need one.
    if (requiresAccount && !loading && !session) void navigate({ to: '/login' })
  }, [loading, session, navigate, requiresAccount])

  // Coming back: start from what the student already chose, not from a blank
  // form that reads like "start over". Once, and only if they have not touched
  // anything yet — a late answer must never overwrite a click.
  const seeded = useRef(false)
  useEffect(() => {
    const current = existing.data
    if (!current || seeded.current) return
    seeded.current = true
    if (current.unmappedLabel) {
      setManual(true)
      setManualLabel(current.unmappedLabel)
      return
    }
    setInstitutionId(current.institutionId)
    setUnitId(current.academicUnitId)
    setProgramId(current.programId)
    setCurriculumId(current.curriculumId)
    if (current.programId) setActiveStep(3)
  }, [existing.data])

  // Pre-select when there is only one option — a list of one is not a decision.
  useEffect(() => {
    if (units.data?.length === 1 && !unitId) setUnitId(units.data[0]!.id)
  }, [units.data, unitId])
  useEffect(() => {
    if (curricula.data?.length === 1 && !curriculumId) setCurriculumId(curricula.data[0]!.id)
  }, [curricula.data, curriculumId])

  // A step is done when the student has a choice there — the radio on screen is
  // checked — and never otherwise. It used to be derived from "how far along",
  // which put four green checks on the free-text path where nothing was chosen.
  const stepDone = [institutionId, unitId, programId, curriculumId].map((id) => id !== null)

  const coverage = coverageLine((institutions.data ?? []).map((i) => i.shortName))
  const selectedInstitution = institutions.data?.find((item) => item.id === institutionId)?.name
  const selectedUnit = units.data?.find((item) => item.id === unitId)?.name
  const selectedProgram = programs.data?.find((item) => item.id === programId)?.name
  const selectedCurriculum = curricula.data?.find((item) => item.id === curriculumId)
  const selected = [
    selectedInstitution,
    selectedUnit,
    selectedProgram,
    selectedCurriculum?.version,
  ]
  const canVisit = [true, Boolean(institutionId), Boolean(unitId), Boolean(programId)]
  const workspaceName = workspace.folder ? 'En esta computadora' : 'Campus Cloud'
  const workspaceDetail = workspace.folder
    ? workspace.folder.name
    : 'Tu espacio vinculado a tu cuenta'

  async function confirm() {
    try {
      await save.mutateAsync({
        institutionId: manual ? null : institutionId,
        academicUnitId: manual ? null : unitId,
        programId: manual ? null : programId,
        curriculumId: manual ? null : curriculumId,
        unmappedLabel: manual ? manualLabel.trim() || 'Carrera no listada' : null,
      })
      setConfirmed(true)
    } catch {
      // The mutation exposes its error in the form, and keeps all selections.
    }
  }

  // Gate on the session too, not just the auth load: otherwise the whole wizard
  // paints for one tick before the redirect effect fires.
  if (requiresAccount && (loading || !session)) return null

  return (
    <main className="blue-onboarding">
      <div className="blue-onboarding-container">
        <header className="blue-onboarding-top">
          <div className="blue-onboarding-brand">
            <span aria-hidden="true" className="blue-onboarding-brand-mark">
              C
            </span>
            <span>
              Campus<span className="blue-onboarding-brand-dot">.</span>
            </span>
          </div>
          {existing.data ? (
            <Link to="/settings" className="blue-onboarding-text-link">
              <ArrowLeft size={16} aria-hidden="true" /> Volver a ajustes
            </Link>
          ) : (
            <span className="blue-onboarding-top-note">Tu espacio de estudio</span>
          )}
        </header>

        {confirmed ? (
          <section className="blue-onboarding-complete" role="status">
            <img
              src="/campus-blue-assets/onboarding-ready.svg"
              alt="Documento académico con una marca de confirmación"
              width={640}
              height={400}
            />
            <span className="blue-onboarding-eyebrow">Configuración guardada</span>
            <h1>Tu plan ya está en Campus.</h1>
            <p>
              {manual
                ? 'Podés agregar tus materias manualmente desde el plan. No se cargaron materias que no están en el catálogo.'
                : 'Ahora elegí cuáles materias ya aprobaste, regularizaste o te faltan cursar. Así tu progreso reflejará tu situación real.'}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void navigate({ to: manual ? '/plan' : '/plan/progress' })}
            >
              {manual ? 'Ir a mi plan' : 'Marcar estado de materias'}{' '}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </section>
        ) : (
          <div className="blue-onboarding-layout">
            <section className="blue-onboarding-primary" aria-labelledby="onboarding-title">
              <header className="blue-onboarding-intro">
                <p className="blue-onboarding-eyebrow">
                  <GraduationCap size={17} aria-hidden="true" /> Configuración académica
                </p>
                <h1 id="onboarding-title">
                  {manual ? 'Empezá con tu propia carrera.' : 'Organicemos tu recorrido.'}
                </h1>
                <p>
                  {manual
                    ? 'Si tu carrera no está en nuestro catálogo, podés crear un plan manual.'
                    : 'Elegí tu universidad, facultad, carrera y plan de estudios. Vamos paso a paso.'}
                </p>
                {!manual && coverage ? (
                  <p className="blue-onboarding-coverage">{coverage}</p>
                ) : null}
              </header>

              {!manual ? (
                <nav className="blue-onboarding-progress" aria-label="Pasos de configuración">
                  <ol>
                    {STEPS.map((label, index) => (
                      <li key={label}>
                        <button
                          type="button"
                          disabled={!canVisit[index]}
                          aria-current={activeStep === index ? 'step' : undefined}
                          data-active={activeStep === index}
                          data-complete={stepDone[index]}
                          onClick={() => setActiveStep(index)}
                        >
                          <span className="blue-onboarding-step-number">
                            {stepDone[index] ? (
                              <Check size={16} aria-hidden="true" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span>{label}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>
              ) : null}

              <div className="blue-onboarding-form-panel">
                {!manual ? (
                  <div className="blue-onboarding-section-heading">
                    <span>
                      Paso {activeStep + 1} de {STEPS.length}
                    </span>
                    <h2>{STEPS[activeStep]}</h2>
                    <p>
                      {
                        [
                          '¿En qué universidad estudiás?',
                          'Seleccioná tu facultad o regional.',
                          'Elegí la carrera que estás cursando.',
                          'Seleccioná la versión de tu plan de estudios.',
                        ][activeStep]
                      }
                    </p>
                  </div>
                ) : (
                  <div className="blue-onboarding-section-heading">
                    <span>Carga manual</span>
                    <h2>Tu carrera</h2>
                    <p>
                      Guardaremos el nombre que indiques para empezar a organizar tus materias.
                    </p>
                  </div>
                )}

                {!manual && activeStep === 0 && (
                  <>
                    {institutions.error ? (
                      <ErrorState
                        error={institutions.error as Error}
                        onRetry={() => void institutions.refetch()}
                      />
                    ) : (
                      <Choice
                        legend="Universidad"
                        options={(institutions.data ?? []).map((i) => ({
                          id: i.id,
                          label: i.name,
                          hint: i.shortName,
                        }))}
                        loading={institutions.isLoading}
                        value={institutionId}
                        onChange={(id) => {
                          if (id !== institutionId) {
                            setInstitutionId(id)
                            setUnitId(null)
                            setProgramId(null)
                            setCurriculumId(null)
                          }
                          setActiveStep(1)
                        }}
                      />
                    )}
                  </>
                )}

                {!manual && activeStep === 1 && (
                  <>
                    {units.error ? (
                      <ErrorState
                        error={units.error as Error}
                        onRetry={() => void units.refetch()}
                      />
                    ) : (
                      <Choice
                        legend="Facultad o regional"
                        options={(units.data ?? []).map((u) => ({ id: u.id, label: u.name }))}
                        loading={units.isLoading}
                        value={unitId}
                        onChange={(id) => {
                          if (id !== unitId) {
                            setUnitId(id)
                            setProgramId(null)
                            setCurriculumId(null)
                          }
                          setActiveStep(2)
                        }}
                      />
                    )}
                  </>
                )}

                {!manual && activeStep === 2 && (
                  <>
                    {programs.error ? (
                      <ErrorState
                        error={programs.error as Error}
                        onRetry={() => void programs.refetch()}
                      />
                    ) : (
                      <Choice
                        legend="Carrera"
                        options={(programs.data ?? []).map((p) => ({
                          id: p.id,
                          label: p.name,
                        }))}
                        loading={programs.isLoading}
                        value={programId}
                        onChange={(id) => {
                          if (id !== programId) {
                            setProgramId(id)
                            setCurriculumId(null)
                          }
                          setActiveStep(3)
                        }}
                      />
                    )}
                  </>
                )}

                {!manual && activeStep === 3 && (
                  <>
                    {curricula.error ? (
                      <ErrorState
                        error={curricula.error as Error}
                        onRetry={() => void curricula.refetch()}
                      />
                    ) : (
                      <Choice
                        legend="Plan de estudios"
                        options={(curricula.data ?? []).map((c) => ({
                          id: c.id,
                          label: c.version,
                          detail: c.name,
                        }))}
                        loading={curricula.isLoading}
                        value={curriculumId}
                        onChange={setCurriculumId}
                      />
                    )}
                    {curriculumId ? (
                      <p className="blue-onboarding-confirm-hint">
                        <Check size={16} aria-hidden="true" />
                        Plan seleccionado. Revisá tus datos y guardá la configuración.
                      </p>
                    ) : null}
                  </>
                )}

                {manual ? (
                  <TextField
                    label="Carrera y universidad"
                    placeholder="Psicología — UBA"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    hint={
                      workspace.folder
                        ? 'Este nombre se guarda en tu carpeta. Podés agregar tus materias manualmente.'
                        : 'Este nombre se guarda en tu cuenta. Podés agregar tus materias manualmente.'
                    }
                    required
                  />
                ) : null}

                {save.error ? (
                  <p role="alert" className="blue-onboarding-error">
                    {(save.error as Error).message}
                  </p>
                ) : null}

                <div className="blue-onboarding-actions">
                  {!manual && activeStep > 0 ? (
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
                    >
                      <ArrowLeft size={16} aria-hidden="true" /> Anterior
                    </Button>
                  ) : null}
                  {(manual || activeStep === 3) && (
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={
                        save.isPending || (manual ? !manualLabel.trim() : !curriculumId)
                      }
                      onClick={() => void confirm()}
                    >
                      {save.isPending ? 'Guardando…' : 'Guardar y continuar'}
                      {!save.isPending && <ArrowRight size={17} aria-hidden="true" />}
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  className="blue-onboarding-manual-toggle"
                  onClick={() => setManual((previous) => !previous)}
                >
                  {manual ? 'Volver a elegir del catálogo' : 'No encuentro mi carrera'}
                </button>
              </div>
            </section>

            <aside className="blue-onboarding-aside" aria-label="Espacio y resumen">
              <div className="blue-onboarding-aside-heading">
                <span className="blue-onboarding-eyebrow">Dónde se guarda</span>
                <h2>Tu espacio de trabajo</h2>
                <p>Ya elegiste cómo usar Campus. Podés cambiarlo desde acá.</p>
              </div>
              <div className="blue-onboarding-workspaces">
                <div
                  className="blue-onboarding-workspace-card"
                  data-active={Boolean(workspace.folder)}
                >
                  <img
                    src="/campus-blue-assets/workspace-local.svg"
                    width={640}
                    height={400}
                    alt="Ilustración de una carpeta de materias guardada en esta computadora"
                  />
                  <span>
                    <FolderOpen size={16} aria-hidden="true" /> En esta computadora
                  </span>
                  <small>
                    {workspace.folder ? 'Espacio actual' : 'Disponible desde la app local'}
                  </small>
                </div>
                <div className="blue-onboarding-workspace-card" data-active={!workspace.folder}>
                  <img
                    src="/campus-blue-assets/workspace-cloud.svg"
                    width={640}
                    height={400}
                    alt="Ilustración de un espacio académico almacenado en Cloud"
                  />
                  <span>
                    <Cloud size={16} aria-hidden="true" /> Campus Cloud
                  </span>
                  <small>{!workspace.folder ? 'Espacio actual' : 'Requiere una cuenta'}</small>
                </div>
              </div>
              <p className="blue-onboarding-workspace-current">
                <Check size={15} aria-hidden="true" />
                {workspaceName}: {workspaceDetail}
              </p>
              <button
                className="blue-onboarding-text-link"
                type="button"
                onClick={workspace.change}
              >
                Cambiar espacio de trabajo <ArrowRight size={16} aria-hidden="true" />
              </button>

              <div className="blue-onboarding-summary">
                <h3>Tu selección</h3>
                {manual ? (
                  <p>{manualLabel.trim() || 'Escribí tu carrera para continuar.'}</p>
                ) : (
                  <ol>
                    {STEPS.map((label, index) => (
                      <li key={label}>
                        <span>{label}</span>
                        <strong>{selected[index] || 'Por elegir'}</strong>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <p className="blue-onboarding-next">
                {manual
                  ? 'Después vas a poder agregar materias propias a tu plan.'
                  : 'Al finalizar vas a marcar cuáles materias aprobaste, regularizaste o te falta cursar.'}
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

interface Option {
  id: string
  label: string
  /** Always visible, small, under the label. */
  hint?: string
  /** Long reference text, collapsed behind "Ver detalle". */
  detail?: string
}

/** "Por ahora tenemos planes de UNR y UTN." — from the data, so it stays true. */
function coverageLine(shortNames: string[]): string | null {
  const names = [...shortNames].sort((a, b) => a.localeCompare(b, 'es'))
  if (names.length === 0) return null
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
  return `Por ahora tenemos planes de ${list}.`
}

/**
 * A radio group rendered as rows.
 *
 * Real `<input type="radio">` inside a `<fieldset>` — arrow keys, form semantics
 * and screen-reader grouping come for free, and the visual treatment is entirely
 * in the label.
 */
function Choice({
  legend,
  options,
  value,
  onChange,
  loading,
}: {
  legend: string
  options: Option[]
  value: string | null
  onChange: (id: string) => void
  loading?: boolean
}) {
  return (
    <fieldset className="blue-onboarding-options flex flex-col gap-1">
      <legend className="text-2xs text-ink-muted mb-1.5 font-semibold tracking-[0.12em] uppercase">
        {legend}
      </legend>

      {loading ? (
        <p className="text-ink-muted py-2 text-sm">Cargando…</p>
      ) : options.length === 0 ? (
        <p className="text-ink-muted py-2 text-sm">
          Todavía no tenemos opciones acá. Podés seguir con “No encuentro mi carrera”.
        </p>
      ) : (
        options.map((option) => (
          <div key={option.id}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                value === option.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-rule hover:border-ink-faint hover:bg-paper-elevated',
              )}
            >
              <input
                type="radio"
                name={legend}
                value={option.id}
                checked={value === option.id}
                onChange={() => onChange(option.id)}
                // The sole faculty/plan is preselected by the catalog. Clicking
                // that already-checked radio does not fire change, but should
                // still advance the wizard to the next step.
                onClick={() => {
                  if (value === option.id) onChange(option.id)
                }}
                className="size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="text-ink block text-sm">{option.label}</span>
                {option.hint ? (
                  <span className="text-ink-muted block text-xs">{option.hint}</span>
                ) : null}
              </span>
            </label>
            {option.detail ? (
              <details className="text-ink-muted px-3 pt-1 text-xs">
                <summary className="min-h-8 cursor-pointer py-1.5 underline-offset-4 hover:underline">
                  Ver detalle
                </summary>
                <p className="pb-1">{option.detail}</p>
              </details>
            ) : null}
          </div>
        ))
      )}
    </fieldset>
  )
}
