import type { CSSProperties } from 'react'

/**
 * Example numbers, labelled as such. They describe no real student and no real
 * career: 21 of 34 aprobadas is 62%, and every figure below agrees with that.
 */
const EXAMPLE = { total: 34, passed: 21, current: 5, pending: 8 } as const
const PERCENT = Math.round((EXAMPLE.passed / EXAMPLE.total) * 100)

type BubbleState = 'passed' | 'current' | 'pending'

/** One bubble per subject on a sunflower spiral; state order is shuffled by a fixed stride. */
const BUBBLES = Array.from({ length: EXAMPLE.total }, (_, i) => {
  const angle = i * 2.39996
  const radius = 8.4 * Math.sqrt(i + 0.6)
  const slot = (i * 13) % EXAMPLE.total
  const state: BubbleState =
    slot < EXAMPLE.passed
      ? 'passed'
      : slot < EXAMPLE.passed + EXAMPLE.current
        ? 'current'
        : 'pending'
  return {
    cx: 60 + radius * Math.cos(angle),
    cy: 60 + radius * Math.sin(angle),
    r: 3.6 + ((i * 7) % 4),
    state,
  }
})

/**
 * Progress drawn as the Campus C: a round-capped arc that closes as the career
 * does. `pathLength` 100 makes the dash the percentage itself.
 */
function ProgressRing() {
  return (
    <svg className="lp-ring" viewBox="0 0 120 120" aria-hidden focusable="false">
      <circle className="lp-ring-track" cx="60" cy="60" r="46" pathLength={100} />
      <circle
        className="lp-ring-fill"
        cx="60"
        cy="60"
        r="46"
        pathLength={100}
        strokeDasharray={`${PERCENT} 100`}
      />
    </svg>
  )
}

function Bubbles() {
  return (
    <svg className="lp-bubbles" viewBox="0 0 120 120" aria-hidden focusable="false">
      {BUBBLES.map((bubble, i) => (
        <circle
          key={i}
          className="lp-bubble"
          data-state={bubble.state}
          cx={bubble.cx.toFixed(2)}
          cy={bubble.cy.toFixed(2)}
          r={bubble.r}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  )
}

export function ProgressShowcase() {
  return (
    <section
      aria-labelledby="lp-progress-title"
      className="lp-container lp-section pt-0"
      data-reveal
    >
      <div className="lp-progress">
        <div>
          <p className="lp-eyebrow">Tu avance</p>
          <h2 id="lp-progress-title" className="lp-heading lp-h2 mt-3">
            Mirá cuánto te falta. Y cuánto ya hiciste.
          </h2>
          <p className="lp-lead mt-4">
            Cada materia que aprobás cierra un poco más el círculo. Campus cuenta por vos lo
            aprobado, lo que estás cursando y lo que queda, sin planillas.
          </p>
        </div>

        <div className="lp-progress-board">
          <div className="lp-stat">
            <span className="lp-example">Ejemplo</span>
            <div>
              <p className="lp-stat-label">Carrera aprobada</p>
              <p className="lp-stat-number">{PERCENT}%</p>
              <p className="lp-stat-caption">
                {EXAMPLE.passed} de {EXAMPLE.total} materias
              </p>
            </div>
            <ProgressRing />
          </div>
          <div className="lp-stat">
            <span className="lp-example">Ejemplo</span>
            <div>
              <p className="lp-stat-label">Materias del plan</p>
              <p className="lp-stat-number">{EXAMPLE.total}</p>
              <p className="lp-stat-caption">Una burbuja por materia</p>
            </div>
            <Bubbles />
          </div>
          <ul className="lp-blocks" aria-label="Ejemplo de materias por estado">
            <li className="lp-block" data-state="passed" style={{ '--i': 0 } as CSSProperties}>
              <span className="lp-block-number">{EXAMPLE.passed}</span>
              <span className="lp-block-label">Aprobadas</span>
            </li>
            <li className="lp-block" data-state="current" style={{ '--i': 1 } as CSSProperties}>
              <span className="lp-block-number">{EXAMPLE.current}</span>
              <span className="lp-block-label">Cursando</span>
            </li>
            <li className="lp-block" data-state="pending" style={{ '--i': 2 } as CSSProperties}>
              <span className="lp-block-number">{EXAMPLE.pending}</span>
              <span className="lp-block-label">Pendientes</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
