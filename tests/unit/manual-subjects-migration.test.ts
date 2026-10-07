import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * STATIC check of the manual-subjects migration.
 *
 * This reads the SQL as text. It proves the policies are WRITTEN the way the
 * existing user tables write them; it does NOT prove Postgres enforces them.
 * That needs `pnpm test:db` (Docker), which cannot be run here.
 */

const FILE = '20260816000100_manual_subjects.sql'
const read = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', name), 'utf8')

const sql = read(FILE)
const TABLE = 'public.user_manual_subjects'

/** SQL with `--` comments removed, whitespace collapsed, lower-cased. */
const normalize = (text: string) =>
  text.replace(/--.*$/gm, '').replace(/\s+/g, ' ').toLowerCase()

const body = normalize(sql)

const policies = [
  ...body.matchAll(/create policy "([^"]+)" on ([\w.]+) for (\w+) to (\w+) (.*?);/g),
]
  .map(([, name, table, command, role, rest]) => ({ name, table, command, role, rest: rest! }))
  .filter((p) => p.table === TABLE)

describe('manual subjects migration (static)', () => {
  it('creates a user-owned table with a not-null user_id cascading from auth.users', () => {
    expect(body).toContain(`create table ${TABLE}`)
    expect(body).toMatch(
      /user_id uuid not null references auth\.users \(id\) on delete cascade/,
    )
  })

  it('enables row level security on it', () => {
    expect(body).toContain(`alter table ${TABLE} enable row level security`)
  })

  it('has exactly four policies: select, insert, update, delete — all for authenticated only', () => {
    expect(policies.map((p) => p.command).sort()).toEqual([
      'delete',
      'insert',
      'select',
      'update',
    ])
    for (const p of policies) expect(p.role).toBe('authenticated')
  })

  it('scopes every policy to auth.uid() = user_id', () => {
    for (const p of policies) expect(p.rest).toContain('auth.uid() = user_id')
  })

  it('puts `with check` on insert AND update, so a row cannot be handed to someone else', () => {
    const byCommand = new Map(policies.map((p) => [p.command, p.rest]))
    expect(byCommand.get('insert')).toContain('with check (auth.uid() = user_id)')
    expect(byCommand.get('update')).toContain('using (auth.uid() = user_id)')
    expect(byCommand.get('update')).toContain('with check (auth.uid() = user_id)')
    expect(byCommand.get('select')).toContain('using (auth.uid() = user_id)')
    expect(byCommand.get('delete')).toContain('using (auth.uid() = user_id)')
  })

  it('grants DML to authenticated and nothing to anon', () => {
    expect(body).toMatch(
      new RegExp(
        `grant select, insert, update, delete on table ${TABLE.replace('.', '\\.')} to authenticated`,
      ),
    )
    expect(body).not.toMatch(/to[^;]*\banon\b/)
  })

  it('mirrors the existing user tables: same policy shape as user_subject_states', () => {
    const existing = normalize(read('20260814000200_user_data.sql'))
    const shape = (text: string, table: string) =>
      [...text.matchAll(/create policy "[^"]+" on ([\w.]+) for (\w+) to (\w+) (.*?);/g)]
        .filter(([, t]) => t === table)
        .map(([, , command, role, rest]) => `${command} ${role} ${rest}`)
        .sort()
    expect(shape(body, TABLE)).toEqual(shape(existing, 'public.user_subject_states'))
  })

  it('links entregas and material to a manual subject only through the OWNER composite key', () => {
    for (const table of ['public.academic_items', 'public.resources']) {
      expect(body).toContain(`alter table ${table} add column manual_subject_id uuid`)
    }
    // (manual_subject_id, user_id) -> (id, user_id): a row can only point at the
    // caller's own manual subject, without touching the existing policies.
    expect(body).toContain('foreign key (manual_subject_id, user_id)')
    expect(body).toContain(`references ${TABLE} (id, user_id)`)
    expect(body).toMatch(/unique \(id, user_id\)/)
  })

  it('does not weaken or replace any existing policy', () => {
    expect(body).not.toMatch(/drop policy|alter policy|disable row level security/)
  })

  it('is mirrored by hand in database.types.ts, column for column', () => {
    const create = /create table public\.user_manual_subjects \(([\s\S]*?)\n\);/.exec(sql)![1]!
    const columns = [...create.matchAll(/^\s{2}([a-z_]+)\s+(?!\()/gm)]
      .map(([, name]) => name!)
      .filter((name) => name !== 'unique' && name !== 'check')
    expect(columns).toEqual([
      'id',
      'user_id',
      'name',
      'year_level',
      'term',
      'status',
      'grade',
      'created_at',
      'updated_at',
    ])

    const types = readFileSync(join(process.cwd(), 'src/lib/db/database.types.ts'), 'utf8')
    const row = /user_manual_subjects: \{\s+Row: \{([\s\S]*?)\n\s+\}/.exec(types)![1]!
    for (const column of columns) expect(row).toMatch(new RegExp(`\\b${column}:`))

    for (const table of ['academic_items', 'resources']) {
      const block = new RegExp(`      ${table}: \\{\\s+Row: \\{([\\s\\S]*?)\\n\\s+\\}`).exec(
        types,
      )![1]!
      expect(block).toContain('manual_subject_id: string | null')
    }
  })
})
