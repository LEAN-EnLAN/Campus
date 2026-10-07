import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A just-enough in-memory PostgREST, for running the cloud adapter without a
 * database. It implements the calls `supabase-backend.ts` makes — nothing more —
 * and the one constraint that matters to these tests: a user has at most ONE
 * active academic context (`user_academic_contexts_one_active_idx`).
 *
 * This is not a model of Postgres. Real RLS, types and constraints are covered
 * by `tests/db`, which needs a running Supabase.
 */

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string } | null }

const DEFAULTS: Record<string, () => Row> = {
  academic_items: () => ({ status: 'open', starts_at: null, due_at: null, notes: null }),
  resources: () => ({
    storage_path: null,
    url: null,
    body: null,
    created_at: new Date().toISOString(),
  }),
  user_subject_states: () => ({
    grade: null,
    started_at: null,
    completed_at: null,
    notes: null,
  }),
  user_manual_subjects: () => ({
    term: 'anual',
    status: null,
    grade: null,
    created_at: new Date().toISOString(),
  }),
  user_academic_contexts: () => ({
    institution_id: null,
    academic_unit_id: null,
    program_id: null,
    curriculum_id: null,
    unmapped_label: null,
  }),
}

export interface FakeSupabase {
  client: SupabaseClient
  tables: Record<string, Row[]>
  /** Make the next `insert` into `table` fail once. */
  failNextInsert(table: string): void
}

export function createFakeSupabase(userId = 'user-1'): FakeSupabase {
  const tables: Record<string, Row[]> = {}
  const failInsert = new Set<string>()
  let seq = 0

  const rows = (table: string) => (tables[table] ??= [])

  function violatesOneActive(table: string, candidate: Row, ignore?: Row): boolean {
    return (
      table === 'user_academic_contexts' &&
      candidate.is_active === true &&
      rows(table).some(
        (r) => r !== ignore && r.user_id === candidate.user_id && r.is_active === true,
      )
    )
  }

  function from(table: string) {
    type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete'
    let op: Op = 'select'
    let payload: Row | Row[] | null = null
    let onConflict: string[] = []
    const filters: [string, unknown][] = []
    const inFilters: [string, unknown[]][] = []
    let wantsRow: 'single' | 'maybe' | null = null

    const matches = (r: Row) =>
      filters.every(([c, v]) => r[c] === v) && inFilters.every(([c, vs]) => vs.includes(r[c]))

    function run(): Result {
      const fail = (message: string): Result => ({ data: null, error: { message } })
      const target = rows(table)

      if (op === 'insert') {
        if (failInsert.delete(table)) return fail('forced insert failure')
        const created = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({
          id: `${table}-${++seq}`,
          ...(DEFAULTS[table]?.() ?? {}),
          ...p,
        }))
        for (const row of created) {
          if (violatesOneActive(table, row)) return fail('duplicate key: one active context')
          target.push(row)
        }
        return respond(created)
      }

      if (op === 'upsert') {
        for (const incoming of Array.isArray(payload) ? payload : [payload as Row]) {
          const existing = target.find((r) => onConflict.every((c) => r[c] === incoming[c]))
          if (existing) Object.assign(existing, incoming)
          else
            target.push({
              id: `${table}-${++seq}`,
              ...(DEFAULTS[table]?.() ?? {}),
              ...incoming,
            })
        }
        return respond([])
      }

      if (op === 'update') {
        const hit = target.filter(matches)
        for (const row of hit) {
          const next = { ...row, ...(payload as Row) }
          if (violatesOneActive(table, next, row))
            return fail('duplicate key: one active context')
          Object.assign(row, payload)
        }
        return respond(hit)
      }

      if (op === 'delete') {
        tables[table] = target.filter((r) => !matches(r))
        return respond([])
      }

      return respond(target.filter(matches))
    }

    function respond(result: Row[]): Result {
      if (wantsRow === 'single') {
        return result.length === 1 ? { data: { ...result[0] }, error: null } : fail1()
      }
      if (wantsRow === 'maybe') {
        return { data: result[0] ? { ...result[0] } : null, error: null }
      }
      return { data: result.map((r) => ({ ...r })), error: null }
    }
    const fail1 = (): Result => ({ data: null, error: { message: 'expected exactly one row' } })

    const builder = {
      select: () => builder,
      insert: (p: Row | Row[]) => ((op = 'insert'), (payload = p), builder),
      update: (p: Row) => ((op = 'update'), (payload = p), builder),
      upsert: (p: Row | Row[], opts?: { onConflict?: string }) => (
        (op = 'upsert'),
        (payload = p),
        (onConflict = (opts?.onConflict ?? 'id').split(',')),
        builder
      ),
      delete: () => ((op = 'delete'), builder),
      eq: (column: string, value: unknown) => (filters.push([column, value]), builder),
      in: (column: string, values: unknown[]) => (inFilters.push([column, values]), builder),
      order: () => builder,
      limit: () => builder,
      single: () => ((wantsRow = 'single'), builder),
      maybeSingle: () => ((wantsRow = 'maybe'), builder),
      then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    }
    return builder
  }

  const client = {
    from,
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
  } as unknown as SupabaseClient

  return { client, tables, failNextInsert: (table) => void failInsert.add(table) }
}
