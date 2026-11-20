import { itemKindLabel } from '@/components/deadline-row'
import type { CourseSummary } from '@/domain/course-summary'
import { relativeDayLabel } from '@/domain/course-summary'
import { describeItemDate } from '@/domain/item-dates'

/**
 * The strip under a materia's header: one idea per tile, the number first.
 *
 * The next date gets the navy surface Hoy uses for "Lo próximo", so the two
 * screens answer the same question the same way. Without one it is an ordinary
 * tile: an empty navy block would shout about nothing.
 */
export function CourseFacts({ summary }: { summary: CourseSummary }) {
  return (
    <dl aria-label="Resumen de la materia" className="course-facts">
      <NextDateFact summary={summary} />
      <CorrelativasFact summary={summary} />
      <div className="course-fact">
        <dt className="course-fact-label">Habilita</dt>
        <dd className="course-fact-value" data-numeric>
          {summary.unlocksCount}
        </dd>
        <dd className="course-fact-note">
          {summary.unlocksCount === 1 ? 'materia del plan' : 'materias del plan'}
        </dd>
      </div>
      <div className="course-fact">
        <dt className="course-fact-label">Material</dt>
        <dd className="course-fact-value" data-numeric>
          {summary.materialCount}
        </dd>
        <dd className="course-fact-note">
          {summary.materialCount === 1 ? 'recurso guardado' : 'recursos guardados'}
        </dd>
      </div>
    </dl>
  )
}

function NextDateFact({ summary }: { summary: CourseSummary }) {
  const { next, daysUntilNext, upcomingCount, overdueCount } = summary
  const overdue =
    overdueCount > 0 ? `${overdueCount} ${overdueCount === 1 ? 'atrasada' : 'atrasadas'}` : null

  if (!next || daysUntilNext === null) {
    return (
      <div className="course-fact course-fact-next">
        <dt className="course-fact-label">Próximas fechas</dt>
        <dd className="course-fact-value" data-numeric>
          0
        </dd>
        <dd className="course-fact-note">
          {overdue ? `Nada por delante · ${overdue}` : 'Nada anotado por delante'}
        </dd>
      </div>
    )
  }

  const others = upcomingCount - 1
  const when = relativeDayLabel(daysUntilNext)
  return (
    <div className="course-fact course-fact-next" data-tone="hero">
      <dt className="course-fact-label">Lo próximo · {itemKindLabel(next.kind)}</dt>
      <dd className="course-fact-title">{next.title}</dd>
      <dd className="course-fact-note">
        {describeItemDate(next)}
        {others > 0 ? ` · ${others} ${others === 1 ? 'fecha más' : 'fechas más'}` : null}
        {overdue ? ` · ${overdue}` : null}
      </dd>
      <dd className="course-fact-countdown" data-numeric>
        {daysUntilNext > 1 ? (
          <>
            <span className="course-fact-numeral">{daysUntilNext}</span>
            <span className="course-fact-unit">días</span>
          </>
        ) : (
          <span className="course-fact-numeral is-word">{when}</span>
        )}
      </dd>
    </div>
  )
}

function missingNote(missing: number): string {
  if (missing === 0) return 'cumplidas'
  return missing === 1 ? 'cumplidas · te falta una' : `cumplidas · te faltan ${missing}`
}

function CorrelativasFact({ summary }: { summary: CourseSummary }) {
  const fact = summary.correlativas
  const [value, note] =
    fact.kind === 'counted'
      ? [`${fact.met}/${fact.total}`, missingNote(fact.total - fact.met)]
      : fact.kind === 'none'
        ? ['0', 'No pide correlativas']
        : fact.kind === 'manual'
          ? ['—', 'Cargada a mano, sin datos del plan']
          : ['—', 'El plan no las publicó']
  return (
    <div className="course-fact">
      <dt className="course-fact-label">Correlativas</dt>
      <dd className="course-fact-value" data-numeric>
        {value}
      </dd>
      <dd className="course-fact-note">{note}</dd>
    </div>
  )
}
