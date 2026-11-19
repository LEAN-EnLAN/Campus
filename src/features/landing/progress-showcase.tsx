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

/* The trophy spans y = 12…128; the fill rises from the base to PERCENT. */
const FILL_TOP = 128 - (116 * PERCENT) / 100

function Trophy() {
  return (
    <svg className="lp-trophy" viewBox="0 0 120 140" aria-hidden focusable="false">
      <defs>
        <clipPath id="lp-trophy-shape">
          <path d="M22 12H98V40C98 66 82 82 60 84C38 82 22 66 22 40Z" />
          <rect x="52" y="82" width="16" height="23" />
          <path d="M44 104H76L80 112H40Z" />
          <rect x="32" y="112" width="56" height="16" rx="4" />
        </clipPath>
      </defs>
      <g fill="none" strokeWidth="7" strokeLinecap="round">
        <path d="M24 22H12C8 22 6 25 6 29C6 44 15 55 30 58" stroke="var(--lp-rule)" />
        <path d="M96 22H108C112 22 114 25 114 29C114 44 105 55 90 58" stroke="var(--lp-rule)" />
      </g>
      <g clipPath="url(#lp-trophy-shape)">
        <rect className="lp-trophy-cup" x="0" y="0" width="120" height="140" />
        <rect
          className="lp-trophy-fill"
          x="0"
          y={FILL_TOP}
          width="120"
          height={140 - FILL_TOP}
        />
      </g>
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
          <h2 id="lp-progress-title" className="lp-heading lp-h2">
            Mirá cuánto te falta. Y cuánto ya hiciste.
          </h2>
          <p className="lp-lead mt-4">
            Cada materia que aprobás llena un poco más la copa. Campus cuenta por vos lo
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
            <Trophy />
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
