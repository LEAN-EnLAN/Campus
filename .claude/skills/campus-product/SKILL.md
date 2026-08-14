---
name: campus-product
description: Campus product doctrine — PRD index, core loop, POC scope, non-goals, requirement IDs (CAP-*), and Argentine academic terminology. Use when deciding WHAT to build, whether a feature is in scope, which requirement a task implements, or how to name an academic concept in the domain or UI.
---

# Campus — product doctrine

Campus is a **personal academic operating system for Argentine university students**.
Authoritative source: `docs/PRD.md`. This skill is the index, not a replacement.

## Thesis

Opening Campus must immediately answer:

- ¿Qué tengo que hacer hoy?
- ¿Qué estoy cursando?
- ¿Qué se viene esta semana?
- ¿Cómo voy en mi carrera?
- ¿Qué materia depende de cuál?
- ¿Dónde dejé el material de esta materia?

It must feel like **a personal academic notebook that understands the real structure of a
university degree** — not an LMS, ERP, Trello clone, Notion copy, forum, social network, or
AI demo.

## Core loop

```text
abrir → ver Today → entender prioridades → entrar a materia → hacer/capturar algo → volver a la vida
```

## Principles

| ID   | Principle                                                                                 |
| ---- | ----------------------------------------------------------------------------------------- |
| P-01 | Today first — Campus answers "what matters now" before anything else                      |
| P-02 | Academic-native — materia, correlativa, plan, final, regularidad, período are first-class |
| P-03 | Progressive disclosure — no ERP setup to get started                                      |
| P-04 | Capture fast, organize later                                                              |
| P-05 | Source-aware — never invent plans or correlativas                                         |
| P-06 | Personal before social                                                                    |
| P-07 | Free core                                                                                 |
| P-08 | Mobile is not a compressed desktop                                                        |
| P-09 | AI is optional infrastructure — no student-facing AI in this POC                          |
| P-10 | Evidence over polish theater                                                              |

## Requirement IDs — every task must declare which it implements

| ID                 | Requirement                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| CAP-ONBOARD-001    | Select institution → academic unit → program → curriculum. Persisted, resumable, editable, not hardcoded |
| CAP-ONBOARD-002    | Continue even when the plan is unavailable (manual / unmapped academic context)                          |
| CAP-TODAY-001      | Today prioritises today over tomorrow without hiding what's next                                         |
| CAP-CAPTURE-001    | Create an academic obligation from any screen                                                            |
| CAP-PLAN-001       | Visualise the curriculum grouped by year/level                                                           |
| CAP-PLAN-002       | Marking a subject `passed` recalculates dependants' availability **in the domain layer, not in React**   |
| CAP-PLAN-003       | Support multiple versions of a curriculum                                                                |
| CAP-COURSE-001     | Unified subject view: status, next deadline, tasks, resources, notes                                     |
| CAP-CALENDAR-001   | Obligations created anywhere appear in the temporal view                                                 |
| CAP-RESOURCE-001   | Associate a resource with a subject                                                                      |
| CAP-SEARCH-001     | Find subject/task/resource by partial text                                                               |
| CAP-RESPONSIVE-001 | Primary workflows at 360, 390, 768, 1024, 1440 px with no accidental overflow                            |
| CAP-A11Y-001       | Zero critical/serious accessibility violations                                                           |

Never renumber or invent requirement IDs. If work has no matching ID, it is probably out of scope.

## Argentine academic terminology (use these words, in the domain AND the UI)

| Term                                       | Meaning                                         | Do not call it          |
| ------------------------------------------ | ----------------------------------------------- | ----------------------- |
| **materia**                                | a course/subject in a degree                    | "class", "curso"        |
| **cursada**                                | the act of attending/taking a subject in a term | "enrollment"            |
| **correlativa**                            | prerequisite subject                            | "dependency" in UI copy |
| **plan de estudios**                       | curriculum version                              | "program"               |
| **carrera**                                | degree program                                  | "major"                 |
| **facultad / regional / unidad académica** | academic unit under an institution              | "campus", "school"      |
| **parcial**                                | midterm exam                                    | "test"                  |
| **final**                                  | final exam, often taken after the cursada ends  | "exam"                  |
| **TP / trabajo práctico**                  | practical assignment                            | "homework"              |
| **regularizar / regular**                  | earn the right to sit the final                 | —                       |
| **libre**                                  | taking a final without having done the cursada  | —                       |
| **equivalencia**                           | credit granted for a subject taken elsewhere    | —                       |
| **cuatrimestre / anual**                   | term structure (1c, 2c, anual)                  | "semester"              |

Subject status vocabulary (domain enum): `pending`, `available`, `in_progress`, `regularized`,
`passed`, `failed`, `equivalent`.

Prerequisite kinds: `to_take` (para cursar), `to_pass` (para rendir), `recommended`.

Academic item kinds: `task`, `assignment`, `midterm`, `final`, `registration`, `class`, `custom`.

## Explicit non-goals — do NOT implement

social feed · chat · reviews · marketplace · jobs · automatic enrollment · institutional
credential storage · Telegram bot · AI tutor/chat/RAG · billing · organizations/teams ·
nationwide curriculum database · admin CMS · gamification · complex analytics

If an idea like this comes up, append it to `docs/future-ideas.md` and move on.

## POC release definition

The POC is complete when a real person can: create an account → select academic context →
see a real plan → mark progress → see available/blocked subjects → add current subjects →
create a deadline → see it in Today and Calendar → open a subject and see tasks/resources →
do all of it comfortably on phone and desktop.

## Source-of-truth order

```text
PRD → design.md → SDD spec/design → project skills → existing convention → agent preference
```

## Local-first evolution

Campus is evolving from _an academic planner backed by Supabase_ into **a local-first
academic workspace where a student's own folder, Markdown notes, files, coursework, academic
structure and executable code understand each other**.

The POC requirements (`CAP-*`) remain valid and must not regress. The new delta lives in
`openspec/changes/campus-local-first-workspace/` with its own epics and IDs
(`VAULT-*`, `EDITOR-*`, `CODE-*`, `WORKSPACE-*`, `DESKTOP-*`, …).

Two runtime modes: **LOCAL** (a folder, no account, no network) and **CLOUD** (today's
Supabase behaviour). See `campus-local-first`.

Campus is not a note app with university metadata bolted on. It is the student's academic
filesystem becoming intelligent — see `docs/vault-format.md`.
