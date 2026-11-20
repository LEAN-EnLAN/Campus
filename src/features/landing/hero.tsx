import {
  ArrowRight,
  Download,
  GraduationCap,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import { Lockup, StatusPill, WatermarkC, type PillStatus } from './landing-brand'
import { landingLinks } from './landing-links'

/** Stagger index for the hero's one-time arrival. */
const at = (i: number) => ({ '--i': i }) as CSSProperties

/** Sits on the hero's navy, like the lockup on the deck cover. */
export function LandingTopbar() {
  return (
    <header className="lp-topbar">
      <div className="lp-container lp-topbar-inner">
        <a href="/" aria-label="Campus, inicio" className="lp-topbar-home">
          <Lockup tone="dark" />
        </a>
        <nav aria-label="Accesos" className="lp-topbar-links">
          <a className="lp-topbar-link lp-topbar-link--wide" href={landingLinks.demo}>
            Probar la demo
          </a>
          <a className="lp-topbar-link lp-topbar-link--outline" href={landingLinks.signIn}>
            Entrar
          </a>
        </nav>
      </div>
    </header>
  )
}

const HERO_PILLS: ReadonlyArray<{ status: PillStatus; label: string }> = [
  { status: 'ok', label: 'Aprobada' },
  { status: 'cur', label: 'Cursando' },
  { status: 'reg', label: 'Regularizada' },
  { status: 'dis', label: 'Disponible para cursar' },
]

/** The deck cover, translated to the web. */
export function LandingHero() {
  return (
    <section aria-labelledby="lp-hero-title" className="lp-hero">
      <div className="lp-hero-backdrop">
        <WatermarkC className="lp-hero-watermark" />
      </div>
      <div className="lp-container lp-hero-grid">
        <div className="lp-hero-text">
          <h1 id="lp-hero-title" className="lp-display">
            <span className="lp-rise" style={at(0)}>
              Tu plan de estudios,
            </span>{' '}
            <span className="lp-display-blue lp-rise" style={at(1)}>
              convertido en qué hacer hoy.
            </span>
          </h1>
          <p className="lp-hero-lead lp-rise" style={at(2)}>
            Campus conoce tu carrera de verdad: materias, correlativas, finales y fechas. Abrís
            y ya sabés qué te toca, qué podés adelantar y qué conviene cursar después.
          </p>
          <div className="lp-hero-actions lp-rise" style={at(3)}>
            <a className="lp-btn lp-btn--light" href={landingLinks.demo}>
              Probar la demo
              <ArrowRight aria-hidden size={18} />
            </a>
            <a className="lp-btn lp-btn--outline" href={landingLinks.signUp}>
              Crear cuenta gratis
            </a>
          </div>
          <a
            className="lp-hero-download lp-rise"
            style={at(4)}
            href={landingLinks.windows}
            rel="noopener"
          >
            <Download aria-hidden size={18} />
            Descargar para Windows
          </a>
          <ul className="lp-pills lp-hero-pills" aria-label="Los estados de cada materia">
            {HERO_PILLS.map((pill, i) => (
              <li key={pill.status} className="lp-pop" style={at(i + 5)}>
                <StatusPill status={pill.status}>{pill.label}</StatusPill>
              </li>
            ))}
          </ul>
        </div>
        <TodayPreview />
      </div>
      <div className="lp-container">
        <TrustStrip />
      </div>
    </section>
  )
}

type PreviewRow = {
  kind: string
  subject: string
  when: string
  status: PillStatus
  label: string
}

/**
 * A crisp hint of the product, drawn in HTML: what "Hoy" looks like for an
 * example student. Subjects are real ones from the UTN FRRo plan; the student
 * and the dates are nobody's, and the card says so.
 */
const PREVIEW: readonly PreviewRow[] = [
  {
    kind: 'Parcial',
    subject: 'Análisis Matemático II',
    when: 'En 3 días',
    status: 'cur',
    label: 'Cursando',
  },
  {
    kind: 'TP',
    subject: 'Sintaxis y Semántica de los Lenguajes',
    when: 'Vence el viernes',
    status: 'cur',
    label: 'Cursando',
  },
  {
    kind: 'Final',
    subject: 'Física I',
    when: 'Inscripción abierta',
    status: 'reg',
    label: 'Regularizada',
  },
]

function TodayPreview() {
  return (
    <div
      className="lp-preview"
      role="img"
      aria-label="Ejemplo de la pantalla Hoy: un parcial en 3 días, un TP que vence el viernes, una inscripción a final abierta y una materia que ya podés cursar"
    >
      <div className="lp-preview-card lp-preview-card--main lp-rise" style={at(3)}>
        <div className="lp-preview-head">
          <p className="lp-preview-title">Hoy</p>
          <span className="lp-example">Ejemplo</span>
        </div>
        <ul className="lp-preview-list">
          {PREVIEW.map((row) => (
            <li key={row.subject} className="lp-preview-row">
              <span className="lp-preview-when">
                {row.kind} · {row.when}
              </span>
              <span className="lp-preview-subject">{row.subject}</span>
              <StatusPill status={row.status}>{row.label}</StatusPill>
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-preview-card lp-preview-card--next lp-rise" style={at(5)}>
        <p className="lp-preview-eyebrow">Podés adelantar</p>
        <p className="lp-preview-subject">Paradigmas de Programación</p>
        <StatusPill status="dis">Disponible para cursar</StatusPill>
      </div>
      <div className="lp-preview-card lp-preview-card--done lp-rise" style={at(6)}>
        <StatusPill status="ok">Aprobada</StatusPill>
        <span className="lp-preview-subject">Álgebra y Geometría Analítica</span>
      </div>
    </div>
  )
}

function TrustItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <li className="lp-trust-item">
      <span className="lp-chip-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="lp-trust-title">{title}</p>
        <p className="lp-trust-text">{children}</p>
      </div>
    </li>
  )
}

/**
 * Only true claims. The institutions are the ones bundled in
 * `public/academic-catalog/institutions.json`; when that list grows, so does
 * this line — never before.
 */
function TrustStrip() {
  return (
    <ul className="lp-trust" aria-label="Lo que tenés que saber">
      <TrustItem icon={<Sparkles size={20} />} title="Gratis para estudiantes">
        Sin prueba que vence ni funciones bloqueadas.
      </TrustItem>
      <TrustItem icon={<ShieldCheck size={20} />} title="Tus datos son tuyos">
        Exportá o borrá todo cuando quieras, desde Ajustes.
      </TrustItem>
      <TrustItem icon={<MonitorSmartphone size={20} />} title="Web, celu y Windows">
        Empezás en la compu y seguís en el colectivo.
      </TrustItem>
      <TrustItem icon={<GraduationCap size={20} />} title="Planes reales de UTN y UNR">
        Ing. en Sistemas (UTN FRRo) y Lic. en Cs. de la Computación (UNR FCEIA).
      </TrustItem>
    </ul>
  )
}
