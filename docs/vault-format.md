# Vault format v1

A Campus vault is **a normal folder the student chose**. Campus is a guest in it.

Everything below is designed so that deleting Campus leaves the student with folders,
Markdown and readable JSON — nothing proprietary, nothing that needs Campus to interpret.

## Layout

```text
Campus/
├── Inbox/                     capture first, file later
├── Daily/                     Daily/YYYY-MM-DD.md
├── Materias/
│   ├── Arquitectura/
│   └── Análisis Matemático II/
├── Proyectos/
├── Exámenes/
├── Recursos/
├── Attachments/
└── .campus/
    ├── vault.json             identity + format version
    ├── academic/
    │   ├── context.json       which institution/carrera/plan this student picked
    │   ├── curriculum.json    the selected plan, copied in with its provenance
    │   ├── subject-state.json what the student has passed / is cursando
    │   └── items.json         deadlines, parciales, entregas
    ├── settings.json          vault-scoped preferences
    ├── layouts.json           workspace layout
    ├── themes/
    ├── trash/                 deleted files, restorable
    └── index.sqlite           DERIVED — safe to delete
```

Folder names are defaults, not a schema. A student who renames `Materias/` to `Cursadas/`
keeps a working vault; the mapping lives in `settings.json`.

## Canonical vs derived

| Canonical — the truth     | Derived — rebuildable  |
| ------------------------- | ---------------------- |
| every `.md` file          | `.campus/index.sqlite` |
| `Attachments/**`          | search index, FTS      |
| `.campus/vault.json`      | backlink index         |
| `.campus/academic/*.json` | caches, thumbnails     |
| `.campus/settings.json`   |                        |

**The acceptance test is literal:** `rm .campus/index.sqlite`, restart Campus, everything is
still there. If a fact only exists in the index, it is a canonical fact hiding in a derived
store and belongs in a file.

`.campus/trash/` is canonical — it holds the student's deleted work until they empty it.

## `vault.json`

```json
{
  "formatVersion": 1,
  "id": "01J9X8QK7M3T4V5W6Y7Z8A9B0C",
  "createdAt": "2026-08-14T12:00:00.000Z",
  "createdBy": "campus/0.2.0"
}
```

`id` is stable and local. It identifies _this vault_, not the student — there is no account
in LOCAL mode.

## `academic/`

The whole point of Campus lives here, and it is four readable JSON files.

`context.json` — what the student picked in onboarding:

```json
{
  "institution": { "slug": "utn", "name": "Universidad Tecnológica Nacional" },
  "academicUnit": { "slug": "utn-frro", "name": "Facultad Regional Rosario" },
  "program": { "slug": "isi", "name": "Ingeniería en Sistemas de Información" },
  "curriculumId": "utn/utn-frro/isi/Plan 2023",
  "unmappedLabel": null
}
```

`curriculum.json` — the selected plan copied into the vault **with its provenance**, so the
vault is self-describing and an offline student can still see where the data came from:

```json
{
  "name": "Diseño Curricular de Ingeniería en Sistemas de Información — Plan 2023",
  "version": "Plan 2023",
  "sourceUrl": "https://www.frro.utn.edu.ar/...",
  "sourceKind": "pdf",
  "retrievedAt": "2026-08-14",
  "prerequisitesKnown": true,
  "subjects": [
    {
      "id": "am1",
      "name": "Análisis Matemático I",
      "yearLevel": 1,
      "term": "anual",
      "elective": false,
      "displayOrder": 1,
      "verified": true,
      "prerequisites": []
    }
  ]
}
```

### `prerequisitesKnown` is not decoration

```text
prerequisitesKnown: true   → an empty `prerequisites` array means this subject has none
prerequisitesKnown: false  → we do not know. Say so. Never render it as "nothing blocks you"
```

UNR FCEIA publishes a plan but **not** its correlatividades — the Texto Ordenado 2024 says
they "serán aprobados oportunamente por el Consejo Directivo". A vault must be able to
represent _unknown_ distinctly from _none_, or Campus quietly asserts an academic fact it
does not have. This is the same invariant the cloud backend carries.

`subject-state.json` and `items.json` are the student's own data:

```json
{ "formatVersion": 1, "states": [{ "subjectId": "am1", "status": "passed", "grade": 8 }] }
```

```json
{
  "formatVersion": 1,
  "items": [
    {
      "id": "01J9...",
      "title": "TP 4",
      "kind": "assignment",
      "subjectId": "am2",
      "dueAt": "2026-08-20T21:00:00.000Z",
      "status": "open"
    }
  ]
}
```

IDs are ULIDs minted locally. **They are not Postgres UUIDs and the formats must not be
assumed interchangeable** — a future sync maps between them explicitly.

## Notes

Plain Markdown with YAML frontmatter. A note joins a Course by _saying so_:

```markdown
---
subject: arquitectura
type: lecture
date: 2026-08-14
tags: [cpu, pipeline]
---

# Clase 01 — Pipeline

Ver [[CPU]] para el detalle de las etapas.
```

That is the whole mechanism. A Course is a **semantic view over real files**, not a row that
owns hidden children. Delete Campus and the note is still a lecture note about pipelines,
filed under Arquitectura, linking to CPU.

## Filenames

Validated with **Windows rules everywhere**, so a vault created on Linux opens on Windows:

```text
reserved:  CON PRN AUX NUL COM1..9 LPT1..9
forbidden: < > : " | ? * and control characters
no trailing dots or spaces
path length kept under the 260-char Windows limit unless long paths are enabled
```

## Conflict semantics — documented, not built

Sync is **out of scope**. But the design is recorded now because these four things conflict
differently, and one strategy for all of them is the trap:

| Data                  | Conflict                          | Intended resolution                                                                                     |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **file content**      | two edits to one `.md`            | keep both, surface the conflict, never silently pick a winner                                           |
| **academic metadata** | two edits to `subject-state.json` | merge **per entity** — last-write-wins is defensible for one subject's status, never for the whole file |
| **device settings**   | vault paths, window layout        | **never syncs.** Device-scoped by definition                                                            |
| **cloud identity**    | account-level                     | server authoritative                                                                                    |

> **Last write wins is never the implicit global default.** Applied to a file, it is how a
> student loses a semester of notes.

External change is not a conflict by itself — it is normal. A vault is edited by text
editors, `git checkout` and the student's own `mv`. Campus re-stats before writing and
refuses to overwrite a file that changed after it was loaded.

## Versioning

`formatVersion` appears in `vault.json` and in each academic file. A vault from a newer
Campus opens read-only with an explanation rather than being silently migrated or corrupted.
