import { CalendarPlus, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'plan' | 'calendar' | 'assistant' | 'progress' | 'share'
type Span = 'wide' | 'half' | 'third'

function Tile({
  tone,
  span,
  title,
  tag,
  children,
  art,
}: {
  tone: Tone
  span: Span
  title: string
  tag?: string
  children: ReactNode
  art: ReactNode
}) {
  return (
    <article className={`lp-tile lp-tile--${span}`} data-tone={tone}>
      {tag ? <span className="lp-tag">{tag}</span> : null}
      <h3 className="lp-tile-title">{title}</h3>
      <p className="lp-tile-text">{children}</p>
      {art}
    </article>
  )
}

function TileArt({ name, alt }: { name: string; alt: string }) {
  return (
    <img
      className="lp-tile-art"
      src={`/landing/${name}.webp`}
      width={800}
      height={800}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  )
}

export function FeatureMosaic() {
  return (
    <section
      aria-labelledby="lp-features-title"
      className="lp-container lp-section"
      data-reveal
    >
      <h2 id="lp-features-title" className="lp-heading lp-h2 max-w-3xl">
        Todo lo que tu carrera te pide, en el orden en que te lo pide.
      </h2>
      <p className="lp-lead mt-4">
        Nada de planillas que se desactualizan: Campus entiende el plan, las correlativas y tus
        fechas, y te muestra lo que importa ahora.
      </p>

      <div className="lp-mosaic">
        <Tile
          tone="calendar"
          span="wide"
          title="Radar de Hoy"
          tag="Lo primero que ves"
          art={
            <TileArt
              name="tile-calendar"
              alt="Calendario con fechas marcadas, libros y un despertador"
            />
          }
        >
          Lo que vence pronto, arriba. Debajo, lo que podés ir adelantando para que el parcial
          no te agarre de sorpresa.
        </Tile>
        <Tile
          tone="plan"
          span="half"
          title="Plan y correlativas"
          tag="Con simulador"
          art={
            <TileArt
              name="tile-plan"
              alt="Árbol de materias conectadas, coloreadas según su estado"
            />
          }
        >
          Tu plan real, año por año. Marcá lo aprobado y mirá qué se destraba. Y probá el
          simulador: ¿qué curso el cuatri que viene?
        </Tile>
        <Tile
          tone="progress"
          span="third"
          title="Finales que más destraban"
          art={<TileArt name="tile-progress" alt="Copa de vidrio que se va llenando" />}
        >
          Qué final rendir primero para habilitar más materias.
        </Tile>
        <Tile
          tone="assistant"
          span="third"
          title="Asistente con tu propia clave"
          tag="BYOK"
          art={<TileArt name="tile-assistant" alt="Globo de chat con una llave dorada" />}
        >
          Conectá tu clave de IA: elegís el proveedor y controlás lo que gastás.
        </Tile>
        <Tile
          tone="share"
          span="third"
          title="Compartí tus fechas"
          art={
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
          }
        >
          Pasale la fecha del parcial al grupo por WhatsApp o sumala a tu calendario con un
          .ics.
        </Tile>
      </div>
    </section>
  )
}
