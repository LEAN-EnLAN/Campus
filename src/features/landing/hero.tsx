import {
  ArrowRight,
  Download,
  GraduationCap,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { CampusLogo } from '@/components/brand/campus-logo'

import { landingLinks } from './landing-links'

export function LandingTopbar() {
  return (
    <header className="lp-container lp-topbar">
      <a href="/" aria-label="Campus, inicio" className="text-xl">
        <CampusLogo wordmark />
      </a>
      <nav aria-label="Accesos" className="lp-topbar-links">
        <a className="lp-topbar-link lp-topbar-link--wide" href={landingLinks.demo}>
          Probar la demo
        </a>
        <a className="lp-topbar-link" href={landingLinks.signIn}>
          Entrar
        </a>
      </nav>
    </header>
  )
}

export function LandingHero() {
  return (
    <section aria-labelledby="lp-hero-title" className="lp-container">
      <div className="lp-band">
        <div className="lp-hero">
          <div className="min-w-0">
            <h1 id="lp-hero-title" className="lp-hero-title">
              Tu plan de estudios, convertido en qué hacer hoy.
            </h1>
            <p className="lp-hero-copy">
              Campus conoce tu carrera de verdad: materias, correlativas, finales y fechas.
              Abrís y ya sabés qué te toca, qué podés adelantar y qué conviene cursar después.
            </p>
            <div className="lp-hero-actions">
              <a className="lp-btn lp-btn--light" href={landingLinks.demo}>
                Probar la demo
                <ArrowRight aria-hidden size={18} />
              </a>
              <a className="lp-btn lp-btn--ghost" href={landingLinks.signUp}>
                Crear cuenta gratis
              </a>
            </div>
            <a className="lp-hero-download" href={landingLinks.windows} rel="noopener">
              <Download aria-hidden size={18} />
              Descargar para Windows
            </a>
          </div>
          <div className="lp-hero-art">
            <img
              src="/landing/hero.webp"
              width={1600}
              height={1200}
              alt="Escritorio de estudiante con apuntes, un calendario y Campus abierto en la notebook y el celular"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </div>
      <TrustStrip />
    </section>
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
