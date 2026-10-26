# Campus · Protocolo de versiones y GitHub Releases

**Estado:** procedimiento preparado, **ninguna versión publicada**. La primera candidata prevista es `v0.1.0` (prerelease). Una rama en draft no es un lanzamiento.

## Condiciones previas obligatorias

1. Aprobar e integrar la estabilización en `main` tras revisar el PR técnico. Confirmar que CI `quality` y `database` terminan correctamente **en el commit a publicar**. No extrapolar un resultado de un commit anterior.
2. Elegir y añadir una licencia de distribución real (`LICENSE`); la elección corresponde al propietario. Comprobar la compatibilidad de cualquier material de terceros.
3. Escribir `CHANGELOG.md` con una sección `## [0.1.0]` y distinguir funciones verificadas, limitaciones y cambios incompatibles. Ajustar la versión en `package.json` antes del lanzamiento.
4. Completar el ensayo con email real de restablecimiento de contraseña (SMTP/redirects configurados), comprobar rutas profundas, registros y políticas RLS. Los tests simulados **no** verifican la entrega de correo.
5. Validar exportación/recuperación de datos y explicar los límites de Local y Cloud. Si falta alguna capacidad, marcar el bloqueo y no prometer protección de datos que no existe.
6. Ejecutar la batería determinista del proyecto en un entorno compatible: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm deploy:check`; para interfaces, la matriz de `docs/TESTING.md`. Registrar los resultados reales y las excepciones. La falta de privilegios de symlinks en Windows no equivale a un pase local completo.
7. Obtener aprobación explícita para publicar. **No** ejecutar este procedimiento automáticamente desde un push de PR ni generar tags desde un draft.

## Preflight local (no publica nada)

Partiendo de un `main` limpio y sincronizado con `origin/main`:

```bash
pnpm release:check --tag v0.1.0
```

El comando es de solo lectura. Bloquea etiquetas que no coinciden con `package.json`, ausencia de licencia/changelog, rama distinta de `main`, cambios locales y referencias remotas divergentes o ya etiquetadas. No confirma por sí solo el estado de CI, los backups, el funcionamiento de SMTP ni la autorización para publicar.

## Publicación manual, **solo después de aprobar todas las condiciones**

Una persona mantenedora crea el tag anotado apuntando al commit exacto de `main` revisado y publica una **pre-release** de GitHub con las notas del changelog. Puede usar la interfaz de GitHub (Releases → Draft a new release). Debe verificar que el `target` es el commit revisado y activar `Set as a pre-release`.

Después de publicar, comprobar públicamente nombre, commit, notas, marca de prerelease y URL; verificar que el checkout del tag sigue compilando. Anotar limitaciones conocidas y procedimiento de reporte de bugs. Publicar un release **no** despliega Campus ni migra una base de datos; deployment y migraciones tienen procesos y aprobación separados.

## Volver atrás

Si se detecta un defecto, suspender nuevos deployments, documentar el incidente y preparar un fix sobre una rama nueva. No reescribir un tag ya distribuido para aparentar una versión distinta. Publicar una versión correctiva y, si corresponde, señalar claramente la versión afectada. Para un problema de datos, ensayar la restauración en un entorno aislado antes de aplicarla a producción.
