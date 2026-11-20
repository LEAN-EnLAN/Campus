import { CalendarPlus, KeyRound, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Illustration } from '@/components/ui/illustration'
import type { IllustrationName } from '@/components/ui/illustrations'

type Span = 'wide' | 'half' | 'third'

function Tile({
  span,
  title,
  tag,
  children,
  art,
  highlight = false,
}: {
  span: Span
  title: string
  tag?: string
  children: ReactNode
  art: ReactNode
  highlight?: boolean
}) {
  return (
    <article className={`lp-tile lp-tile--${span}`} data-highlight={highlight || undefined}>
      {tag ? <span className="lp-tag">{tag}</span> : null}
      <h3 className="lp-tile-title">{title}</h3>
      <p className="lp-tile-text">{children}</p>
      {art}
    </article>
  )
}

/**
 * Campus's own illustrations (public/campus-blue-assets), through the shared
 * `Illustration` so the 1x/2x srcset, intrinsic size and lazy loading are the
 * same as everywhere else in the app.
 */
function TileArt({ name, alt }: { name: IllustrationName; alt: string }) {
  return (
    <div className="lp-tile-art">
      <Illustration name={name} alt={alt} size="lg" className="lp-tile-img" />
    </div>
  )
}

export function FeatureMosaic() {
  return (
    <section
      aria-labelledby="lp-features-title"
      className="lp-container lp-section"
      data-reveal
    >
      <p className="lp-eyebrow">Qué hace Campus</p>
      <h2 id="lp-features-title" className="lp-heading lp-h2 mt-3 max-w-3xl">
        Todo lo que tu carrera te pide, en el orden en que te lo pide.
      </h2>
      <p className="lp-lead mt-4">
        Nada de planillas que se desactualizan: Campus entiende el plan, las correlativas y tus
        fechas, y te muestra lo que importa ahora.
      </p>

      <div className="lp-mosaic">
        <Tile
          span="wide"
          title="Radar de Hoy"
          tag="Lo primero que ves"
          art={
            <TileArt
              name="section-today"
              alt="Hoja con una lista tildada, una taza y un sol azul que asoma"
            />
          }
        >
          Lo que vence pronto, arriba. Debajo, lo que podés ir adelantando para que el parcial
          no te agarre de sorpresa.
        </Tile>
        <Tile
          span="half"
          title="Plan y correlativas"
          tag="Con simulador"
          art={
            <TileArt
              name="section-plan"
              alt="Seis hojas de calendario en grilla, una por cuatrimestre"
            />
          }
        >
          Tu plan real, año por año. Marcá lo aprobado y mirá qué se destraba. Y probá el
          simulador: ¿qué curso el cuatri que viene?
        </Tile>
        <Tile
          span="third"
          title="Finales que más destraban"
          art={
            <TileArt
              name="status-approved-celebration"
              alt="Medalla con una tilde y dos cintas, entre papelitos azules"
            />
          }
        >
          Qué final rendir primero para habilitar más materias.
        </Tile>
        <Tile
          span="third"
          title="Asistente con tu propia clave"
          tag="BYOK"
          highlight
          art={
            <ul className="lp-key-facts" aria-label="Cómo funciona la clave propia">
              <li>
                <KeyRound aria-hidden size={18} />
                Elegís el proveedor
              </li>
              <li>
                <KeyRound aria-hidden size={18} />
                Controlás lo que gastás
              </li>
              <li>
                <KeyRound aria-hidden size={18} />
                La quitás cuando quieras
              </li>
            </ul>
          }
        >
          Conectá tu clave de IA y usá el asistente sin pagarle nada a Campus.
        </Tile>
        <Tile
          span="third"
          title="Compartí tus fechas"
          art={
            <>
              <div className="lp-share-badges" aria-hidden>
                <span className="lp-share-badge">
                  <MessageCircle size={18} />
                  WhatsApp
                </span>
                <span className="lp-share-badge">
                  <CalendarPlus size={18} />
                  Archivo .ics
                </span>
              </div>
              <TileArt
                name="section-calendar"
                alt="Calendario de pie con la grilla en blanco y un día marcado"
              />
            </>
          }
        >
          Pasale la fecha del parcial al grupo por WhatsApp o sumala a tu calendario con un
          .ics.
        </Tile>
      </div>
    </section>
  )
}
