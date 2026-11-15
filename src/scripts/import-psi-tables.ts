/**
 * Import the cleaned FLEX and CFI-G tables from data/psi/ as datasets.
 *
 *   pnpm payload run src/scripts/import-psi-tables.ts          # dry run: validate, write nothing
 *   pnpm payload run src/scripts/import-psi-tables.ts -- --write
 *   pnpm payload run src/scripts/import-psi-tables.ts -- --check
 *
 * The table definitions and their checks live in ./psi-tables (unit tested in
 * tests/int/psi-tables.spec.ts); this file only talks to the database. BASS-II
 * has its own script (import-bass2-clean.ts). Datasets are created published
 * (the dashboard only serves published ones) and are reached at
 * /dashboard?dataset=<id>&tab=visualization.
 */
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload'

import config from '../payload.config'
import { DATA, TABLES, buildRows, toColumn } from './psi-tables'

async function findPapers(payload: Awaited<ReturnType<typeof getPayload>>, ntrsIds: string[]) {
  if (!ntrsIds.length) return []
  const res = await payload.find({
    collection: 'papers',
    where: { ntrsId: { in: ntrsIds } },
    depth: 0,
    pagination: false,
    draft: true,
  })
  const byNtrs = new Map(res.docs.map((p) => [String(p.ntrsId), p.id]))
  return ntrsIds.map((n) => byNtrs.get(n)).filter((v): v is number => v !== undefined)
}

async function main() {
  const argv = process.argv.slice(2)
  const mode = argv.includes('--write') ? 'write' : argv.includes('--check') ? 'check' : 'dry-run'
  const payload = await getPayload({ config: await config })

  if (mode === 'check') {
    let failed = 0
    for (const table of TABLES) {
      const found = await payload.find({ collection: 'datasets', where: { name: { equals: table.name } }, depth: 0, limit: 2 })
      if (found.docs.length !== 1) {
        console.log(`FAIL  ${table.name}: expected one dataset, found ${found.docs.length}`)
        failed++
        continue
      }
      const ds = found.docs[0]
      const stored = await payload.find({
        collection: 'dataset-rows',
        where: { dataset: { equals: ds.id } },
        depth: 0,
        pagination: false,
        sort: 'rowIndex',
      })
      const rows = stored.docs.map((d) => ({ data: d.data as Record<string, unknown> }))
      console.log(`\n${table.name} (id ${ds.id}): published ${ds.published ? 'YES' : 'no'}, ${ds.columns?.length} columns, rowCount ${ds.rowCount}, rows stored ${rows.length}`)
      const { lines, failures } = table.checks(rows)
      for (const l of lines) console.log('  ' + l)
      failed += failures
      if (ds.rowCount !== rows.length) {
        console.log(`  FAIL  rowCount ${ds.rowCount} does not match ${rows.length} stored rows`)
        failed++
      }
    }
    console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
    if (failed) throw new Error(`${failed} check(s) failed.`)
    return
  }

  for (const table of TABLES) {
    const csvPath = `${DATA}/${table.csv}`
    const { rows, problems } = buildRows(csvPath, table.defs)
    console.log(`\n${table.name}: ${rows.length} rows from ${csvPath}`)
    const { lines, failures } = table.checks(rows)
    for (const l of lines) console.log('  ' + l)
    if (problems.length) {
      console.log(`  ${problems.length} value problem(s):`)
      for (const p of problems.slice(0, 20)) console.log(`    ${p}`)
      if (problems.length > 20) console.log(`    ...and ${problems.length - 20} more.`)
    }
    if (problems.length || failures) throw new Error(`${table.name}: not clean, nothing was written.`)
  }

  if (mode === 'dry-run') return console.log('\nDry run: nothing was written. Run with --write to import.')

  for (const table of TABLES) {
    const exists = await payload.find({ collection: 'datasets', where: { name: { equals: table.name } }, depth: 0, limit: 1 })
    if (exists.docs.length) throw new Error(`A dataset named "${table.name}" already exists (id ${exists.docs[0].id}). Nothing was written.`)

    const { rows } = buildRows(`${DATA}/${table.csv}`, table.defs)
    const papers = await findPapers(payload, table.papers)
    console.log(`${table.name}: ${rows.length} rows, papers linked ${papers.length ? papers.join(', ') : 'none'}`)

    const req = await createLocalReq({}, payload)
    const ownTransaction = await initTransaction(req)
    try {
      const ds = await payload.create({
        collection: 'datasets',
        data: {
          name: table.name,
          description: table.description,
          published: true,
          papers: papers as number[],
          columns: table.defs.map(toColumn) as never,
        },
        req,
      })
      for (let i = 0; i < rows.length; i++) {
        await payload.create({
          collection: 'dataset-rows',
          data: { dataset: ds.id, rowIndex: i + 1, data: rows[i].data },
          req,
        })
        if ((i + 1) % 50 === 0 || i + 1 === rows.length) process.stdout.write(`\r  inserted ${i + 1} / ${rows.length} rows`)
      }
      await payload.update({
        collection: 'datasets',
        id: ds.id,
        data: { rowCount: rows.length, lastImportedAt: new Date().toISOString() },
        req,
      })
      if (ownTransaction) await commitTransaction(req)
      console.log(`\nCreated dataset ${ds.id} "${table.name}" (published, ${rows.length} rows). Run with --check to read it back.`)
    } catch (e) {
      if (ownTransaction) await killTransaction(req)
      throw new Error(`Import failed and was rolled back: ${(e as Error).message}`)
    }
  }
}

// `payload run` imports this module and then exits, so the work is awaited at
// top level: a fire-and-forget main() is killed before it finishes.
await main()
