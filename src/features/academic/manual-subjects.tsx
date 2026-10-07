import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/ui/field'
import { MANUAL_MAX_YEAR, manualProblem } from '@/domain/manual-subjects'
import type { SubjectView, Term } from '@/domain/types'

import { useAddManualSubject, useRemoveManualSubject } from './queries'

/**
 * Subjects typed in by hand, for a carrera that is not in the catalog.
 *
 * The honesty rule is in the copy: Campus keeps what the student says and
 * claims nothing else. No availability, no correlativas, no "te falta".
 */

export const manualSubjectsBanner =
  'Tu carrera todavía no está en Campus. Cargá tus materias a mano y seguí tu avance. No calculamos correlatividades ni qué podés cursar.'

const TERMS: { value: Term; label: string }[] = [
  { value: 'anual', label: 'Anual' },
  { value: '1c', label: '1° cuatrimestre' },
  { value: '2c', label: '2° cuatrimestre' },
]

const YEARS = Array.from({ length: MANUAL_MAX_YEAR }, (_, i) => i + 1)

export function AddManualSubjectForm({ defaultYear = 1 }: { defaultYear?: number }) {
  const add = useAddManualSubject()
  const [name, setName] = useState('')
  const [yearLevel, setYearLevel] = useState(defaultYear)
  const [term, setTerm] = useState<Term>('1c')
  const [problem, setProblem] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = manualProblem({ name, yearLevel, term })
    setProblem(found)
    if (found) return
    try {
      await add.mutateAsync({ name, yearLevel, term })
      // Year and term stay put: a student usually adds a whole year in a row.
      setName('')
      nameInput.current?.focus()
    } catch {
      /* surfaced through add.error; what the student typed stays */
    }
  }

  const error = problem ?? (add.error ? (add.error as Error).message : null)

  return (
    <form
      onSubmit={submit}
      aria-label="Agregar una materia"
      className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_11rem_auto]"
    >
      <TextField
        ref={nameInput}
        label="Nombre"
        placeholder="Nombre de la materia"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setProblem(null)
        }}
        maxLength={200}
        autoComplete="off"
      />
      <SelectField
        label="Año"
        value={String(yearLevel)}
        onChange={(e) => setYearLevel(Number(e.target.value))}
      >
        {YEARS.map((year) => (
          <option key={year} value={year}>
            {year}°
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Cuatrimestre"
        value={term}
        onChange={(e) => setTerm(e.target.value as Term)}
      >
        {TERMS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </SelectField>
      <Button
        type="submit"
        variant="primary"
        className="sm:mt-[1.625rem]"
        disabled={add.isPending}
      >
        Agregar materia
      </Button>
      {error ? (
        <p role="alert" className="text-danger text-sm font-medium sm:col-span-4">
          {error}
        </p>
      ) : null}
    </form>
  )
}

/** Two-step so a typo does not cost a subject. Its entregas and material are kept. */
export function RemoveManualSubjectButton({ subject }: { subject: SubjectView }) {
  const remove = useRemoveManualSubject()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="icon-touch"
        className="md:size-8"
        aria-label={`Quitar ${subject.name}`}
        title="Quitar esta materia"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
    )
  }

  return (
    <span role="group" aria-label={`Confirmar quitar ${subject.name}`} className="flex gap-1.5">
      <Button
        variant="danger"
        size="sm"
        disabled={remove.isPending}
        onClick={() => remove.mutate(subject.id)}
      >
        Quitar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </span>
  )
}
