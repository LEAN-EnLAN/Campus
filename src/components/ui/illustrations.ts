/**
 * The illustration registry: one place that knows every image's file name,
 * intrinsic size and Spanish alt text.
 *
 * Files live in public/campus-blue-assets as `<name>.webp` (1x) and
 * `<name>@2x.webp`, built from the PNG masters by scripts/optimize-assets.mjs.
 * `vector: true` marks a slot that still ships its provisional `<name>.svg`
 * instead of a raster. Only the four `ambient-*` backdrops keep it: their STYLE-A
 * masters are 1280x800 object spots, not 1920x640 bands, and the time-of-day
 * backdrop is a CSS gradient that mounts no image (DESIGN_SYSTEM.md section 6).
 * A name that is not here does not type-check, so a typo or a deleted image
 * fails the build instead of rendering a broken <img>.
 *
 * `alt` is what the picture shows. Use it when the image adds meaning; mark the
 * <Illustration> `decorative` when the heading beside it already says it.
 */
export const ILLUSTRATIONS = {
  'workspace-local': {
    width: 640,
    height: 400,
    alt: 'Carpeta de materias guardada en esta computadora',
  },
  'workspace-cloud': {
    width: 640,
    height: 400,
    alt: 'Carpeta de materias conectada con Campus Cloud',
  },
  'vault-cloud-unavailable': {
    width: 640,
    height: 400,
    alt: 'Carpeta de cuadernos separada de una nube por una conexión interrumpida',
  },
  'calendar-empty': {
    width: 640,
    height: 400,
    alt: 'Calendario académico de pie con la grilla de días vacía',
  },
  'material-empty': {
    width: 640,
    height: 400,
    alt: 'Libro abierto junto a un eslabón de enlace para guardar material',
  },
  'notes-empty': {
    width: 640,
    height: 400,
    alt: 'Cuaderno abierto con hojas en blanco y una lapicera azul',
  },
  'onboarding-ready': {
    width: 640,
    height: 400,
    alt: 'Documento académico con marca de confirmación',
  },
  'gentle-error': {
    width: 640,
    height: 400,
    alt: 'Hoja con un símbolo de atención ante un error recuperable',
  },
  'folder-picker-empty': {
    width: 640,
    height: 400,
    alt: 'Carpeta abierta y vacía, lista para elegir apuntes',
  },
  'onboarding-university': {
    width: 640,
    height: 400,
    alt: 'Edificio universitario sin emblemas',
  },
  'onboarding-faculty': {
    width: 640,
    height: 400,
    alt: 'Tres edificios de facultad sobre una misma base',
  },
  'onboarding-program': {
    width: 640,
    height: 400,
    alt: 'Libros, diploma y birrete para elegir carrera',
  },
  'onboarding-plan': {
    width: 640,
    height: 400,
    alt: 'Hojas de un plan de estudios para revisar',
  },
  'onboarding-manual': {
    width: 640,
    height: 400,
    alt: 'Ficha académica y lápiz para una carrera propia',
  },
  'onboarding-progress': {
    width: 640,
    height: 400,
    alt: 'Fichas de materias, algunas ya marcadas como aprobadas',
  },
  'login-signin': {
    width: 640,
    height: 400,
    alt: 'Puerta entreabierta junto a un libro cerrado',
  },
  'login-signup': {
    width: 640,
    height: 400,
    alt: 'Cuaderno nuevo junto a una ficha en blanco',
  },
  'password-recovery': {
    width: 640,
    height: 400,
    alt: 'Sobre abierto junto a una llave',
  },
  'password-new': {
    width: 640,
    height: 400,
    alt: 'Candado junto a una hoja en blanco',
  },
  'auth-email': {
    width: 640,
    height: 400,
    alt: 'Sobre abierto con una tarjeta de correo en blanco',
  },
  'today-study': {
    width: 640,
    height: 400,
    alt: 'Computadora, libro y reloj para un momento de estudio',
  },
  'today-empty': {
    width: 640,
    height: 400,
    alt: 'Escritorio ordenado con cuaderno, taza y planta',
  },
  'plan-unselected': {
    width: 640,
    height: 400,
    alt: 'Estante vacío con un libro, a la espera de elegir carrera',
  },
  'plan-empty': {
    width: 640,
    height: 400,
    alt: 'Grilla de materias vacía con un lugar para agregar',
  },
  'courses-empty': { width: 640, height: 400, alt: 'Pila de carpetas de materias sin rótulos' },
  'courses-filter-empty': {
    width: 640,
    height: 400,
    alt: 'Tres fichas de materias en blanco detrás de una lupa',
  },
  'courses-current-empty': {
    width: 640,
    height: 400,
    alt: 'Libro de cursada con una cinta señaladora sin marcar',
  },
  'courses-finals-empty': {
    width: 640,
    height: 400,
    alt: 'Agenda de finales con la página vacía junto a un reloj',
  },
  'course-not-found': {
    width: 640,
    height: 400,
    alt: 'Ficha de materia bajo una lupa, con el contorno de una ficha que falta',
  },
  'course-tasks-empty': {
    width: 640,
    height: 400,
    alt: 'Ficha de tareas con dos casillas sin marcar y una lapicera',
  },
  'material-drop-zone': {
    width: 640,
    height: 400,
    alt: 'Eslabón de enlace y tarjeta en blanco sobre una bandeja abierta',
  },
  'course-notes-empty': {
    width: 640,
    height: 400,
    alt: 'Dos hojas de apuntes en blanco junto a un eslabón de enlace',
  },
  'notes-select': {
    width: 640,
    height: 400,
    alt: 'Cuaderno cerrado con una cinta señaladora, listo para abrir',
  },
  'search-empty': {
    width: 640,
    height: 400,
    alt: 'Lupa sobre dos fichas en blanco',
  },
  'settings-workspace': {
    width: 640,
    height: 400,
    alt: 'Carpeta abierta con tres separadores junto a una laptop',
  },
  'settings-privacy': {
    width: 640,
    height: 400,
    alt: 'Escudo detrás de un candado y una carpeta cerrada',
  },
  'page-not-found': {
    width: 640,
    height: 400,
    alt: 'Hoja con un señalador y un camino punteado que se corta',
  },
  'offline-study': {
    width: 640,
    height: 400,
    alt: 'Computadora y libro con la conexión interrumpida',
  },
  'config-unavailable': {
    width: 640,
    height: 400,
    alt: 'Carpeta de configuración con un hueco cuadrado y la pieza que falta al lado',
  },
  'settings-appearance': {
    width: 640,
    height: 400,
    alt: 'Abanico de muestras de color azules junto a una paleta',
  },
  'settings-career': {
    width: 640,
    height: 400,
    alt: 'Birrete junto a tres hojas de plan de estudios con cuatrimestres vacíos',
  },
  'account-local': {
    width: 640,
    height: 400,
    alt: 'Laptop con una carpeta de archivos en la pantalla',
  },
  'account-cloud': {
    width: 640,
    height: 400,
    alt: 'Nube con una carpeta de archivos delante',
  },
  'sync-offline': {
    width: 640,
    height: 400,
    alt: 'Nube tachada junto a un cuaderno abierto',
  },
  'status-approved-celebration': {
    width: 640,
    height: 400,
    alt: 'Medalla con una tilde y dos cintas, entre papelitos azules',
  },
  'status-final-pending': {
    width: 640,
    height: 400,
    alt: 'Reloj de arena junto a una hoja de examen final en blanco',
  },
  'import-plan': {
    width: 640,
    height: 400,
    alt: 'Hoja en blanco que pasa a una grilla de seis cuatrimestres',
  },
  'desktop-app': {
    width: 640,
    height: 400,
    alt: 'Monitor con una ventana de aplicación de tres paneles',
  },
  'section-today': {
    width: 640,
    height: 400,
    alt: 'Hoja con una lista, una taza y un sol azul que asoma',
  },
  'section-plan': {
    width: 640,
    height: 400,
    alt: 'Seis hojas de calendario en grilla, una por cuatrimestre',
  },
  'section-courses': {
    width: 640,
    height: 400,
    alt: 'Tres libros académicos apilados, azules y blancos',
  },
  'section-material': {
    width: 640,
    height: 400,
    alt: 'Tres tarjetas de recursos apiladas y dos eslabones de enlace',
  },
  'section-calendar': {
    width: 640,
    height: 400,
    alt: 'Calendario de pie con la grilla en blanco y un día marcado',
  },
  'section-notes': {
    width: 640,
    height: 400,
    alt: 'Cuaderno cerrado con una lapicera azul en diagonal',
  },
  'ambient-morning': { width: 1920, height: 640, vector: true, alt: 'Luz azul de la mañana' },
  'ambient-afternoon': { width: 1920, height: 640, vector: true, alt: 'Luz azul de la tarde' },
  'ambient-evening': { width: 1920, height: 640, vector: true, alt: 'Luz azul del atardecer' },
  'ambient-night': { width: 1920, height: 640, vector: true, alt: 'Luz azul de la noche' },
} as const satisfies Record<
  string,
  { width: number; height: number; alt: string; vector?: true }
>

export type IllustrationName = keyof typeof ILLUSTRATIONS
