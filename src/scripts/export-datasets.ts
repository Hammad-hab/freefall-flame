/**
 * Backs up the experiment data to one local JSON file. READ-ONLY on the database.
 *
 *   pnpm payload run src/scripts/export-datasets.ts
 *
 * Writes .local-checks/backup/datasets-<UTC date-time>.json (git-excluded) with
 * every dataset (published or not), every dataset row, every dataset-import
 * record and every paper, exactly as stored, plus the counts. Prints the
 * counts per dataset so they can be compared with the dashboard.
 *
 * Restoring: see "Backup and restore" in data/README-bass2-clean.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '../payload.config'

const OUT_DIR = path.resolve(process.cwd(), '.local-checks', 'backup')

async function main() {
  const payload = await getPayload({ config: await config })
  // The local API reads with full access (overrideAccess defaults to true),
  // so unpublished datasets are included. Nothing is written to the database.
  const opts = { pagination: false, depth: 0, sort: 'id' } as const
  const datasets = (await payload.find({ collection: 'datasets', ...opts })).docs
  const rows = (await payload.find({ collection: 'dataset-rows', ...opts })).docs
  const imports = (await payload.find({ collection: 'dataset-imports', ...opts })).docs
  const papers = (await payload.find({ collection: 'papers', ...opts })).docs

  const rowsPer = new Map<string, number>()
  for (const r of rows) {
    const id = String(typeof r.dataset === 'object' && r.dataset ? r.dataset.id : r.dataset)
    rowsPer.set(id, (rowsPer.get(id) ?? 0) + 1)
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z')
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, `datasets-${stamp}.json`)
  const counts = {
    datasets: datasets.length,
    datasetRows: rows.length,
    datasetImports: imports.length,
    papers: papers.length,
    rowsPerDataset: Object.fromEntries(rowsPer),
  }
  fs.writeFileSync(
    file,
    JSON.stringify({ exportedAt: new Date().toISOString(), counts, datasets, datasetRows: rows, datasetImports: imports, papers }, null, 1),
  )

  console.log(`Backup written: ${path.relative(process.cwd(), file)} (${fs.statSync(file).size} bytes)`)
  console.log(`datasets ${datasets.length}, dataset rows ${rows.length}, dataset imports ${imports.length}, papers ${papers.length}`)
  for (const d of datasets) {
    console.log(
      `  dataset ${d.id} "${d.name}": published ${d.published ? 'yes' : 'no'}, ${d.columns?.length ?? 0} columns, ` +
        `rowCount field ${d.rowCount ?? '-'}, rows found ${rowsPer.get(String(d.id)) ?? 0}`,
    )
  }
}

try {
  await main()
  process.exit(0)
} catch (e) {
  console.error(`\n${(e as Error).message}`)
  process.exit(1)
}
