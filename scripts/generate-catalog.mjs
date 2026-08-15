#!/usr/bin/env node
/**
 * Generate the portable academic catalog for LOCAL mode.
 *
 * ACADEMIC-001. Reads the SAME verified JSON that `generate-seed.mjs` turns into
 * `supabase/seed.sql`, so there is exactly one source of truth and the cloud and
 * local catalogs cannot drift. Two hand-maintained catalogs would diverge, and a
 * divergence here means one of them is lying about a real curriculum.
 *
 *   docs/research/curricula/*.json      ← verified, provenance-carrying research
 *          ├── generate-seed.mjs    → supabase/seed.sql        (CLOUD)
 *          └── generate-catalog.mjs → resources/academic-catalog/ (LOCAL)
 *
 * The output must preserve, per curriculum: sourceUrl, sourceKind, retrievedAt,
 * per-subject `verified`, and — the one that matters most — whether the
 * correlatividades are KNOWN AT ALL.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const CURRICULA_DIR = 'docs/research/curricula'
const OUT_DIR = join('resources', 'academic-catalog')

/**
 * Read the plan's epistemic flag. DECLARED by research, never inferred here.
 *
 * `known` answers "does the source we read publish correlativas at all?", and
 * it is independent of how many edges we found:
 *
 *   known: true,  edges: []   → this plan genuinely has no correlativas
 *   known: false, edges: []   → we do not know what they are
 *
 * Those are different statements about a university, and `edgeCount > 0`
 * cannot tell them apart — it answers "unknown" for both. That inference used
 * to live here and is deliberately gone. Do not bring it back: the flag is a
 * research finding about a document, and a generator cannot re-derive it from
 * the rows it happens to have parsed.
 *
 * Missing means the researcher has not answered the question yet, so this
 * fails rather than guessing.
 */
function readPrerequisiteProvenance(plan, file) {
  const declared = plan.curriculum?.prerequisites
  if (declared == null || typeof declared.known !== 'boolean') {
    throw new Error(
      `${file}: curriculum.prerequisites.known must be declared as a boolean. ` +
        'It records whether the official source publishes correlativas, which is a ' +
        'research finding and is never inferred from the number of edges parsed.',
    )
  }
  if (declared.known === false && !declared.note) {
    throw new Error(
      `${file}: curriculum.prerequisites.note is required when known is false — ` +
        'a student is told why they are unknown, so someone has to write it down.',
    )
  }
  return { known: declared.known, note: declared.known ? null : declared.note }
}

/** Lowercase, strip diacritics, collapse whitespace. Mirrors src/domain/search.ts. */
function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** A stable, human-readable id. Local ids are not Postgres UUIDs, on purpose. */
function subjectId(name, displayOrder) {
  const slug = normalize(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `${slug}-${displayOrder}`
}

const files = readdirSync(CURRICULA_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()

if (files.length === 0) {
  console.error(`[generate-catalog] no curriculum JSON in ${CURRICULA_DIR}`)
  process.exit(1)
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(join(OUT_DIR, 'curricula'), { recursive: true })

const institutions = new Map()
const index = []
let unverified = 0

for (const file of files) {
  const plan = JSON.parse(readFileSync(join(CURRICULA_DIR, file), 'utf8'))

  const instSlug = plan.institution.slug
  const unitSlug = plan.academic_unit.slug
  const programSlug = plan.program.slug
  const version = plan.curriculum.version
  const curriculumId = `${instSlug}/${unitSlug}/${programSlug}/${version}`

  // ---- institutions.json: the onboarding cascade, without a database ----
  if (!institutions.has(instSlug)) {
    institutions.set(instSlug, {
      slug: instSlug,
      name: plan.institution.name,
      shortName: plan.institution.short_name,
      country: plan.institution.country ?? 'AR',
      academicUnits: [],
    })
  }
  const institution = institutions.get(instSlug)

  let unit = institution.academicUnits.find((u) => u.slug === unitSlug)
  if (!unit) {
    unit = {
      slug: unitSlug,
      kind: plan.academic_unit.kind,
      name: plan.academic_unit.name,
      programs: [],
    }
    institution.academicUnits.push(unit)
  }

  let program = unit.programs.find((p) => p.slug === programSlug)
  if (!program) {
    program = {
      slug: programSlug,
      name: plan.program.name,
      degreeType: plan.program.degree_type ?? 'grado',
      curricula: [],
    }
    unit.programs.push(program)
  }

  // ---- the curriculum itself ----
  const byName = new Map()
  for (const subject of plan.subjects) {
    byName.set(subject.name, subjectId(subject.name, subject.display_order ?? 0))
  }

  const subjects = plan.subjects.map((subject) => {
    if (subject.verified === false) unverified += 1
    return {
      id: byName.get(subject.name),
      code: subject.code ?? null,
      name: subject.name,
      normalizedName: normalize(subject.name),
      yearLevel: subject.year_level,
      term: subject.term,
      credits: subject.credits ?? null,
      elective: Boolean(subject.elective),
      displayOrder: subject.display_order ?? 0,
      verified: subject.verified !== false,
      prerequisites: (subject.prerequisites ?? []).map((p) => {
        const required = byName.get(p.subject_name)
        if (!required) {
          console.error(
            `[generate-catalog] DANGLING prerequisite in ${file}: ` +
              `"${subject.name}" requires "${p.subject_name}", not in this plan`,
          )
          process.exit(1)
        }
        return { subjectId: required, kind: p.kind }
      }),
    }
  })

  const { known: prerequisitesKnown, note: prerequisitesNote } = readPrerequisiteProvenance(
    plan,
    file,
  )

  // A count, reported as a count. It is deliberately NOT consulted when deciding
  // `prerequisitesKnown` — that is the inference this file no longer makes.
  const edgeCount = subjects.reduce((n, s) => n + s.prerequisites.length, 0)

  const curriculum = {
    formatVersion: 1,
    id: curriculumId,
    institution: { slug: instSlug, name: plan.institution.name },
    academicUnit: { slug: unitSlug, name: plan.academic_unit.name },
    program: { slug: programSlug, name: plan.program.name },
    name: plan.curriculum.name,
    version,
    sourceUrl: plan.curriculum.source_url ?? null,
    sourceKind: plan.curriculum.source_kind ?? null,
    retrievedAt: plan.curriculum.retrieved_at ?? null,
    prerequisitesKnown,
    prerequisitesNote,
    subjects,
  }

  const outFile = file.replace(/\.json$/, '') + '.json'
  writeFileSync(join(OUT_DIR, 'curricula', outFile), JSON.stringify(curriculum, null, 2) + '\n')

  program.curricula.push({
    id: curriculumId,
    version,
    name: plan.curriculum.name,
    file: `curricula/${outFile}`,
    subjectCount: subjects.length,
    prerequisitesKnown,
  })

  index.push({
    id: curriculumId,
    subjects: subjects.length,
    edges: edgeCount,
    prerequisitesKnown,
  })
}

writeFileSync(
  join(OUT_DIR, 'institutions.json'),
  JSON.stringify(
    {
      formatVersion: 1,
      note: 'GENERATED by scripts/generate-catalog.mjs from docs/research/curricula/. Do not edit by hand.',
      institutions: [...institutions.values()],
    },
    null,
    2,
  ) + '\n',
)

console.log(`[generate-catalog] wrote ${OUT_DIR}`)
for (const entry of index) {
  console.log(
    `  ${entry.id.padEnd(42)} ${String(entry.subjects).padStart(3)} materias · ` +
      (entry.prerequisitesKnown
        ? `${entry.edges} correlativas`
        : 'correlativas DESCONOCIDAS (la facultad no las publicó)'),
  )
}
if (unverified > 0) {
  console.log(
    `  ${unverified} materia(s) con verified:false — ver docs/research/academic-sources.md`,
  )
}
