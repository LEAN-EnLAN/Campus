# Campus — dirección de mockups y briefs para ImageGen nativo

**Estado:** preparado para ronda de propuestas, **pendiente de revisión del usuario**.

**Tarea autorizada ahora:** investigar y preparar briefs. **No se generaron imágenes.**

**Único motor autorizado para próximas imágenes:** **ImageGen nativo de ChatGPT** (una generación original por composición). No Canva, herramientas de diseño que produzcan la imagen, API de imágenes, CLI ni renders HTML/CSS convertidos en mockups.

Referencias funcionales: [AUDIT.md](AUDIT.md), [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md). Los nombres de pantallas y funcionalidades **REAL** se extrajeron del código del corte `fd8a832`. Las imágenes de propuesta deben portar una etiqueta externa **«FUTURO PROPUESTO»** y no presentarse como capturas del producto.

## 1. Objetivo creativo y límites

Crear una familia coherente de propuestas visuales de Campus, entendible por estudiantes argentinos y traducible posteriormente a **React 19 + Tailwind v4 + TanStack Router + componentes actuales**. Debe sentirse como un cuaderno universitario editorial y una mesa de trabajo con estructura, **sin parecer** un LMS, ERP, Trello genérico, Notion clon ni una aplicación de IA. El estilo es institucionalmente confiable, cálido, directo, sereno, ligeramente táctil y ágil.

Las referencias se usan por **comportamiento**, nunca por identidad: Things (jerarquía Hoy/Próximos), Craft (documento primero), Obsidian (notas enlazadas / local), AFFiNE (proporciones del workspace) y Supernotes (densidad tipográfica de metadatos). **No reproducir** logotipos, screenshots, colores de marca, sidebar exacto, ilustraciones ni iconografía propietaria. No generar texto de relleno («Lorem ipsum») o eventos vacíos; usar contenidos de prueba plausibles y consistentes.

## 2. Biblia visual única — pegar en todas las llamadas ImageGen

> **SISTEMA CANÓNICO CAMPUS.** Diseño de interfaz web de alta fidelidad para estudiantes universitarios argentinos. Papel cálido casi blanco, bordes finos de tinta gris, tipografía editorial con títulos serif estilo Newsreader y controles sans estilo Inter. Una sola familia de color de acento azul/turquesa apagado, tonalidades de estado sobrias; la grilla del calendario puede sumar tonos armónicos discretos por materia con etiquetas legibles. Sin gradientes, brillo, glassmorphism, stock photography, mascotas, tarjetas KPI gigantes, sombras de tarjetas, esquinas excesivamente redondeadas, ornamentación inimplementable o pseudo-3D. Usar bloques y espaciado de 4/8/12/16/24 px, líneas divisorias, alto contraste, títulos y navegación precisos. Iconos lineales tipo Lucide. Producto denominado **Campus** con logo tipográfico simple y pequeño trazo vertical a la izquierda; español argentino correcto. Priorizar lectura, alineación, jerarquía y estados. Render plano frontal de interfaz completa, píxeles nítidos, sin marco de dispositivo ni perspectiva, fondo neutro. Los módulos deben poder construirse con React/Tailwind/CSS grid/flex y componentes existentes; no inventar animaciones ni componentes 3D.

**Reglas de consistencia entre imágenes:**

1. **Un vocabulario de UI:** encabezados «Hoy», «Tu plan», «Tus materias», «Calendario», «Notas», «Material», «Ajustes», «Agregar entrega», y «Más» donde sea aplicable. Las mismas materias y estados en todas las imágenes del set.
2. **Una fuente de datos ficticios marcada de prueba:** ingeniería en sistemas UTN Rosario Plan 2023 como ejemplo respaldado por seed real del repo; nombres de asignaturas específicos se toman del seed/plan, no se inventan equivalencias. Fechas en octubre de 2026 son **datos de maqueta**, no hechos de agenda del estudiante. Cargar algunas obligaciones de prueba: «TP 4 de Análisis Matemático II», «Parcial de Física II», «Inscripción a final de Arquitectura»; pueden variar solo si se etiqueta la imagen como DEMO y el cambio se mantiene consistente.
3. **Estados académicos:** `Disponible`, `Cursando`, `Regularizada`, `Aprobada`, `Bloqueada` y `Correlativas no publicadas` tienen semántica distinta. Una variante UNR sin correlativas **nunca** dibuja candados o «disponibles» como hechos.
4. **Navegación real:** desktop actual: sidebar de 220 px con Hoy/Plan/Materias/Calendario/Notas/Material/Ajustes, buscar y agregar. En 390 px: cabecera Campus, barra fija Hoy/Plan/Materias/Calendario/Más. El FAB aparece según pantalla; Notas/Material/Ajustes tras Más. **Rail compacto de 48 px solo en variante etiquetada FUTURO.**
5. **Tamaños de imagen EXACTOS:** móvil **390×844**, tablet **768×1024**, desktop **1440×900**, sin recortes del menú. Se admite ampliar contraste o fuente tras iteración con usuario, sin mover arquitectura sin decisión.
6. **El mockup nunca certifica funcionalidad:** etiquetas «REAL — UI basada en código» y «FUTURO — propuesta visual» deben quedar en la nota de revisión **fuera de la imagen** para no confundir producto con anotaciones. Una renderización de pantalla real sigue siendo ilustrativa hasta contrastarse con captura de navegador.

## 3. Ficha de render de cada propuesta

Cada prompt enviado a ImageGen debe acompañarse de esta ficha fuera del contenido de la imagen:

| Campo            | Valor a completar                                                |
| ---------------- | ---------------------------------------------------------------- |
| `screen_id`      | S00–S21 del inventario                                           |
| `variant`        | `A` conservadora / `B` exploratoria o `C` iteración revisada     |
| `truth`          | REAL / FUTURO                                                    |
| `viewport`       | 390×844 / 768×1024 / 1440×900                                    |
| `dataset`        | UTN FRRo ISI Plan 2023 ejemplo; estado específico                |
| `behavior`       | Qué tap/clic produce qué cambio, solo si existe en fuente        |
| `references`     | Links de patrón conductual, sin copiar identidad                 |
| `implementation` | Qué flex/grid/Tailwind/componente existente permitiría recrearla |
| `feedback`       | Aprobado / Cambiar / Rechazado; qué zona, qué motivo             |

**Control antialucinaciones:** mirar cada imagen y marcar diferencias contra inventario antes de mostrarla: navegación, número de paneles, textos, tipo de acción, estado de materia, contenido, proporción y scroll. Una imagen con datos de universidad erróneos, botones no implementables o navegación duplicada es **descartada**, no se valida por estética. Pedir imagen corregida con ancla a la anterior y el mismo sistema canónico para preservar familia visual.

## 4. Matriz de variantes para revisión del usuario

| Lote | Brief                                                   | Tamaños                  | Variantes                                | Qué decisión se pide                                 |
| ---- | ------------------------------------------------------- | ------------------------ | ---------------------------------------- | ---------------------------------------------------- |
| I    | S00 selector, S02 onboarding, S03 avance                | 390 y 1440               | A REAL, B FUTURO                         | Entrada sin fricción y claridad de datos local/Cloud |
| II   | S04 Hoy, S05 Plan, S08 Materia                          | 390 y 1440               | A lista editorial, B densidad compacta   | Jerarquía de obligaciones, correlativas y año        |
| III  | S09 Mes, S10 Semana, S11 Agenda                         | 390/768/1440 según vista | A REAL, B FUTURO adaptable               | Grilla vs agenda y legibilidad de materia            |
| IV   | S13 Notas local, S14 Cloud vacío                        | 390 y 1440               | A nav 220 actual, B rail compacto FUTURO | Shell y orden del explorador/editor                  |
| V    | S16 captura, S06/07 Materias, S12 Material, S15 Ajustes | 390 y 1440               | A/B según necesidad                      | Controles, microinteracciones, filtros y estados     |

**Ritmo:** generar **una sola composición por llamada nativa ImageGen**, revisar su anatomía y contradicciones, corregir si hace falta y recién entonces producir su pareja responsive, usando el resultado anterior como referencia visual dentro de la conversación. Evitar generar 12 imágenes simultáneas de estilos incompatibles. El usuario revisará primero S04/S05/S13, las superficies donde una decisión global tiene mayor efecto.

## 5. Prompts específicos listos para usar

La persona que invoque **ImageGen nativo** debe anteponer la **Biblia visual** del §2 y elegir una única composición de estas. Los prompts describen **propuestas de imágenes**; no son especificaciones de implementación aprobadas.

### IG-01 · S00, inicio y espacio — 390×844

> **REAL, variante A.** Dibujar pantalla inicial Campus para celular 390×844 en español argentino. Arriba logo tipográfico Campus pequeño; pregunta «¿Dónde querés guardar tus materias y tus notas?»; contenido organizado por decisión, no hero marketing. Mostrar dos caminos **solo cuando ambos estén disponibles**: carpeta en mi computadora (local, mantiene archivos en el equipo) y Campus Cloud (en mi cuenta), separados por una regla discreta. Botones con etiqueta de acción comprensible y explicación breve de privacidad. Estado de primer uso sin materias ni gráficos. Barra inferior **no aparece todavía** porque el estudiante no entró al shell. Buena lectura móvil y 44 px de toque. Sin inventar sincronización automática entre opciones ni login para la carpeta local.

**FUTURO variante B:** comparar una versión editorial con dos grupos equivalentes, texto explicativo de una línea y ejemplo de ubicación, adaptando a web sin API local (solo Cloud real). **Implementación:** `Startup`, `FolderPicker`, capacidades runtime; cards opcionales con bordes y superficies, sin otro backend.

### IG-02 · S02, onboarding con plan — 390×844

> **REAL, variante A.** Mockup móvil Campus 390×844 del paso de elegir universidad y carrera. Cabecera «Contanos dónde estudiás»; línea de progreso legible «Universidad · Facultad · Carrera · Plan», elegidos anteriores visibles en modo compacto, siguiente pregunta destacada con opciones radio nativas estilizadas como filas de papel: UTN, UNR. Una opción seleccionada muestra borde de acento, texto y radio. La alternativa «No encuentro mi carrera» aparece como enlace discreto cerca del botón «Listo, empezar», deshabilitado hasta elegir plan. Diseño liviano y sin campo avatar, biografía ni foto. No fingir planes de universidades no seedados.

**FUTURO B:** al elegir facultad, conservar breadcrumb corto arriba y mostrar próximas opciones, sin introducir pasos no implementados. **Implementación:** `fieldset` + inputs radio y estado descendiente, `onboarding.tsx`.

### IG-03 · S03, cargar avance — 1440×900

> **REAL, A.** Campus desktop con sidebar 220 px y columna editorial centrada. Título «Contanos hasta dónde llegaste», nota «Regularizada es cursada aprobada, con el final todavía por rendir». Agrupar asignaturas por «1° año» y «2° año», cada grupo con contador y CTA secundario «Aprobé todo 1° año», filas con materias y controles de estado discretos «Aprobada», «Cursando», «Sin marcar», feedback pequeño «Guardado». Ningún botón Guardar global porque el cambio persiste al elegir. El pie muestra acción de terminar y revisar conflictos si existen. Fondo papel y líneas, sin tablas ERP ni confetti.

**FUTURO B:** reducir longitud visual de filas sin quitar explicación de regularizada ni deshacer de aprobación masiva. **Implementación:** `ProgressEntryScreen`, `StatusControl` y dominio real de estados.

### IG-04 · S04, Hoy — 390×844

> **REAL, A.** Captura conceptual de Pantalla «Hoy» en Campus móvil 390×844 con fecha editorial «Viernes, 23 de octubre», título dinámico humano y lista de obligaciones antes de cualquier indicador. Orden: «Atrasadas» si hay, «Hoy», «Próximas». Filas de 44px con checkbox de tarea y nombre de materia en tinta atenuada; ejemplo «TP 4 de Análisis Matemático II», «Parcial de Física II», con fecha textual no horarios inventados. Barra inferior Hoy / Plan / Materias / Calendario / Más, Hoy activo. Botón flotante + con contraste moderado por encima de la barra. Nada de cronómetro, porcentaje de enfoque, AI assistant ni KPI dashboard.

**FUTURO B — compacto:** mismo dataset pero un primer viewport que prioriza pendientes y hace progresos secundarios a la lista; distinguir tipo con microetiqueta. **Implementación:** `TodayScreen`, `DeadlineRow`, `SectionHeading`, `AcademicShell`, CSS flex/list.

### IG-05 · S04, Hoy — 1440×900

> **REAL, A.** Versión desktop coherente de IG-04, 1440×900. Navegación izquierda Campus de 220px; columna de lectura cálida hasta ~832px centrada. Fecha serif pequeña, titular, tres secciones de agenda, filas lineales, acción «Ver calendario» textual. En la mitad inferior materias «Cursando», «Final pendiente» y progreso «Tu carrera» solo si cabe. Mantener el mismo contenido y tipo de acción del móvil; eliminar FAB y ubicar botón «Agregar» en sidebar. No agregar derecha un rail de métricas sin contenido contextual.

**FUTURO B:** mayor densidad de fila, menos huecos entre secciones, conserva medida de lectura. **Implementación:** las mismas primitivas y responsive `md`/`lg`.

### IG-06 · S05, Plan / correlativas — 1440×900

> **REAL, A.** Pantalla «Tu plan» de Campus desktop 1440×900; título «Ingeniería en Sistemas de Información», indicación «Plan 2023», enlace en letra pequeña «Fuente oficial · Consultada...» sin sello inventado. Barra de progreso sobria; debajo grupos «1° año», «2° año», «3° año» con materias y estado **con palabra visible**: Aprobada, Cursando, Disponible, Bloqueada. Algunas filas contienen «Aprobada» y habilitaciones; acción secundaria «Cargar mi avance». No dibujar un grafo 3D, ni un mapa institucional inexistente. Izquierda nav 220px. Objetivo: identificar qué te falta para cursar.

**FUTURO B:** cada grupo plegable y un bloque contextual «Requiere/Te habilita» solo si se decide implementarlo; jerarquía revisable. **Variación obligatoria:** otro mockup separado **REAL** de plan con **«Correlativas no publicadas»** sin candados ni cifras falsas. **Implementación:** `PlanScreen`, `SubjectRow`, `ProgressLine`, bandera `prerequisitesKnown`.

### IG-07 · S08, materia — 390×844

> **REAL, A.** Detalle móvil 390×844 de «Análisis Matemático II»: link «Volver a materias», metadata «2° año · Anual», título serif, estado «Cursando» y botón «Agregar entrega». Primera sección «Fechas» con lista breve, luego «Notas» solo en workspace de carpeta local, «Correlativas» con requeridas y «Habilita», y «Material» con links. Disposición vertical clara con separadores finos, ningún sistema de pestañas falso. Navegación inferior y sin FAB adicional porque ya hay «Agregar entrega» en el detalle. Asegurar que título largo no colisione con la acción.

**FUTURO B:** resumen compacto próximo parcial / estado y mininavegación a secciones por anclas, solo si el usuario aprueba. **Implementación:** `CourseDetailScreen`, `SubjectNotes`, `CorrelativasPanel`, `QuickCapture`.

### IG-08 · S09/10/11, calendario — 768×1024 y 1440×900

> **REAL, A.** Campus calendario tablet 768×1024, sidebar de navegación real desde 768, encabezado con «Octubre 2026», botones anterior/siguiente/Hoy y selector «Mes · Semana · Agenda», Mes activo. Grilla de semanas comenzando lunes, días numerados, chips breves tipo «TP 4 · Análisis II» y «Parcial · Física II» con tonos muy discretos diferenciados por materia, textos en alto contraste. Eventos todo el día en línea, sin supuestos de drag-to-reschedule. Panel scroll interno; evitar cortar calendario por la barra de navegación. En desktop 1440×900 el canvas ocupa el área de trabajo restante.

**FUTURO B, móvil separado:** propuesta 390×844 con Agenda inicialmente destacada como lectura más útil en ancho pequeño, sin afirmar que la app ya persiste esa preferencia; botones Mes/Semana/Agenda siguen disponibles. **Implementación:** `CampusCalendar`, `DayFlowCalendar` + slots, `AgendaList`, `CalendarChrome`.

### IG-09 · S13, notas workspace desktop — 1440×900

> **REAL, A.** Campus 1440×900 usando el shell existente: sidebar global Campus de 220 px a la izquierda, explorador de carpetas contiguo a editor de notas, pestañas de archivos arriba, documento central con título serif «Clase 7 — Matrices», cuerpo Markdown mostrado como lectura amable en columna de ancho razonable, elementos de lista, código y `[[Referencias]]` como texto de enlace, indicador de guardado de archivo. La interfaz presenta una sola nota activa y no introduce una vista de grafo ni un canvas infinito. Bordes suaves finos y casi ninguna sombra. El explorer debe verse unido al borde izquierdo, sin flotación sobre el centro.

**FUTURO B:** rail compacto 48px y explorer acoplado, panel de backlinks contextual, tab preview en cursiva y split, todo **explicitamente propuesto** para confirmar con usuario. Dibujar también pareja en móvil IG-10. **Implementación:** `WorkspaceShell`, `FileExplorer`, `NoteEditor`/CodeMirror6, `BacklinksPanel`, modelo `panes`.

### IG-10 · S13, notas mobile — 390×844

> **FUTURO, B.** Pantalla móvil «Notas» de Campus 390×844 con top bar y navegación inferior reales; barra de herramienta de notas compacta con botón «Carpetas», título «Clase 7 — Matrices» y editor abierto como superficie dominante. Explorador cerrado por defecto, abre como sheet **solo** al tocar Carpetas; el editor no queda oculto en primera apertura. Anotación fuera de mockup: diferencia con `sidebarOpen=true` actual. Párrafos de longitud cómoda, tabs no se fuerzan a dos columnas, estado guardado discreto en zona superior. Sin grafo Obsidian, sin vista Notion, sin editor cloud inventado.

**REAL A, para contraste:** mismo viewport con el explorer abierto por defecto ocupando unos 288px como código actual; incluir solo si el usuario quiere comparar el defecto. **Implementación futura:** cambiar valor inicial condicionado por viewport con lógica robusta de persistencia y test; no se modifica ahora.

### IG-11 · S16, captura rápida — 390×844

> **REAL, A.** Overlay de captura de Campus móvil sobre «Hoy» atenuado, panel blanco papel y borde discreto adaptado a la parte inferior del viewport; título «Agregar entrega», campo enfocado «¿Qué es?» con texto «TP 4 de Análisis Matemático II», selector Tipo (Entrega) y Materia (Análisis Matemático II), Fecha «26/10/2026» y Hora opcional, nota «Sin hora, queda para todo el día», botones «Cancelar» y «Guardar». Barra inferior de app apenas visible tras el overlay. Los campos y errores en español rioplatense, alto contraste. No introducir NLP, calendario de Google, recordatorio push ni repetición automática.

**FUTURO B:** mostrar primera fila título y fecha destacadas, controles tipo/materia secundarias al expandir, pero sin perder validación y capacidad de asignar materia. **Implementación:** `QuickCapture` + `Modal` con foco atrapado y restaurado; componentes `TextField`/`SelectField` existentes.

### IG-12 · S06/07, materias — 390×844 y 1440×900

> **REAL, A.** Vista «Tus materias» de Campus: chips filtrables `Todas`, `Cursando`, `Final pendiente`, `Aprobadas` y `Disponibles` **solo si grafo conocido**, cada chip con cuenta. Toggle «Lista / Tablero». Móvil 390×844 dibuja **Lista** con filas «Análisis Matemático II — Cursando», estado a la derecha y año pequeño; sin perder navegación inferior. Desktop 1440×900 puede mostrar **Tablero** real con columnas correspondientes a grupos de estado. Los controles de estado son discretos pero visibles. No colorear columnas como sprint Agile ni inventar drag-and-drop de tareas. Cuando cambia un estado, fila permanece momentáneamente hasta cambiar filtro.

**FUTURO B:** probar tablero con columnas apiladas para mobile y selector de estado compacto. **Implementación:** `CoursesScreen`, `SubjectBoardView`, `SubjectStatusControl`.

### IG-13 · S12/S14/S15, material, vacío Cloud y ajustes — 390×844

> **REAL, A.** Tres propuestas independientes, nunca combinarlas en una pantalla. Material: cabecera «Tu material», formulario Link/Nota breve y materia, lista agrupada por curso; sin upload de PDF. Notas Cloud vacío: ilustración vectorial pequeña de carpeta, título «Tus notas viven en tu computadora» y explicación de acceso local; sin editor fantasma. Ajustes: tema Claro/Oscuro/Como el sistema, opciones de acento con nombre visible, ubicación del espacio, cuenta si Cloud y carrera. Cada pantalla mantiene navegación móvil y regla de separadores. No dibujar opciones ni sync inexistentes.

**FUTURO B:** mejor alineación, compactación y prioridad de ayuda, preservando capacidades reales. **Implementación:** componentes y rutas existentes.

## 6. Estados que necesitan una segunda imagen, no solo la principal

| Pantalla       | Estado A                                   | Estado B                                         | Regla de fidelidad                                               |
| -------------- | ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------- |
| Plan S05       | Plan con correlativas oficiales            | Carrera manual / sin correlativas publicadas     | B nunca muestra materias habilitadas por grafo desconocido       |
| Hoy S04        | Obligaciones atrasadas/hoy/próximas        | Día vacío y sin carrera elegida                  | No duplicar tres empties; CTA a onboarding cuando falta contexto |
| Calendario S09 | Mes con eventos                            | Sin datos guardados                              | Empty real indica que aparecen al registrar parcial/entrega      |
| Materia S08    | Cursando, fechas, material, notas en local | Cloud sin notas y sin requerimientos publicados  | Ausencia de sección no se transforma en datos inventados         |
| Vault S13      | Carpeta abierta y nota activa              | Sin archivo / error de guardado / cambio externo | Mostrar guard/error en texto; evitar implicar autosync en Cloud  |
| Captura S16    | Edición válida                             | Fecha inválida o título faltante                 | Error junto al input y foco en primer campo problemático         |
| Avance S03     | Estado individual guardado                 | Aprobación de año y deshacer / conflicto         | No borrar cambios sin posibilidad real de reversión              |

## 7. Protocolo de revisión por usuario (obligatorio antes del código)

Cada tanda se presenta con una **imagen principal** y, si aporta, una comparación A/B; fuera del mockup se explica en dos o tres líneas qué pantalla es, qué alternativa es FUTURO, qué función realmente existe y qué decisión concreta se solicita. No empezar con decenas de variaciones sin un ancla común.

Registro de feedback a mantener por composición:

```text
ID: IG-04 / S04 / móvil 390×844
Variante: A (REAL) / B (FUTURO)
Estado usuario: PENDIENTE | CAMBIAR | APROBADO | RECHAZADO
Secciones aprobadas:
Secciones a corregir:
Problema de factibilidad React/Tailwind:
Regla global nueva para próximas imágenes:
Captura actual equivalente disponible: SÍ / NO
```

Después del primer feedback, **actualizar la Biblia visual** en una versión `v2`, citar qué se resolvió y anclar las siguientes imágenes a una ya aprobada. Si un control de imagen no existe en código, llevarlo a backlog FUTURO y exigir decisión explícita. **Aprobación de propuesta visual no sustituye QA técnico**: al implementar habrá que auditar con capturas 390/768/1440 y tests de flujo.

## 8. Checklist de consistencia antes de mostrar un render

- ¿La navegación coincide con viewport y ruta REAL? ¿La pantalla muestra solo las acciones posibles?
- ¿Los textos de carrera/materia están en español argentino sin faltas, y son congruentes entre mockups?
- ¿Los estados académicos, fuente oficial y ausencia de correlativas se representan sin afirmar algo falso?
- ¿El contenido principal se ve en el primer viewport de 390 y tiene lectura cómoda en 1440?
- ¿Se puede reproducir con componentes, CSS grid/flex y Tailwind v4 sin inventar diseño 3D?
- ¿Los contrastes, texto visible, foco y controles de toque serían practicables?
- ¿Todo patrón de Things/Craft/Obsidian/AFFiNE/Supernotes se transformó al lenguaje Campus y no copió identidad?
- ¿Se etiqueta A/REAL y B/FUTURO en la entrega al usuario, y está registrada su decisión antes de implementar?

**Próximo acto pendiente:** ejecutar ImageGen **nativo** sobre IG-04 (Hoy 390 y 1440) y IG-09/10 (Notas 1440 y 390), enseñar las dos direcciones al usuario y esperar su selección. Esta investigación **no autoriza ninguna modificación de UI**.
