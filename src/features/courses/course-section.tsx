import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * One block of the materia page: a raised icon chip, the title, one line that
 * says what the block is for, an optional action, then the content indented
 * under the title. The same shape as Ajustes, so the app reads as one.
 */
export function CourseSection({
  id,
  icon,
  title,
  purpose,
  action,
  children,
  className,
}: {
  /** The heading's id; the section is labelled by it. */
  id: string
  /** A decorative lucide icon. */
  icon: ReactNode
  title: string
  purpose?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn('course-section', className)}>
      <div className="course-section-head">
        <span aria-hidden="true" className="course-chip">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="course-section-title">
            {title}
          </h2>
          {purpose ? <p className="course-section-purpose">{purpose}</p> : null}
        </div>
        {action ? <div className="course-section-action">{action}</div> : null}
      </div>
      <div className="course-section-body">{children}</div>
    </section>
  )
}
