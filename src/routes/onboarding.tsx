import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
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
import { useRequiresAccount } from '@/lib/runtime/identity'
import { useWorkspace } from '@/lib/runtime/workspace'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

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
  const navigate = useNavigate()

  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [programId, setProgramId] = useState<string | null>(null)
  const [curriculumId, setCurriculumId] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [manualLabel, setManualLabel] = useState('')

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
  }, [loading, session, navigate])

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
  const currentStep = stepDone.findIndex((isDone) => !isDone)

  const coverage = coverageLine((institutions.data ?? []).map((i) => i.shortName))

  async function confirm() {
    await save.mutateAsync({
      institutionId: manual ? null : institutionId,
      academicUnitId: manual ? null : unitId,
      programId: manual ? null : programId,
      curriculumId: manual ? null : curriculumId,
      unmappedLabel: manual ? manualLabel.trim() || 'Carrera no listada' : null,
    })
    void navigate({ to: '/today' })
  }

  // Gate on the session too, not just the auth load: otherwise the whole wizard
  // paints for one tick before the redirect effect fires.
  if (requiresAccount && (loading || !session)) return null

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-10 sm:px-6">
      <p className="text-ink flex items-center gap-2 font-serif text-lg">
        <span aria-hidden="true" className="bg-accent inline-block h-5 w-1 rounded-full" />
        Campus
      </p>

      {existing.data ? (
        <Link
          to="/settings"
          className="text-ink-muted hover:text-ink mt-6 -mb-4 inline-flex min-h-8 items-center self-start text-sm underline-offset-4 hover:underline"
        >
          Volver
        </Link>
      ) : null}

      <h1 className="text-ink mt-8 font-serif text-2xl leading-tight">
        Contanos dónde estudiás.
      </h1>
      <p className="text-ink-muted mt-2 text-sm">
        Con esto armamos tu plan, tus materias y tus correlativas.{' '}
        {manual ? null : 'Son cuatro pasos.'}
      </p>
      {coverage ? <p className="text-ink mt-1 text-sm font-medium">{coverage}</p> : null}

      {manual ? null : (
        <ol
          aria-label="Pasos"
          className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
        >
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex items-center gap-1.5',
                  stepDone[index]
                    ? 'text-success-ink'
                    : index === currentStep
                      ? 'text-ink'
                      : 'text-ink-muted',
                )}
              >
                {stepDone[index] ? (
                  <>
                    <Check aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">(listo)</span>
                  </>
                ) : (
                  <span aria-hidden="true" className="w-3.5 text-center">
                    {index + 1}
                  </span>
                )}
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <span aria-hidden="true" className="text-ink-muted">
                  ·
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {institutions.error ? (
        <ErrorState
          className="mt-8"
          error={institutions.error as Error}
          onRetry={() => void institutions.refetch()}
        />
      ) : null}

      {!manual ? (
        <div className="mt-8 flex flex-col gap-7">
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
              setInstitutionId(id)
              setUnitId(null)
              setProgramId(null)
              setCurriculumId(null)
            }}
          />

          {institutionId ? (
            <Choice
              legend="Facultad o regional"
              options={(units.data ?? []).map((u) => ({ id: u.id, label: u.name }))}
              loading={units.isLoading}
              value={unitId}
              onChange={(id) => {
                setUnitId(id)
                setProgramId(null)
                setCurriculumId(null)
              }}
            />
          ) : null}

          {unitId ? (
            <Choice
              legend="Carrera"
              options={(programs.data ?? []).map((p) => ({ id: p.id, label: p.name }))}
              loading={programs.isLoading}
              value={programId}
              onChange={(id) => {
                setProgramId(id)
                setCurriculumId(null)
              }}
            />
          ) : null}

          {programId ? (
            <Choice
              legend="Plan de estudios"
              options={(curricula.data ?? []).map((c) => ({
                id: c.id,
                label: c.version,
                // The full resolution text is a citation, not a choice: one tap
                // away, not three lines under every option.
                detail: c.name,
              }))}
              loading={curricula.isLoading}
              value={curriculumId}
              onChange={setCurriculumId}
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          <TextField
            label="Carrera y universidad"
            placeholder="Psicología — UBA"
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
            hint={`Esto queda guardado solo en ${workspace.folder ? 'tu carpeta' : 'tu cuenta'}: todavía no le avisamos a nadie que falta tu plan. No inventamos materias ni correlativas que no pudimos verificar.`}
          />
        </div>
      )}

      {save.error ? (
        <p role="alert" className="text-danger mt-6 text-sm font-medium">
          {(save.error as Error).message}
        </p>
      ) : null}

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          disabled={
            save.isPending || (manual ? manualLabel.trim().length === 0 : !curriculumId)
          }
          onClick={confirm}
        >
          {save.isPending ? 'Guardando…' : 'Listo, empezar'}
        </Button>

        <button
          type="button"
          onClick={() => setManual((m) => !m)}
          className="text-ink-muted hover:text-ink text-sm underline-offset-4 hover:underline"
        >
          {manual ? 'Volver a elegir de la lista' : 'No encuentro mi carrera'}
        </button>
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
    <fieldset className="flex flex-col gap-1">
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
