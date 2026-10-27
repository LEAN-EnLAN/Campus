# Backup y restauración local de Campus (fase 1)

**Estado:** disponible para **vault local**; el repositorio incluye prueba real de backup → verificación SHA-256 → restauración en otra carpeta. **No es un sistema automático de copias periódicas, ni un respaldo de Supabase Cloud**. Los datos siguen sin cifrar en el directorio destino: guardar la copia en un medio protegido y fuera de la computadora que se quiere recuperar.

## Procedimiento, sin credenciales ni servicios externos

1. **Cerrar Campus y cualquier editor que escriba en ese vault**; se requiere una fotografía estable de los archivos. Localizar la carpeta principal de Campus. Elegir un destino que **no exista todavía**, preferentemente en otro disco o ubicación segura.
2. Ejecutar desde la raíz del repositorio, con Node.js y pnpm instalados (en Windows, comillas alrededor de rutas con espacios):

```powershell
pnpm vault:backup backup "C:\Users\Usuario\Documents\Campus" "D:\Copias\Campus-2026-10-27"
pnpm vault:backup verify "D:\Copias\Campus-2026-10-27"
```

3. Ensayar recuperación **a una nueva carpeta vacía que aún NO existe**, sin sobrescribir el vault original:

```powershell
pnpm vault:backup restore "D:\Copias\Campus-2026-10-27" "C:\Users\Usuario\Documents\Campus-restaurado"
pnpm vault:backup verify "D:\Copias\Campus-2026-10-27"
```

4. Comparar algunas notas, materias y el directorio `.campus/academic/` entre origen y destino. Seleccionar el vault restaurado desde el selector de carpetas **solo en una sesión de prueba**. No reemplazar un vault de producción sin aprobación y sin verificar la restauración. Mantener el respaldo inalterado.

## Qué se comprueba, qué se rechaza

- El comando `backup` realiza copia en directorio temporal, con manifiesto de carpetas, archivos, tamaños y **SHA-256** de cada archivo; compara los archivos copiados y publica el directorio nuevo únicamente cuando coinciden.
- `verify` vuelve a recorrer el contenido y compara el manifiesto, detectando corrupción, modificaciones, archivos adicionales y faltantes. `restore` **primero verifica**, recupera a carpeta temporal, revalida el resultado y renombra a destino nuevo. Ante fallo elimina la carpeta temporal, **no** reemplaza un destino existente.
- Se preservan carpetas vacías. Se rechazan **symlinks POSIX, junctions Windows, enlaces a archivos y archivos especiales**: pueden escapar del vault o apuntar a algo que cambia. El test de Windows usa junctions reales sin fingir symlinks POSIX. Los nombres inseguros/no portables de Windows se rechazan para evitar cambios silenciosos al restaurar en otro sistema.
- Para confirmar la integridad se usan hashes, **no firmas autenticadas**. Alguien con acceso de escritura al backup puede reemplazar archivos **y su manifiesto**: proteger físicamente el destino, cifrar con una herramienta de backup apropiada, conservar copias fuera del equipo y controlar accesos.
- Esto es una **copia offline**: si la aplicación modifica archivos mientras se copian, puede fallar o reflejar cambios inconsistentes. No garantiza snapshot transaccional ni fsync de todo el volumen. Los tests tampoco prueban recuperación ante pérdida simultánea de dos discos.

## Cloud / SMTP / release: límites del alcance

La base **Cloud** reside en Supabase Postgres: sus cuentas, RLS, tablas y políticas **no** se guardan mediante `vault:backup`. Antes de publicar un release hay que comprobar por separado un dump de PostgreSQL y un **restore aislado con verificación de filas y políticas**, usando el mecanismo autorizado de la instalación (credenciales fuera de Git y del frontend). No se realizó esa operación sobre un proyecto hospedado ni se afirma disponibilidad de Point-in-Time Recovery o backups de un plan contratado.

El reseteo de contraseña usa `supabase.auth.resetPasswordForEmail` y callback `/login?recovery=1`, pero **requiere SMTP, redirects y ensayo de recepción real**. Las pruebas unitarias de auth verifican el contrato simulado y no demuestran entrega efectiva, filtrado de spam o expiración real del enlace. El prerelease sigue bloqueado por las condiciones de `RELEASING.md`: licencia decidida por el propietario, changelog, estado verde en el commit exacto, Cloud restore si aplica, SMTP probado y aprobación.

## Pruebas reproducibles sin datos personales

`pnpm exec vitest run tests/unit/local-backup.test.ts` crea un vault temporal con una nota Markdown, archivo académico JSON y carpeta vacía; realiza backup, verifica, restaura y compara bytes, además de detectar corrupción, traversal y junctions. `pnpm test` ejecuta este archivo como parte del conjunto normal. CI tiene un paso explícito para este caso y `release-preflight.test.ts`, adicional a la suite general.
