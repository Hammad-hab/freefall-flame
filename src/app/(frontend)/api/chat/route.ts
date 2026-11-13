// src/app/api/chat/route.ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { AI_MODEL } from '@/lib/ai-guard'
import psiCatalogue from '@/app/(frontend)/dashboard/components/investigations/psi.json'
import scorecard from '@/app/(frontend)/dashboard/components/sandbox/scorecard.json'
import {
  rank,
  DEFAULT_WEIGHTS,
  type PsiCatalogue,
  type PsiInvestigation,
} from '@/lib/psi'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

// The PSI catalogue is static, checked-in data, so compute the habitat-relevance
// ranking once at module load rather than on every chat request.
const catalogue = psiCatalogue as PsiCatalogue
const ranked = rank(
  catalogue.investigations.map((i) => ({ id: i.id, name: i.name, scores: i.scores })),
  DEFAULT_WEIGHTS,
)
const rankById = new Map((ranked ?? []).map((r) => [r.id, r]))
const investigationIds = catalogue.investigations.map((i) => i.id)

// Scorecard: static, checked-in record of every BASS-II preset the sandbox can
// load, with NASA's stated outcome and the sandbox's precomputed verdict.
const scorecardTests = new Map(
  (scorecard as { tests: { testId: string; nasaOutcome: string; verdict: string; runSteps: number }[] }).tests.map(
    (t) => [t.testId, t],
  ),
)
const presetTestIds = (scorecard as { presetTestIds: string[] }).presetTestIds
const VALID_VIEWS = ['material', 'temperature', 'oxygen', 'flow', 'co2', 'co', 'camera'] as const
type SandboxView = (typeof VALID_VIEWS)[number]

function toSummary(inv: PsiInvestigation) {
  const r = rankById.get(inv.id)
  return {
    id: inv.id,
    name: inv.name,
    psiId: inv.psiId,
    tests: inv.tests,
    safetyTheme: inv.safetyTheme,
    score: r?.score ?? null,
    rank: r?.rank ?? null,
  }
}

function toDetail(inv: PsiInvestigation) {
  const r = rankById.get(inv.id)
  return {
    id: inv.id,
    name: inv.name,
    psiId: inv.psiId,
    fuelPhase: inv.fuelPhase,
    hardware: inv.hardware,
    tests: inv.tests,
    granularity: inv.granularity,
    rows: inv.rows,
    flaggedRows: inv.flaggedRows,
    fuels: inv.fuels,
    o2Pct: inv.o2Pct,
    pressure: inv.pressure,
    flowCmS: inv.flowCmS,
    outcomeRecorded: inv.outcomeRecorded,
    safetyTheme: inv.safetyTheme,
    simulation: inv.simulation,
    facts: inv.facts,
    sources: inv.sources,
    scores: inv.scores,
    score: r?.score ?? null,
    rank: r?.rank ?? null,
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json()
  const result = streamText({
    model: openrouter.chat(AI_MODEL),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5), // lets the model call a tool, then continue
    system: SYSTEM_PROMPT,
    tools: {
      listInvestigations: tool({
        description:
          "List NASA's 14 PSI combustion investigations with their habitat-relevance score and rank. Use this first when the user asks about investigations in general or wants to know which ones exist.",
        inputSchema: z.object({}),
        execute: async () => ({
          investigations: catalogue.investigations.map(toSummary),
        }),
      }),
      getInvestigation: tool({
        description:
          "Fetch one investigation by its id (e.g. \"bass-ii\", \"saffire\"). Returns its full record: fuels, oxygen/pressure/flow ranges, stated outcomes, simulation status, computed facts, sources, and per-criterion habitat-relevance scores. Use this when the user asks about a specific investigation.",
        inputSchema: z.object({
          id: z
            .string()
            .describe(`One of: ${investigationIds.join(', ')}`),
        }),
        execute: async ({ id }) => {
          const inv = catalogue.investigations.find((i) => i.id === id)
          if (!inv) {
            return {
              error: `No investigation with id "${id}". Available ids: ${investigationIds.join(', ')}`,
            }
          }
          return toDetail(inv)
        },
      }),
      openSandbox: tool({
        description:
          "Offer to show a 2D sandbox simulation for a BASS-II test. Use this when the user asks to see, run, or visualise a test (e.g. \"show me B14\", \"what does B14 look like\"). Only BASS-II tests that the sandbox can load are valid. Pick the view most relevant to the conversation: temperature (burning sample), oxygen (O2-limited burning), flow (ventilation), co/co2 (gas readings), material (fuel layout), camera (visual appearance).",
        inputSchema: z.object({
          testId: z
            .string()
            .describe(`One of: ${presetTestIds.join(', ')}`),
          view: z
            .enum(VALID_VIEWS)
            .optional()
            .describe('Most relevant view for the conversation; defaults to temperature'),
        }),
        execute: async ({ testId, view }) => {
          if (!presetTestIds.includes(testId)) {
            return {
              error: `No sandbox preset for "${testId}". Available test ids: ${presetTestIds.join(', ')}`,
            }
          }
          const rec = scorecardTests.get(testId)
          const v = (view ?? 'temperature') as SandboxView
          return {
            testId,
            view: v,
            href: `/dashboard?tab=sandbox&preset=${encodeURIComponent(testId)}&view=${v}`,
            nasaOutcome: rec?.nasaOutcome ?? null,
            verdict: rec?.verdict ?? null,
            runSteps: rec?.runSteps ?? null,
          }
        },
      }),
    },
  })
  return result.toUIMessageStreamResponse()
}
