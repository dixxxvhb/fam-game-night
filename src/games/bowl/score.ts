/**
 * Ten-pin scoring. A player's game is a flat list of pins knocked per ball, the way a
 * paper score sheet reads. The last frame (frame 5 or 10) gets up to three balls.
 */

export const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export interface FrameCell {
  /** Ball marks: 'X', '/', '-', '1'..'9'. Two boxes, three in the last frame. */
  marks: string[]
  /** Indexes into the roll list for each mark (for split rings). */
  idx: number[]
  /** Running total once the frame (and its bonus) is settled, else null. */
  total: number | null
}

const digit = (n: number) => (n === 0 ? '-' : String(n))

/** Frame-by-frame card plus the settled total and the live total (counting bonus balls seen so far). */
export function scoreCard(rolls: number[], frames: number): { cells: FrameCell[]; total: number; live: number } {
  const cells: FrameCell[] = []
  let i = 0
  let run = 0
  let live = 0
  let settled = true
  for (let f = 0; f < frames; f++) {
    const last = f === frames - 1
    const a = rolls[i]
    if (a === undefined) {
      cells.push({ marks: [], idx: [], total: null })
      continue
    }
    if (!last) {
      if (a === 10) {
        const b = rolls[i + 1]
        const c = rolls[i + 2]
        const ok = b !== undefined && c !== undefined
        const val = 10 + (b ?? 0) + (c ?? 0)
        live += val
        if (ok && settled) run += val
        else settled = false
        cells.push({ marks: ['', 'X'], idx: [-1, i], total: settled ? run : null })
        i += 1
        continue
      }
      const b = rolls[i + 1]
      if (b === undefined) {
        live += a
        settled = false
        cells.push({ marks: [digit(a)], idx: [i], total: null })
        i += 1
        continue
      }
      if (a + b === 10) {
        const c = rolls[i + 2]
        const val = 10 + (c ?? 0)
        live += val
        if (c !== undefined && settled) run += val
        else settled = false
        cells.push({ marks: [digit(a), '/'], idx: [i, i + 1], total: settled ? run : null })
      } else {
        live += a + b
        if (settled) run += a + b
        cells.push({ marks: [digit(a), digit(b)], idx: [i, i + 1], total: settled ? run : null })
      }
      i += 2
      continue
    }
    // Last frame: up to three balls.
    const b = rolls[i + 1]
    const c = rolls[i + 2]
    const marks = [a === 10 ? 'X' : digit(a)]
    const idx = [i]
    if (b !== undefined) {
      marks.push(a === 10 ? (b === 10 ? 'X' : digit(b)) : a + b === 10 ? '/' : digit(b))
      idx.push(i + 1)
    }
    const bonus = b !== undefined && (a === 10 || a + b === 10)
    if (bonus && c !== undefined) {
      const freshForC = a === 10 ? b === 10 : true
      marks.push(freshForC ? (c === 10 ? 'X' : digit(c)) : b! + c === 10 ? '/' : digit(c))
      idx.push(i + 2)
    }
    const sum = a + (b ?? 0) + (bonus ? (c ?? 0) : 0)
    live += sum
    const done = b !== undefined && (!bonus || c !== undefined)
    if (done && settled) run += sum
    else settled = false
    cells.push({ marks, idx, total: done && settled ? run : null })
  }
  return { cells, total: run, live }
}

/** Where a player's next ball goes. frame === frames means their game is over. fresh = a full rack. */
export function position(rolls: number[], frames: number): { frame: number; ball: number; fresh: boolean } {
  let i = 0
  for (let f = 0; f < frames - 1; f++) {
    const a = rolls[i]
    if (a === undefined) return { frame: f, ball: 0, fresh: true }
    if (a === 10) { i += 1; continue }
    if (rolls[i + 1] === undefined) return { frame: f, ball: 1, fresh: false }
    i += 2
  }
  const last = frames - 1
  const a = rolls[i]
  const b = rolls[i + 1]
  const c = rolls[i + 2]
  if (a === undefined) return { frame: last, ball: 0, fresh: true }
  if (b === undefined) return { frame: last, ball: 1, fresh: a === 10 }
  if (a === 10 || a + b === 10) {
    if (c === undefined) return { frame: last, ball: 2, fresh: a === 10 ? b === 10 : true }
  }
  return { frame: frames, ball: 0, fresh: true }
}

/** Highest possible score for a game of this length (all strikes). */
export function perfectScore(frames: number) {
  return frames * 30
}

/** Pin spots in inches: x across the lane (0 = middle, + = right), y down the lane from the head pin. */
const ROW = 12 * Math.sin(Math.PI / 3)
export const PIN_SPOT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -6, y: ROW },
  3: { x: 6, y: ROW },
  4: { x: -12, y: ROW * 2 },
  5: { x: 0, y: ROW * 2 },
  6: { x: 12, y: ROW * 2 },
  7: { x: -18, y: ROW * 3 },
  8: { x: -6, y: ROW * 3 },
  9: { x: 6, y: ROW * 3 },
  10: { x: 18, y: ROW * 3 },
}

/**
 * A split: the head pin is down and the pins left standing fall into two or more groups
 * that don't touch (neighbors 12 inches apart, or one straight behind the other).
 */
export function isSplit(left: number[]): boolean {
  if (left.length < 2 || left.includes(1)) return false
  const touch = (a: number, b: number) => {
    const p = PIN_SPOT[a]
    const q = PIN_SPOT[b]
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    return d < 12.5 || (Math.abs(p.x - q.x) < 0.5 && d < 21)
  }
  const seen = new Set([left[0]])
  const queue = [left[0]]
  while (queue.length) {
    const a = queue.pop()!
    for (const b of left) if (!seen.has(b) && touch(a, b)) { seen.add(b); queue.push(b) }
  }
  return seen.size < left.length
}

/** Name for what was left, e.g. "7-10". */
export function leaveName(left: number[]): string {
  return [...left].sort((a, b) => a - b).join('-')
}
