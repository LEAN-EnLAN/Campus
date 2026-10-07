import { Link } from '@tanstack/react-router'

import { StatusGlyph } from '@/components/academic-status'
import { requirementGroups } from '@/domain/requirements'
import type { RequirementItem, SubjectView } from '@/domain/types'

/**
 * "Correlativas", split by what each one is FOR: cursar the subject, or rendir
 * its final. Every item says whether it is met; no subject repeats in a group.
 * Unmet items keep naming exactly what is missing ("te falta cursar/aprobar").
 */
function Group({
  title,
  verb,
  items,
}: {
  title: string
  /** What an unmet item still needs. */
  verb: 'cursar' | 'aprobar'
  items: RequirementItem[]
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.curriculumSubjectId} className="flex items-baseline gap-2">
            <StatusGlyph status={item.met ? 'passed' : 'pending'} />
            <Link
              to="/courses/$courseId"
              params={{ courseId: item.curriculumSubjectId }}
              className="text-ink text-sm underline-offset-4 hover:underline"
            >
              {item.name}
            </Link>
            <span className={item.met ? 'text-success-ink text-sm' : 'text-ink-muted text-sm'}>
              {item.met ? '— cumplida' : `— te falta ${verb}la`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CorrelativasPanel({ subject }: { subject: SubjectView }) {
  const groups = requirementGroups(subject)
  return (
    <>
      <Group title="Para cursar" verb="cursar" items={groups.cursar} />
      <Group title="Para rendir el final" verb="aprobar" items={groups.rendir} />
    </>
  )
}
