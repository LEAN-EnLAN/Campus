#!/usr/bin/env node
/**
 * Rehearse a logical Postgres backup against a NEW temporary database in the
 * local Supabase Docker container. No TCP, Cloud, credentials or exported data.
 * Usage: node scripts/db-restore-rehearsal.mjs [--json]
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CONTAINER = 'supabase_db_campus-poc'
export const SOURCE_DB = 'postgres'
const PREFIX = 'campus_restore_rehearsal_'
const TEMP_NAME = /^campus_restore_rehearsal_[a-f0-9]{12}$/
const SCHEMAS = ['public', 'auth', 'storage']

export function makeTempName(bytes = randomBytes(6)) {
  const name = PREFIX + Buffer.from(bytes).toString('hex')
  assertTempName(name)
  return name
}

export function assertTempName(name) {
  if (typeof name !== 'string' || !TEMP_NAME.test(name) || name === SOURCE_DB)
    throw new Error('refusing a database outside the isolated rehearsal namespace')
  return name
}

function run(command, args, input, timeoutMs = 180000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: 'pipe' })
    let output = ''
    let errorOutput = ''
    let overflow = false
    let ended = false
    const timer = setTimeout(() => {
      ended = true
      child.kill()
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (data) => {
      if (output.length + data.length > 2_000_000) {
        overflow = true
        child.kill()
      } else output += data
    })
    // Keep stderr in memory for a redacted error category; never print raw SQL.
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (part) => {
      if (errorOutput.length < 12000) errorOutput += part.slice(0, 12000 - errorOutput.length)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new Error(command + ' unavailable: ' + error.code))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 || ended || overflow)
        reject(
          new Error(
            command +
              ' ' +
              (args.find((arg) =>
                [
                  'psql',
                  'pg_dump',
                  'pg_restore',
                  'createdb',
                  'dropdb',
                  'inspect',
                  'rm',
                ].includes(arg),
              ) ?? 'unknown') +
              ' subprocess failed (exit=' +
              code +
              ', timeout=' +
              ended +
              ', excessiveOutput=' +
              overflow +
              ', errorCategory=' +
              (
                (errorOutput.match(/ERROR:\s*([a-zA-Z ]{1,75})/) ?? [])[1] ?? 'unavailable'
              ).trim() +
              ')',
          ),
        )
      else resolvePromise(output.trim())
    })
    child.stdin.end(input)
  })
}

const docker = (args, input, timeout) => run('docker', args, input, timeout)
function query(database, sql) {
  return docker(
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '-X',
      '-q',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      database,
      '-f',
      '-',
    ],
    sql,
  )
}

export function schemaQuery() {
  const schemas = SCHEMAS.map((x) => "'" + x + "'").join(',')
  return [
    'WITH relations AS (',
    'SELECT c.oid, n.nspname AS s, c.relname AS t, c.relkind AS k,',
    'pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,',
    'c.relforcerowsecurity AS force_rls, c.relacl',
    'FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace',
    'WHERE n.nspname IN (' + schemas + ") AND c.relkind IN ('r','p','v','m','S')",
    ') SELECT jsonb_build_object(',
    "'relations', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    "'schema',s,'name',t,'kind',k,'owner',owner,'rls',rls,'forceRls',force_rls,",
    "'acl',coalesce((SELECT jsonb_agg(a::text ORDER BY a::text) FROM unnest(relacl) a),'[]'::jsonb)",
    ") ORDER BY s,t),'[]'::jsonb) FROM relations),",
    "'columns', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    // pg_restore compacts attnum gaps left by dropped columns. The ordered
    // JSON array still verifies *visible* column order, without physical IDs.
    "'schema',r.s,'table',r.t,'name',a.attname,",
    "'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,",
    "'default',pg_get_expr(d.adbin,d.adrelid)",
    ") ORDER BY r.s,r.t,a.attnum),'[]'::jsonb)",
    'FROM relations r JOIN pg_attribute a ON a.attrelid=r.oid',
    'LEFT JOIN pg_attrdef d ON d.adrelid=r.oid AND d.adnum=a.attnum',
    'WHERE a.attnum>0 AND NOT a.attisdropped),',
    "'indexes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    "'schema',r.s,'table',r.t,'definition',pg_get_indexdef(i.indexrelid)",
    ") ORDER BY r.s,r.t,pg_get_indexdef(i.indexrelid)),'[]'::jsonb)",
    'FROM relations r JOIN pg_index i ON i.indrelid=r.oid),',
    "'constraints', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    "'schema',r.s,'table',r.t,'name',c.conname,'type',c.contype,",
    "'definition',pg_get_constraintdef(c.oid)",
    ") ORDER BY r.s,r.t,c.conname),'[]'::jsonb)",
    'FROM relations r JOIN pg_constraint c ON c.conrelid=r.oid),',
    "'policies', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    "'schema',schemaname,'table',tablename,'name',policyname,",
    "'roles',roles,'cmd',cmd,'qual',qual,'withCheck',with_check,'permissive',permissive",
    ") ORDER BY schemaname,tablename,policyname),'[]'::jsonb)",
    'FROM pg_policies WHERE schemaname IN (' + schemas + ')),',
    "'grants', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    "'schema',r.s,'table',r.t,'role',u.rolname,",
    "'select',has_table_privilege(u.oid,r.oid,'SELECT'),",
    "'insert',has_table_privilege(u.oid,r.oid,'INSERT'),",
    "'update',has_table_privilege(u.oid,r.oid,'UPDATE'),",
    "'delete',has_table_privilege(u.oid,r.oid,'DELETE')",
    ") ORDER BY r.s,r.t,u.rolname),'[]'::jsonb)",
    "FROM relations r CROSS JOIN pg_roles u WHERE r.k IN ('r','p','v','m')",
    "AND u.rolname IN ('anon','authenticated','service_role')),",
    "'schemas', (SELECT COALESCE(jsonb_agg(jsonb_build_object(",
    "'name',nspname,'owner',pg_get_userbyid(nspowner),",
    "'acl',coalesce((SELECT jsonb_agg(x::text ORDER BY x::text) FROM unnest(nspacl) x),'[]'::jsonb)",
    ") ORDER BY nspname),'[]'::jsonb)",
    'FROM pg_namespace WHERE nspname IN (' + schemas + '))',
    ')::text;',
  ].join('\n')
}

function sqlIdent(value) {
  if (typeof value !== 'string' || value.includes('\0'))
    throw new Error('invalid SQL identifier')
  return '"' + value.replaceAll('"', '""') + '"'
}
function sqlText(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('invalid SQL text')
  return "'" + value.replaceAll("'", "''") + "'"
}

export function rowQuery(relations) {
  const tables = relations.filter((r) => r.kind === 'r' && SCHEMAS.includes(r.schema))
  if (!tables.length) throw new Error('no base tables found for comparison')
  const clauses = tables.map((r) => {
    const name = sqlIdent(r.schema) + '.' + sqlIdent(r.name)
    const label = sqlText(r.schema + '.' + r.name)
    return (
      'SELECT ' +
      label +
      ' AS name, count(*)::bigint AS rows,' +
      " md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest" +
      ' FROM ' +
      name +
      ' t'
    )
  })
  return (
    "SELECT coalesce(jsonb_agg(jsonb_build_object('table',name,'rows',rows,'digest',digest)" +
    " ORDER BY name),'[]'::jsonb)::text FROM (" +
    clauses.join('\nUNION ALL\n') +
    ') v;'
  )
}

function parseMetadata(text, label) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(label + ' metadata could not be parsed (contents omitted)')
  }
}

export function compareSnapshots(source, target) {
  const checks = {}
  for (const key of [
    'relations',
    'columns',
    'indexes',
    'constraints',
    'policies',
    'grants',
    'schemas',
    'rows',
  ])
    checks[key] = JSON.stringify(source[key]) === JSON.stringify(target[key])
  return { pass: Object.values(checks).every(Boolean), checks }
}

export function firstColumnDifference(source, target) {
  const a = source.columns ?? []
  const b = target.columns ?? []
  const index = a.findIndex((column, i) => JSON.stringify(column) !== JSON.stringify(b[i]))
  if (index < 0 && a.length === b.length) return null
  const col = a[index] ?? b[index] ?? {}
  const counterpart = b[index] ?? {}
  return {
    schema: col.schema,
    table: col.table,
    column: col.name,
    fields: Object.keys(col).filter(
      (key) => JSON.stringify(col[key]) !== JSON.stringify(counterpart[key]),
    ),
  }
}

async function snapshot(db) {
  const metadata = parseMetadata(await query(db, schemaQuery()), 'schema')
  const rows = parseMetadata(await query(db, rowQuery(metadata.relations)), 'rows')
  return { ...metadata, rows }
}

export async function rehearse() {
  const temp = assertTempName(makeTempName())
  const dump = '/tmp/' + temp + '.dump'
  let creationAttempted = false
  let failure
  let outcome
  let interrupted = false
  const onInterrupt = () => {
    interrupted = true
  }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onInterrupt)
  try {
    const health = await docker([
      'inspect',
      '--format',
      '{{.State.Running}}|{{.State.Health.Status}}',
      CONTAINER,
    ])
    if (health !== 'true|healthy')
      throw new Error('the local Supabase DB container is not healthy')
    const identity = await query(SOURCE_DB, "SELECT current_database() || '|' || current_user;")
    if (identity !== 'postgres|postgres') throw new Error('source DB identity mismatch')
    const pgVersion = await query(SOURCE_DB, 'SHOW server_version;')
    const before = await snapshot(SOURCE_DB)
    await docker(
      [
        'exec',
        CONTAINER,
        'pg_dump',
        '-U',
        'postgres',
        '-d',
        SOURCE_DB,
        '-Fc',
        '--lock-wait-timeout=15000',
        '-f',
        dump,
      ],
      undefined,
      240000,
    )
    if (interrupted) throw new Error('interrupted after dump; cleaning up')
    const exists = await query(
      SOURCE_DB,
      'SELECT count(*) FROM pg_database WHERE datname=' + sqlText(temp) + ';',
    )
    if (exists !== '0') throw new Error('temporary DB already exists; refusing overwrite')
    // Also clean up if createdb succeeds server-side but the client fails
    // before receiving its success result.
    creationAttempted = true
    await docker(['exec', CONTAINER, 'createdb', '-U', 'postgres', '-T', 'template0', temp])
    if (interrupted) throw new Error('interrupted after create; cleaning up')
    // Supabase's postgres is not a superuser. Local-only supabase_admin can
    // SET ROLE to the original object owners, preserving ACL/RLS semantics.
    await docker(
      [
        'exec',
        CONTAINER,
        'pg_restore',
        '-U',
        'supabase_admin',
        '-d',
        temp,
        '--single-transaction',
        '--exit-on-error',
        dump,
      ],
      undefined,
      240000,
    )
    if (interrupted) throw new Error('interrupted after restore; cleaning up')
    const restored = await snapshot(temp)
    const after = await snapshot(SOURCE_DB)
    const stable = compareSnapshots(before, after)
    const fidelity = compareSnapshots(before, restored)
    if (!stable.pass || !fidelity.pass) {
      throw new Error(
        'comparison mismatch: sourceStable=' +
          stable.pass +
          ', restoreMatches=' +
          fidelity.pass +
          ', mismatchGroups=' +
          Object.keys(fidelity.checks)
            .filter((k) => !fidelity.checks[k])
            .join(',') +
          ', firstColumnDifference=' +
          JSON.stringify(firstColumnDifference(before, restored)),
      )
    }
    outcome = {
      status: 'PASS',
      source: 'local Docker postgres',
      container: CONTAINER,
      serverVersion: pgVersion,
      mode: 'full pg_dump custom-format / temporary database restore',
      schemasChecked: SCHEMAS,
      tableCount: before.rows.length,
      relationCount: before.relations.length,
      policyCount: before.policies.length,
      sourceStable: stable.pass,
      comparisons: fidelity.checks,
    }
  } catch (err) {
    failure = err
  } finally {
    const issues = []
    if (creationAttempted) {
      try {
        assertTempName(temp)
        await docker(
          [
            'exec',
            CONTAINER,
            'dropdb',
            '-U',
            'postgres',
            '--maintenance-db=postgres',
            '--if-exists',
            '--force',
            temp,
          ],
          undefined,
          40000,
        )
      } catch {
        issues.push('temporary database removal failed')
      }
    }
    try {
      await docker(['exec', CONTAINER, 'rm', '-f', dump], undefined, 30000)
    } catch {
      issues.push('temporary dump removal failed')
    }
    try {
      const remaining = await query(
        SOURCE_DB,
        'SELECT count(*) FROM pg_database WHERE datname=' + sqlText(temp) + ';',
      )
      if (remaining !== '0') issues.push('temporary database remains present')
      await docker(['exec', CONTAINER, 'test', '!', '-e', dump], undefined, 30000)
    } catch {
      issues.push('cleanup absence verification failed')
    }
    process.removeListener('SIGINT', onInterrupt)
    process.removeListener('SIGTERM', onInterrupt)
    if (issues.length) {
      failure = new Error(
        (failure ? failure.message + '; ' : '') +
          issues.join('; ') +
          ' (inspect only the campus_restore_rehearsal_ namespace)',
      )
    }
  }
  if (failure) throw failure
  return { ...outcome, cleanup: 'verified absent: temporary database and dump file' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some((x) => x !== '--json')) {
    console.error('Usage: node scripts/db-restore-rehearsal.mjs [--json]')
    process.exitCode = 2
  } else {
    rehearse()
      .then((result) => {
        console.log(
          process.argv.includes('--json')
            ? JSON.stringify(result, null, 2)
            : 'PASS: full local dump/restore verified; ' +
                result.tableCount +
                ' tables, ' +
                result.policyCount +
                ' RLS policies; cleanup complete',
        )
      })
      .catch((err) => {
        console.error('BLOCK: ' + (err instanceof Error ? err.message : 'unknown error'))
        process.exitCode = 1
      })
  }
}
