# Campus · Propuesta 2 azul — manifiesto de ilustraciones

**Estado:** 43 assets de producción: 8 originales conservados y 35 SVG nuevos. Inventario inicial y ampliación verificable abajo.
**Fecha:** 26 de octubre de 2026; ampliación: 29 de octubre de 2026.
**Rama:** `feat/campus-proposal2-blue`.
**Alcance:** `public/campus-blue-assets/` y este manifiesto. Sin cambios a componentes ni rutas.

## Identidad gráfica

La familia usa una geometría editorial y académica: planos rectangulares, pequeñas curvas funcionales, un motivo orbital punteado de fondo, contornos navy y una sola familia cromática de azul. Son ilustraciones silenciosas; **el mensaje, las acciones y el estado pertenecen siempre al HTML/React**, no están escritos dentro del SVG.

| Token            | HEX                 | Uso                                                    |
| ---------------- | ------------------- | ------------------------------------------------------ |
| Navy / contorno  | `#1E3976`–`#24417D` | Contorno de pantalla, carpeta, calendario y documentos |
| Navy profundo    | `#101F4C`           | Figura de computadora, siluetas                        |
| Sapphire         | `#416BDE`–`#4D73DB` | Superficie activa y símbolo principal                  |
| Periwinkle       | `#849BF4`–`#9EB0F5` | Superficie secundaria y símbolos complementarios       |
| Ice / papel      | `#F0F5FF`–`#FAFBFF` | Fondo interno; el exterior es transparente             |
| Rule / ornamento | `#CBD9F6`–`#DEE7FC` | Líneas, aros, estructura tenue                         |

Los colores están incorporados en cada SVG para que pueda montarse mediante `<img src>` sin requerir CSS ni inyección de SVG en el DOM. Las formas no tienen degradados, filtros, sombras, CSS externo, fuentes, imágenes raster, animaciones ni elementos de marca de terceros.

## Inventario inicial (8 originales sin modificar)

Las ocho ilustraciones originales tienen **dimensión intrínseca `640 × 400`**, `viewBox="0 0 640 400"`, fondo exterior transparente, `role="img"` y `<title>` accesible para inserción inline. Pesan menos de 3 KB individualmente.

| Ruta URL pública                                  | Superficie / estado                                           | `alt` recomendado (es-AR)                                             |
| ------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/campus-blue-assets/workspace-local.svg`         | S00, selector de carpeta local                                | `Ilustración de una carpeta de materias guardada en esta computadora` |
| `/campus-blue-assets/workspace-cloud.svg`         | S00, selector Campus Cloud                                    | `Ilustración de un espacio académico almacenado en Cloud`             |
| `/campus-blue-assets/vault-cloud-unavailable.svg` | S14, Vault inaccesible desde Cloud                            | `Carpeta de apuntes local separada del espacio Cloud`                 |
| `/campus-blue-assets/calendar-empty.svg`          | S09–S11, calendario sin eventos cargados                      | `Calendario académico todavía sin fechas registradas`                 |
| `/campus-blue-assets/material-empty.svg`          | S12, lista de material sin recursos                           | `Libro de estudio con un símbolo de enlace para material académico`   |
| `/campus-blue-assets/notes-empty.svg`             | S13, carpeta local sin archivos de notas                      | `Cuaderno de apuntes preparado para empezar una nota`                 |
| `/campus-blue-assets/onboarding-ready.svg`        | S02–S03, confirmación visual posterior a completar onboarding | `Documento académico con una marca de confirmación`                   |
| `/campus-blue-assets/gentle-error.svg`            | Estados de error recuperable / fallo al cargar                | `Panel de Campus con un símbolo de atención`                          |

**Nota semántica:** si el título adyacente a la imagen explica por completo el estado, se recomienda `alt=""` para evitar que el lector de pantalla anuncie información redundante. No usar `onboarding-ready.svg` antes de confirmar que la operación terminó correctamente, ni sugerir sincronización Cloud↔notas locales con `vault-cloud-unavailable.svg`.

## Integración React

No requiere import de Vite, sprites ni dependencias. Ejemplo con tamaño contenido y ratio nativo:

```tsx
<img
  src="/campus-blue-assets/workspace-local.svg"
  alt="Ilustración de una carpeta de materias guardada en esta computadora"
  width={640}
  height={400}
  loading="lazy"
  decoding="async"
  className="h-auto w-full max-w-72"
/>
```

En tarjetas de selección Local/Cloud usar un tamaño visual comparable para ambos assets (`max-width: 240–280px`). Para los estados vacíos colocar imagen sobre título/acción, ancho recomendable de `176–240px` en 390 px y `220–300px` en 1440 px. Los SVG poseen un margen óptico interno, por lo que no necesitan padding adicional.

Los assets son presentacionales: no incluyen texto de interfaz ni botones. La accesibilidad del componente que los incorpora debe asegurar etiqueta de control, foco, feedback y contraste del texto por separado.

## Procedencia y derechos

- **Origen:** formas vectoriales originales dibujadas por código para la propuesta azul de Campus, en este worktree.
- **Generación nativa ImageGen:** **ninguna**; no se dispone de ese renderizador en esta sesión. Estos archivos **no** son originales nativos ImageGen, screenshots ni generados en Canva.
- **Material de terceros:** ninguno. No incorporan archivos externos, bibliotecas de iconos con licencia separada, tipografías ni logotipos ajenos.
- **Licenciamiento:** recursos encargados para uso, adaptación e incorporación en Campus; el repositorio no contiene en este trabajo una licencia explícita nueva para redistribución independiente. Su eventual publicación sigue la licencia/términos generales que determine el titular del proyecto. No se declara una licencia CC0 o MIT que no haya sido autorizada.
- **Seguridad SVG:** no usan `script`, `foreignObject`, `image`, URLs externas, CSS remoto ni eventos embebidos.

## QA y límites

La familia está diseñada para funcionar en distintos fondos gracias a sus interiores de papel/ice y contornos oscuros. Las validaciones exigidas son parse XML, dimensión `640×400`, ocho nombres únicos y ausencia de texto visible embebido. El tamaño total está dentro de un presupuesto pequeño de descarga.

Queda para el integrador verificar contraste del **texto y los controles React**, reflow en 390/768/1440, carga de todos los recursos en navegador de producto y que la ilustración no desplace la acción principal por debajo del primer viewport. Ninguna ilustración constituye una captura de una pantalla funcionando ni evidencia de cambio de estado del backend.

## Cobertura ampliada — 29 de octubre de 2026

**63 superficies cubiertas, 35 assets nuevos, 8 reutilizados sin modificar y 8 exclusiones justificadas.** Las ubicaciones son puntos de integración propuestos observados; no prueban integración. Las líneas pueden desplazarse si otro agente continúa editando.

### Familia, tamaño y accesibilidad

Se conserva la familia editorial de órbita punteada, libros, fichas y carpetas. Los nuevos SVG usan exactamente ink #10224a, accent #155dd6, accent-soft #e7f0ff, paper-sunken #eef4fd, paper-elevated #ffffff, rule #d6e1f1 e ink-faint #798dac de `campus-blue.css`. Los ocho originales conservan su paleta histórica. `tokens.css` no existe; `globals.css` contiene los tokens base. Los contornos nuevos usan `currentColor` con `var(--color-ink, #10224a)` como fallback inline; un `<img>` externo usa la paleta incorporada sin heredar colores del documento.

Ilustraciones nuevas: 640 × 400; fondos: 1920 × 640. Son vectores escalables sin exportaciones 2x duplicadas, con exterior transparente. Mostrar una sola ilustración pequeña por panel (176–240 px), 80–120 px en drop zone; mantener instrucciones y controles visibles. No llenar listas, columnas o banners con imágenes. Los nuevos SVG no incluyen texto visible, fuentes, scripts, recursos externos, logos, parecidos personales, degradados ni animaciones.

`alt` contiene descripción española; usar `alt=""` cuando el título HTML ya explica el estado. Fondos siempre decorativos (`alt=""`; `aria-hidden="true"` inline). Cada SVG tiene `<title>` para consumo inline. La imagen no sustituye título, acción, validación, estado ni foco.

### Superficies y puntos de integración

| ID                  | Superficie                                   | Archivo:línea observado                               | Asset                         |
| ------------------- | -------------------------------------------- | ----------------------------------------------------- | ----------------------------- |
| S00-local           | Startup: local workspace                     | `src/app/startup.tsx:255`                             | `workspace-local.svg`         |
| S02-local           | Onboarding: local summary                    | `src/routes/onboarding.tsx:438`                       | `workspace-local.svg`         |
| S00-cloud           | Startup: Cloud workspace                     | `src/app/startup.tsx:367`                             | `workspace-cloud.svg`         |
| S02-cloud           | Onboarding: Cloud summary                    | `src/routes/onboarding.tsx:452`                       | `workspace-cloud.svg`         |
| S01-cloud           | Login: Cloud aside                           | `src/routes/login.tsx:286`                            | `workspace-cloud.svg`         |
| S14-cloud           | Notes unavailable in Cloud                   | `src/routes/_app/vault.tsx:52`                        | `vault-cloud-unavailable.svg` |
| S09-empty           | Calendar: no events                          | `src/routes/_app/calendar.tsx:43`                     | `calendar-empty.svg`          |
| S09-agenda          | Agenda: no upcoming events                   | `src/features/calendar/agenda-list.tsx:48`            | `calendar-empty.svg`          |
| S04-calendar        | Today: calendar aside                        | `src/features/blue/blue-today-screen.tsx:220`         | `calendar-empty.svg`          |
| S12-empty           | Library: no resources                        | `src/routes/_app/library.tsx:272`                     | `material-empty.svg`          |
| S08-material        | Course: no saved material                    | `src/routes/_app/courses.$courseId.tsx:307`           | `material-empty.svg`          |
| S13-empty           | Notes: empty vault                           | `src/components/workspace/workspace-shell.tsx:516`    | `notes-empty.svg`             |
| S13-recents         | Quick switcher: no notes                     | `src/components/workspace/quick-switcher.tsx:91`      | `notes-empty.svg`             |
| S03-ready           | Onboarding: persisted configuration complete | `src/routes/onboarding.tsx:160`                       | `onboarding-ready.svg`        |
| S-error             | Shared recoverable query errors              | `src/components/empty-state.tsx:90`                   | `gentle-error.svg`            |
| S13-load-error      | Notes: failed load                           | `src/components/workspace/note-editor.tsx:225`        | `gentle-error.svg`            |
| S00-folder-error    | Folder picker: refused/unavailable           | `src/app/folder-picker.tsx:26`                        | `gentle-error.svg`            |
| S00-folder          | Folder picker: empty folder                  | `src/app/folder-picker.tsx:298`                       | `folder-picker-empty.svg`     |
| S02-university      | Onboarding: institution selection            | `src/routes/onboarding.tsx:257`                       | `onboarding-university.svg`   |
| S02-faculty         | Onboarding: faculty or regional selection    | `src/routes/onboarding.tsx:288`                       | `onboarding-faculty.svg`      |
| S02-program         | Onboarding: degree selection                 | `src/routes/onboarding.tsx:314`                       | `onboarding-program.svg`      |
| S02-plan            | Onboarding: curriculum version selection     | `src/routes/onboarding.tsx:342`                       | `onboarding-plan.svg`         |
| S02-manual          | Onboarding: manual degree entry              | `src/routes/onboarding.tsx:371`                       | `onboarding-manual.svg`       |
| S03-progress        | Initial academic progress entry              | `src/features/academic/progress-entry-screen.tsx:140` | `onboarding-progress.svg`     |
| S01-signin          | Authentication: sign in                      | `src/routes/login.tsx:149`                            | `login-signin.svg`            |
| S01-signup          | Authentication: create account               | `src/routes/login.tsx:144`                            | `login-signup.svg`            |
| S01-reset           | Authentication: request recovery email       | `src/routes/login.tsx:146`                            | `password-recovery.svg`       |
| S01-password        | Authentication: enter new password           | `src/routes/login.tsx:148`                            | `password-new.svg`            |
| S01-notice          | Authentication: email/confirmation notices   | `src/routes/login.tsx:253`                            | `auth-email.svg`              |
| S04-hero            | Today: study summary spot                    | `src/features/blue/blue-today-screen.tsx:159`         | `today-study.svg`             |
| S04-empty           | Today: no pending tasks                      | `src/features/blue/blue-today-screen.tsx:180`         | `today-empty.svg`             |
| S04-legacy-empty    | Today: legacy no further tasks               | `src/routes/_app/today.tsx:128`                       | `today-empty.svg`             |
| S05-context         | Plan: no academic context                    | `src/routes/_app/plan.tsx:53`                         | `plan-unselected.svg`         |
| S06-context         | Courses: no academic context                 | `src/routes/_app/courses.index.tsx:133`               | `plan-unselected.svg`         |
| S04-context         | Today: no academic context                   | `src/features/blue/blue-today-screen.tsx:208`         | `plan-unselected.svg`         |
| S03-context         | Progress: no academic context                | `src/features/academic/progress-entry-screen.tsx:68`  | `plan-unselected.svg`         |
| S15-context         | Settings: degree not selected                | `src/features/settings/settings-screen.tsx:311`       | `plan-unselected.svg`         |
| S05-empty           | Plan: no manually added subjects             | `src/routes/_app/plan.tsx:141`                        | `plan-empty.svg`              |
| S03-empty           | Progress: no subjects to mark                | `src/features/academic/progress-entry-screen.tsx:87`  | `plan-empty.svg`              |
| S06-empty           | Courses: no subjects entered                 | `src/routes/_app/courses.index.tsx:242`               | `courses-empty.svg`           |
| S06-filter          | Courses: empty filtered list                 | `src/routes/_app/courses.index.tsx:247`               | `courses-filter-empty.svg`    |
| S06-current         | Courses: none currently studying             | `src/routes/_app/courses.index.tsx:244`               | `courses-current-empty.svg`   |
| S06-finals          | Courses: no pending finals                   | `src/routes/_app/courses.index.tsx:246`               | `courses-finals-empty.svg`    |
| S08-missing         | Course detail: subject not found             | `src/routes/_app/courses.$courseId.tsx:91`            | `course-not-found.svg`        |
| S08-tasks           | Course detail: no tasks                      | `src/routes/_app/courses.$courseId.tsx:186`           | `course-tasks-empty.svg`      |
| S08-drop            | Add material dialog: link/text drop zone     | `src/features/courses/add-resource-dialog.tsx:223`    | `material-drop-zone.svg`      |
| S08-notes           | Course detail: no note mentions              | `src/features/courses/subject-notes.tsx:147`          | `course-notes-empty.svg`      |
| S13-pane            | Notes: vault has notes but pane empty        | `src/components/workspace/workspace-shell.tsx:522`    | `notes-select.svg`            |
| S-search            | Global search: no matches                    | `src/features/search/search-palette.tsx:200`          | `search-empty.svg`            |
| S12-filter          | Library: no filter matches                   | `src/routes/_app/library.tsx:283`                     | `search-empty.svg`            |
| S13-search          | Note search: no matches                      | `src/components/workspace/search-dialog.tsx:79`       | `search-empty.svg`            |
| S13-switcher        | Quick switcher: no query matches             | `src/components/workspace/quick-switcher.tsx:91`      | `search-empty.svg`            |
| S00-folder-filter   | Folder picker: no filter matches             | `src/app/folder-picker.tsx:297`                       | `search-empty.svg`            |
| S15-workspace       | Settings: active workspace                   | `src/features/settings/settings-screen.tsx:208`       | `settings-workspace.svg`      |
| S15-privacy         | Settings: privacy explanation                | `src/features/settings/settings-screen.tsx:324`       | `settings-privacy.svg`        |
| S404                | Root route: page not found                   | `src/routes/__root.tsx:10`                            | `page-not-found.svg`          |
| S-offline-auth      | Authentication: network unavailable          | `src/routes/login.tsx:259`                            | `offline-study.svg`           |
| S-offline-startup   | Startup: Cloud unreachable                   | `src/app/startup.tsx:390`                             | `offline-study.svg`           |
| S-config            | Startup: missing configuration               | `src/app/config-error.tsx:10`                         | `config-unavailable.svg`      |
| S-ambient-morning   | Ambient: morning                             | `src/lib/theme/theme-context.tsx:80`                  | `ambient-morning.svg`         |
| S-ambient-afternoon | Ambient: afternoon                           | `src/lib/theme/theme-context.tsx:80`                  | `ambient-afternoon.svg`       |
| S-ambient-evening   | Ambient: evening                             | `src/lib/theme/theme-context.tsx:80`                  | `ambient-evening.svg`         |
| S-ambient-night     | Ambient: night                               | `src/lib/theme/theme-context.tsx:80`                  | `ambient-night.svg`           |

### Superficies sin asset adicional

| Superficie                                   | Archivo:línea                                     | Motivo                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Kanban: four empty columns                   | `src/features/courses/subject-board-view.tsx:96`  | Keep concise state sentences and drag targets; four illustrations crowd dense columns and risk implying academic eligibility. |
| Note backlinks: no mentions                  | `src/components/workspace/backlinks-panel.tsx:44` | Compact editor metadata; existing sentence suffices, avoid duplicate note illustration.                                       |
| File explorer: empty directory               | `src/components/workspace/file-explorer.tsx:176`  | Source suppresses duplicate empty-folder message; main empty pane already maps to notes-empty.svg.                            |
| Editor: conflict, deleted file or save error | `src/components/workspace/note-editor.tsx:238`    | Keep recovery actions immediately visible in narrow safety banners; load failure maps to gentle-error.svg.                    |
| Loading skeletons                            | `src/components/empty-state.tsx:61`               | Keep deterministic row geometry; illustration would suggest a settled state.                                                  |
| Developer scenarios                          | `src/routes/dev.tsx:44`                           | Internal diagnostic surface outside production student illustration scope.                                                    |
| Unknown prerequisites / availability         | `src/routes/_app/plan.tsx:287`                    | Doctrine requires explicit text for unknown official data; no diagram may invent prerequisites.                               |

| Settings: appearance and account controls | `src/features/settings/settings-screen.tsx:118` | Existing interactive theme swatches and account controls already express the choices; no app-screen image or extra decoration. |

### Períodos y límites semánticos

`ThemeProvider` observa hora local cada minuto: morning 06:00–11:59, afternoon 12:00–17:59, evening 18:00–21:59, night 22:00–05:59. Los cuatro fondos tienen motivo tenue a la derecha y exterior transparente. Mantienen la identidad clara y no reemplazan el gradiente CSS existente. Mantener paneles opacos y evitar texto encima del motivo. No se conectaron al selector de período.

No existe una pantalla global offline: el asset se propone para errores existentes de startup/login, sin prometer escrituras offline en Cloud. El drop zone acepta links/texto, sin representar subida de archivos. Autenticación y finales no implican cuenta existente, correo entregado, contraseña guardada ni materias/finales aprobados. `onboarding-ready.svg` sólo corresponde al guardado confirmado. No sugerir sincronización entre notas locales y Cloud.

### Manifiesto parseable

El siguiente bloque JSON mantiene la fuente estructurada dentro del manifiesto existente, sin un segundo archivo. Incluye ruta, dimensiones, bytes, alt, superficies, archivo:línea, fuente, prompt y procedencia. No se reconstruyen prompts históricos desconocidos. Los nuevos son vectores originales deterministas; no se usó ImageGen, Canva ni material de terceros.

```json
{
  "schemaVersion": 1,
  "updated": "2026-10-29",
  "branch": "feat/campus-proposal2-blue",
  "scope": "Assets and manifest only; no wiring",
  "paletteSource": [
    "src/styles/campus-blue.css:4",
    "src/styles/blue-secondary.css:2",
    "src/styles/globals.css:31"
  ],
  "missingRequestedSource": "tokens.css does not exist; globals.css holds base tokens and campus-blue.css approved scoped overrides.",
  "periods": {
    "morning": "06:00–11:59",
    "afternoon": "12:00–17:59",
    "evening": "18:00–21:59",
    "night": "22:00–05:59"
  },
  "assets": [
    {
      "path": "/campus-blue-assets/workspace-local.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpeta de materias guardada en esta computadora",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S00-local", "S02-local"],
      "intendedComponents": ["src/app/startup.tsx:255", "src/routes/onboarding.tsx:438"],
      "bytes": 2737
    },
    {
      "path": "/campus-blue-assets/workspace-cloud.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Espacio académico de Campus Cloud",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S00-cloud", "S02-cloud", "S01-cloud"],
      "intendedComponents": [
        "src/app/startup.tsx:367",
        "src/routes/onboarding.tsx:452",
        "src/routes/login.tsx:286"
      ],
      "bytes": 2409
    },
    {
      "path": "/campus-blue-assets/vault-cloud-unavailable.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpeta de apuntes local separada de Campus Cloud",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S14-cloud"],
      "intendedComponents": ["src/routes/_app/vault.tsx:52"],
      "bytes": 2371
    },
    {
      "path": "/campus-blue-assets/calendar-empty.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Calendario académico sin fechas registradas",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S09-empty", "S09-agenda", "S04-calendar"],
      "intendedComponents": [
        "src/routes/_app/calendar.tsx:43",
        "src/features/calendar/agenda-list.tsx:48",
        "src/features/blue/blue-today-screen.tsx:220"
      ],
      "bytes": 1613
    },
    {
      "path": "/campus-blue-assets/material-empty.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Libro y enlace para guardar material académico",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S12-empty", "S08-material"],
      "intendedComponents": [
        "src/routes/_app/library.tsx:272",
        "src/routes/_app/courses.$courseId.tsx:307"
      ],
      "bytes": 1987
    },
    {
      "path": "/campus-blue-assets/notes-empty.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Cuaderno preparado para escribir la primera nota",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S13-empty", "S13-recents"],
      "intendedComponents": [
        "src/components/workspace/workspace-shell.tsx:516",
        "src/components/workspace/quick-switcher.tsx:91"
      ],
      "bytes": 1833
    },
    {
      "path": "/campus-blue-assets/onboarding-ready.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Documento académico con marca de confirmación",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S03-ready"],
      "intendedComponents": ["src/routes/onboarding.tsx:160"],
      "bytes": 1710
    },
    {
      "path": "/campus-blue-assets/gentle-error.svg",
      "status": "reused-unchanged",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Símbolo de atención ante un error recuperable",
      "decorativeAlt": "",
      "display": "Existing scalable SVG; 176–280 CSS px wide, height auto",
      "source": "Existing original code-authored SVG",
      "prompt": "Historical prompt not recorded; existing original geometry and historical art direction preserved.",
      "provenance": "Preserved byte-for-byte. Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-error", "S13-load-error", "S00-folder-error"],
      "intendedComponents": [
        "src/components/empty-state.tsx:90",
        "src/components/workspace/note-editor.tsx:225",
        "src/app/folder-picker.tsx:26"
      ],
      "bytes": 1669
    },
    {
      "path": "/campus-blue-assets/folder-picker-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpeta abierta preparada para elegir apuntes",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. An open study folder with a magnifying glass, no computer or app screen.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S00-folder"],
      "intendedComponents": ["src/app/folder-picker.tsx:298"],
      "bytes": 1014
    },
    {
      "path": "/campus-blue-assets/onboarding-university.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Edificio universitario sin emblemas",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Modest public university building; no real institution likeness or seal.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S02-university"],
      "intendedComponents": ["src/routes/onboarding.tsx:257"],
      "bytes": 1140
    },
    {
      "path": "/campus-blue-assets/onboarding-faculty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpetas junto a un edificio de facultad",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Small academic building and subject folder.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S02-faculty"],
      "intendedComponents": ["src/routes/onboarding.tsx:288"],
      "bytes": 1331
    },
    {
      "path": "/campus-blue-assets/onboarding-program.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Libro abierto y brújula para elegir carrera",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Open textbook and compass; study direction, no graduation claim.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S02-program"],
      "intendedComponents": ["src/routes/onboarding.tsx:314"],
      "bytes": 1037
    },
    {
      "path": "/campus-blue-assets/onboarding-plan.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Hojas de un plan de estudios para revisar",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Overlapping curriculum documents; no prerequisite graph or invented academic data.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S02-plan"],
      "intendedComponents": ["src/routes/onboarding.tsx:342"],
      "bytes": 1062
    },
    {
      "path": "/campus-blue-assets/onboarding-manual.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Ficha académica y lápiz para una carrera propia",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Blank academic cards and pencil for manually entered degree.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S02-manual"],
      "intendedComponents": ["src/routes/onboarding.tsx:371"],
      "bytes": 1222
    },
    {
      "path": "/campus-blue-assets/onboarding-progress.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Fichas de materias para registrar el recorrido",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Neutral subject records; never assert passed subjects.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S03-progress"],
      "intendedComponents": ["src/features/academic/progress-entry-screen.tsx:140"],
      "bytes": 993
    },
    {
      "path": "/campus-blue-assets/login-signin.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Libro junto a una puerta entreabierta",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Study book beside doorway; no screen or authentication success mark.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S01-signin"],
      "intendedComponents": ["src/routes/login.tsx:149"],
      "bytes": 1167
    },
    {
      "path": "/campus-blue-assets/login-signup.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Cuaderno nuevo con una ficha para empezar",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Fresh notebook, blank card and plus sign; no account-created claim.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S01-signup"],
      "intendedComponents": ["src/routes/login.tsx:144"],
      "bytes": 1043
    },
    {
      "path": "/campus-blue-assets/password-recovery.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Sobre y llave para recuperar el acceso",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Envelope and key; no delivered check or known-account indication.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S01-reset"],
      "intendedComponents": ["src/routes/login.tsx:146"],
      "bytes": 1054
    },
    {
      "path": "/campus-blue-assets/password-new.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Candado junto a una hoja para una contraseña nueva",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Lock and blank document; no password text or saved-success claim.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S01-password"],
      "intendedComponents": ["src/routes/login.tsx:148"],
      "bytes": 1139
    },
    {
      "path": "/campus-blue-assets/auth-email.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Sobre con una tarjeta de correo sin texto",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Envelope and unmarked letter supporting conditional recovery/confirmation notice.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S01-notice"],
      "intendedComponents": ["src/routes/login.tsx:253"],
      "bytes": 962
    },
    {
      "path": "/campus-blue-assets/today-study.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Libro y mate para un momento de estudio",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Textbook and small mate with bombilla, everyday Argentine student context, no completion mark.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S04-hero"],
      "intendedComponents": ["src/features/blue/blue-today-screen.tsx:159"],
      "bytes": 1081
    },
    {
      "path": "/campus-blue-assets/today-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Agenda abierta con espacio para organizar el día",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Open agenda and small clock, no task-completion check.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S04-empty", "S04-legacy-empty"],
      "intendedComponents": [
        "src/features/blue/blue-today-screen.tsx:180",
        "src/routes/_app/today.tsx:128"
      ],
      "bytes": 1054
    },
    {
      "path": "/campus-blue-assets/plan-unselected.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Índice académico abierto para elegir un recorrido",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Study index and unattached bookmark, no selected curriculum or eligibility claim.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S05-context", "S06-context", "S04-context", "S03-context", "S15-context"],
      "intendedComponents": [
        "src/routes/_app/plan.tsx:53",
        "src/routes/_app/courses.index.tsx:133",
        "src/features/blue/blue-today-screen.tsx:208",
        "src/features/academic/progress-entry-screen.tsx:68",
        "src/features/settings/settings-screen.tsx:311"
      ],
      "bytes": 1001
    },
    {
      "path": "/campus-blue-assets/plan-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpeta e índice preparados para agregar materias",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Folder, blank subject index and plus symbol; no invented curriculum map.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S05-empty", "S03-empty"],
      "intendedComponents": [
        "src/routes/_app/plan.tsx:141",
        "src/features/academic/progress-entry-screen.tsx:87"
      ],
      "bytes": 1193
    },
    {
      "path": "/campus-blue-assets/courses-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Fichas de materias listas para completar",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Blank subject index cards with add symbol.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S06-empty"],
      "intendedComponents": ["src/routes/_app/courses.index.tsx:242"],
      "bytes": 1046
    },
    {
      "path": "/campus-blue-assets/courses-filter-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Fichas de materias y una lupa sin resultados",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Academic index cards and magnifier; no false error mark.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S06-filter"],
      "intendedComponents": ["src/routes/_app/courses.index.tsx:247"],
      "bytes": 1063
    },
    {
      "path": "/campus-blue-assets/courses-current-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Libro de cursada con un señalador sin marcar",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Class textbook and plain bookmark; no active enrolment or eligibility badge.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S06-current"],
      "intendedComponents": ["src/routes/_app/courses.index.tsx:244"],
      "bytes": 1009
    },
    {
      "path": "/campus-blue-assets/courses-finals-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Agenda de finales con un reloj sin fecha asignada",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Academic agenda and clock, no graduation or exam-passed symbol.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S06-finals"],
      "intendedComponents": ["src/routes/_app/courses.index.tsx:246"],
      "bytes": 1169
    },
    {
      "path": "/campus-blue-assets/course-not-found.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Ficha de una materia buscada con una lupa",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. One subject card and magnifier, distinct from whole-page missing route.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S08-missing"],
      "intendedComponents": ["src/routes/_app/courses.$courseId.tsx:91"],
      "bytes": 942
    },
    {
      "path": "/campus-blue-assets/course-tasks-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Ficha de cursada para anotar una tarea",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Assignment card and plus symbol; no fake task list UI or completed checkbox.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S08-tasks"],
      "intendedComponents": ["src/routes/_app/courses.$courseId.tsx:186"],
      "bytes": 945
    },
    {
      "path": "/campus-blue-assets/material-drop-zone.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Enlace y tarjeta que se acercan a una bandeja",
      "decorativeAlt": "",
      "display": "80–120 CSS px wide, height auto, above instruction; retain paste and keyboard controls",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Link and note card above receiving tray; one static arrow, no file-upload/cloud promise.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S08-drop"],
      "intendedComponents": ["src/features/courses/add-resource-dialog.tsx:223"],
      "bytes": 1118
    },
    {
      "path": "/campus-blue-assets/course-notes-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Dos hojas de apuntes con un enlace por agregar",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Two notes and marginal plus; no automatic linking or sync claim.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S08-notes"],
      "intendedComponents": ["src/features/courses/subject-notes.tsx:147"],
      "bytes": 1072
    },
    {
      "path": "/campus-blue-assets/notes-select.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Cuaderno cerrado con un señalador para abrir",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Closed notebook and bookmark; no-open-note differs from empty vault.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S13-pane"],
      "intendedComponents": ["src/components/workspace/workspace-shell.tsx:522"],
      "bytes": 956
    },
    {
      "path": "/campus-blue-assets/search-empty.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Lupa sobre fichas sin coincidencias",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Magnifier and loose notes, neutral no-match state.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-search", "S12-filter", "S13-search", "S13-switcher", "S00-folder-filter"],
      "intendedComponents": [
        "src/features/search/search-palette.tsx:200",
        "src/routes/_app/library.tsx:283",
        "src/components/workspace/search-dialog.tsx:79",
        "src/components/workspace/quick-switcher.tsx:91",
        "src/app/folder-picker.tsx:297"
      ],
      "bytes": 943
    },
    {
      "path": "/campus-blue-assets/settings-workspace.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpeta y separadores para organizar el espacio",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Academic folder and blank dividers; no mock settings screen or sync arrows.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S15-workspace"],
      "intendedComponents": ["src/features/settings/settings-screen.tsx:208"],
      "bytes": 975
    },
    {
      "path": "/campus-blue-assets/settings-privacy.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Carpeta de apuntes con un candado",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Folder and lock; decorative privacy topic, not security certification.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S15-privacy"],
      "intendedComponents": ["src/features/settings/settings-screen.tsx:324"],
      "bytes": 1191
    },
    {
      "path": "/campus-blue-assets/page-not-found.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Señalador y camino interrumpido hacia una hoja",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Document, detached bookmark and interrupted trail; no baked-in 404 or browser window.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S404"],
      "intendedComponents": ["src/routes/__root.tsx:10"],
      "bytes": 993
    },
    {
      "path": "/campus-blue-assets/offline-study.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Libro junto a una señal de conexión interrumpida",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Textbook and crossed connection arcs; no Cloud offline writes/cache promise or invented global offline route.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-offline-auth", "S-offline-startup"],
      "intendedComponents": ["src/routes/login.tsx:259", "src/app/startup.tsx:390"],
      "bytes": 1158
    },
    {
      "path": "/campus-blue-assets/config-unavailable.svg",
      "status": "new",
      "dimensions": {
        "width": 640,
        "height": 400
      },
      "alt": "Dossier de configuración con una pieza por completar",
      "decorativeAlt": "",
      "display": "176–240 CSS px wide, height auto; compact slots 80–144 px; SVG scales without duplicate 2x exports",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Configuration dossier and missing-piece marker; no technical labels or fake app screen.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-config"],
      "intendedComponents": ["src/app/config-error.tsx:10"],
      "bytes": 1212
    },
    {
      "path": "/campus-blue-assets/ambient-morning.svg",
      "status": "new",
      "dimensions": {
        "width": 1920,
        "height": 640
      },
      "alt": "Luz azul de la mañana",
      "decorativeAlt": "",
      "display": "Ambient top band, width 100%, height auto; decorative alt=\"\", no tiling; opaque content panels",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Faint morning light motif in upper-right 28%; left 70% transparent for content; flat abstract sky, not UI composition.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-ambient-morning"],
      "intendedComponents": ["src/lib/theme/theme-context.tsx:80"],
      "bytes": 477
    },
    {
      "path": "/campus-blue-assets/ambient-afternoon.svg",
      "status": "new",
      "dimensions": {
        "width": 1920,
        "height": 640
      },
      "alt": "Luz azul de la tarde",
      "decorativeAlt": "",
      "display": "Ambient top band, width 100%, height auto; decorative alt=\"\", no tiling; opaque content panels",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Faint afternoon light motif in upper-right 28%; left 70% transparent for content; flat abstract sky, not UI composition.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-ambient-afternoon"],
      "intendedComponents": ["src/lib/theme/theme-context.tsx:80"],
      "bytes": 537
    },
    {
      "path": "/campus-blue-assets/ambient-evening.svg",
      "status": "new",
      "dimensions": {
        "width": 1920,
        "height": 640
      },
      "alt": "Luz azul del atardecer",
      "decorativeAlt": "",
      "display": "Ambient top band, width 100%, height auto; decorative alt=\"\", no tiling; opaque content panels",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Faint evening light motif in upper-right 28%; left 70% transparent for content; flat abstract sky, not UI composition.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-ambient-evening"],
      "intendedComponents": ["src/lib/theme/theme-context.tsx:80"],
      "bytes": 505
    },
    {
      "path": "/campus-blue-assets/ambient-night.svg",
      "status": "new",
      "dimensions": {
        "width": 1920,
        "height": 640
      },
      "alt": "Luz azul de la noche",
      "decorativeAlt": "",
      "display": "Ambient top band, width 100%, height auto; decorative alt=\"\", no tiling; opaque content panels",
      "source": "Code-authored original SVG",
      "prompt": "Original deterministic SVG geometry for Campus. Extend existing editorial orbital family; calm Argentine university study context; navy contours, token blue and white paper, sparse pale-blue fills; no visible text, app UI, logos, trademarks, people, shadows, texture or animation; transparent outside subject. Faint night light motif in upper-right 28%; left 70% transparent for content; flat abstract sky, not UI composition.",
      "provenance": "Original commissioned vector geometry; no third-party material. Use/adaptation in Campus follows project owner terms; no separate CC0/MIT grant is asserted.",
      "surfaces": ["S-ambient-night"],
      "intendedComponents": ["src/lib/theme/theme-context.tsx:80"],
      "bytes": 588
    }
  ],
  "surfaces": [
    {
      "id": "S00-local",
      "surface": "Startup: local workspace",
      "component": "src/app/startup.tsx:255",
      "asset": "workspace-local.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-local",
      "surface": "Onboarding: local summary",
      "component": "src/routes/onboarding.tsx:438",
      "asset": "workspace-local.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S00-cloud",
      "surface": "Startup: Cloud workspace",
      "component": "src/app/startup.tsx:367",
      "asset": "workspace-cloud.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-cloud",
      "surface": "Onboarding: Cloud summary",
      "component": "src/routes/onboarding.tsx:452",
      "asset": "workspace-cloud.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S01-cloud",
      "surface": "Login: Cloud aside",
      "component": "src/routes/login.tsx:286",
      "asset": "workspace-cloud.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S14-cloud",
      "surface": "Notes unavailable in Cloud",
      "component": "src/routes/_app/vault.tsx:52",
      "asset": "vault-cloud-unavailable.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S09-empty",
      "surface": "Calendar: no events",
      "component": "src/routes/_app/calendar.tsx:43",
      "asset": "calendar-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S09-agenda",
      "surface": "Agenda: no upcoming events",
      "component": "src/features/calendar/agenda-list.tsx:48",
      "asset": "calendar-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S04-calendar",
      "surface": "Today: calendar aside",
      "component": "src/features/blue/blue-today-screen.tsx:220",
      "asset": "calendar-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S12-empty",
      "surface": "Library: no resources",
      "component": "src/routes/_app/library.tsx:272",
      "asset": "material-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S08-material",
      "surface": "Course: no saved material",
      "component": "src/routes/_app/courses.$courseId.tsx:307",
      "asset": "material-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S13-empty",
      "surface": "Notes: empty vault",
      "component": "src/components/workspace/workspace-shell.tsx:516",
      "asset": "notes-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S13-recents",
      "surface": "Quick switcher: no notes",
      "component": "src/components/workspace/quick-switcher.tsx:91",
      "asset": "notes-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S03-ready",
      "surface": "Onboarding: persisted configuration complete",
      "component": "src/routes/onboarding.tsx:160",
      "asset": "onboarding-ready.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S-error",
      "surface": "Shared recoverable query errors",
      "component": "src/components/empty-state.tsx:90",
      "asset": "gentle-error.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S13-load-error",
      "surface": "Notes: failed load",
      "component": "src/components/workspace/note-editor.tsx:225",
      "asset": "gentle-error.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S00-folder-error",
      "surface": "Folder picker: refused/unavailable",
      "component": "src/app/folder-picker.tsx:26",
      "asset": "gentle-error.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S00-folder",
      "surface": "Folder picker: empty folder",
      "component": "src/app/folder-picker.tsx:298",
      "asset": "folder-picker-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-university",
      "surface": "Onboarding: institution selection",
      "component": "src/routes/onboarding.tsx:257",
      "asset": "onboarding-university.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-faculty",
      "surface": "Onboarding: faculty or regional selection",
      "component": "src/routes/onboarding.tsx:288",
      "asset": "onboarding-faculty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-program",
      "surface": "Onboarding: degree selection",
      "component": "src/routes/onboarding.tsx:314",
      "asset": "onboarding-program.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-plan",
      "surface": "Onboarding: curriculum version selection",
      "component": "src/routes/onboarding.tsx:342",
      "asset": "onboarding-plan.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S02-manual",
      "surface": "Onboarding: manual degree entry",
      "component": "src/routes/onboarding.tsx:371",
      "asset": "onboarding-manual.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S03-progress",
      "surface": "Initial academic progress entry",
      "component": "src/features/academic/progress-entry-screen.tsx:140",
      "asset": "onboarding-progress.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S01-signin",
      "surface": "Authentication: sign in",
      "component": "src/routes/login.tsx:149",
      "asset": "login-signin.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S01-signup",
      "surface": "Authentication: create account",
      "component": "src/routes/login.tsx:144",
      "asset": "login-signup.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S01-reset",
      "surface": "Authentication: request recovery email",
      "component": "src/routes/login.tsx:146",
      "asset": "password-recovery.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S01-password",
      "surface": "Authentication: enter new password",
      "component": "src/routes/login.tsx:148",
      "asset": "password-new.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S01-notice",
      "surface": "Authentication: email/confirmation notices",
      "component": "src/routes/login.tsx:253",
      "asset": "auth-email.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S04-hero",
      "surface": "Today: study summary spot",
      "component": "src/features/blue/blue-today-screen.tsx:159",
      "asset": "today-study.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S04-empty",
      "surface": "Today: no pending tasks",
      "component": "src/features/blue/blue-today-screen.tsx:180",
      "asset": "today-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S04-legacy-empty",
      "surface": "Today: legacy no further tasks",
      "component": "src/routes/_app/today.tsx:128",
      "asset": "today-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S05-context",
      "surface": "Plan: no academic context",
      "component": "src/routes/_app/plan.tsx:53",
      "asset": "plan-unselected.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S06-context",
      "surface": "Courses: no academic context",
      "component": "src/routes/_app/courses.index.tsx:133",
      "asset": "plan-unselected.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S04-context",
      "surface": "Today: no academic context",
      "component": "src/features/blue/blue-today-screen.tsx:208",
      "asset": "plan-unselected.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S03-context",
      "surface": "Progress: no academic context",
      "component": "src/features/academic/progress-entry-screen.tsx:68",
      "asset": "plan-unselected.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S15-context",
      "surface": "Settings: degree not selected",
      "component": "src/features/settings/settings-screen.tsx:311",
      "asset": "plan-unselected.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S05-empty",
      "surface": "Plan: no manually added subjects",
      "component": "src/routes/_app/plan.tsx:141",
      "asset": "plan-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S03-empty",
      "surface": "Progress: no subjects to mark",
      "component": "src/features/academic/progress-entry-screen.tsx:87",
      "asset": "plan-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S06-empty",
      "surface": "Courses: no subjects entered",
      "component": "src/routes/_app/courses.index.tsx:242",
      "asset": "courses-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S06-filter",
      "surface": "Courses: empty filtered list",
      "component": "src/routes/_app/courses.index.tsx:247",
      "asset": "courses-filter-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S06-current",
      "surface": "Courses: none currently studying",
      "component": "src/routes/_app/courses.index.tsx:244",
      "asset": "courses-current-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S06-finals",
      "surface": "Courses: no pending finals",
      "component": "src/routes/_app/courses.index.tsx:246",
      "asset": "courses-finals-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S08-missing",
      "surface": "Course detail: subject not found",
      "component": "src/routes/_app/courses.$courseId.tsx:91",
      "asset": "course-not-found.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S08-tasks",
      "surface": "Course detail: no tasks",
      "component": "src/routes/_app/courses.$courseId.tsx:186",
      "asset": "course-tasks-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S08-drop",
      "surface": "Add material dialog: link/text drop zone",
      "component": "src/features/courses/add-resource-dialog.tsx:223",
      "asset": "material-drop-zone.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S08-notes",
      "surface": "Course detail: no note mentions",
      "component": "src/features/courses/subject-notes.tsx:147",
      "asset": "course-notes-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S13-pane",
      "surface": "Notes: vault has notes but pane empty",
      "component": "src/components/workspace/workspace-shell.tsx:522",
      "asset": "notes-select.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S-search",
      "surface": "Global search: no matches",
      "component": "src/features/search/search-palette.tsx:200",
      "asset": "search-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S12-filter",
      "surface": "Library: no filter matches",
      "component": "src/routes/_app/library.tsx:283",
      "asset": "search-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S13-search",
      "surface": "Note search: no matches",
      "component": "src/components/workspace/search-dialog.tsx:79",
      "asset": "search-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S13-switcher",
      "surface": "Quick switcher: no query matches",
      "component": "src/components/workspace/quick-switcher.tsx:91",
      "asset": "search-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S00-folder-filter",
      "surface": "Folder picker: no filter matches",
      "component": "src/app/folder-picker.tsx:297",
      "asset": "search-empty.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S15-workspace",
      "surface": "Settings: active workspace",
      "component": "src/features/settings/settings-screen.tsx:208",
      "asset": "settings-workspace.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S15-privacy",
      "surface": "Settings: privacy explanation",
      "component": "src/features/settings/settings-screen.tsx:324",
      "asset": "settings-privacy.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S404",
      "surface": "Root route: page not found",
      "component": "src/routes/__root.tsx:10",
      "asset": "page-not-found.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S-offline-auth",
      "surface": "Authentication: network unavailable",
      "component": "src/routes/login.tsx:259",
      "asset": "offline-study.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S-offline-startup",
      "surface": "Startup: Cloud unreachable",
      "component": "src/app/startup.tsx:390",
      "asset": "offline-study.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S-config",
      "surface": "Startup: missing configuration",
      "component": "src/app/config-error.tsx:10",
      "asset": "config-unavailable.svg",
      "slot": "empty-state",
      "note": ""
    },
    {
      "id": "S-ambient-morning",
      "surface": "Ambient: morning",
      "component": "src/lib/theme/theme-context.tsx:80",
      "asset": "ambient-morning.svg",
      "slot": "ambient",
      "note": "data-campus-period='morning'; target src/styles/prompt.css:69; light palette."
    },
    {
      "id": "S-ambient-afternoon",
      "surface": "Ambient: afternoon",
      "component": "src/lib/theme/theme-context.tsx:80",
      "asset": "ambient-afternoon.svg",
      "slot": "ambient",
      "note": "data-campus-period='afternoon'; target src/styles/prompt.css:72; light palette."
    },
    {
      "id": "S-ambient-evening",
      "surface": "Ambient: evening",
      "component": "src/lib/theme/theme-context.tsx:80",
      "asset": "ambient-evening.svg",
      "slot": "ambient",
      "note": "data-campus-period='evening'; target src/styles/prompt.css:75; light palette."
    },
    {
      "id": "S-ambient-night",
      "surface": "Ambient: night",
      "component": "src/lib/theme/theme-context.tsx:80",
      "asset": "ambient-night.svg",
      "slot": "ambient",
      "note": "data-campus-period='night'; target src/styles/prompt.css:78; light palette."
    }
  ],
  "skipped": [
    {
      "surface": "Kanban: four empty columns",
      "component": "src/features/courses/subject-board-view.tsx:96",
      "reason": "Keep concise state sentences and drag targets; four illustrations crowd dense columns and risk implying academic eligibility."
    },
    {
      "surface": "Note backlinks: no mentions",
      "component": "src/components/workspace/backlinks-panel.tsx:44",
      "reason": "Compact editor metadata; existing sentence suffices, avoid duplicate note illustration."
    },
    {
      "surface": "File explorer: empty directory",
      "component": "src/components/workspace/file-explorer.tsx:176",
      "reason": "Source suppresses duplicate empty-folder message; main empty pane already maps to notes-empty.svg."
    },
    {
      "surface": "Editor: conflict, deleted file or save error",
      "component": "src/components/workspace/note-editor.tsx:238",
      "reason": "Keep recovery actions immediately visible in narrow safety banners; load failure maps to gentle-error.svg."
    },
    {
      "surface": "Loading skeletons",
      "component": "src/components/empty-state.tsx:61",
      "reason": "Keep deterministic row geometry; illustration would suggest a settled state."
    },
    {
      "surface": "Developer scenarios",
      "component": "src/routes/dev.tsx:44",
      "reason": "Internal diagnostic surface outside production student illustration scope."
    },
    {
      "surface": "Unknown prerequisites / availability",
      "component": "src/routes/_app/plan.tsx:287",
      "reason": "Doctrine requires explicit text for unknown official data; no diagram may invent prerequisites."
    },
    {
      "surface": "Settings: appearance and account controls",
      "component": "src/features/settings/settings-screen.tsx:118",
      "reason": "Existing interactive theme swatches and account controls already express the choices; no app-screen image or extra decoration."
    }
  ]
}
```

### Verificación y decisiones pendientes

Validar JSON y XML, dimensiones/bytes, presupuesto <150000 bytes por archivo, referencias a líneas existentes, nombres/geometrías únicos y ausencia de texto visible o contenido ejecutable/remoto. Revisar contact sheet renderizado localmente sin modificar rutas/componentes. Comparar archivos ajenos por SHA-256 y los ocho SVG originales con HEAD.

Decisión de producto pendiente: sumar una imagen ambiental al gradiente CSS actual o conservar sólo el gradiente. Los cuatro períodos quedan disponibles. El integrador debe elegir un único spot por panel y preservar textos/acciones. No se verificó integración del producto porque este encargo excluye cableado de componentes.

### Resultados observados

Verificación ejecutada en este worktree; el render usó Microsoft Edge headless porque el Chromium empaquetado de Playwright no estaba instalado. Se decodificaron y revisaron visualmente los 43 assets en un contact sheet temporal, eliminado al finalizar.

```text
PASS manifest: JSON parsed; 43 assets / 63 mapped placements / 8 exclusions
PASS SVG: 43 XML documents; dimensions, byte counts and safe content
PASS sizes: 51,721 bytes total; 35392 bytes in 35 new SVGs; max 2737 bytes
PASS render: 43 images decoded in headless Edge; contact sheet visually reviewed
PASS preservation: 8 original SVGs match HEAD; 11 pre-existing files match baseline SHA-256
PASS scope: 35 new SVGs + 1 modified manifest; no unexpected changed files
PASS branch: feat/campus-proposal2-blue
PASS prettier --check docs/ux-research/BLUE_ASSET_MANIFEST.md
PASS git diff --check -- docs/ux-research/BLUE_ASSET_MANIFEST.md
```

Comandos de inspección reproducibles (desde este worktree):

```powershell
Get-ChildItem -LiteralPath public/campus-blue-assets -File | Sort-Object Name | Select-Object Name, Length
pnpm exec prettier --check docs/ux-research/BLUE_ASSET_MANIFEST.md
git diff --check -- docs/ux-research/BLUE_ASSET_MANIFEST.md
git status --short --untracked-files=all
```

El bloque JSON se extrajo del Markdown y se validó mediante `JSON.parse` y `json.loads`; XML se validó con `xml.etree.ElementTree`. QA de integración, reflow y acciones del producto queda fuera de este trabajo de assets. No se hicieron commits, stage, push, merge, deploy ni cambios de componentes.
