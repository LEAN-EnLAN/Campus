# Campus POC — Product Requirements Document v0.1

**Status:** Build-ready  
**Codename:** Campus  
**Product type:** Personal academic operating system for Argentine university students  
**Initial stage:** Open-source proof of concept  
**Primary language:** Spanish (Argentina)  
**Target:** Responsive web application, mobile-first but desktop-capable

## 0. Índice resumido

1. Product thesis
2. Problem
3. Users
4. Principles
5. Scope
6. Core product loop
7. Information architecture
8. Functional requirements
9. Academic domain model
10. Data provenance
11. Technical architecture
12. Security and privacy
13. Quality requirements
14. Success criteria
15. Explicit non-goals
16. POC release definition

# 1. Product thesis

Campus debe ser el lugar al que un estudiante entra para contestar inmediatamente:

- ¿Qué tengo que hacer hoy?
- ¿Qué estoy cursando?
- ¿Qué se viene esta semana?
- ¿Cómo voy en mi carrera?
- ¿Qué materia depende de cuál?
- ¿Dónde dejé el material de esta materia?
- ¿Qué información académica es realmente relevante ahora?

No debe sentirse como un LMS institucional, ERP, Trello genérico, copia de Notion, foro, red social o demo de IA.

Debe sentirse como **un cuaderno académico personal que entiende la estructura real de una carrera universitaria**.

# 2. Problema

El estudiante argentino termina repartiendo su vida académica entre WhatsApp, PDFs, Drive, calendario, notas, autogestión, grupos, plan de estudios, correlatividades, recordatorios, capturas y chats privados.

Campus POC no intentará fusionar inmediatamente todas esas soluciones. El primer problema a resolver es:

> **Transformar la cursada personal del estudiante en un sistema claro, confiable y agradable de consultar todos los días.**

# 3. Usuario inicial

## Persona primaria

Estudiante activo de universidad argentina que cursa varias materias, usa teléfono y notebook, recibe información desde múltiples canales, necesita recordar parciales/trabajos/finales y quiere visualizar progreso y correlativas sin mantener una base compleja.

## Instituciones iniciales

La arquitectura debe admitir cualquier institución. Para demostrarlo, el POC debe soportar conceptualmente UTN y UNR y sus diferentes unidades académicas.

Modelar:

```text
Institution
→ Academic Unit
→ Program
→ Curriculum Version
→ Subject
```

# 4. Principios de producto

- **P-01 — Today first:** abrir Campus responde primero qué importa ahora.
- **P-02 — Academic-native:** materia, correlativa, plan, final, regularidad y período académico son first-class.
- **P-03 — Progressive disclosure:** no configurar un ERP para empezar.
- **P-04 — Capture fast, organize later.**
- **P-05 — Source-aware:** nunca inventar planes o correlativas.
- **P-06 — Personal before social.**
- **P-07 — Free core.**
- **P-08 — Mobile is not a compressed desktop.**
- **P-09 — AI is optional infrastructure:** no feature de IA para estudiantes en este POC.
- **P-10 — Evidence over polish theater.**

# 5. Alcance del POC

## Incluido

### A. Onboarding académico

Seleccionar universidad, unidad académica, carrera y plan. Si el plan no existe, permitir modo manual y registrar la falta.

### B. Home / Today

Fecha, próximas obligaciones, materias activas, progreso semanal, quick capture e indicadores académicos.

### C. Plan de carrera

Vista visual por año/nivel con estados:
`pending`, `available`, `in_progress`, `regularized`, `passed`, `failed`, `equivalent`.

### D. Materias activas

Nombre, estado, período, próximas fechas, notas rápidas, recursos y progreso personal opcional.

### E. Tareas y eventos académicos

Tipos: parcial, final, trabajo práctico, entrega, inscripción, clase/evento, tarea libre.

### F. Calendar / Upcoming

Vista semanal / agenda y próximas fechas.

### G. Quick capture

Nueva tarea, parcial, entrega, nota o recurso.

### H. Recursos mínimos

Link, nota corta y archivo opcional si Storage está correctamente configurado.

### I. Búsqueda/comando

Buscar materias, tareas y recursos.

# 6. Core loop

```text
abrir
→ ver Today
→ entender prioridades
→ entrar a materia
→ hacer/capturar algo
→ volver a la vida
```

# 7. Information architecture

```text
/
└── redirect → /today

/onboarding
/today
/plan
/calendar
/courses
/courses/:courseId
/library
/settings
```

# 8. Functional requirements

## CAP-ONBOARD-001

Seleccionar institución, unidad académica, carrera y plan. Persistido, reanudable, editable y no hardcodeado.

## CAP-ONBOARD-002

Continuar aunque el plan no esté disponible mediante contexto académico manual/unmapped.

## CAP-TODAY-001

Today prioriza hoy sobre mañana sin ocultar lo próximo.

## CAP-CAPTURE-001

Crear una obligación académica desde cualquier pantalla.

## CAP-PLAN-001

Visualizar el plan agrupado por nivel/año.

## CAP-PLAN-002

Marcar una materia como `passed` recalcula disponibilidad de dependientes en dominio, no en React.

## CAP-PLAN-003

Soportar múltiples versiones de un plan.

## CAP-COURSE-001

Vista unificada de materia con status, next deadline, tasks, resources y notes.

## CAP-CALENDAR-001

Obligaciones creadas desde cualquier módulo aparecen en la vista temporal.

## CAP-RESOURCE-001

Asociar un recurso a una materia.

## CAP-SEARCH-001

Encontrar materia/tarea/recurso por texto parcial.

## CAP-RESPONSIVE-001

Workflows primarios en 360, 390, 768, 1024 y 1440 px sin overflow accidental.

## CAP-A11Y-001

Cero violaciones críticas/serias según quality profile.

# 9. Domain model

```text
Institution
AcademicUnit
Program
Curriculum
Subject
CurriculumSubject
Prerequisite

User
UserAcademicContext
UserSubjectState

AcademicItem
Resource
```

## Institution

`id`, `slug`, `name`, `short_name`, `country`, `metadata`

## AcademicUnit

`id`, `institution_id`, `parent_id?`, `kind`, `name`, `slug`

## Program

`id`, `academic_unit_id`, `name`, `degree_type`, `duration_hint?`

## Curriculum

`id`, `program_id`, `name`, `version`, `valid_from?`, `valid_to?`, `source_url?`, `source_fetched_at?`

## Subject

`id`, `code?`, `name`, `normalized_name`

## CurriculumSubject

`curriculum_id`, `subject_id`, `year_level`, `term`, `credits?`, `elective`, `display_order`

## Prerequisite

`subject_id`, `required_subject_id`, `kind`

Kinds: `to_take`, `to_pass`, `recommended`

## UserSubjectState

`user_id`, `curriculum_subject_id`, `status`, `grade?`, `started_at?`, `completed_at?`, `notes?`

## AcademicItem

`id`, `user_id`, `curriculum_subject_id?`, `kind`, `title`, `starts_at?`, `due_at?`, `status`, `notes?`

Kinds: `task`, `assignment`, `midterm`, `final`, `registration`, `class`, `custom`

## Resource

`id`, `user_id`, `curriculum_subject_id?`, `kind`, `title`, `url?`, `storage_path?`, `body?`

# 10. Data provenance

Todo curriculum importado guarda `source_url`, `source_kind`, `retrieved_at` y checksum/version cuando sea posible.

Jerarquía:
`official university source → official faculty/regional source → curated project data → user-entered data`

# 11. Technical architecture

Frontend:

- React
- TypeScript strict
- Vite
- TanStack Router
- TanStack Query
- Tailwind CSS
- shadcn/ui
- Lucide icons

Backend/data:

- Supabase
- PostgreSQL
- Supabase Auth
- RLS
- Supabase Storage cuando aplique
- migrations committed
- generated DB types

Local:

- Docker
- Supabase local stack

# 12. Repo shape

```text
campus-poc/
├── .claude/skills/
├── docs/
│   ├── PRD.md
│   ├── design.md
│   └── research/
├── src/
│   ├── app/
│   ├── routes/
│   ├── components/
│   ├── features/
│   ├── domain/
│   ├── lib/
│   └── styles/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── registry/
├── public/
├── tests/
└── openspec/
```

# 13. Security/privacy

- Nunca exponer service-role credentials al frontend.
- Toda tabla user-owned debe tener RLS.
- Un usuario no accede a objetos privados ajenos.
- No pedir credenciales de autogestión universitaria.
- No implementar automatización institucional.
- Uploads validan owner, size, content type y path.

# 14. Seed strategy

Demostrar al menos un recorrido académico real completo desde fuente oficial y una segunda institución/unidad para demostrar desacople del modelo.

Preferencia:

- UTN FRRo — Ingeniería en Sistemas de Información
- UNR FCEIA — una carrera oficialmente documentada

# 15. Quality requirements

Requeridos:

- format
- lint
- typecheck
- test
- build
- responsive verification
- runtime console verification
- accessibility verification

Cada candidate final pasa por developer-harness evidence + receipt authorization.

# 16. Explicit non-goals

No implementar:

- social feed
- chat
- reviews
- marketplace
- jobs
- automatic enrollment
- institutional credential storage
- Telegram bot
- AI tutor/chat/RAG
- billing
- organizations/teams
- nationwide curriculum database
- admin CMS
- gamification
- complex analytics

# 17. POC release definition

Campus POC está completo cuando una persona puede:

1. crear cuenta;
2. seleccionar contexto académico;
3. ver un plan real;
4. marcar progreso;
5. identificar materias disponibles/bloqueadas;
6. añadir materias actuales;
7. crear una fecha límite;
8. verla en Today y Calendar;
9. entrar a una materia y ver tasks/resources;
10. usar todo cómodamente en phone y desktop.

Y el repo tiene:

```text
green deterministic checks
+
responsive evidence
+
accessibility evidence
+
valid candidate
+
RDD review
+
valid receipt
```
