# Campus · Backlog operativo (29 octubre 2026)

Fuente de verdad para el hilo de T3 Code. Actualizar casillas **únicamente** con pruebas y commits concretos; no reiniciar ni duplicar PR #17/#18. La propuesta 2 azul es definitiva.

## P0 — Sistema visual e interacción (en desarrollo)

- [x] Adoptar Prompt como fuente local (OFL, cuatro pesos) y sustituir la serifa en el sistema azul. Verificar carga en localhost.
- [x] Hacer colapsables los grupos por año en Plan académico (teclado, contadores, conservar rutas reales).
- [x] Rehacer Ajustes, mantener funcionalidad y persistencia de personalización: paleta **azul** y tema **claro** coherentes en toda la app, incluidos diálogos y modales. Sin controles falsos.
- [ ] Refinar estructura, bordes, radios, paddings y densidad de layouts/modals en móvil/tablet/escritorio.
- [ ] Unificar iconos SVG: preferir Lucide ya instalado; evaluar Solar Broken de SVGRepo respetando la licencia de cada icono sin copiar librerías sin comprobar.
- [x] Añadir ambiente visual dinámico que cambie suavemente según hora local, sin pedir ubicación ni acceso a Internet y respetando reduced-motion y contraste.
- [ ] Revisar capturas y accesibilidad a 390×844, 768×1024, 1440×900 y controles keyboard.

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
