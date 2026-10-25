# Evidencia runtime Campus — 24/10/2026

## Resultado verificado

Servidor **Vite** en `http://127.0.0.1:5188`, worktree `work/campus-ux-study`, commit producto `fd8a832`, investigación `649da02` al iniciar. Variables transitorias de entorno `VITE_SUPABASE_URL=http://127.0.0.1:1`, `VITE_SUPABASE_ANON_KEY=offline`, sin servicio Cloud. Se usó **modo local real** con carpeta de datos de prueba dentro de `node_modules/.cache/campus-ux-fixture/`, fuera de control de versiones. El CSS de DayFlow se resolvió con la dependencia local `node_modules/@dayflow/core/dist/styles.components.css`; no fue necesario editar el producto ni tocar la rama de infraestructura.

Usando **Chat On Steroids Desktop Browser** se abrió una pestaña nueva de Campus, se ingresó la ruta del vault, se eligió UTN → Facultad Regional Rosario → Ingeniería en Sistemas de Información → Plan 2023 y se confirmó el primer uso. Navegación ejecutada en un navegador real, **no imágenes ImageGen**.

| Ruta     | Evidencia DOM                                                                                                                      | Captura nativa del navegador en la sesión                                                          | Viewport exacto devuelto | Estado                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------ |
| `/today` | Fecha «Sábado, 24 de octubre», «No tenés nada para hoy», «Tu carrera», progreso `0/40`                                             | `screenshotId=fe58f9ed-44b2-472e-8b2a-98aa4ffae10e`, `pageId=8b6be7e8-25b2-430f-8f36-c01adf38b5d0` | 776×521                  | **REAL / fixture vacío** |
| `/plan`  | Ingeniería en Sistemas de Información, Plan 2023, link fuente oficial, `0/40`, `9 disponibles / 28 bloqueadas`, materias de 1° año | `screenshotId=573d5282-7dcd-431c-8eca-96acebe671d9`, `pageId=2c3be4cb-5d12-441b-a020-461fee2c0477` | 766×521                  | **REAL / fixture vacío** |
| `/vault` | «Nota de hoy», «+ Nota», «+ Carpeta», «Sin notas abiertas», «Escribir mi primera nota»                                             | `screenshotId=281ca933-31ed-4595-9f8a-8765cf0588a2`, `pageId=d62ce23c-f06c-4731-8cb4-74c85e6239f1` | 776×521                  | **REAL / sin notas**     |

**Procedencia de capturas:** `Chat_On_Steroids_Desktop__b032___browser_screenshot`, navegador existente en tabId `68918771-54d7-4044-87aa-6282ff54bce5:530377936`; URL local por ruta, scale `1`, `fullPage=false`. Los identificadores pertenecen a la sesión del navegador: **no constituyen enlaces públicos ni rutas de archivos**. La herramienta devolvió ID y dimensiones, pero no ofreció acción para exportar esos screenshots como archivos originales a esta rama. **No hay PNG en el repositorio.** No se usó screenshot programático, Canva ni ImageGen.

## Límite: matriz solicitada de viewports

Se intentó `window.resizeTo(1464,979)` sobre el tab propiedad del agente; `outerWidth/outerHeight` cambiaron pero `innerWidth/innerHeight` permanecieron en `776×521`, por lo que **no hubo cambio de layout verificable**. Tampoco existe en el conector Desktop Browser presentado una acción de emulación de viewport de 390/768/1440. No es válido llamar «1440» al screenshot resultante ni cambiarles dimensiones posteriormente. **Capturas completas de 390×844, 768×1024 y 1440×900: pendientes.**

Los estados poblados de `scripts/tester.mjs` son fixtures de Cloud y requieren servidor de autenticación/tester; esta inspección abrió **un vault local vacío**. Los documentos de propuestas A/B/C utilizan el fixture `utn-activo` como dato de diseño, pero **no se ha validado esa composición poblada en runtime**. El DOM de Hoy vacío sí está verificado.

## Reproducción de la evidencia pendiente

1. Preservar worktree y arrancar Vite con configuración local de prueba en puerto `5188`; mantener `@dayflow/core` resoluble desde `node_modules`. Revisar `git status` tras arrancar: TanStack puede regenerar `src/routeTree.gen.ts`; revertir exclusivamente ese cambio propio al cerrar la revisión si surge.
2. Desde el navegador de escritorio con opción de viewport/emulación **real**, establecer sucesivamente `390×844`, `768×1024`, `1440×900`, y comprobar con `window.innerWidth`, `window.innerHeight`, `matchMedia('(min-width:768px)')`, `scrollWidth/clientWidth` antes de capturar. Registrar métricas, ruta y estado.
3. Cargar un fixture no sensible representativo usando los flujos o scripts de tester existentes en un entorno aislado y revisar Hoy vacío/poblado, Plan 2023 y Notas con nota abierta, además de errores, hover, foco y overflow. No capturar información privada.
4. Usar exclusivamente captura **real** de Desktop Browser o exportación original admitida por el mismo conector; registrar nombre, dimensiones, SHA-256 y metadatos **solo al disponer realmente del archivo**. Nunca pasar por render ImageGen una captura ni generar imágenes visualmente similares para rellenar evidencias.

## Pruebas y límites funcionales observables

Se verificó un recorrido local completo **inicio → selector de carpeta → onboarding UTN → pantalla de avance → Hoy/Plan/Notas** y contenido DOM legible en cada ruta. No se verificaron en esta sesión ítems creados, cambios de estado guardados, cuadernos abiertos, tablet/mobile breakpoints, ni contraste visual por viewport. No inferir que todas las pruebas cross-platform pasan por esta navegación.
