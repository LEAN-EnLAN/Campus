# Campus

Sistema operativo académico personal para estudiantes universitarios argentinos.

> Campus tiene que sentirse como abrir un cuaderno de facultad extremadamente bien
> organizado, no como entrar al portal administrativo de una universidad.

Proof of concept, código abierto. Producto: [`docs/PRD.md`](docs/PRD.md) ·
Dirección visual: [`docs/design.md`](docs/design.md).

## Qué hace

- **Onboarding académico** — universidad → facultad/regional → carrera → plan de estudios.
  Si no tenemos tu plan, seguís usando Campus igual y lo anotamos como faltante.
- **Hoy** — qué tenés que hacer hoy, qué se viene, qué estás cursando.
- **Plan** — tu carrera por año, con estados y **correlativas reales**. Aprobar una materia
  recalcula qué se te habilita.
- **Materias** — estado, fechas, correlativas (qué te falta y qué habilita), material.
- **Calendario** — la semana, con todo lo que anotaste en cualquier pantalla.
- **Material** — links y notas cortas, por materia.
- **Buscar** — materias, entregas y material, sin importar acentos (`/` o Cmd/Ctrl+K).

## Datos académicos

Los planes salen de **documentos oficiales que se leyeron de verdad**, con URL y fecha de
consulta guardadas en la base. Si algo no se pudo verificar, se registra como hueco — no se
inventa (PRD P-05).

| Institución | Unidad                    | Carrera                                    | Plan                                       | Materias | Correlativas  |
| ----------- | ------------------------- | ------------------------------------------ | ------------------------------------------ | -------- | ------------- |
| UTN         | Facultad Regional Rosario | Ingeniería en Sistemas de Información      | Plan 2023 (Ord. CSU 1877/2022 y 1878/2022) | 40       | 186           |
| UNR         | FCEIA                     | Licenciatura en Ciencias de la Computación | Texto Ordenado 2024 (Res. C.D. 850/2023)   | 33       | no publicadas |

Detalle, huecos y salvedades: [`docs/research/academic-sources.md`](docs/research/academic-sources.md).

## Stack

React 19 · TypeScript strict · Vite · TanStack Router + Query · Tailwind v4 · Supabase
(Postgres + Auth + RLS) · Vitest · Playwright + axe-core.

## Cómo correrlo

Necesitás **Docker corriendo**, Node 22+ y pnpm.

```bash
pnpm install

# 1. Levantar Postgres, Auth y PostgREST locales (la primera vez baja imágenes)
pnpm db:start

# 2. Aplicar migraciones y el seed académico
pnpm db:reset

# 3. Escribir .env con las claves locales que imprime Supabase
node -e 'const{execFileSync}=require("child_process"),fs=require("fs");
const s=JSON.parse(execFileSync("./node_modules/.bin/supabase",["status","-o","json"],{encoding:"utf8"}));
fs.writeFileSync(".env",`VITE_SUPABASE_URL=${s.API_URL}\nVITE_SUPABASE_ANON_KEY=${s.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${s.SERVICE_ROLE_KEY}\n`)'

# 4. Arrancar
pnpm dev        # http://localhost:5173
```

Creá una cuenta con cualquier email (el stack local no manda mails), elegí UTN → FRRo →
Ingeniería en Sistemas de Información → Plan 2023, y ya tenés 40 materias con sus
correlativas.

## Probarlo a mano

Hay seis cuentas de prueba sembradas que cubren todos los estados, **incluidos los que
están bloqueados** porque la facultad no publicó el dato:

```bash
pnpm tester seed    # crea las cuentas
pnpm dev            # y abrí http://localhost:5173/dev
```

Detalle en [`docs/TESTING.md`](docs/TESTING.md). Es andamiaje temporal y se saca entero
con cinco `rm` — está documentado ahí mismo.

## Verificación

Ningún comando acá miente: todos corren de verdad y devuelven un exit code real.

```bash
pnpm format:check     # Prettier
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # dominio puro, sin mocks
pnpm test:db          # aislamiento RLS A/B contra Postgres real
pnpm build            # build de producción

pnpm build && pnpm verify:journey   # el recorrido completo en un browser real
pnpm build && pnpm verify:ui        # 6 rutas × 5 viewports
pnpm build && pnpm verify:a11y      # axe-core, bloquea en critical/serious

pnpm build && pnpm verify:frontend:xvfb   # 39 superficies × 5 viewports, con axe en cada una
```

Los tres `verify:*` necesitan `pnpm build` antes y el stack local arriba. La evidencia queda
en `evidence/<tipo>/<candidato>/`, atada al hash del código que la produjo.

## Estructura

```text
src/domain/      lógica pura — sin React, sin Supabase, sin I/O. Acá vive la corrección.
src/lib/db/      único lugar que conoce nombres de columnas
src/features/    hooks de datos + componentes de feature
src/components/  primitivas presentacionales
src/routes/      rutas finas (composición nada más)
supabase/        migraciones + seed generado
scripts/         generación de seed y verificación
docs/research/   fuentes académicas oficiales y notas de investigación visual
openspec/        proposal, spec y tasks de este cambio
.claude/skills/  doctrina del proyecto para agentes
```

## Convenciones

Antes de tocar código, leé la skill que corresponda en `.claude/skills/`. En corto:

- La lógica de negocio va en `src/domain/**` y se prueba sin mocks.
- El schema cambia **solo** por migraciones. `database.types.ts` se genera, no se edita.
- Toda tabla tiene RLS. `with check` en insert **y** update.
- Nada de colores hardcodeados: todo pasa por los tokens.
- El color nunca es el único portador de significado.
- Nunca se inventa un dato académico.
