# Campus · Backlog operativo (29 octubre 2026)

Fuente de verdad para el hilo de T3 Code. Actualizar casillas **únicamente** con pruebas y commits concretos; no reiniciar ni duplicar PR #17/#18. La propuesta 2 azul es definitiva.

## P0 — Sistema visual e interacción (en desarrollo)

- [x] Adoptar Prompt como fuente local (OFL, cuatro pesos) y sustituir la serifa en el sistema azul. Verificar carga en localhost.
- [x] Hacer colapsables los grupos por año en Plan académico (teclado, contadores, conservar rutas reales).
- [x] Corregir Startup Local/Cloud con fondo azul claro de ancho completo, incluyendo el espacio de scrollbar, sin columnas beige exteriores ni estirar tarjetas. Commit `b4e6e20`.
- [x] Sustituir la fila de cinco símbolos de estado académico por un selector bajo demanda con SVG Lucide, teclado, foco, `failed`, limpiar, feedback y persistencia Local/Cloud. Commit `b4e6e20`.
- [x] Unificar los colapsables de Plan manual/catálogo y «Cargar mi avance»: cerrados inicialmente salvo el primer año con materias realmente en curso, sin reapertura arbitraria de primero. Commit `b4e6e20`.
- [x] Rehacer Ajustes, mantener funcionalidad y persistencia de personalización: paleta **azul** y tema **claro** coherentes en toda la app, incluidos diálogos y modales. Sin controles falsos.
- [ ] Refinar estructura, bordes, radios, paddings y densidad de layouts/modals en móvil/tablet/escritorio.
- [ ] Unificar iconos SVG: preferir Lucide ya instalado; evaluar Solar Broken de SVGRepo respetando la licencia de cada icono sin copiar librerías sin comprobar.
- [x] Añadir ambiente visual dinámico que cambie suavemente según hora local, sin pedir ubicación ni acceso a Internet y respetando reduced-motion y contraste.
- [x] Verificar Startup, onboarding, ocho rutas, Axe WCAG 2.1 A/AA, sin overflow y controles keyboard a 390×844, 768×1024, 1440×900 y 1627×928 (captura reportada). E2E Local 4/4 y screenshots 29/10/2026; no equivale a QA Cloud.

## P1 — Automatización programática (vertical slice Local verificada)

- [x] CLI de Campus: inspeccionar carrera/estado y listar, crear, actualizar y eliminar recursos y tareas con permisos equivalentes a UI, JSON estable, documentación y tests Local.
- [x] Servidor MCP **self-hosted**: tools tipadas sobre backend existente y stdio/loopback seguro, sin servidor expuesto por defecto.
- [ ] Diseñar conexión Cloud mediante túnel autenticado y opt-in, revocación de acceso, auditoría, aislamiento de workspace, sin secrets en querystrings ni endpoints públicos.
- [ ] Arquitectura futura de app escritorio Rust con MCP embebido; abrir implementación Rust solo cuando flujo desktop, protocolo y seguridad estén especificados y validados.

## P2 — Producto y estabilización

- [ ] GitHub PRs y branches: sincronización sin merge automático, CI y prerelease con licencia, changelog, restauración, SMTP y controles obligatorios.
- [ ] Terminar pruebas E2E Cloud con Mailpit, luego SMTP externo real (separar ambos resultados).
- [ ] Conservar backlog y progreso actuales de integraciones Obsidian, SCHOOL, UniStation, Estudia, hábitos, utilidades Matemática/Física/Química y marketing UTNHub; no duplicar issues.

## P3 — Ideas nuevas (al final, requieren más testing)

- [ ] Vista de folleto físico con materias tachadas con fibrón al aprobar: foco y progreso visual, reversible, accesible, sin sobreescribir estados académicos.
- [ ] Ayuda inteligente de anotación inline, semántica y transparente para destacar ideas importantes con negritas y colores según método, estilo Copilot; control reversible, sin modificar texto no aprobado.
- [ ] Citaciones para tesis: descubrir fuente, cita textual, comillas, bibliografía normalizada y deep link verificable al documento, sin inventar referencias o atribuciones.

## Política para el hilo T3

Un único hilo con este documento como mensaje de arranque, y posteriores respuestas con resultados: [ ] pendiente, [~] en progreso, [x] validado con comando + commit. Nunca dar por cerrado un item si solo hay mockups/planes. Todo cambio de UI es React real; no generar más imágenes ni Canva. No publicar release, ni hacer merge o deploy sin cumplir gates.

## Evidencia al 29 de octubre

- Prompt: public/fonts/prompt/ y src/styles/prompt.css, verificado en Edge 390/768/1440 (document.fonts.check true, data-theme light, sin overflow).
- Ajustes azul/blanco: commit 9ea9882, focal 10/10 tests PASS y persistencia de preferencias.
- Anios colapsables: src/routes/_app/plan.tsx con <details>/<summary>; validación de build y accesibilidad pendiente del reporte E2E integrado.
- Fondo horario: data-campus-period por hora local, update cada minuto y sin animación invasiva.
- CLI/MCP Local: 7/7 pruebas E2E reales sobre LocalBackend/VaultRepository, sin datastore paralelo, MCP stdio read-only por defecto y `--allow-write` explícito. Tunnel Cloud y desktop Rust no implementados.
- T3 Code: hilo creado en proyecto campus-poc, agente bloqueado por proveedor Claude no autenticado; requiere claude auth login en entorno ZAFIRUS-B-032. No marcar ejecución automática como realizada.
- Corrección visual de Startup y estados, y relevancia de los años: `b4e6e20`; E2E Local aislado 4/4 con Vault temporal real, selección académica y persistencia tras reload, screenshots y axe en `%LOCALAPPDATA%\Temp\campus-blue-qa\2026-10-29T18-08-20-184Z-36560` (móvil) y `%LOCALAPPDATA%\Temp\campus-blue-qa\2026-10-29T18-09-23-012Z-28876` (tablet/desktop/1627). Unitarios: `StatusControl` 9/9, Progreso 9/9, Plan/Carrera manual 6/6, Startup 29/29. `pnpm typecheck` y build OK; ESLint 0 errores, 16 advertencias de Fast Refresh preexistentes. No se alteraron datos del usuario, RLS, Cloud E2E ajeno ni `routeTree.gen.ts`.
- T3 Code sigue pendiente de acceso programático autenticado al hilo **existente**, sin duplicarlo ni afirmar ejecución del agente. Continuar backlog P0 general (modales, densidad e iconografía restante) y P1/P2 tras cerrar correcciones críticas; P3 deliberadamente última.

## T1 usage heatmap follow-ups (30 October 2026)

Source: `docs/ux-research/USAGE_HEATMAP.md`. These are additional scoped follow-ups, not closure of the existing P0/P1/P2 work.

- [ ] Warm — Calendar header hierarchy, empty-state CTA and month/week/agenda density: needs a dedicated Dayflow layout pass beyond the Hot journey.
- [ ] Warm — Calendar event detail/creation keyboard and mobile focus audit: third-party editor has a separate interaction contract.
- [ ] Warm — Unify Library inline creation with the course Add material dialog: two current entry points should converge after preserving filter/association behavior.
- [ ] Warm — Resource deletion confirmation or undo in Library/course detail: changes destructive-action behavior and needs its own persistence tests.
- [ ] Warm — Global search empty-result creation action: requires deciding which resource type/context the query should create.
- [ ] Warm — Notes workspace editor/external-change and conflict QA: file autosave and external edits need dedicated real-Vault fixtures.
- [ ] Warm — Notes quick switcher empty/loading and responsive results: not on the core presentation route.
- [ ] Warm — Notes content-search dialog result context and error recovery: requires populated note/index fixtures.
- [ ] Warm — Explorer rename/create/delete confirmation focus audit: requires file-operation and focus-restore tests beyond this polish.
- [ ] Warm — Settings notification-labelled shortcut and single-choice appearance controls: current destination/available controls need product-level reconciliation.
- [ ] Warm — Cloud login/signup/reset and email round-trip: Local-mode QA cannot establish Cloud behavior; retain the existing Cloud E2E backlog.
- [ ] Cold — Manual-subject inline removal wrapping/focus: rare action; keep its existing two-step confirmation until dedicated review.
- [ ] Cold — Missing/unavailable folder and recent-entry removal browser fixtures: permission/recovery paths need controlled filesystem fault injection.
- [ ] Cold — Dev scenario UI polish: tester-only surface is outside the student presentation.
- [ ] Cold — Remove the inactive LegacyTodayScreen export: separate cleanup avoids mixing code deletion with visible Hot improvements.
- [ ] Hot follow-up — Course-detail final completion bypasses the shared outcome dialog: preserve current completion/data behavior in this layout pass; reconcile final/item/subject updates and manual-subject handling with regression tests before changing the mutation path.
- [ ] Hot follow-up — Recover unfinished onboarding after refresh/workspace change: requires an explicit per-workspace draft storage/expiry decision; current persisted academic context remains unchanged.
- [ ] Integration gate — Re-run responsive/axe QA after combining T1 with T3 primitives/tokens/assets: evidence on either branch alone does not prove the integrated presentation candidate.
- [ ] Hot follow-up — Decide whether the status chooser should expose Desaprobada from every stored state: the current regression test intentionally offers it only when already failed; course-detail select/final outcome remain the supported entry points.
