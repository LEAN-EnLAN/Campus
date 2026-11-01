/**
 * The illustration registry: one place that knows every image's file name,
 * intrinsic size and Spanish alt text.
 *
 * Files live in public/campus-blue-assets as `<name>.webp` (1x) and
 * `<name>@2x.webp`, built from the PNG masters by scripts/optimize-assets.mjs.
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
  'workspace-cloud': { width: 640, height: 400, alt: 'Espacio académico de Campus Cloud' },
  'vault-cloud-unavailable': {
    width: 640,
    height: 400,
    alt: 'Carpeta de apuntes local separada de Campus Cloud',
  },
  'calendar-empty': {
    width: 640,
    height: 400,
    alt: 'Calendario académico sin fechas registradas',
  },
  'material-empty': {
    width: 640,
    height: 400,
    alt: 'Libro y enlace para guardar material académico',
  },
  'notes-empty': {
    width: 640,
    height: 400,
    alt: 'Cuaderno preparado para escribir la primera nota',
  },
  'onboarding-ready': {
    width: 640,
    height: 400,
    alt: 'Documento académico con marca de confirmación',
  },
  'gentle-error': {
    width: 640,
    height: 400,
    alt: 'Símbolo de atención ante un error recuperable',
  },
  'folder-picker-empty': {
    width: 640,
    height: 400,
    alt: 'Carpeta abierta preparada para elegir apuntes',
  },
  'onboarding-university': {
    width: 640,
    height: 400,
    alt: 'Edificio universitario sin emblemas',
  },
  'onboarding-faculty': {
    width: 640,
    height: 400,
    alt: 'Carpetas junto a un edificio de facultad',
  },
  'onboarding-program': {
    width: 640,
    height: 400,
    alt: 'Libro abierto y brújula para elegir carrera',
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
    alt: 'Fichas de materias para registrar el recorrido',
  },
  'login-signin': { width: 640, height: 400, alt: 'Libro junto a una puerta entreabierta' },
  'login-signup': { width: 640, height: 400, alt: 'Cuaderno nuevo con una ficha para empezar' },
  'password-recovery': {
    width: 640,
    height: 400,
    alt: 'Sobre y llave para recuperar el acceso',
  },
  'password-new': {
    width: 640,
    height: 400,
    alt: 'Candado junto a una hoja para una contraseña nueva',
  },
  'auth-email': { width: 640, height: 400, alt: 'Sobre con una tarjeta de correo sin texto' },
  'today-study': { width: 640, height: 400, alt: 'Libro y mate para un momento de estudio' },
  'today-empty': {
    width: 640,
    height: 400,
    alt: 'Agenda abierta con espacio para organizar el día',
  },
  'plan-unselected': {
    width: 640,
    height: 400,
    alt: 'Índice académico abierto para elegir un recorrido',
  },
  'plan-empty': {
    width: 640,
    height: 400,
    alt: 'Carpeta e índice preparados para agregar materias',
  },
  'courses-empty': { width: 640, height: 400, alt: 'Fichas de materias listas para completar' },
  'courses-filter-empty': {
    width: 640,
    height: 400,
    alt: 'Fichas de materias y una lupa sin resultados',
  },
  'courses-current-empty': {
    width: 640,
    height: 400,
    alt: 'Libro de cursada con un señalador sin marcar',
  },
  'courses-finals-empty': {
    width: 640,
    height: 400,
    alt: 'Agenda de finales con un reloj sin fecha asignada',
  },
  'course-not-found': {
    width: 640,
    height: 400,
    alt: 'Ficha de una materia buscada con una lupa',
  },
  'course-tasks-empty': {
    width: 640,
    height: 400,
    alt: 'Ficha de cursada para anotar una tarea',
  },
  'material-drop-zone': {
    width: 400,
    height: 250,
    alt: 'Enlace y tarjeta que se acercan a una bandeja',
  },
  'course-notes-empty': {
    width: 640,
    height: 400,
    alt: 'Dos hojas de apuntes con un enlace por agregar',
  },
  'notes-select': {
    width: 640,
    height: 400,
    alt: 'Cuaderno cerrado con un señalador para abrir',
  },
  'search-empty': { width: 640, height: 400, alt: 'Lupa sobre fichas sin coincidencias' },
  'settings-workspace': {
    width: 640,
    height: 400,
    alt: 'Carpeta y separadores para organizar el espacio',
  },
  'settings-privacy': { width: 640, height: 400, alt: 'Carpeta de apuntes con un candado' },
  'page-not-found': {
    width: 640,
    height: 400,
    alt: 'Señalador y camino interrumpido hacia una hoja',
  },
  'offline-study': {
    width: 640,
    height: 400,
    alt: 'Libro junto a una señal de conexión interrumpida',
  },
  'config-unavailable': {
    width: 640,
    height: 400,
    alt: 'Dossier de configuración con una pieza por completar',
  },
  'ambient-morning': { width: 1920, height: 640, alt: 'Luz azul de la mañana' },
  'ambient-afternoon': { width: 1920, height: 640, alt: 'Luz azul de la tarde' },
  'ambient-evening': { width: 1920, height: 640, alt: 'Luz azul del atardecer' },
  'ambient-night': { width: 1920, height: 640, alt: 'Luz azul de la noche' },
} as const satisfies Record<string, { width: number; height: number; alt: string }>

export type IllustrationName = keyof typeof ILLUSTRATIONS
