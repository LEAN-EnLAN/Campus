# Campus · Estabilización fase 1

## Alcance

Se incorporó recuperación de contraseña en Campus Cloud, se corrigió la
dependencia declarada de `@dayflow/core` que usa el CSS del calendario y se
configuró el generador de rutas para ignorar archivos `.test.tsx` adyacentes a
rutas. También se añadió el primer pipeline de GitHub Actions para
`pull_request` y pushes a `main`. Los checks no despliegan, publican versiones
ni acceden a credenciales de producción.

## Checks automáticos

`quality` instala con lockfile, ejecuta ESLint, TypeScript, Vitest, un build
estático con variables de prueba y el análisis `deploy:check` del bundle.
`database` inicia Supabase local en Docker, aplica migraciones/seed y ejecuta
`test:db` con claves obtenidas localmente, verificando las políticas RLS.
El wrapper `scripts/with-supabase-env.mjs` transmite la URL y la clave pública
locales tanto como `SUPABASE_*` para las pruebas como `VITE_SUPABASE_*`
para el adaptador que importa el cliente real mediante `import.meta.env`.
Esto evita un fallo de carga previo a ejecutar `tests/db/conformance.test.ts`.

Los tests que ejercitan enlaces simbólicos se ejecutan en Ubuntu. En Windows,
`symlinkSync` puede fallar con `EPERM` sin el modo de desarrollador o los permisos
necesarios. **No se deshabilitan estos tests**: comprueban límites de acceso a
archivos y deben seguir en un sistema que soporte symlinks reales. Otras pruebas
presentaban diferencias entre rutas POSIX/Win32, permisos POSIX y saltos CRLF:
no deben confundirse con una regresión de la nueva funcionalidad.

El `format:check` global ya estaba fallando en centenares de archivos antes de
esta fase. Por eso todavía no bloquea el pipeline; la deuda debe reducirse en
cambios acotados sin reformatear de golpe el repositorio ni afectar la UI en
revisión. Los archivos modificados en la fase se validan individualmente con
Prettier.

## Recuperación de acceso

En el modo Entrar aparece el enlace de recuperación. Se solicita un email y,
si Supabase acepta la petición, se muestra una respuesta neutral que no revela
si la cuenta existe. El enlace llega a `/login?recovery=1`, y la sesión temporal
de Supabase queda en la pantalla de cambio de contraseña hasta confirmar el
nuevo valor. La contraseña debe tener al menos seis caracteres y coincidir con
su repetición; el cambio se envía a `supabase.auth.updateUser`.

Para desarrollo local, `supabase/config.toml` autoriza callbacks hacia los
orígenes habituales de Vite (`localhost:5173` y `127.0.0.1:5173`). En producción
hay que habilitar **cada dominio** en Supabase Authentication → Redirect URLs y
configurar SMTP; el cliente nunca guarda un secreto de administración.

## Verificación pendiente del entorno

El pipeline recién añadido debe correr por primera vez en GitHub Actions. La
recuperación de contraseña requiere un ensayo manual de extremo a extremo con
una cuenta de prueba, email recibido y Supabase hospedado o local configurado.
Hasta entonces la evidencia es de código, pruebas unitarias y compilación.
Se ampliaron las pruebas con email inválido, enlace de recuperación sin sesión,
contraseñas diferentes, error de token en el proveedor, límite de tasa y fallo
de red. Los envíos de email se simularon mediante mocks de Supabase Auth; no se
mandaron mensajes reales ni se utilizaron secretos de producción.
