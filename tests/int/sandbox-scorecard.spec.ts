/**
 * The sandbox's precomputed scorecard (sandbox/scorecard.json, written by
 * src/scripts/sandbox-scorecard.ts) against the engine project's own
 * scorecard (data/bass2_all_outcomes.csv, copied unchanged from
 * nasa-project/exports) and against the engine file it was made with.
 * See data/README-bass2-scorecard.md.
 */
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'
import card from '@/app/(frontend)/dashboard/components/sandbox/scorecard.json'
import { matchVerdict } from '@/app/(frontend)/dashboard/components/sandbox/engine/scoring'

type StudyRow = { test_id: string; fidelity: string; nasa_outcome: string; sim_outcome: string; match: string }

const ROOT = process.cwd()
const study = Papa.parse(fs.readFileSync(path.join(ROOT, 'data', 'bass2_all_outcomes.csv'), 'utf8'), {
  header: true,
  skipEmptyLines: true,
}).data as StudyRow[]
const scored = study.filter((r) => r.match === 'yes' || r.match === 'no')

describe('sandbox scorecard', () => {
  it('was made with the engine file the sandbox loads', () => {
    const wasm = path.join(ROOT, 'src', 'app', '(frontend)', 'dashboard', 'components', 'sandbox', 'engine', 'flame_core.wasm')
    const sha = crypto.createHash('sha256').update(fs.readFileSync(wasm)).digest('hex')
    expect(card.engine.sha256, 'engine changed: rerun src/scripts/sandbox-scorecard.ts').toBe(sha)
  })

  it('has the same 129 preset test ids as the study scorecard', () => {
    expect(study).toHaveLength(129)
    expect(card.presets).toBe(129)
    expect([...card.presetTestIds].sort()).toEqual(study.map((r) => r.test_id).sort())
  })

  it('scores the same tests as the study scorecard, with the same outcomes and match results', () => {
    expect(card.scored).toBe(scored.length)
    expect(card.tests.map((t) => t.testId).sort()).toEqual(scored.map((r) => r.test_id).sort())
    for (const r of scored) {
      const t = card.tests.find((x) => x.testId === r.test_id)!
      expect(t.outcome, r.test_id).toBe(r.sim_outcome)
      expect(t.verdict, r.test_id).toBe(r.match === 'yes' ? 'match' : 'no match')
    }
  })

  it('counts 4 of 26, as the study scorecard does', () => {
    const yes = scored.filter((r) => r.match === 'yes').map((r) => r.test_id)
    expect(card.matched).toBe(yes.length)
    expect([...card.matchedTests].sort()).toEqual([...yes].sort())
    expect(`${card.matched} of ${card.scored}`).toBe('4 of 26')
  })

  it("gives each test the verdict the sandbox's rule gives its stored outcome", () => {
    for (const t of card.tests) {
      expect(t.verdict, t.testId).toBe(matchVerdict(t.nasaCode, t.outcomeCode, true))
      expect(t.outcomeStep, t.testId).toBeLessThanOrEqual(t.runSteps)
    }
  })
})
