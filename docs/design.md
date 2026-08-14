# Campus — design.md

## 0. Design thesis

**Campus debe sentirse como abrir un cuaderno de facultad extremadamente bien organizado, no como entrar al portal administrativo de una universidad.**

Working visual metaphor:

> **Academic field notebook + quiet operations desk.**

Keywords:

```text
editorial
quiet
tactile
academic
dense-but-readable
notebook
structured
warm
precise
personal
```

Avoid:

```text
generic SaaS
neon gradient
glassmorphism everywhere
giant KPI cards
gaming dashboard
AI sparkle aesthetic
corporate LMS
juvenile school aesthetic
```

# 1. Inspiration map

## Craft
- https://www.craft.do/
- https://craft-support.mintlify.app/en/plan-and-do/calendar
- https://www.craft.do/blog/introducing-tasks

Borrow: whitespace, document-first feeling, embedded tasks, calendar + daily notes, low chrome.

## Tana
- https://outliner.tana.inc/daily-notes
- https://tana.inc/

Borrow: today as entry point, capture first, structured objects in an informal page, contextual right rail.

## Things
- https://culturedcode.com/things/
- https://culturedcode.com/things/features/

Borrow: Today first, clear now/upcoming/later, minimal controls, micro-interactions, strong hierarchy.

## Anytype
- https://anytype.io/
- https://doc.anytype.io/anytype/create/objects
- https://doc.anytype.io/anytype/features/graph

Borrow: object + relation mental model. Do not build graph view in POC.

## Supernotes
- https://supernotes.app/

Borrow: academic typography, compact note cards, metadata without clutter.

## Pattern libraries
- https://mobbin.com/explore/web/screens/goal-task
- https://mobbin.com/explore/mobile/flows/onboarding
- https://pageflows.com/
- https://dribbble.com/search/note-taking-ui

# 2. Visual register

Warm editorial light theme first.

Suggested tokens:

```css
--paper: #f7f5ef;
--paper-elevated: #fffefa;
--ink: #181816;
--ink-muted: #73716b;
--rule: #dedbd2;
--rule-soft: #ebe8df;
--accent: #3157d5;
--accent-soft: #e7ecfb;
--success: #36745b;
--warning: #9b6427;
--danger: #a3423d;
```

# 3. Typography

UI/utility:
- Inter Variable or Instrument Sans

Editorial:
- Newsreader or Source Serif 4

Use serif selectively for page title/date/important moments.

# 4. Layout system

Desktop ≥1200:

```text
┌────────────┬──────────────────────────────┬───────────────┐
│ navigation │ main notebook surface        │ context rail  │
│ 220px      │ max 760–900px                │ 260px         │
└────────────┴──────────────────────────────┴───────────────┘
```

Tablet: nav collapses, context rail becomes inline/drawer.

Mobile: top context, main content, bottom nav, prominent quick capture.

# 5. Surface language

Prefer paper-like main surface with thin separators and occasional elevated cards. Avoid card-everything UI.

Radii: 8/12/16px.
Shadows: subtle, prefer border + surface contrast.

# 6. Navigation

Desktop:
- Today
- Plan
- Courses
- Calendar
- Library
- Search
- Settings

Mobile bottom nav:
- Today
- Plan
- Calendar
- Courses

# 7. Today screen

Hero experience. No KPI dashboard.

```text
Friday, 14 August
Buen día.

You have 3 things that matter today.

TODAY
09:00   Arquitectura de Computadoras
18:00   Análisis Matemático II · TP 4
20:00   Física II · Repasar ondas

NEXT
Tomorrow · Parcial de Estadística
Monday   · Entrega Diseño de Sistemas
```

# 8. Quick Capture

Desktop: Cmd/Ctrl+K.
Mobile: bottom sheet.

Fast path:
`open → title → type/date → save`

# 9. Plan screen

```text
INGENIERÍA EN SISTEMAS
Plan 2023

28 / 39 materias
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1° AÑO
✓ Análisis Matemático I
✓ Álgebra
✓ Física I

2° AÑO
● Análisis Matemático II
● Arquitectura
○ Sintaxis
○ Paradigmas

3° AÑO
◌ Diseño de Sistemas
🔒 Redes
🔒 Base de Datos
```

State semantics:
- ✓ passed
- ● in progress
- ○ available
- ◌ pending
- 🔒 blocked

Color is never the only carrier.

# 10. Subject detail

Show:
- status
- next deadlines
- notes
- resources
- requires
- unlocks

# 11. Calendar

Agenda/week first. Monthly grid secondary.

# 12. Onboarding

Goal: 60–120 seconds max.

Steps:
1. Universidad
2. Facultad/Regional
3. Carrera
4. Plan
5. Confirmar

No avatar/bio/interests before value.

# 13. Empty states

No mascot. Direct academic language.

Example:
> No tenés nada para hoy. Buen momento para adelantar algo, o para no hacer nada.

# 14. Motion

120–180ms controls, 180–240ms panels. Respect reduced motion.

# 15. Iconography

Lucide only. Icons support text.

# 16. Components to standardize early

- AcademicShell
- PageHeader
- SectionHeading
- AcademicStatus
- SubjectRow
- SubjectCard
- DeadlineRow
- DaySection
- QuickCapture
- EmptyState
- ProgressLine
- MetadataList
- ResourceRow
- MobileBottomNav
- ContextRail

Search/reuse order:
`project components → shadcn registry → configured external registry → create`

# 17. Responsive verification matrix

- 360×800
- 390×844
- 768×1024
- 1280×800
- 1440×900

Verify overflow, nav adaptation, dialogs/sheets, text wrapping, tap targets, sticky regions, empty/populated states.

# 18. Target emotional response

> “I know what is going on.”

Not:

> “I have another productivity system to maintain.”
