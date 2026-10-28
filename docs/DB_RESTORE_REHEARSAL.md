# Campus — Ensayo local de dump y restauración de PostgreSQL

**Ámbito:** Supabase CLI local en Docker Desktop, proyecto campus-poc. Solo lectura en la base de origen postgres. La restauración se ejecuta exclusivamente en una base temporal nueva del **mismo contenedor**, creada desde template0. Nunca se contacta el proyecto Cloud hospedado.

## Ejecutar

Desde el worktree que contiene el script, con Docker Desktop y Supabase local en funcionamiento:

```powershell
node scripts/db-restore-rehearsal.mjs --json
pnpm exec vitest run tests/unit/db-restore-rehearsal.test.ts
```

Se utiliza el socket local del contenedor supabase_db_campus-poc. El script comprueba que el contenedor esté sano y que la identidad de lectura sea postgres|postgres; no lee ni imprime las claves de supabase status, SMTP, JWT o contraseñas.

El procedimiento:

1. Obtiene una fotografía de metadatos y huellas de datos del origen mediante consultas de solo lectura.
2. Ejecuta un pg_dump completo en formato custom (-Fc), guardando el archivo **solo dentro del contenedor**, en /tmp/campus_restore_rehearsal_ seguido de 12 caracteres hexadecimales y extensión .dump. No copia datos al host, Git ni CI.
3. Rechaza cualquier base de destino ya existente. Crea una base temporal nueva con TEMPLATE template0 y un nombre generado/verificado. Jamás ejecuta pg_restore --clean ni DROP DATABASE postgres.
4. Restaura en una transacción (pg_restore --single-transaction --exit-on-error) bajo el rol **local** supabase_admin. El rol local postgres de Supabase no puede asumir algunos propietarios con SET ROLE; usar supabase_admin permite preservar los owners y ACL originales sin suprimirlos.
5. Compara en public, auth y storage: relaciones y propietarios; orden/nombres/tipos/nullability/defaults de columnas visibles; índices; constraints; políticas RLS (roles, comandos, USING, WITH CHECK); flags RLS; ACL de objetos y esquemas; permisos efectivos SELECT/INSERT/UPDATE/DELETE para anon, authenticated y service_role; recuentos y huellas de filas de todas las tablas base. **Solo se publican resúmenes agregados**, nunca contenidos ni hashes por tabla. Las huellas MD5 detectan divergencias pero no son firmas criptográficas autenticadas.
6. Repite la fotografía del origen para detectar cambios concurrentes. Si hay diferencias de filas, estructura, RLS o permisos, el ensayo falla.
7. En finally elimina el dump y la base temporal, y verifica mediante consultas que ambos hayan desaparecido. La limpieza solo admite el nombre aleatorio de formato restringido.

**Concurrencia:** ejecutar con el stack local sin escrituras concurrentes. El dump es transaccionalmente consistente, pero las dos fotografías de comparación se obtienen antes/después; cambios concurrentes darán un fallo conservador.

## Evidencia verificada — 28/10/2026

En Windows, Docker Desktop y PostgreSQL 17.6 con el contenedor local supabase_db_campus-poc sano, el dump/restauración completa pasó en base independiente: **46 tablas base, 47 relaciones y 34 políticas RLS**, con coincidencia en los ocho grupos de comparación: relations, columns, indexes, constraints, policies, grants, schemas y rows. El origen permaneció estable. La comprobación posterior de limpieza constató **cero bases temporales y cero dumps temporales**. No se adjuntan el dump, datos personales, emails ni secretos.

Un primer restore falló por la limitación SET ROLE de postgres: se resolvió usando el rol superusuario **local** supabase_admin. Una comparación inicial halló huecos físicos attnum de columnas eliminadas en auth.oauth_clients; un restore compacto puede renumerarlos. La comparación final conserva estrictamente el **orden de las columnas visibles** junto con sus propiedades, sin exigir la persistencia de los IDs físicos de columnas borradas.

## Manejo de fallos

Un resultado BLOCK indica que no se puede acreditar el ensayo; el script intenta limpiar aunque falle el dump, el restore o la comparación. Captura SIGINT/SIGTERM para completar la limpieza, pero un corte eléctrico, SIGKILL o caída de Docker pueden impedir finalmente. En ese caso, inspeccionar con estos comandos de **solo lectura**:

```powershell
docker exec supabase_db_campus-poc psql -X -U postgres -d postgres -A -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'campus_restore_rehearsal_%'"
docker exec supabase_db_campus-poc sh -c 'find /tmp -maxdepth 1 -name "campus_restore_rehearsal_*.dump"'
```

Si quedan recursos, verificar manualmente los nombres y el origen antes de gestionar su eliminación; jamás borrar por un patrón amplio ni tocar otra base. La falla de limpieza se informa como bloqueante.

## Límites del resultado

**Este ensayo NO satisface el gate de restore Cloud de producción.** No verifica backups hospedados, PITR, cifrado, retención, restauración en otro servidor/proyecto, RPO/RTO ni una copia offsite. Comparar políticas y grants en PostgreSQL no reemplaza los tests de aislamiento con JWT reales (pnpm test:db), ni los ensayos de SMTP/recuperación de contraseña.

Para el gate Cloud, el responsable necesita obtener un backup autorizado del proyecto correspondiente, restaurar en otro entorno aislado, validar datos/políticas y ejecutar pruebas reales de rol anon/autenticado, sin alterar producción. Mantener evidencia privada y sin tokens. Véanse docs/BACKUPS.md y docs/RELEASING.md: no levantar el bloqueo de release por este ensayo local.
