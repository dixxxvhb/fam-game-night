/** How long the truth needle takes to land; results pop in right after. */
export const SWEEP_MS = 2200
export const RESULTS_AT = SWEEP_MS + 300
/** The redaction bar over the truth tears away when the needle settles. */
export const TEAR_AT = SWEEP_MS - 150

/** Ease-out sweep for the truth needle, 0..1. */
export function sweep(elapsedMs: number, durationMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs))
  return 1 - Math.pow(1 - t, 3)
}

/**
 * An analog meter needle waking up: a damped spring from 0 to 1 that overshoots once
 * (about 16%) and wobbles to rest. Exactly 0 at the start and exactly 1 from durationMs on.
 */
export function swing(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return 1
  if (elapsedMs <= 0) return 0
  const t = elapsedMs / durationMs
  const decay = 7
  const freq = 12
  const x = 1 - Math.exp(-decay * t) * (Math.cos(freq * t) + (decay / freq) * Math.sin(freq * t))
  // Blend the last 10% into exactly 1 so the needle never ticks when it snaps.
  const tail = Math.max(0, (t - 0.9) / 0.1)
  return x * (1 - tail) + tail
}

/** Where the needle reads during a swing from `from` to `to`, kept on the 0..100 dial (the pegs stop it). */
export function needleAt(from: number, to: number, elapsedMs: number, durationMs: number): number {
  const v = from + (to - from) * swing(elapsedMs, durationMs)
  return Math.max(0, Math.min(100, v))
}

/** Characters of a briefing typed so far: a typewriter at `msPerChar`. */
export function typed(text: string, elapsedMs: number, msPerChar = 22): string {
  if (elapsedMs <= 0) return ''
  return text.slice(0, Math.floor(elapsedMs / msPerChar))
}
