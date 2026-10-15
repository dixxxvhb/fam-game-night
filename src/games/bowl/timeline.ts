/**
 * The roll on screen, as a clock. Every screen plays the host's replay on the host clock, so this
 * mapping is shared by logic (when the roll stage ends) and the views (which sample to draw):
 *
 *   windup (the critter swings the ball back and lets go)
 *   -> the replay at normal speed
 *   -> slow motion from just before the ball meets the pins until the pins are flying
 *   -> normal speed to the end of the replay.
 *
 * Pure: no DOM, no clocks of its own.
 */

/** Wind up and release before the ball leaves the hand, ms. */
export const WINDUP_MS = 760
/** Slow motion window, in replay samples around the hit. */
export const SLOW_BEFORE = 2
export const SLOW_AFTER = 9
/** Playback rate inside the slow window (0.4 = each sample lasts 2.5x as long). */
export const SLOW_RATE = 0.4

export interface RollClock { n: number; dt: number; hit: number }

function slowWindow(r: RollClock): [number, number] | null {
  if (r.hit < 0) return null
  const a = Math.max(0, r.hit - SLOW_BEFORE)
  const b = Math.min(r.n - 1, r.hit + SLOW_AFTER)
  return b > a ? [a, b] : null
}

/** How long the replay takes on screen (not counting the windup), ms. */
export function replayMs(r: RollClock): number {
  const w = slowWindow(r)
  const base = Math.max(0, r.n - 1) * r.dt
  if (!w) return base
  return base + (w[1] - w[0]) * r.dt * (1 / SLOW_RATE - 1)
}

/** Whole roll on screen: windup plus replay, ms. */
export function rollMs(r: RollClock): number {
  return WINDUP_MS + replayMs(r)
}

/** Replay sample (fractional) at `ms` after the ball left the hand. */
export function sampleAt(r: RollClock, ms: number): number {
  if (ms <= 0) return 0
  const last = Math.max(0, r.n - 1)
  const w = slowWindow(r)
  if (!w) return Math.min(last, ms / r.dt)
  const [a, b] = w
  const tA = a * r.dt
  if (ms <= tA) return ms / r.dt
  const slowLen = (b - a) * r.dt / SLOW_RATE
  if (ms <= tA + slowLen) return a + ((ms - tA) * SLOW_RATE) / r.dt
  return Math.min(last, b + (ms - tA - slowLen) / r.dt)
}

/** Ms after release when sample `f` shows (inverse of sampleAt). */
export function msAt(r: RollClock, f: number): number {
  const w = slowWindow(r)
  if (!w || f <= w[0]) return f * r.dt
  const [a, b] = w
  if (f <= b) return a * r.dt + ((f - a) * r.dt) / SLOW_RATE
  return a * r.dt + ((b - a) * r.dt) / SLOW_RATE + (f - b) * r.dt
}

/** True while the slow motion window is playing at sample f. */
export function inSlowMo(r: RollClock, f: number): boolean {
  const w = slowWindow(r)
  return !!w && f >= w[0] && f <= w[1]
}
