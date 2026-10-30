import { ClipboardPaste, Info, Link2, MousePointerClick, StickyNote } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { TextareaField, TextField } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import {
  classifyIncoming,
  draftFromIncoming,
  extractHttpUrl,
  hostLabel,
  isHttpUrl,
  titleFromUrl,
  validateDraft,
  type DraftErrors,
  type DraftKind,
  type IncomingContent,
  type ResourceDraft,
  type ValidResource,
} from '@/domain/resource-draft'
import { readClipboardText, readClipboardTextIfGranted } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

export interface AddResourceDialogProps {
  open: boolean
  onClose: () => void
  /** Persist the material. Rejecting keeps the dialog open with the draft intact. */
  onSave: (resource: ValidResource) => Promise<unknown>
  saving: boolean
  /** The last save error, shown inside the dialog. */
  error: unknown
  /** Silent read on open; must never prompt. Injected so tests control the clipboard. */
  readClipboard?: () => Promise<string | null>
  /** Read after the student clicks "Pegar"; may prompt. */
  pasteClipboard?: () => Promise<string | null>
}

/**
 * Add material to a subject.
 *
 * The main surface takes whatever the student already has — a dragged or pasted
 * link or text — and turns it into a draft with a suggested title. Typing it by
 * hand stays one click away. Nothing is saved until Guardar.
 */
export function AddResourceDialog({ open, onClose, ...rest }: AddResourceDialogProps) {
  const titleId = useId()
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      {/* Mounted only while open, so every opening starts from a clean draft. */}
      {open ? <AddResourceForm titleId={titleId} onClose={onClose} {...rest} /> : null}
    </Modal>
  )
}

const KIND_OPTIONS: { value: DraftKind; label: string; Icon: typeof Link2 }[] = [
  { value: 'link', label: 'Link', Icon: Link2 },
  { value: 'note', label: 'Nota', Icon: StickyNote },
]

const FILE_NOTICE =
  'Por ahora Campus guarda links y notas; subir archivos llega más adelante. Si el archivo ya está en Drive o en el campus, pegá su link.'

function AddResourceForm({
  titleId,
  onClose,
  onSave,
  saving,
  error,
  readClipboard = readClipboardTextIfGranted,
  pasteClipboard = readClipboardText,
}: Omit<AddResourceDialogProps, 'open'> & { titleId: string }) {
  const [draft, setDraft] = useState<ResourceDraft | null>(null)
  const [titleTouched, setTitleTouched] = useState(false)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [dragging, setDragging] = useState(false)
  const [fileNotice, setFileNotice] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    readClipboard()
      .then((text) => {
        const url = text === null ? null : extractHttpUrl(text)
        if (active && url) setClipboardUrl(url)
      })
      .catch(() => {
        /* A denied or failed read is not the student's problem. */
      })
    return () => {
      active = false
    }
  }, [readClipboard])

  useEffect(() => {
    if (focusRequest > 0) titleRef.current?.focus()
  }, [focusRequest])

  function startDraft(next: ResourceDraft, message: string) {
    setDraft(next)
    setTitleTouched(false)
    setErrors({})
    setFileNotice(false)
    setAnnouncement(message)
    setFocusRequest((n) => n + 1)
  }

  function accept(incoming: IncomingContent) {
    if (incoming.kind === 'empty') return
    if (incoming.kind === 'file') {
      setFileNotice(true)
      setAnnouncement(FILE_NOTICE)
      return
    }
    startDraft(
      draftFromIncoming(incoming),
      incoming.kind === 'link'
        ? `Link de ${hostLabel(incoming.url)} listo para guardar.`
        : 'Nota lista para guardar.',
    )
  }

  function writeByHand(kind: DraftKind) {
    startDraft({ kind, title: '', url: '', body: '' }, '')
  }

  function update(patch: Partial<ResourceDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  function changeUrl(url: string) {
    // Until the student writes their own title, the link keeps suggesting one.
    update(!titleTouched && isHttpUrl(url) ? { url, title: titleFromUrl(url.trim()) } : { url })
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!dragging) setDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setDragging(false)
    const data = event.dataTransfer
    accept(
      classifyIncoming({
        uriList: data.getData('text/uri-list'),
        text: data.getData('text/plain'),
        fileCount: data.files.length,
      }),
    )
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    // Pasting into a field is ordinary typing; anywhere else it is a drop.
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    const data = event.clipboardData
    accept(
      classifyIncoming({
        uriList: data.getData('text/uri-list'),
        text: data.getData('text/plain'),
        fileCount: data.files.length,
      }),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    const result = validateDraft(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    try {
      await onSave(result.value)
      onClose()
    } catch {
      // The draft stays for correction; the save error renders below.
    }
  }

  async function pasteFromClipboard() {
    const text = await pasteClipboard()
    accept(classifyIncoming({ text: text ?? '' }))
  }

  const showClipboardChip = clipboardUrl !== null && draft?.url !== clipboardUrl
  const showPasteButton = clipboardUrl === null && draft === null
  const saveError = error instanceof Error ? error.message : null

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col gap-4 p-5 pb-6 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-ink font-serif text-lg">
          Agregar material
        </h2>
        <p className="text-ink-muted text-sm">Un link o una nota para tener a mano.</p>
      </div>

      <div
        data-dragging={dragging || undefined}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 text-center',
          'motion-safe:transition-colors motion-safe:duration-150',
          draft ? 'py-4' : 'py-7 sm:py-9',
          dragging ? 'border-accent bg-accent-soft' : 'border-rule bg-paper-sunken',
        )}
      >
        <MousePointerClick
          aria-hidden="true"
          className={cn('size-6', dragging ? 'text-accent-ink' : 'text-ink-faint')}
        />
        <p className="text-ink text-sm font-medium">
          {dragging ? 'Soltalo para usarlo' : 'Arrastrá un link o un texto acá'}
        </p>
        <p className="text-ink-muted text-xs">
          También podés pegarlo con Ctrl+V (⌘V en Mac). Un link queda como link; cualquier otro
          texto, como nota.
        </p>
        {showClipboardChip ? (
          <button
            type="button"
            onClick={() => accept(classifyIncoming({ text: clipboardUrl }))}
            className={cn(
              'border-accent/40 bg-paper-elevated text-accent-ink mt-1 inline-flex min-h-9 max-w-full',
              'items-center gap-2 rounded-md border px-3 text-sm font-medium',
              'hover:bg-accent-soft motion-safe:transition-colors',
            )}
          >
            <ClipboardPaste aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Usar el link copiado: {hostLabel(clipboardUrl)}</span>
          </button>
        ) : null}
        {showPasteButton ? (
          <button
            type="button"
            onClick={() => void pasteFromClipboard()}
            className={cn(
              'border-rule bg-paper-elevated text-ink mt-1 inline-flex min-h-9 items-center gap-2',
              'rounded-md border px-3 text-sm font-medium',
              'hover:bg-accent-soft motion-safe:transition-colors',
            )}
          >
            <ClipboardPaste aria-hidden="true" className="size-4 shrink-0" />
            Pegar lo que copiaste
          </button>
        ) : null}
      </div>

      {fileNotice ? (
        <p
          role="status"
          className="border-rule bg-paper-sunken text-ink flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
        >
          <Info aria-hidden="true" className="text-accent-ink mt-0.5 size-4 shrink-0" />
          {FILE_NOTICE}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {fileNotice ? '' : announcement}
      </p>

      {draft ? (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-ink mb-1.5 text-sm font-medium">Tipo</legend>
            <div className="grid grid-cols-2 gap-2">
              {KIND_OPTIONS.map(({ value, label, Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'border-rule text-ink flex min-h-11 cursor-pointer items-center justify-center gap-2',
                    'rounded-md border text-sm font-medium',
                    'has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink',
                    'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2',
                  )}
                >
                  <input
                    type="radio"
                    name="resource-kind"
                    value={value}
                    checked={draft.kind === value}
                    onChange={() => {
                      setErrors({})
                      update({ kind: value })
                    }}
                    className="sr-only"
                  />
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <TextField
            ref={titleRef}
            label="Título"
            placeholder="Apunte de la cátedra"
            value={draft.title}
            onChange={(e) => {
              setTitleTouched(true)
              update({ title: e.target.value })
            }}
            error={errors.title}
            required
            autoComplete="off"
          />

          {draft.kind === 'link' ? (
            <TextField
              label="Link"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={draft.url}
              onChange={(e) => changeUrl(e.target.value)}
              error={errors.url}
              required
              autoComplete="off"
            />
          ) : (
            <TextareaField
              label="Nota"
              placeholder="Lo que quieras recordar de esta materia"
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={5}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-sm">
          <span className="text-ink-muted">¿Preferís escribirlo a mano?</span>
          {/* The two choices wrap as one unit, so the separator never dangles. */}
          <span className="inline-flex items-center gap-x-1">
            <Button
              variant="link"
              size="sm"
              className="h-9 px-1.5"
              onClick={() => writeByHand('link')}
            >
              Escribir un link
            </Button>
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-9 px-1.5"
              onClick={() => writeByHand('note')}
            >
              Escribir una nota
            </Button>
          </span>
        </div>
      )}

      {saveError ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {saveError}
        </p>
      ) : null}

      <div className="mt-1 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!draft || saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
