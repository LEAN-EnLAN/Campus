import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useFiles, type FilesAccess } from '@/lib/files/context'
import { vaultErrorCode, vaultErrorMessage } from '@/lib/files/errors'
import { ensureSessionIndex, sessionFor } from '@/lib/knowledge/session-index'
import { vaultKeys } from '@/features/vault/queries'

/**
 * "Notas" on a materia: the notes of the student's local folder that mention it
 * with a `[[wikilink]]`, and one action that starts a note already linked to it.
 *
 * A materia is not a note, so it has no backlinks of its own; the shared note
 * index answers "who links this name" from memory (`VaultIndex.mentions`) and is
 * only built once per session, the first time anything needs it. The link is the
 * whole mechanism — no tags, no frontmatter, no second concept to learn.
 *
 * Without a local folder (Campus Cloud) the section is simply not rendered:
 * there is no placeholder, because there is nothing to promise.
 */

const VISIBLE = 5
/** Same-day same-materia notes get " (2)", " (3)"… instead of overwriting each other. */
const MAX_SUFFIX = 50

export interface NotedSubject {
  id: string
  name: string
  code: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayStamp = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** A materia name as a file name: no characters a filesystem refuses. */
const fileSafe = (name: string) =>
  name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')

export function SubjectNotes({ subject }: { subject: NotedSubject }) {
  const files = useFiles()
  if (!files) return null
  return <Notes files={files} subject={subject} />
}

function Notes({ files, subject }: { files: FilesAccess; subject: NotedSubject }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [ready, setReady] = useState(() => sessionFor(files).built)
  // The index is mutable and shared; a counter is what tells React it changed.
  const [version, setVersion] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void ensureSessionIndex(files).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [files])

  const names = useMemo(
    () => [subject.name, ...(subject.code ? [subject.code] : [])],
    [subject.name, subject.code],
  )
  const mentions = useMemo(
    () => (ready ? sessionFor(files).index.mentions(names) : []),
    // `version` is the dependency that matters: the index object never changes.
    [files, ready, names, version],
  )

  async function createNote() {
    setCreating(true)
    setError(null)
    try {
      const base = `Notas/${fileSafe(subject.name)} - ${dayStamp(new Date())}`
      const heading = `${subject.name} - ${dayStamp(new Date())}`
      const body = `# ${heading}\n\nMateria: [[${subject.name}]]\n\n`

      let path = `${base}.md`
      for (let attempt = 2; ; attempt++) {
        try {
          // `null`: "I believe this is new" — an existing file is a conflict,
          // never an overwrite.
          await files.writeNote(path, body, null)
          break
        } catch (cause) {
          if (vaultErrorCode(cause) !== 'already_exists' || attempt > MAX_SUFFIX) throw cause
          path = `${base} (${attempt}).md`
        }
      }

      // Straight into the shared index, so the list is right when the student
      // comes back, with no scan of the folder.
      sessionFor(files).index.upsert(path, body)
      setVersion((v) => v + 1)
      void client.invalidateQueries({ queryKey: vaultKeys.allDirs })
      await navigate({ to: '/vault', search: { note: path } })
    } catch (cause) {
      setError(vaultErrorMessage(cause))
    } finally {
      setCreating(false)
    }
  }

  const shown = showAll ? mentions : mentions.slice(0, VISIBLE)

  return (
    <section aria-labelledby="notas" className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-3">
        <SectionHeading
          id="notas"
          aside={ready && mentions.length > 0 ? `${mentions.length}` : undefined}
          className="flex-1"
        >
          Notas
        </SectionHeading>
        <Button
          variant="secondary"
          size="sm"
          disabled={creating}
          onClick={() => void createNote()}
        >
          + Nota de esta materia
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}

      {ready && mentions.length === 0 ? (
        <EmptyState quiet title="Ninguna nota menciona esta materia todavía." />
      ) : null}

      {shown.length > 0 ? (
        <ul>
          {shown.map((mention) => (
            <li key={mention.sourcePath} className="border-rule-soft border-b">
              <Link
                to="/vault"
                search={{ note: mention.sourcePath }}
                className="hover:bg-paper-sunken flex flex-col gap-0.5 py-2.5"
              >
                <span className="text-ink text-sm">{mention.sourceTitle}</span>
                <span className="text-ink-muted truncate text-xs">{mention.snippet}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!showAll && mentions.length > VISIBLE ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-accent-ink mt-1 min-h-8 self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Ver todas ({mentions.length})
        </button>
      ) : null}
    </section>
  )
}
