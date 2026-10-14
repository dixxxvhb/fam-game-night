/**
 * The board: Party Park, a 40-space loop that winds round an island (1600 x 1100 world
 * units, y grows toward the camera), with two forks. Each fork has a long way (5 spaces,
 * mostly blue, scenic) and a short cut (3 spaces on the main path, mostly red).
 * Clockwise from the Front Gate (space 0, bottom middle): Gator Swamp (the first fork's
 * long way is the swamp boardwalk), Coaster Hill, the Gift Shop plaza, the Boardwalk (the
 * second fork's long way runs out on the pier over the water), Palm Beach, back to the gate.
 * Static data, never in state. Only the coordinates are art; the graph is the rules.
 */

export type SpaceKind = 'blue' | 'red' | 'event' | 'shop' | 'duel' | 'lucky'

export interface Space {
  id: number
  x: number
  y: number
  kind: SpaceKind
  next: number[]
  /** Fork nodes only: labels for next[0] and next[1]. */
  lanes?: [string, string]
}

/** The world box every coordinate lives in. */
export const WORLD_W = 1600
export const WORLD_H = 1100
/** Kept for older callers: the board's drawing box is the world box. */
export const VIEW_W = WORLD_W
export const VIEW_H = WORLD_H
export const SPACE_R = 27

/** Kinds of the 40 loop spaces, clockwise from the Front Gate. */
const LOOP: SpaceKind[] = [
  'blue', 'blue', 'event', 'blue', 'red', 'shop', 'blue', 'red', 'event', 'red',
  'blue', 'duel', 'blue', 'event', 'blue', 'red', 'blue', 'lucky', 'blue', 'red',
  'blue', 'event', 'blue', 'shop', 'red', 'blue', 'blue', 'red', 'duel', 'red',
  'blue', 'event', 'blue', 'red', 'blue', 'lucky', 'blue', 'event', 'blue', 'red',
]
const LANE_TOP: SpaceKind[] = ['blue', 'lucky', 'blue', 'shop', 'blue']
const LANE_BOTTOM: SpaceKind[] = ['blue', 'event', 'blue', 'lucky', 'blue']

/** Fork nodes and where their lanes rejoin. (Names are from the old rectangle board.) */
export const FORK_TOP = 6
export const MERGE_TOP = 10
export const FORK_BOTTOM = 26
export const MERGE_BOTTOM = 30
export const LONG_TOP = [40, 41, 42, 43, 44]
export const LONG_BOTTOM = [45, 46, 47, 48, 49]

/** Loop space centers: a closed spline through the park, sampled evenly by arc length. */
const LOOP_XY: [number, number][] = [
  [800, 990], [723, 999], [646, 997], [570, 982], [496, 957], [428, 921], [364, 878], [307, 826], [262, 764], [235, 691],
  [230, 614], [247, 539], [283, 471], [334, 413], [383, 353], [429, 291], [490, 243], [562, 216], [637, 225], [705, 262],
  [777, 288], [854, 281], [924, 248], [993, 214], [1069, 205], [1145, 223], [1212, 260], [1266, 314], [1303, 382], [1325, 456],
  [1330, 533], [1321, 610], [1299, 683], [1261, 752], [1211, 811], [1149, 856], [1085, 899], [1023, 945], [953, 977], [877, 990],
]
/** The swamp boardwalk (long way from the first fork). */
const SWAMP_XY: [number, number][] = [[291, 905], [216, 880], [165, 821], [149, 743], [173, 668]]
/** The pier over the water (long way from the second fork). */
const PIER_XY: [number, number][] = [[1295, 224], [1383, 245], [1439, 315], [1447, 405], [1408, 487]]

function build(): Space[] {
  const spaces: Space[] = LOOP.map((kind, i) => ({ id: i, x: LOOP_XY[i][0], y: LOOP_XY[i][1], kind, next: [(i + 1) % LOOP.length] }))
  SWAMP_XY.forEach(([x, y], j) => spaces.push({ id: LONG_TOP[j], x, y, kind: LANE_TOP[j], next: [j < 4 ? LONG_TOP[j + 1] : MERGE_TOP] }))
  PIER_XY.forEach(([x, y], j) => spaces.push({ id: LONG_BOTTOM[j], x, y, kind: LANE_BOTTOM[j], next: [j < 4 ? LONG_BOTTOM[j + 1] : MERGE_BOTTOM] }))
  spaces[FORK_TOP] = { ...spaces[FORK_TOP], next: [LONG_TOP[0], FORK_TOP + 1], lanes: ['Long way', 'Short cut'] }
  spaces[FORK_BOTTOM] = { ...spaces[FORK_BOTTOM], next: [LONG_BOTTOM[0], FORK_BOTTOM + 1], lanes: ['Long way', 'Short cut'] }
  return spaces
}

export const SPACES: Space[] = build()
export const START = 0

/** What each lane holds, for the fork choice on the phone. */
export function laneSummary(from: number, first: number): { label: string; spaces: SpaceKind[] } {
  const sp = SPACES[from]
  const idx = sp.next.indexOf(first)
  const label = sp.lanes?.[idx] ?? 'This way'
  const kinds: SpaceKind[] = []
  let cur = first
  for (let guard = 0; guard < 8; guard++) {
    if (cur === MERGE_TOP || cur === MERGE_BOTTOM) break
    kinds.push(SPACES[cur].kind)
    cur = SPACES[cur].next[0]
  }
  return { label, spaces: kinds }
}

// ---------------- distances ----------------

/** dist[a][b]: fewest forward steps from a to b. */
export const DIST: number[][] = SPACES.map((s) => {
  const d = Array(SPACES.length).fill(Infinity) as number[]
  d[s.id] = 0
  const q = [s.id]
  while (q.length) {
    const cur = q.shift()!
    for (const n of SPACES[cur].next) {
      if (d[n] === Infinity) { d[n] = d[cur] + 1; q.push(n) }
    }
  }
  return d
})

/** Shortest forward path from a to b, excluding a, including b. */
export function pathTo(a: number, b: number): number[] {
  if (a === b) return []
  const out: number[] = []
  let cur = a
  for (let guard = 0; guard < SPACES.length + 2 && cur !== b; guard++) {
    const nexts = SPACES[cur].next
    cur = nexts.reduce((best, n) => (DIST[n][b] < DIST[best][b] ? n : best), nexts[0])
    out.push(cur)
  }
  return out
}

export interface Plan {
  path: number[]
  left: number
  stop: 'end' | 'fork' | 'star'
}

/**
 * Walk up to `steps` spaces from `from`. Stops early at a fork that needs a choice
 * (unless `choice` is a valid next space) or on the Star when `starStop` is true.
 */
export function planPath(from: number, steps: number, choice: number | null, star: number, starStop: boolean): Plan {
  const path: number[] = []
  let pos = from
  let left = steps
  let pick = choice
  while (left > 0) {
    const nexts = SPACES[pos].next
    let nxt: number
    if (nexts.length > 1) {
      if (pick === null || !nexts.includes(pick)) return { path, left, stop: 'fork' }
      nxt = pick
      pick = null
    } else {
      nxt = nexts[0]
    }
    pos = nxt
    path.push(pos)
    left -= 1
    if (starStop && pos === star) return { path, left, stop: 'star' }
  }
  return { path, left: 0, stop: 'end' }
}

/** Spaces exactly `d` steps before `target` (falls back to closer ones). */
export function spacesBefore(target: number, d: number): number[] {
  for (let k = d; k >= 1; k--) {
    const list = SPACES.filter((s) => s.id !== target && DIST[s.id][target] === k).map((s) => s.id)
    if (list.length) return list
  }
  return [START]
}

/** Blue spaces at least `min` steps away from `from` in both directions. */
export function farBlue(from: number, min: number, avoid: number[] = []): number[] {
  return SPACES.filter((s) => s.kind === 'blue' && !avoid.includes(s.id) && DIST[from][s.id] >= min && DIST[s.id][from] >= min).map((s) => s.id)
}
