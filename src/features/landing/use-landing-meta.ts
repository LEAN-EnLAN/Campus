import { useEffect } from 'react'

export const LANDING_TITLE = 'Campus — tu plan de estudios, convertido en qué hacer hoy'
export const LANDING_DESCRIPTION =
  'Campus es gratis para estudiantes: cargá tu carrera, lo que ya aprobaste y tus fechas, y mirá qué hacer hoy, qué cursar y qué final destraba más. Web, celu y Windows.'

/** Title and description for as long as the landing is on screen. */
export function useLandingMeta(): void {
  useEffect(() => {
    const previousTitle = document.title
    document.title = LANDING_TITLE

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.append(meta)
    }
    const previousDescription = meta.content
    meta.content = LANDING_DESCRIPTION

    return () => {
      document.title = previousTitle
      if (created) meta.remove()
      else meta.content = previousDescription
    }
  }, [])
}
