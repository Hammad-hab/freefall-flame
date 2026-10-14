/**
 * Seeds the BASS-II research papers into the Papers collection.
 * Run: NODE_OPTIONS="--no-deprecation" pnpm payload run src/scripts/seed-papers.ts
 *
 * Sources were verified against NASA NTRS on 2026-10-14:
 *  - 20210011385: Olson, Ferkul, Bhattacharjee, T'ien, Wichman,
 *    "Burning and Suppression of Solids–II (BASS-II) Summary Report" (2021).
 *  - 20150019858: Olson, Ferkul, Bhattacharjee, Miller, Fernandez-Pello, Link,
 *    T'ien, Wichman, "Results from On-Board CSA-CP and CDM Sensor Readings
 *    During the BASS-II Experiment in MSG" (2015).
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config: await config })

  const papers = [
    {
      title: 'Burning and Suppression of Solids–II (BASS-II) Summary Report',
      authors: [
        { name: 'Sandra L. Olson' },
        { name: 'Paul V. Ferkul' },
        { name: 'Subrata Bhattacharjee' },
        { name: "Fletcher J. T'ien" },
        { name: 'Indrek Wichman' },
      ],
      year: 2021,
      documentType: 'technical-memorandum' as const,
      ntrsId: '20210011385',
      license: 'NASA, public',
      experiments: [{ experiment: 'BASS-II' as const, linkStatus: 'confirmed' as const }],
      abstract:
        'The BASS-II experiment burned solid fuel samples in the Microgravity Science Glovebox aboard the ISS. Main variables: ambient O2 concentration, ventilation flow velocity, fuel type, thickness, geometry. O2, CO and CO2 were recorded before and after each test.',
    },
    {
      title:
        'Results from On-Board CSA-CP and CDM Sensor Readings During the Burning and Suppression of Solids II (BASS-II) Experiment in the Microgravity Science Glovebox (MSG)',
      authors: [
        { name: 'Sandra L. Olson' },
        { name: 'Paul V. Ferkul' },
        { name: 'Subrata Bhattacharjee' },
        { name: 'Fletcher J. Miller' },
        { name: 'Carlos Fernandez-Pello' },
        { name: 'Shmuel Link' },
        { name: "James S. T'ien" },
        { name: 'Indrek Wichman' },
      ],
      year: 2015,
      documentType: 'conference-paper' as const,
      ntrsId: '20150019858',
      license: 'NASA, public',
      experiments: [{ experiment: 'BASS-II' as const, linkStatus: 'confirmed' as const }],
      abstract:
        'Oxygen (CSA-CP) and CO2 (CDM) readings taken before and after each BASS-II test are reported and compared with stoichiometric ratios for a one-step gas-phase reaction.',
    },
  ]

  for (const p of papers) {
    const existing = await payload.find({
      collection: 'papers',
      where: { ntrsId: { equals: p.ntrsId } },
      limit: 1,
      draft: true,
    })
    if (existing.docs[0]) {
      console.log(`Paper ${p.ntrsId} already exists (id ${existing.docs[0].id}). Skipping.`)
      continue
    }
    const created = await payload.create({ collection: 'papers', data: p, draft: true })
    console.log(`Created paper ${p.ntrsId} (id ${created.id}).`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
