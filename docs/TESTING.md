# Probar Campus a mano

Herramientas para testear el frontend completo sin tener que armar datos a mano —
**incluidos los estados que hoy están bloqueados** porque la universidad no publicó la
información.

> Todo esto es andamiaje temporal. La última sección explica cómo sacarlo entero.

## Arrancar

```bash
pnpm db:start          # Postgres + Auth locales (necesita Docker)
pnpm db:reset          # migraciones + seed académico
pnpm tester seed       # crea las cuentas de prueba
pnpm dev               # http://localhost:5173
```

Y abrí **http://localhost:5173/dev** — es una lista de escenarios con un botón "Entrar"
para cada uno. Necesita `VITE_CAMPUS_TESTER=1` en tu `.env`.

## Los seis escenarios

Todas las cuentas usan la contraseña **`campus-tester`**.

| Cuenta                                    | Qué te muestra                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `tester-nuevo@tester.campus.local`        | Cuenta recién creada, sin carrera. Cae en el onboarding, obligado.                                    |
| `tester-unmapped@tester.campus.local`     | **Carrera que Campus no tiene.** Plan degrada honestamente en vez de mostrar una grilla vacía.        |
| `tester-utn-vacio@tester.campus.local`    | UTN con el plan cargado y cero progreso. Todos los empty states.                                      |
| `tester-utn-activo@tester.campus.local`   | UTN cursando 3 materias, con una entrega atrasada, una de hoy, un parcial mañana y material guardado. |
| `tester-utn-avanzado@tester.campus.local` | UTN en el último año: 26 aprobadas, 2 equivalencias, 1 desaprobada.                                   |
| `tester-unr@tester.campus.local`          | **UNR — el caso bloqueado.** El plan es real pero la facultad no publicó las correlatividades.        |

```bash
pnpm tester seed    # crea o refresca (idempotente: borra y rehace)
pnpm tester list    # imprime la tabla
pnpm tester purge   # borra las cuentas y todos sus datos
```

Sólo funciona contra el stack local: si la API no es `127.0.0.1`, se niega a correr.

## Lo que está bloqueado y por qué

Dos cosas no están completas, y **no es por falta de código** — es que la fuente oficial
no publica el dato. Están construidas y son testeables igual:

**Correlatividades de UNR.** El Texto Ordenado 2024 de la Licenciatura en Ciencias de la
Computación dice, textual, que _"los requisitos de correlatividades serán aprobados
oportunamente por el Consejo Directivo de la Facultad"_. No existen todavía.

Con `tester-unr` vas a ver que Plan funciona, agrupa por año y muestra estados — pero
ninguna materia aparece bloqueada, porque no hay grafo que evaluar. **Eso es correcto.**
La alternativa era rellenarlas desde el Plan 2010, que sí las tiene publicadas, pero ese
plan renumeró los códigos: `R-313` y `R-322` significan cosas distintas entre planes.
Copiarlas habría producido correlativas plausibles y falsas, y un estudiante que confía en
una correlativa inventada pierde un cuatrimestre.

**Cuatro filas de UTN marcadas `verified: false`.** Los tres bloques de electivas y la
Práctica Profesional Supervisada: la Ordenanza no documenta su nivel ni su cuatrimestre.
Están en el plan, con la marca puesta, en vez de con un año inventado.

Ver `docs/research/academic-sources.md` para el detalle completo.

## Barrido automático de todo el frontend

```bash
pnpm build && pnpm verify:frontend        # headless
pnpm build && pnpm verify:frontend:xvfb   # headed, dentro de un display virtual
```

**39 superficies × 5 viewports = 195 chequeos**, corriendo los escenarios en paralelo.
Cada uno mide: que renderice, errores de runtime, overflow horizontal, banners de error
inesperados, y **accesibilidad con axe-core**. Deja captura de cada uno en
`evidence/frontend/<candidato>/`.

Cubre lo que `verify:ui` no ve: login (los tres estados), 404, onboarding paso por paso,
la salida manual, Plan para UNR y para carrera desconocida, Materias por cada filtro,
detalle de materia bloqueada / cursando / aprobada, el formulario de nota, y los dos
overlays con y sin resultados.

### Por qué `:xvfb` y no `xvfb-run` a secas

Esta máquina corre Hyprland. Un Xvfb que **busca** un display libre puede quedarse con
`:0` a través del socket de namespace abstracto y dejar al compositor real hablándole a un
servidor de software. Por eso el script pinnea `-n 99`, y `verify-frontend.mjs` se niega a
correr en modo headed si `DISPLAY` es `:0`.

Chromium headless no necesita display para nada — el modo headed existe solamente porque
renderiza fuentes y scrollbars como lo hace un browser de verdad, así que las capturas son
más fieles.

### Fallos de terceros

El sweep clasifica los errores de red **por origen**. Google Fonts devolviendo 404 un rato
no es un defecto de Campus: se registra en `externalErrors` y no bloquea. Un 4xx de nuestro
propio servidor o de Supabase sí bloquea.

## Cómo sacar esto

Nada de la aplicación importa estos archivos. Se va entero con:

```bash
rm src/routes/dev.tsx
rm -rf src/features/dev
rm scripts/tester.mjs
rm scripts/verify-frontend.mjs
rm docs/TESTING.md
```

Y en `package.json`, borrar tres scripts: `tester`, `verify:frontend`,
`verify:frontend:xvfb`. En `.env`, borrar `VITE_CAMPUS_TESTER`.

Para limpiar las cuentas de la base, **corré `pnpm tester purge` antes** de borrar el
script.

Chequeo de que quedó limpio:

```bash
rg -l "features/dev|tester\.mjs|CAMPUS_TESTER" src/ scripts/    # no debería devolver nada
pnpm typecheck && pnpm build
```
