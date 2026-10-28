# Campus azul — QA Local Playwright

## Alcance y ejecución

Harness propio: `scripts/blue-local-qa.mjs`, `tests/e2e-blue/playwright.config.mjs` y `local.spec.mjs`.

```powershell
pnpm install
node scripts/blue-local-qa.mjs
# ejecución selectiva:
node scripts/blue-local-qa.mjs --grep 390x844
```

El runner elige **un puerto efímero** escuchando exclusivamente en `127.0.0.1` (nunca ocupa ni mata el Vite existente en 5173), ejecuta Vite en un proceso hijo identificado, crea una carpeta temporal única, restringe `CAMPUS_VAULT_ALLOWED_ROOTS` a esa carpeta y elimina **sólo esa carpeta** al finalizar. No necesita servicio Vault adicional: `campusVaultPlugin()` monta la API real en Vite durante `dev`. No se interceptan peticiones de la app ni se simula un backend. El navegador predeterminado es **Edge instalado** (Playwright `channel: 'msedge'`); para Chromium instalado, configurar `CAMPUS_BLUE_BROWSER_CHANNEL=chromium`. Headless por defecto; `CAMPUS_BLUE_QA_HEADLESS=0` para ventana visible.

Las credenciales `VITE_SUPABASE_URL=http://127.0.0.1:1` y `VITE_SUPABASE_ANON_KEY=blue-local-offline-fixture` se definen **sólo para satisfacer la inicialización del SDK**. No son reales ni se conectan a Supabase; Local usa el repositorio Vault real. Nunca habilitar el tester. Cloud/login reales **no están cubiertos**: exigen Supabase con claves y cuentas reales. Un build estático no monta el plugin Vault.

Las capturas PNG (startup, onboarding, Hoy, Plan, Materias, Calendario, Material, Ajustes, Vault, Progreso y recurso creado), traces y `results.json` se almacenan en `%TEMP%/campus-blue-qa/<timestamp>-<pid>`, **fuera del repositorio**. Opcionalmente `CAMPUS_BLUE_QA_OUTPUT` personaliza esa carpeta. No subirlas a Git: pueden reflejar información mostrada por la app. Los fixtures académicos se seleccionan en el **catálogo real** mediante el wizard; recurso creado y eliminado por UI real, con texto ficticio, sin datos privados.

Cada uno de **390×844, 768×1024 y 1440×900** verifica: primer acceso Local, Vault real, onboarding y contexto guardado; cada ruta existente accesible; scrollWidth de documento/body; JavaScript `pageerror`, `console.error` y HTTP 4xx/5xx locales; capturas; eje WCAG A/AA con axe (serious/critical bloquean); foco mediante Tab; atajo Ctrl+K, combobox y Escape. Las infracciones axe de impacto moderate/minor se adjuntan como anotaciones, no se silencian.

## Resultado verificado (28-10-2026)

**PASS — 3/3 tests, Edge real, 3,4 minutos.** Comando:

```powershell
node scripts/blue-local-qa.mjs
```

| Edge     | Resultado | Capturas | Incidencias bloqueantes |
| -------- | --------- | -------- | ----------------------- |
| 390×844  | PASS      | 11       | 0                       |
| 768×1024 | PASS      | 11       | 0                       |
| 1440×900 | PASS      | 11       | 0                       |

Se ejercitaron el startup, el wizard del catálogo real, las 8 rutas enumeradas en el spec, la creación/eliminación de una nota de Material, el foco y el atajo Ctrl+K/Escape. Por viewport se evaluaron overflow, consola y HTTP local, errores JS, WCAG AA con axe y capturas. Ninguna expectativa falló y el directorio `axe/` no contiene violaciones registradas para esta ejecución.

Evidencia local (no versionada): `%TEMP%/campus-blue-qa/2026-10-28T15-49-17-820Z-5160/` (33 PNG, `results.json`, traces cuando aplican). Los artefactos históricos de fallos previos permanecen en otros directorios temporales.

## Causa de bloqueo anterior y corrección

El primer intento del 27/10 estaba **bloqueado por dependencias**, no por la UI: Vite mostraba su overlay `Can't resolve '@dayflow/core/dist/styles.components.css'` porque `src/styles/globals.css` importa directamente `@dayflow/core`, pero el paquete estaba sólo como dependencia transitiva de `@dayflow/react`. La solución, aplicada por el agente principal el 28/10, fue declararlo directamente como `"@dayflow/core": "3.7.1"`, actualizar `pnpm-lock.yaml` e instalarlo con pnpm. El preflight del harness comprueba que el import sea resoluble antes de crear el servidor.

El propio harness corrigió dos localizadores erróneos detectados al correrlo: el `radio.check()` aguardaba un elemento que se desmonta al avanzar de paso (reemplazado con `click()`), y el nombre accesible del campo era `Título*` (ahora localizado por rol/regex). El encabezado real de `/plan` es `Plan académico`; para Ctrl+K se espera la hidratación de Hoy antes de simular el atajo. No se alteró el código de producto.

**Limitaciones:** Cloud real, login, sincronización y políticas remotas no se comprueban sin Supabase real. Axe automatizado no sustituye una inspección manual con lector de pantalla; las capturas no se comparan visualmente con un baseline. El runner no edita `src/**`, CSS ni `routeTree.gen.ts`; no hace push, merge ni PR.
