import catalogIndex from '../../../public/academic-catalog/institutions.json'

/**
 * The plans Campus ships, as the landing shows them. Read from the bundled
 * catalog index at build time, so a number on the page is the number in
 * `public/academic-catalog/institutions.json` and nothing else: when the
 * catalog grows or a plan changes, the landing follows without a copy edit.
 */
export type LandingPlan = {
  id: string
  institution: string
  unit: string
  program: string
  version: string
  subjectCount: number
  prerequisitesKnown: boolean
}

type CatalogIndex = {
  institutions: ReadonlyArray<{
    shortName?: string
    slug: string
    academicUnits: ReadonlyArray<{
      name: string
      programs: ReadonlyArray<{
        name: string
        curricula: ReadonlyArray<{
          id: string
          version: string
          subjectCount: number
          prerequisitesKnown: boolean
        }>
      }>
    }>
  }>
}

export function catalogPlans(index: CatalogIndex): LandingPlan[] {
  return index.institutions.flatMap((institution) =>
    institution.academicUnits.flatMap((unit) =>
      unit.programs.flatMap((program) =>
        program.curricula.map((curriculum) => ({
          id: curriculum.id,
          institution: institution.shortName ?? institution.slug.toUpperCase(),
          unit: unit.name,
          program: program.name,
          version: curriculum.version,
          subjectCount: curriculum.subjectCount,
          prerequisitesKnown: curriculum.prerequisitesKnown,
        })),
      ),
    ),
  )
}

export const LANDING_PLANS: readonly LandingPlan[] = catalogPlans(catalogIndex)
