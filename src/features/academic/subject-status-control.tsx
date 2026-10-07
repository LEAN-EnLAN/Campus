import { StatusControl } from '@/components/status-control'
import type { SubjectView } from '@/domain/types'

import { useSetSubjectStatus } from './queries'

/**
 * The status buttons wired to the backend, for any screen that lists subjects.
 *
 * It does not know whether the subject came from the catalog or was typed in by
 * hand beyond passing the flag along: the seam decides where it is stored.
 */
export function SubjectStatusControl({
  subject,
  variant = 'compact',
  onChange,
  className,
}: {
  subject: SubjectView
  variant?: 'full' | 'compact'
  /** Called synchronously on a choice, before the write: lists use it to keep the row in place. */
  onChange?: (subject: SubjectView) => void
  className?: string
}) {
  const setStatus = useSetSubjectStatus()

  return (
    <StatusControl
      subjectName={subject.name}
      status={subject.status}
      variant={variant}
      className={className}
      onChange={(status) => {
        onChange?.(subject)
        return setStatus.mutateAsync({
          curriculumSubjectId: subject.id,
          status,
          ...(subject.manual ? { manual: true } : {}),
        })
      }}
    />
  )
}
