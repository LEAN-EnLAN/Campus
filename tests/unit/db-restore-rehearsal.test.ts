import { describe, expect, it } from 'vitest'

import {
  assertTempName,
  compareSnapshots,
  firstColumnDifference,
  makeTempName,
  rowQuery,
  schemaQuery,
} from '../../scripts/db-restore-rehearsal.mjs'

describe('local database restore rehearsal safety', () => {
  it('only accepts generated, bounded isolated database names', () => {
    const name = makeTempName(Buffer.from('001122334455', 'hex'))
    expect(name).toBe('campus_restore_rehearsal_001122334455')
    expect(assertTempName(name)).toBe(name)
    for (const unsafe of [
      'postgres',
      'template0',
      'supabase_db_campus-poc',
      'campus_restore_rehearsal_../../postgres',
      'campus_restore_rehearsal_001122334455;DROP DATABASE postgres;',
      'campus_restore_rehearsal_00112233445678901234567890',
      'campus_restore_rehearsal_ABCDEF123456',
    ]) {
      expect(() => assertTempName(unsafe)).toThrow(/refusing/)
    }
  })

  it('takes real table metadata, effective grants and RLS policies into the snapshot', () => {
    const sql = schemaQuery()
    expect(sql).toContain('pg_policies')
    expect(sql).toContain('has_table_privilege')
    expect(sql).toContain('pg_get_userbyid')
    expect(sql).toContain('c.relrowsecurity')
    expect(sql).toContain('c.relforcerowsecurity')
    expect(sql).toContain('pg_get_constraintdef')
    expect(sql).toContain('pg_get_indexdef')
    expect(sql).toContain("'auth','storage'")
    expect(sql).toContain('ORDER BY r.s,r.t,a.attnum')
  })

  it('fingerprints every row without returning raw row data, escaping identifiers', () => {
    const sql = rowQuery([
      { schema: 'public', name: 'user"owned', kind: 'r' },
      { schema: 'auth', name: 'users', kind: 'r' },
      { schema: 'public', name: 'list_view', kind: 'v' },
    ])
    expect(sql).toContain('"public"."user""owned"')
    expect(sql).toContain('"auth"."users"')
    expect(sql).not.toContain('list_view')
    expect(sql).toContain('count(*)::bigint')
    expect(sql).toContain('md5(to_jsonb(t)::text)')
    expect(sql).not.toContain('SELECT *')
    expect(() => rowQuery([])).toThrow(/no base tables/)
  })

  it('refuses mismatching rows, policies, ownership and effective privileges', () => {
    const base = {
      relations: [{ schema: 'public', name: 'academic_items', owner: 'postgres', rls: true }],
      columns: [{ schema: 'public', table: 'academic_items', name: 'id', type: 'uuid' }],
      indexes: ['id_index'],
      constraints: ['id_pk'],
      policies: [{ name: 'isolate_owners', qual: 'auth.uid() = user_id' }],
      grants: [{ role: 'anon', select: false }],
      schemas: [{ name: 'public', owner: 'pg_database_owner' }],
      rows: [{ table: 'public.academic_items', rows: 3, digest: 'abc' }],
    }
    expect(compareSnapshots(base, structuredClone(base))).toEqual({
      pass: true,
      checks: {
        relations: true,
        columns: true,
        indexes: true,
        constraints: true,
        policies: true,
        grants: true,
        schemas: true,
        rows: true,
      },
    })
    const alterations: Array<[string, (entry: Record<string, unknown>) => void]> = [
      [
        'relations',
        (entry) => {
          entry.rls = false
        },
      ],
      [
        'policies',
        (entry) => {
          entry.qual = 'true'
        },
      ],
      [
        'grants',
        (entry) => {
          entry.select = true
        },
      ],
      [
        'rows',
        (entry) => {
          entry.digest = 'tampered'
        },
      ],
      [
        'schemas',
        (entry) => {
          entry.owner = 'anon'
        },
      ],
    ]
    for (const [key, mutate] of alterations) {
      const changed = structuredClone(base)
      const changedEntry = (
        changed as unknown as Record<string, Array<Record<string, unknown>>>
      )[key]![0]!
      mutate(changedEntry)
      expect(compareSnapshots(base, changed).pass, key).toBe(false)
      expect(compareSnapshots(base, changed).checks[key], key).toBe(false)
    }
  })

  it('limits column mismatch diagnostics to names and changed field identifiers', () => {
    const original = { columns: [{ schema: 'auth', table: 'users', name: 'id', type: 'uuid' }] }
    const restored = { columns: [{ schema: 'auth', table: 'users', name: 'id', type: 'text' }] }
    expect(firstColumnDifference(original, restored)).toEqual({
      schema: 'auth',
      table: 'users',
      column: 'id',
      fields: ['type'],
    })
  })
})
