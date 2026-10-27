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

## Verificación de esta ejecución (27-10-2026)

**Resultado: bloqueado antes de mostrar Campus.** Se ejecutó `node scripts/blue-local-qa.mjs --grep 390x844` en un puerto aislado, con Edge. El primer aserto de startup falló porque Vite mostró su overlay de desarrollo:

```
[plugin:@tailwindcss/vite:generate:serve]
Can't resolve '@dayflow/core/dist/styles.components.css' in src/styles/globals.css
```

No es lícito concluir que el diseño, el flujo Local o axe fallaron: **la app no llegó a renderizarse**. El runner incorpora un preflight explícito para esta dependencia y ahora informa el bloqueo antes de lanzar el navegador. Corregir instalación/resolución Dayflow en el árbol de producto (fuera de los archivos autorizados a este worker) y volver a ejecutar. También validar catálogos, rutas y labels si cambian los componentes de prime: la suite exige controles reales.

**Limitaciones:** no se validó la matriz completa con este harness por la dependencia bloqueante; la revisión visual externa de prime es independiente y no se presenta como resultado de esta suite. Los resultados y PNG generados antes del bloqueo permanecen en el directorio temporal de QA. El runner no edita `src/**`, CSS, `routeTree.gen.ts`, ramas, PR ni despliegues.
