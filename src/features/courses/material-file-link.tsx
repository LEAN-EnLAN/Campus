import { FileText } from 'lucide-react'
import { useState } from 'react'

import { formatFileSize } from '@/domain/material-file'
import type { Resource } from '@/domain/types'
import { useBackend } from '@/lib/backends/context'

/**
 * An uploaded material file in a list: its title opens it in a new tab through a
 * short-lived signed link (requested on click, never stored). The tab is opened
 * synchronously and pointed at the link once it arrives, so popup blockers let
 * it through.
 */
export function MaterialFileLink({ resource }: { resource: Resource }) {
  const backend = useBackend()
  const files = backend.resources.files
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  async function open() {
    if (!files) return
    setError(null)
    setOpening(true)
    const tab = window.open('', '_blank')
    try {
      const url = await files.openUrl(resource)
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else {
        window.location.assign(url)
      }
    } catch (cause) {
      tab?.close()
      setError(cause instanceof Error ? cause.message : 'No pudimos abrir el archivo.')
    } finally {
      setOpening(false)
    }
  }

  const meta = resource.sizeBytes ? formatFileSize(resource.sizeBytes) : null

  return (
    <span className="flex min-w-0 flex-col">
      {files ? (
        <button
          type="button"
          onClick={() => void open()}
          aria-busy={opening}
          className="text-ink inline-flex max-w-full items-center gap-2 text-left text-sm underline-offset-4 hover:underline"
        >
          <FileText aria-hidden="true" className="text-ink-faint size-3.5 shrink-0" />
          <span className="truncate">{resource.title}</span>
          <span className="sr-only">(abrir archivo)</span>
        </button>
      ) : (
        <span className="text-ink inline-flex max-w-full items-center gap-2 text-sm">
          <FileText aria-hidden="true" className="text-ink-faint size-3.5 shrink-0" />
          <span className="truncate">{resource.title}</span>
        </span>
      )}
      <span className="text-ink-muted text-xs">
        {files
          ? ['Archivo', meta].filter(Boolean).join(' · ')
          : 'Archivo guardado en Campus Cloud'}
      </span>
      {error ? (
        <span role="alert" className="text-danger text-xs font-medium">
          {error}
        </span>
      ) : null}
    </span>
  )
}
