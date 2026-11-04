/**
 * Chooses which BASS-II dataset visitors see, by the published flags.
 *
 *   pnpm payload run src/scripts/switch-bass2-default.ts -- --to cleaned          # dry run
 *   pnpm payload run src/scripts/switch-bass2-default.ts -- --to cleaned --write
 *   pnpm payload run src/scripts/switch-bass2-default.ts -- --to old --write      # switch back
 *
 *   --to cleaned  publish "BASS-II (cleaned)"; unpublish "BASS-II" and "BASS-II CSV Sample"
 *   --to old      publish "BASS-II" and "BASS-II CSV Sample"; unpublish "BASS-II (cleaned)"
 *
 * Only the `published` checkbox changes; no rows, columns or other fields.
 * Without --write it prints what it would do. The dashboard's list of
 * published datasets is cached for 60 seconds. See data/README-bass2-clean.md.
 */
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction } from 'payload'

import config from '../payload.config'

const CLEANED = 'BASS-II (cleaned)'
const OLD = ['BASS-II', 'BASS-II CSV Sample']

async function main() {
  const argv = process.argv.slice(2)
  const toAt = argv.indexOf('--to')
  const to = toAt >= 0 ? argv[toAt + 1] : undefined
  if (to !== 'cleaned' && to !== 'old') throw new Error('Say --to cleaned or --to old.')
  const write = argv.includes('--write')

  const payload = await getPayload({ config: await config })
  const wanted = new Map<string, boolean>([[CLEANED, to === 'cleaned'], ...OLD.map((n): [string, boolean] => [n, to === 'old'])])
  const found = await payload.find({ collection: 'datasets', where: { name: { in: [...wanted.keys()] } }, depth: 0, pagination: false })
  for (const name of wanted.keys()) {
    const n = found.docs.filter((d) => d.name === name).length
    if (n !== 1) throw new Error(`Expected one dataset named "${name}", found ${n}. Nothing was changed.`)
  }

  const changes = found.docs.filter((d) => !!d.published !== wanted.get(d.name))
  for (const d of found.docs) {
    const want = wanted.get(d.name)!
    console.log(`  dataset ${d.id} "${d.name}": published ${d.published ? 'yes' : 'no'} -> ${want ? 'yes' : 'no'}${!!d.published === want ? ' (unchanged)' : ''}`)
  }
  if (!write) return console.log(`\nDry run: ${changes.length} flag(s) would change. Add --write to change them.`)
  if (!changes.length) return console.log('\nNothing to change.')

  const req = await createLocalReq({}, payload)
  const own = await initTransaction(req)
  try {
    for (const d of changes) {
      await payload.update({ collection: 'datasets', id: d.id, data: { published: wanted.get(d.name)! }, req })
    }
    if (own) await commitTransaction(req)
  } catch (e) {
    if (own) await killTransaction(req)
    throw new Error(`Switch failed and was rolled back: ${(e as Error).message}`)
  }

  const after = await payload.find({ collection: 'datasets', where: { name: { in: [...wanted.keys()] } }, depth: 0, pagination: false })
  console.log('\nRead back:')
  let bad = 0
  for (const d of after.docs) {
    const ok = !!d.published === wanted.get(d.name)
    if (!ok) bad++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  dataset ${d.id} "${d.name}": published ${d.published ? 'yes' : 'no'}`)
  }
  console.log(bad ? `\n${bad} flag(s) are not as wanted.` : `\nDone. Visitors see the ${to === 'cleaned' ? 'cleaned' : 'old'} data within 60 s (the dashboard's cache).`)
  if (bad) process.exitCode = 1
}

try {
  await main()
  process.exit(process.exitCode ?? 0)
} catch (e) {
  console.error(`\n${(e as Error).message}`)
  process.exit(1)
}
