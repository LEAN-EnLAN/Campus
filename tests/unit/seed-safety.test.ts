import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `supabase/seed.sql` is what `supabase db push --include-seed` loads into the
 * HOSTED database (docs/DEPLOY.md). It must therefore contain reference data and
 * nothing else: no accounts, no credentials, no writes outside the academic
 * catalogue. Tester accounts (known password) are created by `scripts/tester.mjs`
 * through the admin API of the LOCAL stack only, never from SQL.
 */

const REFERENCE_TABLES = new Set([
  'institutions',
  'academic_units',
  'programs',
  'curricula',
  'subjects',
  'curriculum_subjects',
  'prerequisites',
])

/** Everything wrong with a seed script, as human-readable violations. */
function auditSeed(sql: string): string[] {
  const violations: string[] = []
  const code = sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

  for (const match of code.matchAll(/insert\s+into\s+([\w."]+)/gi)) {
    const target = match[1]!.replaceAll('"', '').toLowerCase()
    const table = target.startsWith('public.') ? target.slice('public.'.length) : null
    if (!table || !REFERENCE_TABLES.has(table)) {
      violations.push(`insert into ${target} is not a reference table`)
    }
  }
  if (/\b(auth|storage|vault)\s*\./i.test(code))
    violations.push('touches a Supabase-owned schema')
  if (/\b(crypt|gen_salt|encrypted_password|password)\b/i.test(code)) {
    violations.push('mentions credentials')
  }
  if (/@[\w-]+\.(local|test|example)\b/i.test(code)) violations.push('contains a test e-mail')
  if (/\b(update|delete\s+from|truncate|drop|alter)\b/i.test(code)) {
    violations.push('is not insert-only')
  }
  // Re-running the push must be harmless.
  const inserts = (code.match(/insert\s+into/gi) ?? []).length
  const guarded = (code.match(/on\s+conflict[^;]*do\s+nothing/gi) ?? []).length
  if (inserts !== guarded)
    violations.push('an insert is not idempotent (on conflict do nothing)')

  return violations
}

describe('supabase/seed.sql is safe for a public hosted database', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/seed.sql'), 'utf8')

  it('has no violations', () => {
    expect(auditSeed(sql)).toEqual([])
  })

  it('actually seeds the reference catalogue', () => {
    for (const table of REFERENCE_TABLES) expect(sql).toContain(`insert into public.${table} `)
  })
})

describe('auditSeed catches what must never reach production', () => {
  it('flags an account insert', () => {
    expect(
      auditSeed(
        "insert into auth.users (email, encrypted_password) values ('a@tester.campus.local', crypt('campus-tester', gen_salt('bf')));",
      ).length,
    ).toBeGreaterThan(0)
  })

  it('flags a write to a user-data table', () => {
    expect(
      auditSeed("insert into public.profiles (id) values ('x') on conflict do nothing;"),
    ).toContain('insert into public.profiles is not a reference table')
  })

  it('flags a non-idempotent insert and destructive statements', () => {
    expect(auditSeed("insert into public.institutions (id) values ('x');")).toContain(
      'an insert is not idempotent (on conflict do nothing)',
    )
    expect(auditSeed('delete from public.subjects;')).toContain('is not insert-only')
  })
})
