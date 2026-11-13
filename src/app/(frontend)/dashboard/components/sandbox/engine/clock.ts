// clock.ts - the sandbox's fixed timestep. The simulation advances at
// STEPS_PER_SECOND steps per second of real time, times the speed setting,
// whatever the screen's refresh rate: a 60 Hz and a 144 Hz screen run the
// same number of steps per second. No DOM; tested in
// tests/int/sandbox-clock.spec.ts.

/** At 1x one step is 1/60 s of real time, as in the desktop game and the flame-core demo. */
export const STEPS_PER_SECOND = 60;
/** At most this many steps in one frame; more would freeze the page. */
export const MAX_STEPS_PER_FRAME = 16;
/** A longer gap between frames (a hidden tab) counts as this long. */
export const MAX_FRAME_GAP_S = 0.25;

export class StepClock {
  private last: number | null = null;
  private owed = 0;
  /** True when the last frame owed more steps than it may run (slower than real time). */
  behind = false;

  constructor(readonly rate = STEPS_PER_SECOND, readonly maxPerFrame = MAX_STEPS_PER_FRAME) {}

  /** Forget past time: call when play starts, so time spent paused isn't caught up. */
  reset(): void {
    this.last = null;
    this.owed = 0;
    this.behind = false;
  }

  /**
   * The steps to run now (time `nowMs`, in ms) at `speed`, never more than
   * `limit` (the steps left in a preset's timeline). The first call after a
   * reset only starts the clock.
   */
  advance(nowMs: number, speed: number, limit = Infinity): number {
    if (this.last === null) {
      this.last = nowMs;
      return 0;
    }
    const dt = Math.min(MAX_FRAME_GAP_S, Math.max(0, (nowMs - this.last) / 1000));
    this.last = nowMs;
    this.owed += dt * this.rate * speed;
    let n = Math.floor(this.owed + 1e-9); // 1e-9: 60 frames of 1/60 s are 60 steps, not 59
    this.owed = Math.max(0, this.owed - n);
    this.behind = n > this.maxPerFrame;
    if (this.behind) {
      n = this.maxPerFrame; // the page can't keep up: drop the backlog instead of piling it up
      this.owed = 0;
    }
    return Math.max(0, Math.min(n, limit));
  }
}
