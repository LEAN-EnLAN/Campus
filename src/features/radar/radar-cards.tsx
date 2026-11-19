import { Link } from '@tanstack/react-router'
import {
  AlarmClock,
  ArrowRight,
  CircleCheck,
  GraduationCap,
  Layers,
  LockOpen,
  Rocket,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import type {
  RadarCountdown,
  RadarInsight,
  RadarInsightKind,
  RadarTarget,
} from '@/domain/radar'
import { itemKindLabel } from '@/features/items/kind-label'
import { PENDING_FINALS_ID } from '@/features/plan/pending-finals-model'
import { plural } from '@/lib/text/plural'

import { updatedLabel } from './use-radar'

export type AgendaSection = Extract<RadarTarget, { kind: 'agenda' }>['section']

export interface RadarNavigation {
  /** Scroll to a list on Hoy and move focus there. */
  onAgenda: (section: AgendaSection) => void
  /** Open the capture form. */
  onCapture: () => void
}

/** The one action a card offers, as a link when it leaves Hoy and a button when it stays. */
function TargetAction({
  target,
  className,
  children,
  nav,
}: {
  target: RadarTarget
  className: string
  children: ReactNode
  nav: RadarNavigation
}) {
  switch (target.kind) {
    case 'subject':
      return (
        <Link
          to="/courses/$courseId"
          params={{ courseId: target.subjectId }}
          className={className}
        >
          {children}
        </Link>
      )
    case 'calendar':
      return (
        <Link to="/calendar" className={className}>
          {children}
        </Link>
      )
    case 'pending-finals':
      return (
        <Link to="/plan" hash={PENDING_FINALS_ID} className={className}>
          {children}
        </Link>
      )
    case 'agenda':
      return (
        <button
          type="button"
          className={className}
          onClick={() => nav.onAgenda(target.section)}
        >
          {children}
        </button>
      )
    case 'capture':
      return (
        <button type="button" className={className} onClick={nav.onCapture}>
          {children}
        </button>
      )
  }
}

function countdownParts(countdown: RadarCountdown): { numeral: string; unit: string } {
  switch (countdown.unit) {
    case 'today':
      return { numeral: 'Hoy', unit: '' }
    case 'hours':
      return {
        numeral: String(countdown.value),
        unit: plural(countdown.value, 'hora', 'horas'),
      }
    case 'days':
      return { numeral: String(countdown.value), unit: plural(countdown.value, 'día', 'días') }
  }
}

/** The single next thing, big. */
export function RadarHero({ insight, nav }: { insight: RadarInsight; nav: RadarNavigation }) {
  const count = insight.countdown ? countdownParts(insight.countdown) : null
  return (
    <section aria-labelledby="radar-hero-title" className="radar-hero">
      <div className="min-w-0">
        <p className="radar-hero-eyebrow">
          Lo próximo{insight.item ? ` · ${itemKindLabel(insight.item.kind)}` : null}
        </p>
        <h2 id="radar-hero-title" className="radar-hero-title">
          {insight.title}
        </h2>
        <p className="radar-hero-reason">{insight.reason}</p>
        <TargetAction target={insight.target} className="radar-hero-action" nav={nav}>
          {insight.actionLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </TargetAction>
      </div>
      {count ? (
        <p className="radar-hero-count">
          <span className="radar-hero-numeral">{count.numeral}</span>
          {count.unit ? <span className="radar-hero-unit">{count.unit}</span> : null}
        </p>
      ) : null}
    </section>
  )
}

const ICON: Record<Exclude<RadarInsightKind, 'next-up'>, LucideIcon> = {
  'due-now': AlarmClock,
  'get-ahead': Rocket,
  'final-to-book': GraduationCap,
  'unlock-soon': LockOpen,
  'heavy-week': Layers,
  'all-clear': CircleCheck,
}

const TONE: Record<Exclude<RadarInsightKind, 'next-up'>, string> = {
  'due-now': 'attention',
  'get-ahead': 'accent',
  'final-to-book': 'regular',
  'unlock-soon': 'approved',
  'heavy-week': 'attention',
  'all-clear': 'approved',
}

/** Every card but the hero: one idea, one line of why, one action. */
export function RadarCards({
  insights,
  nav,
}: {
  insights: readonly RadarInsight[]
  nav: RadarNavigation
}) {
  const cards = insights.filter(
    (insight): insight is RadarInsight & { kind: Exclude<RadarInsightKind, 'next-up'> } =>
      insight.kind !== 'next-up',
  )
  if (cards.length === 0) return null
  return (
    <section aria-label="Radar" className="radar-grid">
      {cards.map((insight, index) => {
        const Icon = ICON[insight.kind]
        return (
          <article
            key={insight.id}
            className="radar-card"
            data-tone={TONE[insight.kind]}
            style={{ '--radar-i': index } as CSSProperties}
          >
            <span className="radar-card-chip">
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <h3 className="radar-card-title">{insight.title}</h3>
            <p className="radar-card-reason">{insight.reason}</p>
            <TargetAction target={insight.target} className="radar-card-action" nav={nav}>
              {insight.actionLabel}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </TargetAction>
          </article>
        )
      })}
    </section>
  )
}

/** "Radar · actualizado recién", with a live dot and the honest part said out loud. */
export function RadarLive({ updatedAt, now }: { updatedAt: Date; now: Date }) {
  return (
    <p className="radar-live">
      <span className="radar-live-dot" aria-hidden="true" />
      <span>Radar · {updatedLabel(updatedAt, now)}</span>
      <span className="text-ink-faint">· Corre en este dispositivo, no envía tus datos.</span>
    </p>
  )
}
