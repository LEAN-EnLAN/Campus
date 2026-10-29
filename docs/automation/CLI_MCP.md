# Campus · CLI y MCP Local

Estado: prototipo funcional Local, basado en LocalBackend y VaultRepository reales. No hay servicio de red público, túnel Cloud ni ejecutable Rust.

## CLI

Ejecutar desde la raíz de Campus (Node y dependencias instaladas):

    node packages/campus-cli/bin.mjs --help
    node packages/campus-cli/bin.mjs --root ABSOLUTE_VAULT_PATH --json status
    node packages/campus-cli/bin.mjs --root ABSOLUTE_VAULT_PATH --json subjects list
    node packages/campus-cli/bin.mjs --root ABSOLUTE_VAULT_PATH --json tasks create --title "TP Álgebra"
    node packages/campus-cli/bin.mjs --root ABSOLUTE_VAULT_PATH --json tasks list
    node packages/campus-cli/bin.mjs --root ABSOLUTE_VAULT_PATH --json resources create --kind note --title "Apunte" --body "Texto"
    node packages/campus-cli/bin.mjs --root ABSOLUTE_VAULT_PATH --json resources list

Ver --help para estados, marcar, eliminar y los demás flags. JSON devuelve ok/data o error/code/message. Códigos de salida: 0 correcto, 2 argumentos, 3 raíz no válida, 4 validación backend y 1 error interno.

La carpeta root debe ser absoluta y existente. No se infiere desde el directorio actual. La herramienta opera con los permisos Local del proceso y los controles de VaultRepository, que protege de rutas internas escapando el jail. Toda operación persiste en los archivos reales académicos de Campus; no se introduce ninguna base paralela.

## MCP self-hosted

    node packages/campus-mcp/server.mjs --root ABSOLUTE_VAULT_PATH
    node packages/campus-mcp/server.mjs --root ABSOLUTE_VAULT_PATH --allow-write

El transporte es stdio por mensajes JSON-RPC delimitados por línea. Soporta initialize, ping, tools/list, tools/call. Por defecto no permite mutaciones; --allow-write es un permiso explícito del proceso local. La raíz se fija al arrancar; ninguna herramienta puede cambiarla. Sin HTTP ni listener público, sin credenciales ni tokens en URLs.

El MCP ofrece inspección de estado, materias, tareas y materiales, y acciones de creación, estado y eliminación sobre los métodos existentes. La interoperabilidad definitiva con clientes MCP concretos debe probarse separadamente. No representa acceso Cloud.

## Verificación

    node --test packages/campus-cli/tests/cli.test.mjs
    node --test packages/campus-mcp/tests/server.test.mjs

Los tests crean carpetas temporales sin datos personales y comprueban persistencia con nuevas instancias.

## Arquitectura futura, no implementada

- Desktop Rust: iniciar servidor local stdio embebido como subproceso, seleccionar Vault, monitorear ciclo de vida y pedir permiso de escritura explícito.
- Cloud: túnel autenticado y opt-in con identidad de usuario/workspace, tokens efímeros, revocación, auditoría, control de acceso tenant y RLS. No exponer Vault mediante port-forward o servidor HTTP sin controles completos.
- El catálogo de herramientas y contratos deberá versionarse, incorporar cancelación y permisos por herramienta. Evitar reusar privilegios del Local para Cloud.

Nunca confundir este vertical slice Local con la versión remota, el túnel o la aplicación Rust terminadas.
