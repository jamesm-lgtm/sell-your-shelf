/**
 * Clone the prod project's `public` schema into staging using the Supabase
 * Management API. Read-only against prod; writes only to staging.
 *
 * Scope: enum types, sequences, tables (columns/PKs/UKs/FKs/CKs), non-constraint
 * indexes, views. Skips RLS policies, triggers, functions, custom non-enum
 * types — those can be added in a second pass if the app needs them.
 *
 * Refuses to run if staging's public schema already has tables (don't clobber).
 *
 * Run:  npx tsx scripts/clone-prod-schema-to-staging.ts
 *
 * .env.staging must contain SUPABASE_MANAGEMENT_API_TOKEN (a Personal Access
 * Token from supabase.com/dashboard/account/tokens).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const PROD_REF = 'vsnhrukqqmukkpqlyrhh'
const STAGING_REF = 'dbqlgknktoctbchxfsvu'

function loadEnvFile(filename: string): Record<string, string> {
  const filePath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filename}`)
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnvFile('.env.staging')
const PAT = env.SUPABASE_MANAGEMENT_API_TOKEN
if (!PAT) throw new Error('Missing SUPABASE_MANAGEMENT_API_TOKEN in .env.staging')

if (PROD_REF === STAGING_REF) throw new Error('PROD_REF === STAGING_REF — refusing')

type QueryRow = Record<string, unknown>

async function queryMgmt(ref: string, sql: string): Promise<QueryRow[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Mgmt API [${ref}] ${res.status}: ${text}\nSQL: ${sql.slice(0, 200)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Mgmt API [${ref}] non-JSON response: ${text}`)
  }
}

async function queryProd(sql: string): Promise<QueryRow[]> {
  // Allowlist: read-only queries only.
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    throw new Error(`Refusing non-read query against prod: ${sql.slice(0, 80)}`)
  }
  return queryMgmt(PROD_REF, sql)
}

async function execStaging(sql: string): Promise<QueryRow[]> {
  return queryMgmt(STAGING_REF, sql)
}

// ---------- Read prod schema ----------

type EnumDef = { name: string; labels: string[] }
type SequenceDef = {
  name: string
  data_type: string
  start_value: string
  minimum_value: string
  maximum_value: string
  increment: string
  cycle_option: string
}
type ColumnRow = {
  table_name: string
  attnum: number
  column_name: string
  data_type: string
  not_null: boolean
  default_value: string | null
  identity: string // '', 'a', 'd'
  generated: string // '', 's'
}
type ConstraintRow = {
  table_name: string
  conname: string
  contype: string // 'p' | 'u' | 'f' | 'c'
  definition: string
  ref_table_name: string | null
}
type IndexRow = {
  table_name: string
  index_name: string
  definition: string
}
type ViewDef = { name: string; definition: string }

async function readProdSchema() {
  console.log('→ Reading prod schema…')

  const enums = (await queryProd(`
    SELECT t.typname AS name,
           jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `)) as unknown as EnumDef[]

  const sequences = (await queryProd(`
    SELECT sequence_name AS name,
           data_type,
           start_value,
           minimum_value,
           maximum_value,
           increment,
           cycle_option
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `)) as unknown as SequenceDef[]

  const columns = (await queryProd(`
    SELECT c.relname AS table_name,
           a.attnum,
           a.attname AS column_name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
           a.attnotnull AS not_null,
           pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_value,
           a.attidentity AS identity,
           a.attgenerated AS generated
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `)) as unknown as ColumnRow[]

  const constraints = (await queryProd(`
    SELECT c.relname AS table_name,
           con.conname,
           con.contype::text AS contype,
           pg_catalog.pg_get_constraintdef(con.oid, true) AS definition,
           CASE WHEN con.contype = 'f'
                THEN (SELECT rc.relname FROM pg_class rc WHERE rc.oid = con.confrelid)
                ELSE NULL END AS ref_table_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, con.conname
  `)) as unknown as ConstraintRow[]

  const indexes = (await queryProd(`
    SELECT c.relname AS table_name,
           i.relname AS index_name,
           pg_catalog.pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT ix.indisprimary
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint pc
        WHERE pc.conindid = ix.indexrelid AND pc.contype IN ('u','p')
      )
    ORDER BY c.relname, i.relname
  `)) as unknown as IndexRow[]

  const views = (await queryProd(`
    SELECT viewname AS name, pg_get_viewdef(viewname::regclass, true) AS definition
    FROM pg_views
    WHERE schemaname = 'public'
    ORDER BY viewname
  `)) as unknown as ViewDef[]

  console.log(
    `  enums=${enums.length}  sequences=${sequences.length}  columns=${columns.length}  ` +
      `constraints=${constraints.length}  indexes=${indexes.length}  views=${views.length}`,
  )

  return { enums, sequences, columns, constraints, indexes, views }
}

// ---------- DDL emission ----------

function qIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"'
}

function qLit(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'"
}

function emitEnumDDL(e: EnumDef): string {
  const labels = e.labels.map(qLit).join(', ')
  return `CREATE TYPE ${qIdent(e.name)} AS ENUM (${labels});`
}

function emitSequenceDDL(s: SequenceDef): string {
  // Re-rewrite as a plain CREATE SEQUENCE. Skip OWNED BY — not required.
  const parts = [
    `CREATE SEQUENCE IF NOT EXISTS ${qIdent(s.name)}`,
    `  AS ${s.data_type}`,
    `  INCREMENT BY ${s.increment}`,
    `  MINVALUE ${s.minimum_value}`,
    `  MAXVALUE ${s.maximum_value}`,
    `  START WITH ${s.start_value}`,
    s.cycle_option === 'YES' ? '  CYCLE' : '  NO CYCLE',
  ]
  return parts.join('\n') + ';'
}

function emitTableDDL(tableName: string, columns: ColumnRow[]): string {
  const cols = columns.map((c) => {
    let line = `  ${qIdent(c.column_name)} ${c.data_type}`
    if (c.identity === 'a') {
      line += ' GENERATED ALWAYS AS IDENTITY'
    } else if (c.identity === 'd') {
      line += ' GENERATED BY DEFAULT AS IDENTITY'
    } else if (c.generated === 's' && c.default_value) {
      line += ` GENERATED ALWAYS AS (${c.default_value}) STORED`
    } else if (c.default_value) {
      line += ` DEFAULT ${c.default_value}`
    }
    if (c.not_null) line += ' NOT NULL'
    return line
  })
  return `CREATE TABLE ${qIdent(tableName)} (\n${cols.join(',\n')}\n);`
}

function emitConstraintDDL(c: ConstraintRow): string {
  return `ALTER TABLE ${qIdent(c.table_name)} ADD CONSTRAINT ${qIdent(c.conname)} ${c.definition};`
}

function emitIndexDDL(i: IndexRow): string {
  // pg_get_indexdef returns a full CREATE INDEX statement with the original
  // schema qualifier — we leave it alone; schema is `public` on both sides.
  return i.definition.endsWith(';') ? i.definition : i.definition + ';'
}

function emitViewDDL(v: ViewDef): string {
  return `CREATE OR REPLACE VIEW ${qIdent(v.name)} AS ${v.definition.replace(/;\s*$/, '')};`
}

// ---------- Order tables by FK dependency ----------

function topoSortTables(tableNames: string[], constraints: ConstraintRow[]): string[] {
  const tables = new Set(tableNames)
  const deps = new Map<string, Set<string>>()
  for (const t of tableNames) deps.set(t, new Set())
  for (const c of constraints) {
    if (c.contype === 'f' && c.ref_table_name && tables.has(c.ref_table_name)) {
      // table depends on ref_table_name; only inline self-refs are skipped
      if (c.ref_table_name !== c.table_name) {
        deps.get(c.table_name)!.add(c.ref_table_name)
      }
    }
  }

  const sorted: string[] = []
  const seen = new Set<string>()
  function visit(t: string, stack: Set<string>) {
    if (seen.has(t)) return
    if (stack.has(t)) {
      // cycle — break it; the FK will be added later anyway
      return
    }
    stack.add(t)
    for (const d of deps.get(t) ?? []) visit(d, stack)
    stack.delete(t)
    seen.add(t)
    sorted.push(t)
  }
  for (const t of tableNames) visit(t, new Set())
  return sorted
}

// ---------- Order views by dependency (retry-on-error) ----------

async function createViewsWithRetry(views: ViewDef[]) {
  let remaining = views.slice()
  let lastErrors: Map<string, string> = new Map()
  while (remaining.length > 0) {
    const created: string[] = []
    const failedThisPass = new Map<string, string>()
    for (const v of remaining) {
      try {
        await execStaging(emitViewDDL(v))
        created.push(v.name)
      } catch (e) {
        failedThisPass.set(v.name, e instanceof Error ? e.message : String(e))
      }
    }
    if (created.length === 0) {
      // No progress — give up with diagnostics.
      console.error('Stuck creating views. Last errors:')
      for (const [n, msg] of failedThisPass) console.error(`  ${n}: ${msg.split('\n')[0]}`)
      throw new Error('Unable to resolve view dependencies')
    }
    console.log(`  ✓ created views: ${created.join(', ')}`)
    remaining = remaining.filter((v) => !created.includes(v.name))
    lastErrors = failedThisPass
  }
  void lastErrors
}

// ---------- Main ----------

async function main() {
  // Pre-flight: staging public must be empty of tables.
  const stagingTables = await execStaging(`
    SELECT count(*)::int AS n
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `)
  const existing = (stagingTables[0] as { n: number }).n
  if (existing > 0) {
    throw new Error(
      `Refusing to clone: staging public schema already has ${existing} table(s). Drop them first or run against a fresh branch.`,
    )
  }
  console.log(`✓ staging public is empty (${existing} tables)`)

  const { enums, sequences, columns, constraints, indexes, views } = await readProdSchema()

  // Group columns by table.
  const tableNames: string[] = []
  const columnsByTable = new Map<string, ColumnRow[]>()
  for (const c of columns) {
    if (!columnsByTable.has(c.table_name)) {
      columnsByTable.set(c.table_name, [])
      tableNames.push(c.table_name)
    }
    columnsByTable.get(c.table_name)!.push(c)
  }
  const sortedTables = topoSortTables(tableNames, constraints)
  console.log(`→ ${sortedTables.length} tables, ordered by FK deps`)

  // 1. Enums first.
  for (const e of enums) {
    console.log(`  · enum ${e.name} (${e.labels.length} labels)`)
    await execStaging(emitEnumDDL(e))
  }

  // 2. Sequences. (Created standalone; table defaults will reference them.)
  for (const s of sequences) {
    console.log(`  · sequence ${s.name}`)
    await execStaging(emitSequenceDDL(s))
  }

  // 3. Tables (without constraints — those come after).
  for (const t of sortedTables) {
    console.log(`  · table ${t} (${columnsByTable.get(t)!.length} cols)`)
    await execStaging(emitTableDDL(t, columnsByTable.get(t)!))
  }

  // 4. Constraints: PKs and UKs and CKs first (no cross-table deps), then FKs.
  const pkukCk = constraints.filter((c) => ['p', 'u', 'c'].includes(c.contype))
  const fks = constraints.filter((c) => c.contype === 'f')

  for (const c of pkukCk) {
    await execStaging(emitConstraintDDL(c))
  }
  console.log(`  ✓ added ${pkukCk.length} PK/UK/CK constraint(s)`)

  for (const c of fks) {
    await execStaging(emitConstraintDDL(c))
  }
  console.log(`  ✓ added ${fks.length} FK constraint(s)`)

  // 5. Non-constraint indexes.
  for (const i of indexes) {
    await execStaging(emitIndexDDL(i))
  }
  console.log(`  ✓ created ${indexes.length} index(es)`)

  // 6. Views (with retry-on-dep-error to handle inter-view ordering).
  await createViewsWithRetry(views)

  // 7. Reload PostgREST schema cache.
  await execStaging(`NOTIFY pgrst, 'reload schema'`)
  console.log('  ✓ NOTIFY pgrst reload sent')

  // Verify count.
  const finalCount = await execStaging(`
    SELECT
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tables,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v') AS views,
      (SELECT count(*) FROM information_schema.sequences WHERE sequence_schema='public') AS sequences
  `)
  console.log('')
  console.log(`Final on staging: ${JSON.stringify(finalCount[0])}`)
}

main().catch((err) => {
  console.error('')
  console.error('Clone failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
