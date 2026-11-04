// scoring.ts - does our outcome match NASA's? The rule of flame-core's
// validation scorecard (flame-core README, "How a match is scored"; the same
// table as flame-core/demo/js/scoring.js), fixed before any preset was run.

import { NASA, OUTCOME } from './Engine';

// NASA code -> the outcomes of ours that count as a match.
const MATCHES: Record<number, number[]> = {
  [NASA.WENT_OUT_LOW_FLOW]: [OUTCOME.OUT_LOW_FLOW],
  [NASA.BLOWOFF]: [OUTCOME.BLOWN_OFF],
  [NASA.NO_IGNITION]: [OUTCOME.NO_LASTING_FLAME],
  [NASA.NOT_SUSTAINED]: [OUTCOME.NO_LASTING_FLAME, OUTCOME.OUT_STEADY_FLOW],
};

export type Verdict = 'match' | 'no match' | 'pending' | 'not scored';

/**
 * 'not scored' where NASA states nothing; 'pending' while the fire is still
 * burning and the run isn't over (it may yet go out); otherwise match / no match.
 */
export function matchVerdict(nasaCode: number, outcomeCode: number, finished: boolean): Verdict {
  const accepted = MATCHES[nasaCode];
  if (!accepted) return 'not scored';
  if (outcomeCode === OUTCOME.NONE) return 'pending';
  if (outcomeCode === OUTCOME.BURNING && !finished) return 'pending';
  return accepted.includes(outcomeCode) ? 'match' : 'no match';
}
