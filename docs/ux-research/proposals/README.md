# Propuestas visuales de Campus · Hoy · ronda 01

**Estado de esta entrega (24/10/2026): `PROMPTS_READY / NO_IMAGES_GENERATED`.**

Se solicitó generar tres imágenes originales de **Hoy** desktop (1440 × 900) y una adaptación móvil (390 × 844), **exclusivamente con ImageGen nativo de ChatGPT**. Esta ejecución **no tiene disponible** una herramienta `image_gen` nativa. El conector `save_image` solo puede guardar imágenes nativas **ya generadas en este chat**, no crear nuevas. Canva y los demás generadores se descartaron expresamente por instrucción del usuario. No hay imágenes originales, capturas de propuestas, previews, renders ni URLs de assets para enseñar. **No presentar estos briefs como propuestas visuales ya vistas.**

El trabajo conserva el contrato de datos del escenario **`utn-activo`** en `scripts/tester.mjs`, las rutas y los estilos existentes (corte `fd8a832`, investigación `b91e847`). Los cuatro prompts son **autónomos y listos para pegar de a uno** en una conversación con acceso a ImageGen nativo. Las variantes A/B/C muestran exactamente la misma información, sin inventar capacidades.

## Material entregado

| ID        | Destino propuesto para ORIGINAL, inexistente hasta generarlo | Prompt íntegro                             | Diferencia UX                                                                    | Estado                    |
| --------- | ------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------- |
| `H-D01-A` | `hoy-desktop-A-cuaderno-original.png`                        | [`prompts/H-D01-A.md`](prompts/H-D01-A.md) | **Cuaderno editorial:** una columna de lectura, aire y serif selectiva           | PENDIENTE, **0 imágenes** |
| `H-D01-B` | `hoy-desktop-B-agenda-original.png`                          | [`prompts/H-D01-B.md`](prompts/H-D01-B.md) | **Agenda de precisión:** filas cronológicas densas, tiempo y metadatos alineados | PENDIENTE, **0 imágenes** |
| `H-D01-C` | `hoy-desktop-C-mesa-original.png`                            | [`prompts/H-D01-C.md`](prompts/H-D01-C.md) | **Mesa de estudio:** agenda a la izquierda, materias y progreso a la derecha     | PENDIENTE, **0 imágenes** |
| `H-M01-A` | `hoy-mobile-A-cuaderno-original.png`                         | [`prompts/H-M01-A.md`](prompts/H-M01-A.md) | **Adaptación móvil de A:** una columna, barra de tabs y FAB                      | PENDIENTE, **0 imágenes** |

La ruta de almacenamiento pertenece exclusivamente al worktree `work/campus-ux-study/docs/ux-research/proposals/`. Los nombres de destino están **reservados en el manifiesto, no son enlaces a archivos existentes**.

## Protocolo para ejecutar cuando ImageGen nativo esté disponible

1. Invocar **ImageGen nativo en ChatGPT** con el contenido completo de `prompts/H-D01-A.md`; **una sola generación original por mockup**. No Canva, API de imágenes, CLI, SVG, Canvas, HTML/CSS ni generadores programáticos.
2. Mirar la salida y cotejar contra [`SCENARIO.md`](SCENARIO.md): datos, español, día, estados, menú, fondo, controles y jerarquía. Guardar el **original** de esa generación con el nombre reservado, mediante `save_image` si la imagen fue generada en el mismo chat y está visible en él. Registrar identificador/ubicación reales, dimensiones reales y SHA-256 real después de que el archivo exista. No rellenar por aproximación.
3. Repetir por separado B y C; después generar una sola adaptación móvil de A (o de la dirección elegida si el usuario la prioriza). Los PNG solo se declaran `generated` si el conector comprobó que son imágenes originales de ImageGen. **No transformar screenshots en imágenes supuestamente generadas.**
4. Para revisión del usuario, mostrar las tres imágenes **directamente**, lado a lado si la UI lo permite, con las descripciones A/B/C de la tabla. Etiquetarlas «Propuesta visual, no pantalla implementada». Comparar navegación, ritmo de lectura, densidad, ubicación de «Atrasadas / Hoy / Próximas» y tratamiento del contexto. No pedir que el usuario elija sobre títulos únicamente.
5. Tras revisar las imágenes, preguntar **cuál dirección conserva** y qué ajustes requiere. Registrar feedback/aceptación antes de implementar. La aprobación de mockup no equivale a QA responsive.

## Restricciones de factibilidad verificadas

- La app usa `React`, `Tailwind v4`, `TanStack Router`, `PageHeader`, `SectionHeading`, `DeadlineRow`, `ProgressLine` y `AcademicShell`. Los prompts no requieren motor de diseño nuevo.
- `AcademicShell` **REAL** desktop tiene sidebar de **220 px** a partir de `md=768` y una columna de lectura de `52rem ≈ 832 px`, sin rail contextual en `Today`. Las tres variantes mantienen navegación desktop real. C propone como **FUTURO** redistribuir bloques **que ya existen** hacia una segunda columna de contexto (CSS grid); requiere cambio de UI solo si se aprueba.
- Mobile **REAL** tiene barra superior Campus + Buscar, barra fija **Hoy / Plan / Materias / Calendario / Más**, y `+` flotante en Hoy. No aparece sidebar desktop en móvil.
- Orden de Hoy: `Atrasadas` (si hay) → `Hoy` → `Próximas` → `Sin fecha` → `Cursando` → `Final pendiente` → `Tu carrera`, según `src/routes/_app/today.tsx`. En C se propone una reubicación visual de las tres secciones contextuales, **sin cambiar su contenido**.
- `todayHeadline` cuenta atrasadas + hoy. Con una atrasada y dos del día, el encabezado correcto es **«Tenés 3 cosas para hoy.»**. Eventos de más de 14 días **no aparecen** en Próximas. `scripts/tester.mjs` contiene también un evento de final a +21 días: **no dibujarlo en Hoy**.
- Colores de tokens reales: `paper` tipo lino `#efe6dd`, `ink` `#231f20`, `accent` turquesa `#7ebdc2`; Newsreader para encabezados, Inter para UI; reglas tenues sin sombras de tarjetas.

## Evidencia y control

`manifest.json` fija `generated_count: 0`, `original_assets: []`, `viewed_images: []`; no contiene URLs inventadas. El componente ImageGen nativo deberá producir cada imagen dentro de una sesión habilitada antes de editar estos campos.

**Fuentes:** `docs/ux-research/IMAGEGEN_BRIEFS.md`, `AUDIT.md`, `SCREEN_INVENTORY.md`, `src/routes/_app/today.tsx`, `src/components/academic-shell.tsx`, `src/components/deadline-row.tsx`, `src/features/items/today-model.ts`, `scripts/tester.mjs`, `supabase/seed.sql`, `src/styles/globals.css`. No se modificó ningún archivo de producto.
