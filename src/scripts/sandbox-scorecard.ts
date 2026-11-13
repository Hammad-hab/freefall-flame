/**
 * Writes the sandbox's scorecard: how many NASA-scored BASS-II tests the
 * engine matches. Running every scored preset to the end takes minutes, too
 * long for a browser, so the result is precomputed into a checked-in file:
 *
 *   src/app/(frontend)/dashboard/components/sandbox/scorecard.json
 *
 * It runs the dashboard's own engine (sandbox/engine: flame_core.mjs + .wasm,
 * Engine.ts) and its own match rule (sandbox/engine/scoring.ts), with each
 * preset's default lighting, to the end of its timeline.
 *
 *   node --import tsx/esm src/scripts/sandbox-scorecard.ts           # write the file
 *   node --import tsx/esm src/scripts/sandbox-scorecard.ts --check   # rerun, compare with the file, write nothing
 *
 * "Scored" means NASA's table says how the test ended (an outcome code other
 * than "not stated"). tests/int/sandbox-scorecard.spec.ts checks the file
 * against the study's scorecard (data/bass2_all_outcomes.csv) and against
 * the engine file it was made with. Rerun this script after any engine swap.
 * Needs no database and no network.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { loadEngine, LIGHT, NASA } from '../app/(frontend)/dashboard/components/sandbox/engine/Engine'
import { matchVerdict } from '../app/(frontend)/dashboard/components/sandbox/engine/scoring'

const SANDBOX = path.join(process.cwd(), 'src', 'app', '(frontend)', 'dashboard', 'components', 'sandbox')
const OUT = path.join(SANDBOX, 'scorecard.json')
const WASM = path.join(SANDBOX, 'engine', 'flame_core.wasm')

async function main() {
  const check = process.argv.includes('--check')
  const t0 = Date.now()
  const engine = await loadEngine()
  const tests = []
  const presetTestIds: string[] = []
  for (let id = 0; id < engine.presetCount(); id++) {
    const p = engine.preset(id)
    presetTestIds.push(p.testId)
    if (p.nasaCode === NASA.NOT_STATED) continue
    if (!engine.loadPreset(id, LIGHT.DEFAULT)) throw new Error(`${p.testId}: the engine refused to load it`)
    engine.step(p.runSteps)
    const status = engine.presetStatus()
    if (!status?.finished || status.step !== p.runSteps) throw new Error(`${p.testId}: not finished after ${p.runSteps} steps`)
    const o = engine.outcome()
    const verdict = matchVerdict(p.nasaCode, o.code, true)
    tests.push({
      id, testId: p.testId,
      nasaCode: p.nasaCode, nasaOutcome: p.nasaOutcome,
      outcomeCode: o.code, outcome: o.name, outcomeStep: o.step,
      runSteps: p.runSteps, checksum: engine.checksum().toString(16).padStart(8, '0'),
      verdict,
    })
    console.log(`  ${p.testId.padEnd(5)} ${o.name.padEnd(28)} step ${String(o.step).padStart(5)}  ${verdict}`)
  }
  // Matched tests listed by test id, digits read as numbers: B14, B18, B19, O4.
  const byTestId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })
  const matched = tests.filter((t) => t.verdict === 'match').sort((a, b) => byTestId(a.testId, b.testId))
  const card = {
    about: 'Precomputed by src/scripts/sandbox-scorecard.ts: every NASA-scored BASS-II preset run to the end of its timeline with its default lighting, scored by sandbox/engine/scoring.ts. Do not edit by hand.',
    engine: { wasm: 'sandbox/engine/flame_core.wasm', sha256: crypto.createHash('sha256').update(fs.readFileSync(WASM)).digest('hex') },
    lighting: 'default',
    presets: presetTestIds.length,
    scored: tests.length,
    matched: matched.length,
    matchedTests: matched.map((t) => t.testId),
    tests,
    presetTestIds,
  }
  const text = JSON.stringify(card, null, 2) + '\n'
  console.log(`\n${card.matched} of ${card.scored} scored tests match NASA (${card.matchedTests.join(', ')}); ${card.presets} presets; ${Math.round((Date.now() - t0) / 1000)} s`)
  if (check) {
    const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : ''
    if (old !== text) {
      console.log(`DIFFERENT from ${path.relative(process.cwd(), OUT)}: rerun without --check to rewrite it.`)
      process.exitCode = 1
    } else console.log(`Same as ${path.relative(process.cwd(), OUT)}.`)
    return
  }
  fs.writeFileSync(OUT, text)
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}.`)
}

try {
  await main()
  process.exit(process.exitCode ?? 0)
} catch (e) {
  console.error(`\n${(e as Error).message}`)
  process.exit(1)
}
