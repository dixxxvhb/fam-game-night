/** How long the truth needle takes to land; results pop in right after. */
export const SWEEP_MS = 2200
export const RESULTS_AT = SWEEP_MS + 300

/** Ease-out sweep for the truth needle, 0..1. */
export function sweep(elapsedMs: number, durationMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs))
  return 1 - Math.pow(1 - t, 3)
}
