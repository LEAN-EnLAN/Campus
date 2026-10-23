# Campus — inventario verificable de pantallas, estados y flujos

**Corte:** `fd8a832`, 23/10/2026. **REAL** significa «implementado o definido en código inspeccionado», **no** «validado en ejecución». **FUTURO** significa «propuesta que requiere mockup, feedback del usuario y aprobación antes de implementación». El intento de navegador no permitió comprobar pantallas académicas operativas (véase [AUDIT.md](AUDIT.md)).

## 1. Arquitectura de navegación real

```text
Inicio (selector de carpeta local o Campus Cloud)
├─ Local: elegir/abrir carpeta → /onboarding si falta contexto, o /today
└─ Cloud: /login (entrar/crear cuenta) → /onboarding → /plan/progress

/ (redirect) → /today
/_app (AcademicShell + QuickCapture + SearchPalette)
├─ /today
├─ /plan → /plan/progress
├─ /courses → /courses/:courseId
├─ /calendar
├─ /vault (?note=...)
├─ /library
└─ /settings

/dev (escenarios tester; uso interno)
not-found (ruta no reconocida)
```

El router usa **TanStack Router file-based** en `src/routes/*`; `_app` protege Cloud mediante cuenta, pero la carpeta local funciona sin sesión. El selector inicial no es una ruta `src/routes`: se monta en `src/app/startup.tsx`. `src/components/nav-model.ts` es la única fuente de destinos para sidebar y mobile tab bar.

## 2. Mapa de superficies y prioridad de mockup

| ID  | Superficie                          | REAL · referencia                                                                   | FUTURO a explorar                                                               | Mockup |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| S00 | Inicio / elegir dónde trabajar      | `src/app/startup.tsx`, `folder-picker.tsx`                                          | Primera decisión con diferencia entre datos locales/Cloud más fácil de escanear | P0     |
| S01 | Entrar / crear cuenta               | `src/routes/login.tsx`                                                              | Jerarquía de error y regreso a selector, sin onboarding comercial               | P1     |
| S02 | Configurar universidad/carrera/plan | `src/routes/onboarding.tsx`                                                         | Wizard de progresión más explícita y alternativa manual                         | P0     |
| S03 | Cargar avance                       | `src/routes/_app/plan_.progress.tsx`, `features/academic/progress-entry-screen.tsx` | Vista de estados por año, chips con confirmación autosave                       | P1     |
| S04 | Hoy                                 | `src/routes/_app/today.tsx`                                                         | Dos densidades y composición por prioridad académica                            | P0     |
| S05 | Plan                                | `src/routes/_app/plan.tsx`                                                          | Foco en desbloqueos, procedencia y grupos por año                               | P0     |
| S06 | Materias · Lista                    | `src/routes/_app/courses.index.tsx`                                                 | Filtros y acciones de estado sin saturación                                     | P1     |
| S07 | Materias · Tablero                  | `features/courses/subject-board-view.tsx`                                           | Proporciones Kanban, colapsos mobile, sin estados imaginarios                   | P1     |
| S08 | Detalle materia                     | `src/routes/_app/courses.$courseId.tsx`                                             | Cabecera con estado/fechas y correlativas entendibles                           | P0     |
| S09 | Calendario · Mes                    | `src/features/calendar/campus-calendar.tsx`                                         | Chips legibles + vista cómoda 768/1440                                          | P0     |
| S10 | Calendario · Semana                 | `src/features/calendar/campus-calendar.tsx`                                         | Eje horario / evento todo el día y overflow                                     | P1     |
| S11 | Calendario · Agenda                 | `src/features/calendar/agenda-list.tsx`                                             | Alternativa preferida para pantalla estrecha                                    | P0     |
| S12 | Material                            | `src/routes/_app/library.tsx`                                                       | Formularios más compactos y recursos agrupados por materia                      | P1     |
| S13 | Notas / explorador/editor local     | `src/routes/_app/vault.tsx`, `components/workspace/*`                               | Resolver shell desktop y drawer mobile; títulos, tabs, vínculos                 | P0     |
| S14 | Notas · disponibilidad Cloud/vacío  | `src/routes/_app/vault.tsx`                                                         | Explicar claramente por qué las notas locales no aparecen en Cloud              | P1     |
| S15 | Ajustes                             | `src/routes/_app/settings.tsx`                                                      | Secciones consistentes y control de tema/color                                  | P2     |
| S16 | Captura rápida                      | `src/components/quick-capture.tsx`, `src/components/ui/modal.tsx`                   | Un primer gesto para «fecha/tarea», teclado y errores                           | P0     |
| S17 | Buscar global                       | `src/features/search/search-palette.tsx`                                            | Diferenciar entidades / comandos/archivos y empty query                         | P1     |
| S18 | Quick switcher / búsqueda de notas  | `components/workspace/{quick-switcher,search-dialog}.tsx`                           | Resultados contextualizados sin mezclar con búsqueda global                     | P1     |
| S19 | Menú móvil Más                      | `src/components/academic-shell.tsx`                                                 | Lista breve accesible, overlay y estado actual                                  | P1     |
| S20 | Final / estados y confirmaciones    | `features/items/{final-outcome-dialog,use-complete-item}.tsx`                       | Aprobado/desaprobado y reversión con lenguaje académico                         | P1     |
| S21 | `/dev` / ruta inválida              | `src/routes/dev.tsx`, `src/routes/__root.tsx`                                       | Solo documentar QA, no convertir tester en pantalla comercial                   | P2     |

## 3. Contrato compartido de pantalla

**REAL:** desktop/sidebar `md:flex` desde 768 px; navegación actual de 220 px; superficie de lectura centrada y limitada, salvo `/vault` y `/calendar` que usan viewport entero y scroll propio. Móvil `<768` tiene barra superior, cuatro destinos Hoy/Plan/Materias/Calendario y un quinto botón «Más» para Notas, Material, Ajustes. Captura `+` flotante solo donde `showsFloatingAdd` lo permite. El `QuickCapture` y `SearchPalette` están a nivel `_app`; Ctrl/Cmd+K captura, `/` busca, ambos con botones para mouse/touch. Fuente: `src/components/academic-shell.tsx`, `src/components/nav-model.ts`, `src/routes/_app.tsx`.

**FUTURO:** el documento de workspace pide un rail de iconos 48 px desde 1200 px, que **no coincide** con el código actual. Los briefs deberán marcar esa variante «propuesta» y conservar versión REAL hasta que el usuario elija. No introducir una columna derecha, popup ni sync entre productos sin una acción real.

**Responsive por defecto:**

- **390 px:** una columna, sin scroll horizontal; título visible, acción principal alcanzable, navegación inferior no tapa el contenido. En pantallas full-bleed se reserva espacio para mobile bar.
- **768 px:** revisar cambio a sidebar desktop (`md=768`) y si quedan >500 px reales de contenido; la nueva propuesta podría contraer rail, pero eso sigue FUTURO.
- **1440 px:** centro editorial con medida de lectura, salvo calendar/vault extendidos; sidebar existente ocupa 220 px y workspace puede dividirse en panes.

Se requieren estados **normal, loading, empty, error, guardando/guardado, selección/foco, sin datos oficiales** donde correspondan. La microinteracción debe mantener texto accesible e indicador de estado, con animaciones breves y `prefers-reduced-motion`.

## 4. Fichas de pantallas

### S00 — Selector de espacio de trabajo (REAL)

**Jerarquía:** «Campus» → pregunta sobre dónde guardar materias y notas → opción de carpeta local cuando la capacidad existe / Cloud → recientes, ruta manual o carpeta sugerida según disponibilidad → estados de error propios. El selector no crea el contexto académico. Fuente `src/app/startup.tsx`, `src/app/folder-picker.tsx`, `src/lib/runtime/context.tsx`.

**Interacciones reales:** recordar último espacio, abrir/cambiar carpeta y elegir Cloud; progreso mientras resuelve; error de carpeta perdida sin recurrir automáticamente a Cloud; errores en lenguaje argentino. **390:** opciones en columna, explicaciones cortas; **768:** misma progresión; **1440:** columna centrada, evita un panel SaaS ancho. **FUTURO:** propuesta de dos decisiones comparables «Guardar en mi computadora» / «Usar Campus Cloud» cuando ambas estén disponibles; mantener modo web sin carpeta como **una sola** opción real. **React/Tailwind:** respetar capability `vaultAvailable`; no inventar APIs de archivos ni almacenamiento de Cloud en local.

### S01 — Login / registro (REAL)

**Jerarquía:** enlace de vuelta al selector → título «Tu cursada, ordenada» o bienvenida → nombre únicamente en registro, email, contraseña, submit → cambio registro/entrar → privacidad. Fuente `src/routes/login.tsx`.

**Interacciones:** alternar modes, feedback de error, submit pendiente, campos requeridos. **390:** un formulario completo sin scroll horizontal; **768/1440:** ancho estrecho de lectura. **FUTURO:** hacer visible la pertenencia al modo Cloud y recuperar contraseña solo si existe backend real; **no mostrar** SSO ni recovery como implementados. **React/Tailwind:** actual Supabase Auth, no flujos sin backend.

### S02 — Onboarding académico (REAL)

**Jerarquía:** pregunta inicial → cobertura disponible → pasos Universidad / Facultad o regional / Carrera / Plan → submit «Listo, empezar», escape «No encuentro mi carrera». Los `fieldset` contienen radios nativos; el paso siguiente aparece al elegir el anterior. Autoselecciona opciones únicas y mantiene selección al editar. Fuente `src/routes/onboarding.tsx`.

**Interacciones:** selección resetea descendientes; carga de catálogo, error y reintento; `details` para ver resolución del plan; alternativa manual. **390:** pasos horizontales deben envolver y el control sigue siendo tocable; **768:** ancho medio; **1440:** lectura centrada. **FUTURO:** anclar un resumen compacto de la elección sin forzar quinto paso; mostrar beneficios antes de pedir decisión. **React/Tailwind:** catálogo real, no hardcodear facultades o carreras; guardar `unmappedLabel` sin inventar materias/correlativas.

### S03 — Cargar avance (REAL)

**Jerarquía:** título «Contanos hasta dónde llegaste» → nota de regularizada → años, contador `aprobadas / total`, filas de materias y controles de estado → acciones aprobar año y deshacer → revisión final. Fuente `src/features/academic/progress-entry-screen.tsx`.

**Interacciones:** autosave de un estado; lote «Aprobé todo X°» + revertir; foco pasa a resumen; conflictos de orden se explican sin bloquear. **390:** acciones por año se apilan, evitar selects estrechos; **768:** filas completas con estados; **1440:** lectura restringida por año. **FUTURO:** compactar el progreso con un lenguaje visual de «marcá una vez»; animar solo confirmación guardado. **React/Tailwind:** conservar dominio de estados y transición sin Guardar ficticio.

### S04 — Hoy (REAL)

**Jerarquía:** fecha / frase contextual → Atrasadas si existen → Hoy → Próximas → Sin fecha → Cursando → Final pendiente → progreso de carrera. Una fecha sin hora usa día legible y no inventa horario. Fuente `src/routes/_app/today.tsx`.

**Interacciones:** completar elemento (`DeadlineRow`, con flujo especial de final), abrir materia y calendario, mostrar error reintentar; loading rows. **390:** fecha y primera obligación sobre el fold; **768:** continuidad de lista; **1440:** superficie tipo hoja, 52rem máximo. **FUTURO:** evaluar dos densidades (compacta/editorial) y un atajo de captura cercano a fecha, sin hero con KPI ni línea del tiempo inventada. **React/Tailwind:** preservar algoritmo `buildToday`, prioridades y fuentes de datos, no reinterpretar fecha vencida por componente UI.

### S05 — Plan (REAL)

**Jerarquía:** nombre de carrera y versión → fuente oficial y fecha de consulta → barra de progreso → advertencia de correlativas desconocidas o cifras de habilitadas/bloqueadas → grupos por año con estados → «Cargar mi avance». Carrera sin catálogo presenta lista manual y formulario. Fuente `src/routes/_app/plan.tsx`.

**Interacciones:** navegar materia, actualizar status (recalcula correlativas), editar materias manuales, cargar avance. **390:** años y rows semánticos sin tabla horizontal; **768:** listas densas, posible bloque auxiliar bajo títulos; **1440:** lectura por años. **FUTURO:** hacer más visible «por qué está bloqueada» sin diagrama de dependencias no existente. **React/Tailwind:** `prerequisitesKnown=false` obliga explicación explícita y no muestra estadísticas de desbloqueo; la fuente es link externo y no ícono de verificación de autoridad inventado.

### S06 / S07 — Materias (REAL lista y tablero)

**Jerarquía:** cabecera → filtros de estados con contadores → switch «Lista / Tablero» → filas o Kanban. El filtro Disponible solo se presenta cuando se conoce el grafo. En modo manual permite añadir materia. Fuente `src/routes/_app/courses.index.tsx`, `src/features/courses/subject-board-view.tsx`.

**Interacciones:** filtrar, alternar vistas, marcar estado, abrir detalle; las filas modificadas se fijan temporalmente al filtro para que no desaparezcan antes de observar el guardado. **390:** lista por defecto de baja carga visual; tablero requiere desplazamiento deliberado/columnas apiladas y rotulación; **768:** decidir si se permiten columnas estrechas sin cortar etiquetas; **1440:** Kanban completo si cabe. **FUTURO:** comparar tablero en columnas horizontales vs agrupación vertical mobile. **React/Tailwind:** reutilizar modelo de dominio y componente Kanban existentes, no convertir el tablero en gestión de tareas tipo Trello con drag no probado.

### S08 — Detalle de materia (REAL)

**Jerarquía:** volver a Materias → año/cuatrimestre y nombre → agregar entrega → estado actual → Fechas → Notas (solo local) → Correlativas («requiere» / «habilita») → Material con links y alta de recurso. Fuente `src/routes/_app/courses.$courseId.tsx`, `src/features/courses/subject-notes.tsx`.

**Interacciones:** status, fechas completas, quick-capture preasociada, crear/borrar link, abrir correlativa y nota. **390:** botón debe caber sin sobreponerse al título; **768:** distribución estrecha en dos prioridades visuales; **1440:** lectura de unidad, no tres dashboards. **FUTURO:** microresumen «próximo parcial, estado, correlativas» bajo título y navegación segmentada solo si volumen real lo exige. **React/Tailwind:** notas pueden **no estar** disponibles en Cloud; sin `prerequisitesKnown` no simular apertura de materias; datos y rutas desde `subject.id`.

### S09 / S10 / S11 — Calendario Mes, Semana, Agenda (REAL)

**Jerarquía:** header con navegación anterior/siguiente/Hoy y «Mes / Semana / Agenda» → grilla DayFlow o lista Agenda; aviso de elementos sin fecha en pie. Fuente `src/features/calendar/campus-calendar.tsx`, `src/features/calendar/agenda-list.tsx`.

**Interacciones:** cambio de modo, desplazamiento período, abrir detalle de evento y completarlo; citas con hora frente a todo el día. **No** arrastrar eventos para cambiar fecha: `readOnly.draggable=false`. **390:** agenda como primera variante propuesta visual, comprobar que modo grilla existente sea usable; **768:** semana y mes con textos truncados correctamente; **1440:** mes y semana en canvas full-bleed, detalles legibles. **FUTURO:** diseñar mejor adaptación móvil sin asumir vista guardada/preferida o reschedule. **React/Tailwind:** respetar wrappers DayFlow y slots existentes, marcas por materia/criticidad con texto, time zone es-AR, no reemplazar motor de calendario con CSS artesanal.

### S12 — Material (REAL)

**Jerarquía:** título, descripción → formulario tipo `link | nota`, materia, título, URL o contenido → listado agrupado por materia con acciones abrir/borrar. Fuente `src/routes/_app/library.tsx`.

**Interacciones:** validación contextual al intentar guardar, reenfoque título tras éxito, borrar, navegar a materia. **390:** formulario en una columna; **768/1440:** tipo+materia en dos columnas. **FUTURO:** plegar el formulario tras guardado en una franja «Agregar» si aumenta la lista. **React/Tailwind:** `Resource.kind` admite nota/link aquí; no dibujar PDF adjunto/carpeta cloud, no convertir la nota corta en Markdown editor del vault.

### S13 — Notas en carpeta (REAL)

**Jerarquía:** explorer carpeta → pestañas por pane → masthead de nota → CodeMirror Markdown → backlinks; SearchDialog y QuickSwitcher superpuestos; editor ocupa viewport y panes internos. Fuente `src/routes/_app/vault.tsx`, `src/components/workspace/workspace-shell.tsx`, `src/components/workspace/note-editor.tsx`.

**Interacciones:** `Ctrl+P` abrir archivo, `Ctrl+Shift+F` buscar notas, `Ctrl+B` mostrar explorer, `Ctrl+\` dividir pane, `Ctrl+W` cerrar nota con guard, `Daily/AAAA-MM-DD.md`, `[[wikilink]]` abre/crea target con aviso de ambigüedad, rename/trash actualizan tabs. **390:** código actual abre explorer superpuesto por defecto (riesgo P0), panel activo único; **768:** explorer fijo de 240px y editor reducido; **1440:** explorer 288px y hasta dos grupos de editor. **FUTURO:** editor primero en móvil y barra de comandos calmada, splitter redimensionable/preview tabs/status solo como propuestas. **React/Tailwind:** editor CodeMirror6 y file adapter local, no traer Tiptap/Notion sin decisión de arquitectura; confirmar guardado/errores y recuperación.

### S14 — Notas en Cloud / ninguna carpeta (REAL)

**Jerarquía:** ilustración lineal de carpeta → «Tus notas viven en tu computadora» → explicación para abrir Campus y seleccionar carpeta. Fuente `src/routes/_app/vault.tsx:47-69`.

**Interacciones:** informativa; no existe editor Cloud alternativo. **390/768/1440:** centrar mensaje sin ocupar todo un canvas vacío. **FUTURO:** CTA contextual de volver al selector solo si el runtime puede ofrecerlo realmente. **React/Tailwind:** no dibujar sincronización Cloud↔local.

### S15 — Ajustes (REAL)

**Jerarquía:** Apariencia (claro/oscuro/sistema, acento con nombre) → ubicación de carpeta o espacio → cuenta si corresponde → carrera → privacidad. Fuente `src/routes/_app/settings.tsx`.

**Interacciones:** alternancia tema, `aria-pressed` en swatches, cambiar workspace/carrera, logout en Cloud. **390:** controles en filas que envuelven sin clipping; **768:** una columna de ajustes; **1440:** lectura. **FUTURO:** incluir ejemplos visuales de tono, agrupaciones refinadas, sin modificar semántica o roles. **React/Tailwind:** tokens y tema existentes, permitir solo presets compatibles y respetar contraste.

### S16 — Captura rápida (REAL)

**Jerarquía:** título según tipo → «¿Qué es?» → Tipo/Materia → Fecha/Hora → aviso de final cuando aplica → Guardar / Cancelar. Fuente `src/components/quick-capture.tsx`, `src/components/ui/modal.tsx`.

**Interacciones:** autofoco, `Esc` y recuperar foco desde Modal, validation de `dd/mm/aaaa` y `hh:mm`, hora opcional, materia preseleccionada desde detalle, pending/error no cierran modal. **390:** overlay/bottom sheet adaptable; **768:** 2 columnas internas solo si caben; **1440:** dialog centrado sin extenderse a 900px. **FUTURO:** una versión con opciones secundarias ocultas a la primera acción si se mantiene velocidad. **React/Tailwind:** no prometer parseo de lenguaje natural, recurrentes ni notificaciones si no hay capacidad real; usar validadores actuales.

### S17 — Buscar Campus (REAL)

**Jerarquía:** input → resultados de materia, tarea y recursos; búsqueda parcial sin acentos por modelo. Fuente `src/features/search/search-palette.tsx`.

**Interacciones:** `/` fuera de inputs abre; selección navega a resultado; vacío y resultados deben decir categoría. **390:** diálogo viewport-safe, teclado de móvil visible; **768/1440:** anchura moderada. **FUTURO:** microcopy con atajos y agrupación clara sin inventar consulta full-text sobre notas del vault. **React/Tailwind:** mantener índices de dominio/fuentes actuales.

### S18 — Búsqueda/quick switcher de notas (REAL)

**Jerarquía:** diálogo pequeño sobre workspace con resultados de archivos; búsqueda interna por contenido separada. Fuente `src/components/workspace/quick-switcher.tsx`, `src/components/workspace/search-dialog.tsx`.

**Interacciones:** `Ctrl+P` switcher, `Ctrl+Shift+F` buscar notas, abrir y enfocar documento; estado vacío. **390:** overlay único sin tapar los resultados detrás del teclado; **768/1440:** modal sobre editor con foco; **FUTURO:** ranking contextual primero recientes y previews breves, solo si índice soporta metadata. **React/Tailwind:** no reutilizar arbitrariamente la búsqueda global, porque operan sobre backends distintos.

### S19 — Menú Más móvil (REAL)

**Jerarquía:** barra fija cinco espacios: Hoy, Plan, Materias, Calendario, Más → overlay con Notas/Material/Ajustes. Fuente `src/components/academic-shell.tsx:207-335`, `src/components/nav-model.ts`.

**Interacciones:** toggle `aria-expanded`, tap fuera, Escape, cierre al cambiar ruta, estado actual marcado. **390:** popover sobre safe area y sin colisión con FAB; **768/1440:** no se usa en desktop (sidebar). **FUTURO:** prioridad de Notas ante Material con investigación real de uso; no crear una sexta tab sin justificar layout.

### S20 — Completar un final y otros cambios (REAL)

**Jerarquía:** marcar evento como final / resultado y posible decisión de estado de materia, mensajes posteriores. Fuente `src/features/items/use-complete-item.tsx`, `src/features/items/final-outcome-dialog.tsx`, `src/features/items/final-check.ts`.

**Interacciones:** confirmación de resultado de final y guardado, diferencia entre completar tarea y aprobar materia. **390/768/1440:** modal con estados accesibles, no modal gigante en teléfono. **FUTURO:** construir copy más didáctico en la variante propuesta sin cambiar reglas de aprobación. **React/Tailwind:** no inferir aprobada de «fecha vencida» ni de checkbox de tarea.

### S21 — Herramienta de QA y 404 (REAL)

**Jerarquía:** `/dev` lista escenarios reproducibles de tester y documentación de test, el not-found muestra mensaje + volver a Hoy. Fuente `src/routes/dev.tsx`, `src/routes/__root.tsx`.

**Interacciones:** ejecutar un caso en entorno de desarrollo; recuperar ruta inválida. **390/768/1440:** navegación inequívoca, sin pantallas de branding. **FUTURO:** ningún rediseño de producto sobre `/dev` hasta estabilizar scenarios y release; 404 puede heredar tokens.

## 5. Matriz de estados para el conjunto de mockups

| Estado                        | Dónde aparece                                                           | Copia visible que debe respetarse                                                 |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Cargando                      | Plan, Hoy, Materias, Calendar, Vault al indexar, AppFrame               | «Cargando tu cursada…», skeleton rows; no porcentajes inventados                  |
| Vacío                         | Hoy sin agenda, Material sin links, Notas sin tab, Calendario sin ítems | Una oración + como máximo una acción; nunca tres cajas repetidas de «no hay nada» |
| Error                         | carga plan, items/material, acceso carpeta, guardado nota, auth         | Indicar causa sin atribuirla al estudiante, permitir reintento si existe acción   |
| Datos académicos desconocidos | plan UNR u otro sin correlativas publicadas, carrera manual             | «Correlativas no publicadas» / «No las inventamos»; sin candados falsos           |
| Cambiando/guardando           | status, registrar avance, biblioteca, quick-capture, CodeMirror         | Ubicar feedback al lado de acción y mantener fila/enfoque durante actualización   |
| Seudocompletado erróneo       | final / regularizada / aprobada                                         | Separar evento hecho de estado académico; mostrar resultado cuando corresponde    |
| Accesibilidad y foco          | Dialog, menú Más, campo en error, tab grupo, navegación                 | Texto legible + outline 2px + restaurar foco, teclado y reduced motion            |

## 6. Prueba de aceptación visual pendiente

Capturar en contexto real y sin datos sensibles: `S00` (móvil/escritorio); `S04` Hoy populated/empty; `S05` plan oficial/unknown; `S08` detalle con correlativas; `S09/10/11` calendario populated en sus tres modos; `S13` vault vacío/nota guardada; `S16` quick capture abierto/error. Para cada caso: **390×844, 768×1024, 1440×900**, y complementar 360×800 y 1280×800 cuando se apruebe la composición. Registrar ID, captura, caso de prueba, fecha y branch. Al 23/10/2026 **no se completó** esta validación runtime; las anotaciones por viewport son objetivos de diseño que requieren test, no observaciones de capturas.

Recién después de revisar los mockups ImageGen con el usuario se escribirá especificación de implementación React/Tailwind por pantalla. El inventario **no es autorización para cambiar la UI**.
