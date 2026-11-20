import { Info } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The anatomy every Ajustes section shares (styles in `styles/settings.css`):
 *
 *   [chip]  Title              ← the section's illustration, cropped to its object
 *           One-line purpose
 *   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *   Label (+ helper)  |  control
 *   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *   …
 *
 * Long explanations do not live in rows: a row says one thing, the rest waits
 * behind "Ver detalle", and a notice goes in a callout.
 */
export function SettingsPanel({
  id,
  title,
  description,
  art,
  children,
}: {
  /** The heading's id; the section is named by it. */
  id: string
  title: string
  description: string
  /** Decorative: an illustration or a line icon. The title already says it. */
  art: ReactNode
  children: ReactNode
}) {
  return (
    <section className="settings-panel" aria-labelledby={id}>
      <header className="settings-panel-head">
        <span className="settings-chip" aria-hidden="true">
          {art}
        </span>
        <div className="min-w-0">
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="settings-panel-body">{children}</div>
    </section>
  )
}

/**
 * One `label | control` row. `labelFor` makes the label a real `<label>` for a
 * control in the right column; `heading` makes it the heading of a nested
 * section instead (the caller wires `aria-labelledby`).
 */
export function SettingsRow({
  label,
  labelId,
  labelFor,
  headingLevel,
  helper,
  helperId,
  required = false,
  align = 'center',
  className,
  children,
}: {
  label?: string
  labelId?: string
  labelFor?: string
  headingLevel?: 'h3'
  helper?: ReactNode
  helperId?: string
  /** A brand-blue marker beside the label, for the few things that really are. */
  required?: boolean
  /** `start` for tall controls: the label stays by the control's first line. */
  align?: 'center' | 'start'
  className?: string
  children: ReactNode
}) {
  const Title = labelFor ? 'label' : (headingLevel ?? 'span')
  return (
    <div className={cn('settings-row', align === 'start' && 'settings-row-start', className)}>
      <div className="settings-row-label">
        {label ? (
          <span className="settings-row-title">
            <Title id={labelId} {...(labelFor ? { htmlFor: labelFor } : {})}>
              {label}
            </Title>
            {required ? (
              <span className="settings-required" aria-hidden="true">
                *
              </span>
            ) : null}
          </span>
        ) : null}
        {helper ? (
          <p id={helperId} className="settings-row-helper">
            {helper}
          </p>
        ) : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}

/** The rest of a row's statement, closed until asked for. */
export function SettingsDetail({ children }: { children: ReactNode }) {
  return (
    <details className="settings-detail">
      <summary>Ver detalle</summary>
      <div>{children}</div>
    </details>
  )
}

/** A short statement in a row's control column, with optional detail below. */
export function SettingsStatement({
  children,
  detail,
}: {
  children: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className="settings-statement">
      <p>{children}</p>
      {detail ? <SettingsDetail>{detail}</SettingsDetail> : null}
    </div>
  )
}

/** A notice: info icon, title, body, and the one link that acts on it. */
export function SettingsCallout({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  const titleId = useId()
  return (
    <div role="note" className="settings-callout" aria-labelledby={titleId}>
      <Info aria-hidden="true" className="settings-callout-icon" />
      <div className="min-w-0">
        <p id={titleId} className="settings-callout-title">
          {title}
        </p>
        <div className="settings-callout-body">{children}</div>
        {action ? <div className="settings-callout-action">{action}</div> : null}
      </div>
    </div>
  )
}
