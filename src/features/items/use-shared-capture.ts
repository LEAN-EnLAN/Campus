import { useEffect, useState } from 'react'

import { track } from '@/lib/telemetry/track'

import {
  clearPendingCapture,
  readPendingCapture,
  resolveSharedCapture,
  type PendingCapture,
} from './share'

/**
 * A draft that arrived through a shared `/add` link, opened once on Hoy.
 *
 * It waits for the plan (`ready`): resolving the subject before the plan has
 * loaded would drop a subject the student does have. Once the form opens the
 * stored draft is cleared, so a reload does not open it again. Nothing is
 * saved here — the student still has to press Guardar.
 */
export function useSharedCapture({
  subjects,
  ready,
}: {
  subjects: readonly { id: string }[]
  ready: boolean
}) {
  const [pending, setPending] = useState<PendingCapture | null>(readPendingCapture)
  const open = pending !== null && ready

  useEffect(() => {
    if (open) clearPendingCapture()
  }, [open])

  return {
    open,
    initialValues: open ? resolveSharedCapture(pending, subjects) : null,
    /** Closed without saving. */
    dismiss: () => setPending(null),
    /** Saved: count it (only with consent; `track` decides) and forget it. */
    saved: () => {
      if (pending) track('share_saved', pending.ref ? { ref: pending.ref } : undefined)
      setPending(null)
    },
  }
}
