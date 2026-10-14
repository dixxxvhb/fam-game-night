/**
 * Aggro board geometry. Pure data, no React.
 *
 * A cross-shaped loop of 56 holes (4 sides of 14). Each side belongs to one arm of the
 * cross. Positions are plain numbers so state stays tiny JSON:
 *   -1        in base
 *   0..55     the loop (clockwise)
 *   60..63    home column slot 0..3 (63 is the deepest, nearest the center)
 *   99        the center hole
 *
 * Side k (arm k), local holes L0..L13, drawn for the top arm then rotated 90 degrees clockwise per arm:
 *   L0        inner corner: the star
 *   L1..L6    up the left edge of the arm
 *   L7        the tip: this arm's home entry (the hole just before start)
 *   L8        start hole
 *   L9..L13   back down the right edge
 */

export const BASE = -1
export const HOME0 = 60
export const CENTER = 99
export const LOOP = 56
export const SIDE = 14
/** Progress index of the last loop hole before home (the arm tip). */
export const ENTRY_PROGRESS = 55
/** The center counts as one hole before your own home star when ranking. */
export const CENTER_PROGRESS = 47
export const STARS = [0, 14, 28, 42]

export const isTrack = (p: number) => Number.isInteger(p) && p >= 0 && p < LOOP
export const isHome = (p: number) => p >= HOME0 && p <= HOME0 + 3
export const isStar = (p: number) => isTrack(p) && p % SIDE === 0
export const startOf = (arm: number) => arm * SIDE + 8
export const entryOf = (arm: number) => arm * SIDE + 7
/** The star just before an arm's home stretch: the last star a marble may hop to. */
export const homeStarOf = (arm: number) => arm * SIDE

/** Steps along the normal route from this arm's start hole. Base -1, home 56..59, center 47. */
export function progressOf(arm: number, pos: number): number {
  if (pos === BASE) return -1
  if (pos === CENTER) return CENTER_PROGRESS
  if (isHome(pos)) return 56 + (pos - HOME0)
  return (pos - startOf(arm) + LOOP) % LOOP
}

/** Holes to go until the first home hole (1 when sitting on the arm tip). */
export function awayFromHome(arm: number, pos: number): number {
  return 56 - progressOf(arm, pos)
}

/** The board position at a given progress for an arm (0..55 loop, 56..59 home). */
export function posAtProgress(arm: number, q: number): number {
  if (q <= ENTRY_PROGRESS) return (startOf(arm) + q) % LOOP
  return HOME0 + (q - 56)
}

// ---------------- drawing coordinates (grid units, center 0,0, y down) ----------------

export type XY = [number, number]

export function rot(p: XY, k: number): XY {
  let [x, y] = p
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) [x, y] = [-y, x]
  return [x + 0, y + 0]
}

const LOCAL_TRACK: XY[] = [
  [-1, -1],
  [-1, -2], [-1, -3], [-1, -4], [-1, -5], [-1, -6], [-1, -7],
  [0, -7],
  [1, -7], [1, -6], [1, -5], [1, -4], [1, -3], [1, -2],
]

/** Base pad for the top arm sits in the quadrant to the right of its start; marbles read 1 2 / 3 4 on every pad. */
const BASE_CENTER: XY = [4.35, -4.35]
const BASE_GAP = 1.2
const BASE_OFFSETS: XY[] = [
  [-BASE_GAP / 2, -BASE_GAP / 2],
  [BASE_GAP / 2, -BASE_GAP / 2],
  [-BASE_GAP / 2, BASE_GAP / 2],
  [BASE_GAP / 2, BASE_GAP / 2],
]

export const trackXY = (i: number): XY => rot(LOCAL_TRACK[i % SIDE], Math.floor(i / SIDE))
export const homeXY = (arm: number, slot: number): XY => rot([0, -6 + slot], arm)
export const baseCenterXY = (arm: number): XY => rot(BASE_CENTER, arm)
export function baseXY(arm: number, m: number): XY {
  const [cx, cy] = baseCenterXY(arm)
  return [cx + BASE_OFFSETS[m][0], cy + BASE_OFFSETS[m][1]]
}

/** Where a marble sits. Base marbles keep their own base hole (marble m in hole m). */
export function posXY(pos: number, arm: number, m: number): XY {
  if (pos === BASE) return baseXY(arm, m)
  if (pos === CENTER) return [0, 0]
  if (isHome(pos)) return homeXY(arm, pos - HOME0)
  return trackXY(pos)
}

/** Seats sit on arms spread around the board: 2 players face each other. */
export function armsFor(n: number): number[] {
  if (n <= 1) return [0]
  if (n === 2) return [0, 2]
  if (n === 3) return [0, 1, 2]
  return [0, 1, 2, 3]
}
