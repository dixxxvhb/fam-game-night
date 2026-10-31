// One-point perspective for the finale corridor. Pure math, so it is tested.
// Depth d runs from 0 (the near end, where everyone starts) to `exit` (the EXIT door).

export const VIEW = { w: 1000, h: 440, vx: 500, vy: 150, nearY: 420, nearHalf: 480, ceil: 230 } as const

/** How much smaller things get per space down the hall. */
export const SHRINK = 0.14

export function depthScale(d: number, exit = 10): number {
  const k = SHRINK * (10 / exit)
  return 1 / (1 + Math.max(0, d) * k)
}

/** Floor y at depth d. */
export function floorY(d: number, exit = 10): number {
  return VIEW.vy + (VIEW.nearY - VIEW.vy) * depthScale(d, exit)
}

/** Left and right wall x at depth d. */
export function wallX(d: number, exit = 10): [number, number] {
  const half = VIEW.nearHalf * depthScale(d, exit)
  return [VIEW.vx - half, VIEW.vx + half]
}

/** Ceiling y at depth d. */
export function ceilY(d: number, exit = 10): number {
  return VIEW.vy - VIEW.ceil * depthScale(d, exit)
}

/** Lane spread across the hall: -1 (left) to 1 (right). */
export function laneOffset(i: number, n: number): number {
  if (n <= 1) return 0
  return -1 + (2 * i) / (n - 1)
}

/** Where a runner stands: x, y of the feet and their scale. Past the exit they stand in the doorway. */
export function runnerAt(pos: number, lane: number, lanes: number, exit = 10): { x: number; y: number; s: number } {
  const d = Math.max(0, Math.min(exit, pos))
  const s = depthScale(d, exit)
  const spread = Math.min(300, 120 + lanes * 40)
  return { x: VIEW.vx + laneOffset(lane, lanes) * spread * s, y: floorY(d, exit), s }
}
