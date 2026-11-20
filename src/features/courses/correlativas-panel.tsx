import { Link } from '@tanstack/react-router'
import { ArrowRight, CircleCheck, CircleDashed, Info } from 'lucide-react'

import { StatusPill } from '@/components/status-pill'
import {
  finalBlockedSentence,
  requirementGroups,
  takeBlockedSentence,
} from '@/domain/requirements'
import type { RequirementItem, SubjectView } from '@/domain/types'

/**
 * "Correlativas", split by what each one is FOR: cursar the subject, or rendir
 * its final. Every row says whether it is met in words and shows the required
 * subject's own status as a deck pill; no subject repeats in a group. What is
 * missing is also said once, in a sentence, above the lists.
 */
function Group({
  id,
  title,
  items,
  subjectById,
}: {
  id: string
  title: string
  items: RequirementItem[]
  subjectById: ReadonlyMap<string, SubjectView>
}) {
  if (items.length === 0) return null
  const met = items.filter((i) => i.met).length
  return (
    <div className="course-corr-group">
      <h3 id={id} className="course-subhead">
        {title}
        <span className="course-subhead-count">
          {met}/{items.length}
        </span>
      </h3>
      <ul aria-labelledby={id} className="course-rows">
        {items.map((item) => {
          const required = subjectById.get(item.curriculumSubjectId)
          return (
            <li key={item.curriculumSubjectId} className="course-row">
              {item.met ? (
                <CircleCheck aria-hidden="true" className="text-success-ink size-4 shrink-0" />
              ) : (
                <CircleDashed aria-hidden="true" className="text-ink-faint size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <Link
                  to="/courses/$courseId"
                  params={{ courseId: item.curriculumSubjectId }}
                  className="course-row-link"
                >
                  {item.name}
                </Link>
                <span className={item.met ? 'course-row-note' : 'course-row-note is-missing'}>
                  {item.met ? 'Cumplida' : `Te falta ${item.needs}la`}
                </span>
              </span>
              {required ? <StatusPill status={required.status} /> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CorrelativasPanel({
  subject,
  subjectById,
}: {
  subject: SubjectView
  subjectById: ReadonlyMap<string, SubjectView>
}) {
  const groups = requirementGroups(subject)
  const missing = [takeBlockedSentence(subject), finalBlockedSentence(subject)].filter(
    (s): s is string => s !== null,
  )
  return (
    <div className="flex flex-col gap-5">
      {missing.length > 0 ? (
        <div role="note" className="course-callout">
          <Info aria-hidden="true" className="text-accent-ink mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            {missing.map((sentence) => (
              <p key={sentence}>{sentence}</p>
            ))}
          </div>
        </div>
      ) : null}
      <div className="course-corr-grid">
        <Group
          id="correlativas-cursar"
          title="Para cursar"
          items={groups.cursar}
          subjectById={subjectById}
        />
        <Group
          id="correlativas-rendir"
          title="Para rendir el final"
          items={groups.rendir}
          subjectById={subjectById}
        />
      </div>
    </div>
  )
}

/** "Habilita": the subjects that list this one as a correlativa, as links. */
export function UnlocksList({ unlocks }: { unlocks: readonly SubjectView[] }) {
  if (unlocks.length === 0) return null
  return (
    <div className="course-corr-group">
      <h3 id="correlativas-habilita" className="course-subhead">
        Habilita
        <span className="course-subhead-count">{unlocks.length}</span>
      </h3>
      <ul aria-labelledby="correlativas-habilita" className="course-rows">
        {unlocks.map((target) => (
          <li key={target.id}>
            <Link
              to="/courses/$courseId"
              params={{ courseId: target.id }}
              className="course-row course-row-action group"
            >
              <span className="min-w-0 flex-1">
                <span className="course-row-link">{target.name}</span>
                <span className="course-row-note">{target.yearLevel}° año</span>
              </span>
              <StatusPill status={target.status} />
              <ArrowRight
                aria-hidden="true"
                className="text-ink-faint size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What to say when a subject has no requirements to list.
 *
 * Silence would read as "nothing blocks you", and for a plan whose correlativas
 * we never had that is a claim Campus cannot make. A subject the student typed
 * in is a different case again: nobody published anything, and we do not guess.
 */
export function correlativasNote(subject: SubjectView, prerequisitesKnown: boolean): string {
  if (subject.manual) {
    return 'Cargaste esta materia a mano, así que no tenemos sus correlativas ni calculamos si la podés cursar.'
  }
  return prerequisitesKnown
    ? 'No te falta ninguna correlativa para cursar esta materia.'
    : 'Esta facultad todavía no publicó las correlatividades de este plan. No sabemos qué te piden para cursarla, y no lo vamos a inventar.'
}
