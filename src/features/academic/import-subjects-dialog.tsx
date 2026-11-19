import { Download, Upload } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SelectField, TextareaField } from '@/components/ui/field'
import { Modal, ModalFooter } from '@/components/ui/modal'
import {
  IMPORT_TEMPLATE_CSV,
  parsePlanImport,
  resolveImport,
  type ImportRow,
} from '@/domain/plan-import'
import { statusLabel } from '@/domain/status-groups'
import type { Term } from '@/domain/types'
import type { SetSubjectStatusInput } from '@/lib/backends/types'

import { useAddManualSubject, useManualSubjects, useSetSubjectStatuses } from './queries'

/**
 * "Importar materias": many manual subjects at once, from a pasted list or a
 * .csv/.json file. They are the student's own entries, exactly like the ones
 * typed one by one — Campus does not check them against any official plan.
 */

const FILE_MAX_BYTES = 1024 * 1024

const TERM_LABEL: Record<Term, string> = {
  anual: 'Anual',
  '1c': '1° cuatrimestre',
  '2c': '2° cuatrimestre',
}

function downloadTemplate() {
  // The BOM makes Excel es-AR open the accents right.
  const blob = new Blob(['\uFEFF' + IMPORT_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'plantilla-materias.csv'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** FileReader rather than `file.text()`: same result, wider support. */
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

type Progress =
  | { phase: 'idle' }
  | { phase: 'running'; done: number; total: number }
  | { phase: 'finished'; added: number; error: string | null }

export function ImportSubjectsDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const existing = useManualSubjects(open)
  const add = useAddManualSubject()
  const setStatuses = useSetSubjectStatuses()

  const [text, setText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [defaultTerm, setDefaultTerm] = useState<Term>('anual')
  const [progress, setProgress] = useState<Progress>({ phase: 'idle' })

  const parsed = parsePlanImport(text)
  const rows: ImportRow[] = parsed.ok
    ? resolveImport(
        parsed.rows,
        (existing.data ?? []).map((s) => s.name),
        defaultTerm,
      )
    : []
  const ready = rows.filter((r) => r.outcome === 'ready')
  const invalid = rows.filter((r) => r.outcome === 'invalid').length
  const duplicates = rows.filter((r) => r.outcome === 'duplicate').length
  const running = progress.phase === 'running'

  function close() {
    if (running) return
    setText('')
    setFileError(null)
    setProgress({ phase: 'idle' })
    onClose()
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setProgress({ phase: 'idle' })
    if (!file) return
    if (!/\.(csv|json|txt)$/i.test(file.name)) {
      setFileError('Elegí un archivo .csv o .json.')
      return
    }
    if (file.size > FILE_MAX_BYTES) {
      setFileError('El archivo pesa más de 1 MB. Una lista de materias no debería.')
      return
    }
    try {
      setText(await readText(file))
      setFileError(null)
    } catch {
      setFileError('No pudimos leer el archivo.')
    }
  }

  async function importAll() {
    const total = ready.length
    if (total === 0) return
    let added = 0
    const statuses: SetSubjectStatusInput[] = []
    setProgress({ phase: 'running', done: 0, total })
    try {
      // One at a time: the order the student wrote is the order they appear in.
      for (const row of ready) {
        const subject = await add.mutateAsync({
          name: row.name,
          yearLevel: row.yearLevel,
          term: row.term,
        })
        added++
        if (row.status) {
          statuses.push({ curriculumSubjectId: subject.id, status: row.status, manual: true })
        }
        setProgress({ phase: 'running', done: added, total })
      }
      if (statuses.length > 0) await setStatuses.mutateAsync(statuses)
      setText('')
      setProgress({ phase: 'finished', added, error: null })
    } catch (error) {
      setProgress({
        phase: 'finished',
        added,
        error: error instanceof Error ? error.message : 'No pudimos terminar la importación.',
      })
    }
  }

  const status =
    progress.phase === 'running'
      ? `Importando ${progress.done} de ${progress.total}…`
      : progress.phase === 'finished'
        ? progress.error
          ? `Importamos ${progress.added} materia${progress.added === 1 ? '' : 's'}. Se cortó: ${progress.error}`
          : `Importamos ${progress.added} materia${progress.added === 1 ? '' : 's'}.`
        : !parsed.ok
          ? parsed.error
          : rows.length === 0
            ? ''
            : [
                `${ready.length} para importar`,
                invalid > 0 ? `${invalid} con errores` : null,
                duplicates > 0 ? `${duplicates} repetida${duplicates === 1 ? '' : 's'}` : null,
              ]
                .filter(Boolean)
                .join(' · ') + '.'

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy={titleId}
      describedBy={descriptionId}
      className="sm:max-w-3xl"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <h2 id={titleId} className="text-ink font-serif text-lg">
          Importar materias
        </h2>
        <p id={descriptionId} className="text-ink-muted -mt-2 text-sm">
          Pegá tu lista o subí un archivo .csv o .json con las columnas nombre, año y, si
          querés, cuatrimestre y estado. Se agregan como materias cargadas por vos: Campus no
          las compara con ningún plan oficial.
        </p>

        <TextareaField
          label="Tu lista"
          placeholder={'nombre;año;cuatrimestre;estado\nNombre de la materia;1;1c;cursando'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setProgress({ phase: 'idle' })
          }}
          disabled={running}
          className="min-h-28 font-mono text-xs"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="border-rule bg-paper-elevated text-ink hover:bg-paper-sunken focus-within:border-focus inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium">
            <Upload aria-hidden="true" className="size-4" />
            Subir archivo
            <input
              type="file"
              accept=".csv,.json,.txt,text/csv,application/json,text/plain"
              onChange={(e) => void onFile(e)}
              disabled={running}
              className="sr-only"
              aria-describedby={fileError ? `${titleId}-file-error` : undefined}
            />
          </label>
          <Button variant="link" onClick={downloadTemplate}>
            <Download aria-hidden="true" />
            Descargar plantilla
          </Button>
          <div className="ml-auto w-full sm:w-56">
            <SelectField
              label="Si una fila no dice el cuatrimestre"
              value={defaultTerm}
              onChange={(e) => setDefaultTerm(e.target.value as Term)}
              disabled={running}
            >
              {(Object.keys(TERM_LABEL) as Term[]).map((term) => (
                <option key={term} value={term}>
                  {TERM_LABEL[term]}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        {fileError ? (
          <p
            id={`${titleId}-file-error`}
            role="alert"
            className="text-danger text-sm font-medium"
          >
            {fileError}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="border-rule max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Vista previa de la importación</caption>
              <thead className="bg-paper-sunken text-ink-muted sticky top-0 text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Fila
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Materia
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Año
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Cuatrimestre
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const reasonId = `${titleId}-row-${row.line}`
                  return (
                    <tr key={row.line} className="border-rule-soft border-t">
                      <td className="text-ink-muted px-3 py-2 tabular-nums">{row.line}</td>
                      <td
                        className="text-ink max-w-56 truncate px-3 py-2"
                        aria-describedby={row.reason ? reasonId : undefined}
                      >
                        {row.name || '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {Number.isFinite(row.yearLevel) ? `${row.yearLevel}°` : '—'}
                      </td>
                      <td className="px-3 py-2">{TERM_LABEL[row.term]}</td>
                      <td className="px-3 py-2">
                        {row.status ? statusLabel(row.status) : 'Sin marcar'}
                      </td>
                      <td
                        id={reasonId}
                        className={
                          row.outcome === 'invalid'
                            ? 'text-danger px-3 py-2 font-medium'
                            : row.outcome === 'duplicate'
                              ? 'text-ink-muted px-3 py-2'
                              : 'text-ink px-3 py-2'
                        }
                      >
                        {row.reason ?? 'Lista'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <p aria-live="polite" className="text-ink-muted min-h-5 text-sm">
          {status}
        </p>

        <ModalFooter>
          <Button variant="ghost" onClick={close} disabled={running}>
            {progress.phase === 'finished' ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button
            variant="primary"
            onClick={() => void importAll()}
            // Wait for what is already loaded, or duplicates would slip through.
            disabled={running || existing.isPending || ready.length === 0}
          >
            {ready.length > 0
              ? `Importar ${ready.length} materia${ready.length === 1 ? '' : 's'}`
              : 'Importar'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
