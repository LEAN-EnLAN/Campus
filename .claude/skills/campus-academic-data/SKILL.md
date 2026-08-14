---
name: campus-academic-data
description: Campus academic data doctrine — provenance hierarchy, institution/unit/program/curriculum modelling, official-source-first research rules, plan versioning, and the absolute ban on invented academic facts. Use when researching curricula, writing seed data, modelling academic entities, or reviewing anything that asserts a subject, year, term or correlativa.
---

# Campus — academic data

## The one rule

> **Never let an LLM guess an academic fact.**

Subject names, year levels, terms, credits and correlativas are _facts about a real
institution_. A student who trusts a hallucinated correlativa can lose a term. If a fact is
not in a source you actually loaded, it does not enter the database — it becomes a recorded gap.

This is PRD principle **P-05 — Source-aware**.

## Provenance hierarchy

```text
official university source
  → official faculty / regional source
    → curated Campus data
      → user-entered data
```

Higher always wins. Curated Campus data may fill _structure_ (ordering, slugs, normalised
names) but never _content_ (which subject exists, what it requires).

## Required provenance on every curriculum

Every `curricula` row stores:

| Field               | Meaning                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `source_url`        | the exact URL the plan was read from                                       |
| `source_kind`       | `html` \| `pdf` \| `manual`                                                |
| `source_fetched_at` | retrieval date                                                             |
| `version`           | the institution's own plan identifier (e.g. "Ordenanza 1150", "Plan 2023") |

A curriculum without `source_url` is not shippable reference data.

## Entity model

```text
Institution      utn, unr                         → slug, name, short_name, country, metadata
  AcademicUnit   facultad / regional / escuela    → institution_id, parent_id?, kind, name, slug
    Program      carrera                          → academic_unit_id, name, degree_type, duration_hint?
      Curriculum plan de estudios (versioned)     → program_id, name, version, valid_from?, valid_to?, provenance
        CurriculumSubject                         → curriculum_id, subject_id, year_level, term, credits?, elective, display_order
Subject          shared, normalised               → code?, name, normalized_name
Prerequisite                                      → subject_id, required_subject_id, kind
```

Key modelling decisions:

- **`AcademicUnit` is recursive** (`parent_id`) — UTN has regionales; a regional can have
  departamentos. UNR has facultades. One model, no institution-specific branches.
- **`Subject` is separate from `CurriculumSubject`.** "Análisis Matemático II" is one subject
  that appears in many plans at different years. Year/term/credits belong to the _link_, not
  to the subject.
- **`normalized_name`** — lowercased, unaccented, whitespace-collapsed. Used for search and
  for de-duplicating the same subject across plans. Never shown to the user.
- **Prerequisites attach to subjects within a curriculum context.** `kind` is `to_take`
  (para cursar), `to_pass` (para rendir), or `recommended`.

## Term vocabulary

`term ∈ { anual, 1c, 2c }`. Argentine degrees are cuatrimestral or anual — do not model
"semester", do not invent quarters. Year levels are `1..N` matching the institution's own
"1° año" labelling.

## Plan versioning — CAP-PLAN-003

Multiple `curricula` rows per `program` are normal and expected.

- **Never merge plan versions silently.** If a source shows both Plan 2008 and Plan 2023,
  they are two rows, seeded separately or one seeded and the other recorded as a gap.
- Never mix subjects from two versions into one list to make a plan "look complete".
- A user's `user_academic_context` points at a specific `curriculum`, so a plan change is a
  data migration, not an in-place edit.

## Research protocol

1. Start at the institution's official domain. Prefer the faculty/regional site over the
   national portal for plan detail.
2. If the plan is a **PDF**: open and read the actual PDF (browser or `pdftotext`). Record the
   PDF URL, not the page that links to it.
3. **Do not hallucinate unreadable cells.** A table cell you cannot read is `null` +
   a note in `docs/research/academic-sources.md`, never a plausible guess.
4. Record retrieval date and exactly what was readable and what was not.
5. Output verified JSON to `docs/research/curricula/<unit>-<program>.json`, with a
   per-subject `"verified": true|false` flag.
6. Seed SQL is **generated from** that JSON. Never hand-type a subject list into SQL.

## Reference targets for the POC

- **Primary:** UTN → Facultad Regional Rosario → Ingeniería en Sistemas de Información →
  current documented plan, with correlativas.
- **Second:** UNR → FCEIA → one officially documented grado program — present specifically to
  prove the model is **not UTN-specific**.

Two institutions with different unit structures is the point. If the second one required a
schema change to fit, the schema was wrong.

## Unmapped academic context — CAP-ONBOARD-002

A student whose plan Campus does not have must still be able to use the product. The
onboarding writes an `unmapped` academic context (free-text institution/program) and the
missing plan is **recorded as a gap**, not silently invented. Plan-dependent screens degrade
honestly: Plan shows an explicit "no tenemos tu plan todavía" state rather than an empty grid
pretending to be a curriculum.

## Review checklist for any academic-data change

- [ ] every asserted subject traces to a loaded source URL
- [ ] `source_url`, `source_kind`, `source_fetched_at` present on every curriculum
- [ ] no plan versions merged
- [ ] unreadable data recorded as a gap, not guessed
- [ ] seed generated from verified JSON, not typed by hand
- [ ] subject names carry correct Spanish accents
- [ ] `term` ∈ {anual, 1c, 2c}, `year_level` matches the institution's labelling

## Portable catalog for LOCAL mode

The curated official seed must be reachable **without Postgres**.

A portable bundle (`resources/academic-catalog/`) is **generated** from the same verified
JSON in `docs/research/curricula/` that produces `supabase/seed.sql`. One source of truth,
two emitted artefacts.

**Never maintain two hand-edited catalogs.** They will diverge, and a divergence here means
one of them is lying about a real curriculum.

The bundle preserves, per curriculum: `sourceUrl`, `sourceKind`, `retrievedAt`, per-subject
`verified` state, and — critically — the distinction that **unknown prerequisites ≠ no
prerequisites**. UNR FCEIA has no published correlatividades; that must survive into LOCAL
mode as _unknown_, not as an empty list that reads as "nothing blocks you".

When a student picks a curriculum in LOCAL mode, the selected slice is written into the vault
under `.campus/academic/`, so the vault stays self-describing.
