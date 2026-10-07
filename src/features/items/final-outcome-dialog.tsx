import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'

export type FinalOutcome = 'passed' | 'failed' | 'absent'

export interface FinalOutcomeResult {
  outcome: FinalOutcome
  /** Should the subject's state follow the result? Never true for an absence. */
  updateSubject: boolean
  /** The nota, when the student gave one and the subject is being updated. */
  grade: number | null
}

const OUTCOMES: { value: FinalOutcome; label: string }[] = [
  { value: 'passed', label: 'Aprobé' },
  { value: 'failed', label: 'Desaprobé' },
  { value: 'absent', label: 'Ausente' },
]

const STATE_LABEL: Record<'passed' | 'failed', string> = {
  passed: 'Aprobada',
  failed: 'Desaprobada',
}

/** A nota as typed: 1–10, one decimal at most, comma or point. */
function parseGrade(text: string): number | null | 'invalid' {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (!/^\d{1,2}([.,]\d)?$/.test(trimmed)) return 'invalid'
  const value = Number(trimmed.replace(',', '.'))
  return value >= 1 && value <= 10 ? value : 'invalid'
}

/**
 * What happened at the Final.
 *
 * Marking a Final done used to be a tick. Agreed position: ask the result
 * (Aprobé / Desaprobé / Ausente) and OFFER to update the subject — never do it
 * silently, and never block: Cancelar leaves everything as it was.
 */
export function FinalOutcomeDialog({
  open,
  title,
  subjectName,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  /** The subject the Final belongs to, if any. */
  subjectName: string | null
  onConfirm: (result: FinalOutcomeResult) => void
  onClose: () => void
}) {
  const titleId = useId()
  const [outcome, setOutcome] = useState<FinalOutcome | null>(null)
  const [update, setUpdate] = useState(true)
  const [gradeText, setGradeText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!open) return null

  const offersState = subjectName !== null && (outcome === 'passed' || outcome === 'failed')
  const grade = parseGrade(gradeText)
  const outcomeError = submitted && outcome === null ? 'Elegí cómo te fue.' : null
  const gradeError =
    submitted && offersState && update && grade === 'invalid' ? 'La nota va de 1 a 10.' : null

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (outcome === null) return
    if (offersState && update && grade === 'invalid') return
    const updateSubject = offersState && update
    onConfirm({
      outcome,
      updateSubject,
      grade: updateSubject && grade !== 'invalid' ? grade : null,
    })
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-5 pb-6">
        <h2 id={titleId} className="text-ink font-serif text-lg">
          ¿Cómo te fue en {title}?
        </h2>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Resultado</legend>
          {OUTCOMES.map(({ value, label }) => (
            <label
              key={value}
              className="border-rule has-[:checked]:border-accent has-[:checked]:bg-accent-soft flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm"
            >
              <input
                type="radio"
                name="resultado"
                value={value}
                checked={outcome === value}
                onChange={() => setOutcome(value)}
                className="size-4 accent-[var(--color-accent)]"
              />
              {label}
            </label>
          ))}
          {outcomeError ? (
            <p role="alert" className="text-danger text-xs font-medium">
              {outcomeError}
            </p>
          ) : null}
        </fieldset>

        {offersState ? (
          <div className="flex flex-col gap-3">
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={update}
                onChange={(e) => setUpdate(e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              {`Marcar ${subjectName} como ${STATE_LABEL[outcome as 'passed' | 'failed']}`}
            </label>
            {update ? (
              <TextField
                label="Nota (opcional)"
                inputMode="decimal"
                autoComplete="off"
                value={gradeText}
                onChange={(e) => setGradeText(e.target.value)}
                error={gradeError}
                className="max-w-28"
              />
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
