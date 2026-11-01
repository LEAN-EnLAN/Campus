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

## Cloud auth E2E (Supabase + Mailpit LOCALES)

Runner: `node scripts/blue-cloud-qa.mjs`. Sólo consulta `pnpm exec supabase status -o env` y rechaza destinos que no sean `127.0.0.1:54321` (Auth) y `127.0.0.1:54324` (Mailpit). Levanta Vite en puerto efímero con `VITE_CAMPUS_VAULT=off`. Edge ejecuta `tests/e2e-blue/cloud.spec.mjs`: registro con cuenta `.test` aleatoria, salida de sesión, error de contraseña, login real, recuperación desde Mailpit, actualización de contraseña e inicio con la nueva. No intercepta las peticiones a Supabase ni entrega correo externo; limpia la cuenta de prueba por admin local al finalizar. Nunca se exponen las claves en logs.

**Configuración observada:** `supabase/config.toml` tiene `[auth.email] enable_confirmations=false`. Por eso la confirmación de registro **no se envía** y no se afirma que se haya verificado; requiere habilitarla expresamente y configurar redirects permitidos para el puerto E2E si se desea validar enlaces de confirmación. `[auth] site_url=http://127.0.0.1:3000` y `additional_redirect_urls` no incluyen el puerto efímero. En recuperación el spec sigue la verificación real de GoTrue, pero cambia sólo la URL de destino al puerto del runner si Supabase devuelve un redirect a 3000. No es equivalente a verificar la configuración productiva de redirect; esa política necesita prueba separada.

**Ejecución parcial:** se inició Edge contra los dos servicios reales y se creó una cuenta desechable correctamente. Falló antes de probar recuperación: al volver directamente a `/login`, todavía existía sesión tras el registro y la aplicación redirigía a `/today` durante el click de `Iniciar sesión`. Se corrigió el test para cerrar sesión mediante Ajustes antes de probar login. La cuenta de prueba **se eliminó con éxito**. El siguiente intento de ejecutar el runner fue bloqueado por los controles de ejecución de herramientas y por tanto la suite corregida **no está validada de extremo a extremo**. No se debe informar PASS hasta una ejecución reproducible completa.

Comprobación recomendada tras permitir la ejecución: `node scripts/blue-cloud-qa.mjs`. Requiere Supabase Docker iniciado y Mailpit; si faltan, devuelve error explícito, sin usar un servicio alojado. Las evidencias quedan bajo `%TEMP%/campus-blue-cloud-qa`, fuera del repositorio. No modificar configuración SMTP del entorno de producción para estos tests.
