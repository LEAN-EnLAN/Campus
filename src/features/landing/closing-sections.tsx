import { ArrowRight, MessageCircle, Plus } from 'lucide-react'

import { LANDING_PLANS } from './catalog-plans'
import { Lockup, StatusPill, WatermarkC } from './landing-brand'
import { landingLinks, WHATSAPP_DISPLAY } from './landing-links'

const STEPS = [
  {
    title: 'Elegí tu carrera',
    text: 'Universidad, facultad y plan. Si tu plan todavía no está, cargás tus materias a mano.',
  },
  {
    title: 'Cargá lo que ya aprobaste',
    text: 'Marcás aprobadas y regulares; Campus recalcula qué podés cursar y rendir.',
  },
  {
    title: 'Sumá tus fechas',
    text: 'Parciales, TPs, finales e inscripciones, desde cualquier pantalla.',
  },
  {
    title: 'Campus te dice qué sigue',
    text: 'Abrís y está: lo de hoy, lo de la semana y lo que conviene adelantar.',
  },
] as const

export function HowItWorks() {
  return (
    <section
      aria-labelledby="lp-steps-title"
      className="lp-container lp-section pt-0"
      data-reveal
    >
      <p className="lp-eyebrow">Cómo funciona</p>
      <h2 id="lp-steps-title" className="lp-heading lp-h2 mt-3">
        Cuatro pasos, una sola vez.
      </h2>
      <p className="lp-lead mt-4">Después, solo abrís y mirás.</p>
      <ol className="lp-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="lp-step">
            <span className="lp-step-number" aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="lp-step-title">{step.title}</h3>
            <p className="lp-step-text">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Where Campus comes from, shown with what it actually ships: every plan in the
 * bundled catalog, with the catalog's own subject count and whether the
 * faculty published its correlativas. Nothing here is typed by hand.
 */
export function CommunityBand() {
  return (
    <section
      aria-labelledby="lp-community-title"
      className="lp-container lp-section pt-0"
      data-reveal
    >
      <div className="lp-navy-panel lp-community">
        <div>
          <p className="lp-eyebrow lp-eyebrow--on-navy">Rosario, Argentina</p>
          <h2 id="lp-community-title" className="lp-heading lp-h2 lp-on-navy mt-3">
            Hecho en Rosario, para estudiantes de todo el mundo.
          </h2>
          <p className="lp-lead lp-lead--on-navy mt-4">
            Campus nació en Rosario, empezando por los planes de la UTN y la UNR. Cada plan sale
            de fuentes oficiales: si un dato no está publicado, Campus te lo dice en vez de
            inventarlo.
          </p>
          <a
            className="lp-text-link lp-text-link--on-navy mt-4"
            href={landingLinks.whatsapp}
            rel="noopener"
          >
            <MessageCircle aria-hidden size={18} />
            ¿Querés tu carrera en Campus? Escribinos
          </a>
        </div>
        <ul className="lp-plans" aria-label="Planes que ya están en Campus">
          {LANDING_PLANS.map((plan) => (
            <li key={plan.id} className="lp-plan">
              <p className="lp-plan-where">
                {plan.institution} · {plan.unit}
              </p>
              <p className="lp-plan-program">{plan.program}</p>
              <p className="lp-plan-count">
                <span className="lp-plan-number">{plan.subjectCount}</span>
                <span className="lp-plan-unit">
                  {plan.subjectCount === 1 ? 'materia' : 'materias'} · {plan.version}
                </span>
              </p>
              <div className="lp-plan-status">
                {plan.prerequisitesKnown ? (
                  <StatusPill status="ok">Con correlativas</StatusPill>
                ) : (
                  <p className="lp-plan-note">
                    La facultad todavía no publicó las correlativas.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const FAQ = [
  {
    q: '¿Es gratis?',
    a: 'Sí. Campus es gratis para estudiantes, sin prueba que vence. Si usás el asistente, la IA la pagás directo a tu proveedor con tu propia clave; Campus no te cobra nada.',
  },
  {
    q: '¿Quién ve mis datos?',
    a: 'Vos. Tus materias y tus fechas son privadas de tu cuenta. Desde Ajustes podés descargar todo o borrar tu cuenta cuando quieras, y las métricas de uso solo se mandan si das permiso.',
  },
  {
    q: '¿Qué es la clave propia?',
    a: 'Es tu clave de API de un proveedor de IA (BYOK: "traé tu propia clave"). La pegás en Campus y el asistente la usa para responderte. Elegís el proveedor, el gasto lo controlás ahí y podés quitarla cuando quieras.',
  },
  {
    q: '¿Funciona sin internet?',
    a: 'La app de Windows tiene modo local: todo queda en una carpeta de tu compu y funciona sin conexión. La versión web y la del celu necesitan conexión.',
  },
] as const

export function Faq() {
  return (
    <section
      aria-labelledby="lp-faq-title"
      className="lp-container lp-section pt-0"
      data-reveal
    >
      <div className="lp-faq">
        <div>
          <h2 id="lp-faq-title" className="lp-heading lp-h2">
            Preguntas frecuentes
          </h2>
          <p className="lp-lead mt-4">
            ¿Te quedó otra? Escribinos por{' '}
            <a className="lp-text-link" href={landingLinks.whatsapp} rel="noopener">
              WhatsApp
            </a>
            .
          </p>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((item) => (
            <details key={item.q} className="lp-faq-item">
              <summary>
                {item.q}
                <Plus aria-hidden size={20} />
              </summary>
              <p className="lp-faq-answer">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ClosingCta() {
  return (
    <section aria-labelledby="lp-cta-title" className="lp-container" data-reveal>
      <div className="lp-navy-panel lp-cta">
        <WatermarkC className="lp-cta-watermark" animate={false} />
        <div className="lp-cta-text">
          <h2 id="lp-cta-title" className="lp-cta-title">
            Tu próximo cuatri, <span className="lp-display-blue">ordenado desde hoy.</span>
          </h2>
          <p className="lp-lead lp-lead--on-navy mt-3">
            Probá la demo sin cuenta, o creá la tuya en un minuto.
          </p>
        </div>
        <div className="lp-hero-actions">
          <a className="lp-btn lp-btn--light" href={landingLinks.demo}>
            Probar la demo
            <ArrowRight aria-hidden size={18} />
          </a>
          <a className="lp-btn lp-btn--outline" href={landingLinks.signUp}>
            Crear cuenta gratis
          </a>
        </div>
      </div>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="lp-container lp-footer">
      <div className="space-y-2">
        <Lockup tone="light" className="lp-footer-lockup" />
        <p>Hecho en Rosario. © {new Date().getFullYear()} Campus.</p>
      </div>
      <nav aria-label="Pie de página" className="lp-footer-links">
        <a href={landingLinks.demo}>Probar la demo</a>
        <a href={landingLinks.signUp}>Crear cuenta</a>
        <a href={landingLinks.windows} rel="noopener">
          Descargar para Windows
        </a>
        <a href={landingLinks.whatsapp} rel="noopener">
          WhatsApp {WHATSAPP_DISPLAY}
        </a>
      </nav>
    </footer>
  )
}
