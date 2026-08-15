#!/usr/bin/env node
/**
 * Generate `supabase/seed.sql` from the VERIFIED curriculum JSON in
 * `docs/research/curricula/`.
 *
 * Subject lists are never hand-typed into SQL (campus-academic-data skill):
 * research produces JSON with provenance, this script mechanically turns it into
 * rows. Re-running it is the only supported way to change the seed.
 *
 * UUIDs are derived deterministically (UUIDv5, DNS-ish namespace) from stable
 * slugs, so a regenerated seed keeps the same ids and `db reset` stays idempotent.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CURRICULA_DIR = 'docs/research/curricula'
const OUT = 'supabase/seed.sql'

/** Marker for a subject name that occurs more than once inside one plan. */
const AMBIGUOUS = Symbol('ambiguous subject name')

const NAMESPACE = Buffer.from('1b671a64-40d5-491e-99b0-da01ff1f3341'.replace(/-/g, ''), 'hex')

/** RFC 4122 v5 (SHA-1) UUID. Deterministic: same name always yields the same id. */
function uuid5(name) {
  const hash = createHash('sha1').update(NAMESPACE).update(Buffer.from(name, 'utf8')).digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Single-quoted SQL literal, or NULL. */
function q(value) {
  if (value === null || value === undefined || value === '') return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

function num(value) {
  return value === null || value === undefined ? 'NULL' : String(value)
}

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const files = readdirSync(CURRICULA_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()

if (files.length === 0) {
  console.error(`[generate-seed] no curriculum JSON found in ${CURRICULA_DIR}`)
  process.exit(1)
}

const institutions = new Map()
const units = new Map()
const programs = new Map()
/**
 * Does this plan's source publish correlativas?
 *
 * DERIVED, and that is a known weakness recorded in tasks.md: the research JSON
 * does not declare it, so this infers from whether any edge was recorded. It is
 * correct for both plans we have — UNR FCEIA genuinely publishes none — but a
 * plan that truly has no correlativas would be labelled "unpublished", which is
 * a false statement about that university. The fix is a declared field at the
 * research layer, not a cleverer inference here.
 */
function prerequisitesKnown(plan) {
  return plan.subjects.some((s) => (s.prerequisites ?? []).length > 0)
}

const curricula = []
const subjects = new Map() // normalized_name -> { id, code, name }
const curriculumSubjects = []
const prerequisites = []

let unverifiedCount = 0

for (const file of files) {
  const plan = JSON.parse(readFileSync(join(CURRICULA_DIR, file), 'utf8'))

  const instSlug = plan.institution.slug
  const instId = uuid5(`institution:${instSlug}`)
  if (!institutions.has(instId)) {
    institutions.set(instId, {
      id: instId,
      slug: instSlug,
      name: plan.institution.name,
      short_name: plan.institution.short_name,
      country: plan.institution.country ?? 'AR',
    })
  }

  const unitSlug = plan.academic_unit.slug
  const unitId = uuid5(`unit:${instSlug}:${unitSlug}`)
  if (!units.has(unitId)) {
    units.set(unitId, {
      id: unitId,
      institution_id: instId,
      kind: plan.academic_unit.kind,
      name: plan.academic_unit.name,
      slug: unitSlug,
    })
  }

  const programSlug = plan.program.slug
  const programId = uuid5(`program:${instSlug}:${unitSlug}:${programSlug}`)
  if (!programs.has(programId)) {
    programs.set(programId, {
      id: programId,
      academic_unit_id: unitId,
      slug: programSlug,
      name: plan.program.name,
      degree_type: plan.program.degree_type ?? 'grado',
      duration_hint: plan.program.duration_hint ?? null,
    })
  }

  const version = plan.curriculum.version
  const curriculumId = uuid5(`curriculum:${instSlug}:${unitSlug}:${programSlug}:${version}`)
  curricula.push({
    id: curriculumId,
    program_id: programId,
    name: plan.curriculum.name,
    version,
    source_url: plan.curriculum.source_url ?? null,
    source_kind: plan.curriculum.source_kind ?? null,
    source_fetched_at: plan.curriculum.retrieved_at ?? null,
    is_default: true,
    // Kept identical to scripts/generate-catalog.mjs on purpose: the cloud and
    // the vault must answer "are the correlativas published?" the same way, or
    // the two adapters disagree about an academic fact.
    prerequisites_known: prerequisitesKnown(plan),
    prerequisites_note: prerequisitesKnown(plan)
      ? null
      : 'La facultad todavía no publicó las correlatividades de este plan.',
  })

  // Subjects are shared across plans, keyed by normalised name.
  const csIdByName = new Map()

  for (const subject of plan.subjects) {
    const normalized = normalize(subject.name)
    const subjectId = uuid5(`subject:${normalized}`)
    if (!subjects.has(normalized)) {
      subjects.set(normalized, {
        id: subjectId,
        code: subject.code ?? null,
        name: subject.name,
        normalized_name: normalized,
      })
    }

    // display_order is part of the key: a plan can legitimately list the same
    // subject twice (e.g. two "Horas electivas" blocks in different cuatrimestres).
    const csId = uuid5(`cs:${curriculumId}:${normalized}:${subject.display_order ?? 0}`)

    // A duplicate name makes prerequisite resolution ambiguous. Record it as such
    // rather than silently keeping the last one.
    if (csIdByName.has(subject.name)) csIdByName.set(subject.name, AMBIGUOUS)
    else csIdByName.set(subject.name, csId)

    if (subject.verified === false) unverifiedCount += 1

    curriculumSubjects.push({
      id: csId,
      curriculum_id: curriculumId,
      subject_id: subjects.get(normalized).id,
      year_level: subject.year_level,
      term: subject.term,
      credits: subject.credits ?? null,
      elective: Boolean(subject.elective),
      display_order: subject.display_order ?? 0,
    })
  }

  // Second pass: edges, now that every curriculum_subject id is known.
  for (const subject of plan.subjects) {
    const fromId = csIdByName.get(subject.name)
    if (fromId === AMBIGUOUS && (subject.prerequisites ?? []).length > 0) {
      console.error(
        `[generate-seed] AMBIGUOUS subject in ${file}: "${subject.name}" appears more than ` +
          `once in this plan and declares prerequisites — cannot resolve which occurrence.`,
      )
      process.exit(1)
    }
    for (const prerequisite of subject.prerequisites ?? []) {
      const requiredId = csIdByName.get(prerequisite.subject_name)
      if (requiredId === AMBIGUOUS) {
        console.error(
          `[generate-seed] AMBIGUOUS prerequisite in ${file}: "${subject.name}" requires ` +
            `"${prerequisite.subject_name}", which appears more than once in this plan.`,
        )
        process.exit(1)
      }
      if (!requiredId) {
        console.error(
          `[generate-seed] DANGLING prerequisite in ${file}: ` +
            `"${subject.name}" requires "${prerequisite.subject_name}" which is not in this plan`,
        )
        process.exit(1)
      }
      if (requiredId === fromId) {
        console.error(`[generate-seed] SELF prerequisite in ${file}: "${subject.name}"`)
        process.exit(1)
      }
      prerequisites.push({
        id: uuid5(`prereq:${fromId}:${requiredId}:${prerequisite.kind}`),
        curriculum_subject_id: fromId,
        required_curriculum_subject_id: requiredId,
        kind: prerequisite.kind,
      })
    }
  }
}

// --- emit ------------------------------------------------------------------

const lines = []
lines.push('-- GENERATED FILE — do not edit by hand.')
lines.push('-- Regenerate with: pnpm seed:generate')
lines.push('--')
lines.push('-- Source of truth: docs/research/curricula/*.json, produced by reading official')
lines.push('-- university documents. Provenance for each plan is stored on public.curricula.')
lines.push(`-- Generated from: ${files.join(', ')}`)
lines.push('')
lines.push('begin;')
lines.push('')

function insert(table, columns, rows, formatters) {
  if (rows.length === 0) return
  lines.push(`insert into public.${table} (${columns.join(', ')}) values`)
  const values = rows.map(
    (row) => '  (' + columns.map((c) => formatters[c](row[c])).join(', ') + ')',
  )
  lines.push(values.join(',\n'))
  lines.push('on conflict (id) do nothing;')
  lines.push('')
}

insert(
  'institutions',
  ['id', 'slug', 'name', 'short_name', 'country'],
  [...institutions.values()],
  { id: q, slug: q, name: q, short_name: q, country: q },
)

insert(
  'academic_units',
  ['id', 'institution_id', 'kind', 'name', 'slug'],
  [...units.values()],
  {
    id: q,
    institution_id: q,
    kind: (v) => `${q(v)}::public.academic_unit_kind`,
    name: q,
    slug: q,
  },
)

insert(
  'programs',
  ['id', 'academic_unit_id', 'slug', 'name', 'degree_type', 'duration_hint'],
  [...programs.values()],
  { id: q, academic_unit_id: q, slug: q, name: q, degree_type: q, duration_hint: q },
)

insert(
  'curricula',
  [
    'id',
    'program_id',
    'name',
    'version',
    'source_url',
    'source_kind',
    'source_fetched_at',
    'is_default',
    'prerequisites_known',
    'prerequisites_note',
  ],
  curricula,
  {
    id: q,
    program_id: q,
    name: q,
    version: q,
    source_url: q,
    source_kind: q,
    source_fetched_at: (v) => (v ? `${q(v)}::timestamptz` : 'NULL'),
    is_default: (v) => (v ? 'true' : 'false'),
    prerequisites_known: (v) => (v ? 'true' : 'false'),
    prerequisites_note: (v) => (v ? q(v) : 'NULL'),
  },
)

insert('subjects', ['id', 'code', 'name', 'normalized_name'], [...subjects.values()], {
  id: q,
  code: q,
  name: q,
  normalized_name: q,
})

insert(
  'curriculum_subjects',
  [
    'id',
    'curriculum_id',
    'subject_id',
    'year_level',
    'term',
    'credits',
    'elective',
    'display_order',
  ],
  curriculumSubjects,
  {
    id: q,
    curriculum_id: q,
    subject_id: q,
    year_level: num,
    term: (v) => `${q(v)}::public.academic_term`,
    credits: num,
    elective: (v) => (v ? 'true' : 'false'),
    display_order: num,
  },
)

insert(
  'prerequisites',
  ['id', 'curriculum_subject_id', 'required_curriculum_subject_id', 'kind'],
  prerequisites,
  {
    id: q,
    curriculum_subject_id: q,
    required_curriculum_subject_id: q,
    kind: (v) => `${q(v)}::public.prerequisite_kind`,
  },
)

lines.push('commit;')
lines.push('')

writeFileSync(OUT, lines.join('\n'))

console.log(`[generate-seed] wrote ${OUT}`)
console.log(
  `  institutions=${institutions.size} units=${units.size} programs=${programs.size} ` +
    `curricula=${curricula.length} subjects=${subjects.size} ` +
    `curriculum_subjects=${curriculumSubjects.length} prerequisites=${prerequisites.length}`,
)
if (unverifiedCount > 0) {
  console.log(
    `  note: ${unverifiedCount} curriculum_subject row(s) are flagged verified:false in the ` +
      `research JSON — see docs/research/academic-sources.md`,
  )
}
