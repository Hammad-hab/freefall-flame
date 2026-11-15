/** @file Ingest the Flame in Freefall reference PDFs from src/scripts/flame_papers/ into the Papers collection.

How papers reach the dashboard (the "investigations" side) vs the Papers side:

  research papers -> data/psi/sources.json   (hand-checked refs: title, NTRS id, url)
                       |
                       v
           src/scripts/psi-catalogue.ts merges them into psi.json
                       |
                       v
           dashboard cards render them as "Sources" (no DB, no network)

  research papers -> Papers collection (Payload CMS), seeded by scripts/seed-papers.ts
                       (metadata + fullText + PDF upload, used for the Explain/AI summaries)

Run:  NODE_OPTIONS="--no-deprecation" pnpm payload run src/scripts/import-flame-papers.ts
*/
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '../payload.config.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const SCRIPTS_DIR = path.resolve(ROOT, 'src/scripts');
const FLAME_DIR = path.join(SCRIPTS_DIR, 'flame_papers');

const here = fileURLToPath(import.meta.url);
const selfDir = path.dirname(here);

// Filename -> how the Paper is described for the Papers collection.
// Title is derived from the filename (the NTRS id is stripped); documentType and
// experiment link are set here. linkStatus "confirmed" = the NTRS id in the name
// was verified against the source list; "unconfirmed" = needs a check.
type DocumentType =
  | 'journal-article'
  | 'technical-memorandum'
  | 'technical-publication'
  | 'conference-paper'
  | 'presentation'
  | 'poster'
  | 'other';
const PAPER_META: Record<string, { experiment: 'SAFFIRE' | 'FLEX' | 'FLEX-2' | 'ACME' | 'BASS-II' | 'SoFIE' | 'SLICE' | 'CFI' | 'SPICE' | 'SAME' | 'DAFT' | 'Other'; documentType: DocumentType; linkStatus: 'confirmed' | 'unconfirmed' }> = {
  // BASS-II -----------------------------------------------------------------
  'BASS-II_CSA-CP_CDM_sensors_20150019858.pdf': {
    experiment: 'BASS-II', linkStatus: 'confirmed', documentType: 'conference-paper',
  },
  // FLEX --------------------------------------------------------------------
  'FLEX_cool_flame_alkane_droplets_20140006750.pdf': {
    experiment: 'FLEX', linkStatus: 'confirmed', documentType: 'journal-article',
  },
  'FLEX_decisive_step_forward_20120015928.pdf': {
    experiment: 'FLEX', linkStatus: 'confirmed', documentType: 'journal-article',
  },
  'FLEX_detailed_results_TP-2015-216046_20150023456.pdf': {
    experiment: 'FLEX', linkStatus: 'confirmed', documentType: 'technical-publication',
  },
  'FLEX_methanol_droplet_combustion_20130014061.pdf': {
    experiment: 'FLEX', linkStatus: 'confirmed', documentType: 'journal-article',
  },
  // Saffire I-III ---------------------------------------------------------
  'Saffire_I-III_overview_slides_20170002628.pdf': {
    experiment: 'SAFFIRE', linkStatus: 'confirmed', documentType: 'presentation',
  },
  'Saffire_I-III_results_slides_20180005168.pdf': {
    experiment: 'SAFFIRE', linkStatus: 'confirmed', documentType: 'presentation',
  },
  'Saffire_ICES_objectives_hardware_20170000230.pdf': {
    experiment: 'SAFFIRE', linkStatus: 'confirmed', documentType: 'presentation',
  },
  'Saffire_large-scale_flammability_results_20170008805.pdf': {
    experiment: 'SAFFIRE', linkStatus: 'confirmed', documentType: 'conference-paper',
  },
  'Saffire_objectives_development_status_20170001636.pdf': {
    experiment: 'SAFFIRE', linkStatus: 'confirmed', documentType: 'presentation',
  },
  'Saffire_poster_20150000894.pdf': { experiment: 'SAFFIRE', linkStatus: 'confirmed', documentType: 'poster' },
  // SAME-R ----------------------------------------------------------------
  'SAME-R_particle_morphology_20150010172.pdf': {
    experiment: 'SAME', linkStatus: 'confirmed', documentType: 'journal-article',
  },
  'SAME-R_preliminary_results_20120012884.pdf': {
    experiment: 'SAME', linkStatus: 'confirmed', documentType: 'conference-paper',
  },
  // SAME ------------------------------------------------------------------
  'SAME_fact_sheet_NASA.pdf': { experiment: 'SAME', linkStatus: 'unconfirmed', documentType: 'other' },
  // SAME-2 (SAME-2 is a follow-on of SAME; the experiment list has no SAME-2) -
  // link to SAME so the paper is reachable in the UI.
  'SAME-2_particle_morphology_size_20130000422.pdf': {
    experiment: 'SAME', linkStatus: 'confirmed', documentType: 'journal-article',
  },
  // General (no catalogue investigation key) --------------------------------
  'ISS_combustion_experiments_overview_20120017940.pdf': {
    experiment: 'Other', linkStatus: 'unconfirmed', documentType: 'technical-memorandum',
  },
  'PSI_system_overview_2015.pdf': {
    experiment: 'Other', linkStatus: 'unconfirmed', documentType: 'technical-memorandum',
  },
};

/** Last path segment of a filename, minus the .pdf, with underscores to spaces. */
function titleFrom(filename: string): string {
  let s = filename.replace(/\.pdf$/i, '');
  s = s.replace(/^SRC_/, ''); // tolerate a leading SRC_ prefix
  s = s.replace(/_[0-9]{11}$/, ''); // strip the trailing NTRS id
  s = s.replace(/^TP-2015-216046_/, ''); // strip a known project-code prefix
  s = s.replace(/_/g, ' ').trim();
  // Title-case the first letter of each space-separated word.
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

async function main() {
  const payload = await getPayload({ config });
  const files = fs
    .readdirSync(FLAME_DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const meta = PAPER_META[file];
    if (!meta) {
      errors.push(`no meta for ${file}`);
      continue;
    }

    // NTRS id = the 11-digit number in the filename, if present.
    const ntrsId = (file.match(/_([0-9]{11})(?=\.pdf$)/i)?.[1] ?? null) as string | null;
    const title = meta.experiment === 'Other' ? titleFrom(file) : titleFrom(file);

    // sourceUrl: the hook fills it from ntrsId when present.
    const sourceUrl = ntrsId ? `https://ntrs.nasa.gov/citations/${ntrsId}` : null;

    // Decode the NTRS link URL used for the general papers (the OTHER table
    // in download-papers.py): the ISS overview ships from nationalacademies.
    const OTHER_SOURCE_URL: Record<string, string> = {
      'ISS_combustion_experiments_overview_20120017940.pdf':
        'https://www.nationalacademies.org/cdn/materials/9fba0b5f-33a8-4c0c-951b-67dcb346b388',
      'PSI_system_overview_2015.pdf':
        'https://www.nationalacademies.org/cdn/materials/9fba0b5f-33a8-4c0c-951b-67dcb346b388',
    };

    /** Skip if the NTRS id is already in the Papers collection (seed-papers.ts
     * created BASS-II CSA-CP_CDM) or, for NTRS-less papers, a paper with the
     * same title already exists (an NTRS-less paper could otherwise be duplicated). */
    if (ntrsId) {
      const existing = await payload.find({
        collection: 'papers',
        where: { ntrsId: { equals: ntrsId } },
        limit: 1,
        draft: true,
      });
      if (existing.docs[0]) {
        console.log(`Skip ${file}: ntrsId ${ntrsId} already ingested (id ${existing.docs[0].id}).`);
        skipped++;
        continue;
      }
    } else {
      const byTitle = await payload.find({ collection: 'papers', where: { title: { equals: title } }, limit: 1, draft: true });
      if (byTitle.docs[0]) {
        console.log(`Skip ${file}: a paper titled "${title}" already exists (id ${byTitle.docs[0].id}).`);
        skipped++;
        continue;
      }
    }

    const createdDoc = await payload.create({
      collection: 'papers',
      data: {
        title,
        documentType: meta.documentType,
        ntrsId,
        sourceUrl: OTHER_SOURCE_URL[file] ?? sourceUrl,
        license: 'NASA, public',
        experiments: [{ experiment: meta.experiment, linkStatus: meta.linkStatus }],
        ingestStatus: 'pending',
      },
      draft: true,
    });
    console.log(`Created paper ${title} (ntrsId ${ntrsId ?? 'n/a'}) -> id ${createdDoc.id}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors.length} errors.`);
  for (const e of errors) console.log('  error:', e);
  if (errors.length) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
