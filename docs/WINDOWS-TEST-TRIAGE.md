# Campus · Triage de tests en Windows (fase 1)

## Evidencia y alcance

En Windows (b032, Node/pnpm del lockfile), el barrido original del 24/10/2026
ejecutó `pnpm exec vitest run --reporter=json --outputFile=evidence/windows-vitest.json`:
**1157 tests, 1104 aprobados, 53 fallidos, 14 archivos con fallos**. El JSON
local está en `evidence/` (ignorado por Git) y permite reproducir los nombres
y stacks sin subir rutas privadas del equipo. En el barrido anterior habían
fallado 51: las tres pruebas de `ProgressEntryScreen` no fueron estables entre
ejecuciones, por lo que el número global no debe tratarse como un valor fijo.

## Clasificación por causa

| Grupo                                   | Fallos originales | Evidencia concreta                                                                                                                                                                              | Acción                                                                                                                                                                                                  |
| --------------------------------------- | ----------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symlinks no permitidos                  |                35 | `EPERM: operation not permitted, symlink` antes de llamar al código bajo prueba; afecta `src/lib/vault/vault-containment.test.ts` (18), `vault-repository` (4), `src/server/vault-api*` y otros | Mantener todas las pruebas de confinamiento en CI Ubuntu. Para ejecutarlas en Windows, habilitar Developer Mode o usar un runner con permisos de symlink. No hacer `skip` ni simular enlaces con mocks. |
| Rutas POSIX tomadas como universales    |                 9 | `src/server/vault-roots.test.ts` (4), `catalog-assets.test.ts` (4), `tests/unit/dev-server-env.test.ts` (1); Win32 devuelve rutas `C:\\...` y no tiene el directorio Linux `/tmp`               | Aserciones con `node:path.resolve` y requisito de `/tmp` sólo en POSIX.                                                                                                                                 |
| Detector de dependencias ignora Windows |                 3 | `tests/unit/backend-boundary.test.ts` obtiene rutas con `\\`, y los filtros `src/domain/` / `src/features/` no encuentran archivos; además la allowlist difiere                                 | Normalizar separadores de rutas de repositorio a `/` para ejecutar las mismas reglas sin reducir cobertura.                                                                                             |
| JSON con CRLF de checkout               |                 1 | `tests/unit/academic-catalog.test.ts`: texto de catálogo versionado con CRLF difiere del generador que escribe LF                                                                               | Normalizar fin de línea en el comparador; sigue detectando diferencias semánticas y de formato restantes.                                                                                               |
| Pantalla de carga de avance             |                 3 | `src/features/academic/progress-entry-screen.test.tsx`: falla flujo 13 materias, aparecen 4 escrituras donde se esperaba 1, y la pantalla queda con un `<p>` vacío; advertencias de React `act` | Derivar incidencia separada para el equipo UX/feature, repetir test aislado y en suite, comprobar sincronización de mutaciones y semántica real del control. No se editaron componentes ni esta prueba. |
| Permisos de filesystem POSIX            |                 1 | `src/server/vault-api-roots.test.ts` espera `permission_denied` tras `chmod`, pero ACL Windows y permisos POSIX difieren; recibe `undefined`                                                    | Mantener la prueba POSIX; diseñar una prueba Windows con ACL real si la plataforma es objetivo.                                                                                                         |
| Mapeo de error de E/S                   |                 1 | `src/server/vault-api-errors.test.ts` espera `io_error` o `not_found` al escribir bajo un archivo; en Windows obtiene `destination_exists`                                                      | Inspeccionar la normalización ENOTDIR/EEXIST en `src/lib/vault/errors.ts` y contract de mensajes; no cambiar producción sin caso funcional reproducible.                                                |

**Total inicial: 53.** Las correcciones de portabilidad en aserciones se
limitan a cinco archivos de tests (13 casos). La segunda ejecución completa
(`evidence/windows-vitest-after.json`) dio **1119 aprobados, 38 fallidos de
1157**. Persisten 35 por symlinks, 1 intermitente de `ProgressEntryScreen`
y 2 de semántica Windows (ACL y código de error). Las otras dos fallas de la
pantalla no se reprodujeron en esa segunda corrida; requieren investigación
de sincronización. Ninguna prueba de seguridad se desactivó.

## Revalidación Fase 1 (24/10/2026)

Se agregaron cinco pruebas de recuperación de cuenta (el total sube de
1157 a 1162). Los cambios posteriores incluyen enlaces de directorio reales
por junction, ACL temporal auténtica, normalización de error `mkdir` y
espera de carga inicial del router dentro de React `act`. Se confirmó que
`window.scrollTo` no está implementado en jsdom y se agregó un stub al
entorno de pruebas, sin modificar código de aplicación.

| Ejecución Windows                        | Aprobados | Fallidos |    Total |
| ---------------------------------------- | --------: | -------: | -------: |
| Antes de esta iteración                  |      1119 |       38 |     1157 |
| Ejecutado con la paralelización anterior |      1147 |       15 |     1162 |
| `--maxWorkers=2`                         |  **1150** |   **12** | **1162** |

El número final de 12 fallos corresponde **únicamente** a creación de
symlinks de archivo, colgantes o ciclos no admitida por los permisos de este
proceso Windows. No hay fallos de aserción del software en esa corrida. Los
tres `STACK_TRACE_ERROR` de `ProgressEntryScreen` eran timeouts cuando
muchos workers de jsdom compiten por CPU; con 2 workers pasaron sus pruebas
de UI sin reducir assertions. `vitest.config.ts` limita workers sólo en
Windows (Ubuntu CI continúa con su valor estándar).

## Qué significa para una entrega

El CI de Ubuntu es la referencia obligatoria de validación cruzada y ejerce los
symlinks reales; un CI verde allí no demuestra compatibilidad total con Windows.
La comprobación en Windows 11 build 26200, Node 24.21.0, usuario estándar
de b032, confirmó:

- La clave de registro `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock`
  no está disponible; el proceso no presenta `SeCreateSymbolicLinkPrivilege`.
- `New-Item -ItemType SymbolicLink` para archivos y directorios falla con
  "Administrator privilege required for this operation".
- `node:fs.symlinkSync(..., 'junction')` crea un enlace **real** a directorios
  sin elevación; `lstatSync(...).isSymbolicLink()` devuelve `true`.

`tests/support/real-links.ts` mantiene los symlinks nativos de POSIX, usa
junctions reales para directorios Windows y sigue exigiendo symlinks genuinos
para archivos y enlaces colgantes. Ninguna prueba se reemplaza por mocks ni se
saltea para aparentar éxito. Habilitar Developer Mode podría permitir enlaces
de archivo sin elevación; no se modificó ninguna política del equipo. Se debe
repetir el probe real después de habilitarlo.

La prueba Windows de permisos usa una ACL auténtica `icacls /deny (F)` en
directorios temporales, restaurándola en `finally`. `writeNote` distingue el
error `EEXIST` de `mkdir` en Windows cuando el supuesto padre es un archivo,
y lo informa como `not_found`, igual que el `ENOTDIR` POSIX. El caso
`inner/..` conserva la prueba exacta en POSIX y ejecuta una cadena
equivalente de dos junctions bajo Windows, cuya API normaliza destinos.

La deuda `format:check` global (327 archivos en la estimación inicial) se
mantiene fuera de este cambio; los archivos editados usan Prettier individual.
