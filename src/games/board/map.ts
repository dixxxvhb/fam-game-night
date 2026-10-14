/**
 * The board: a 40-space loop drawn clockwise in a 1240 x 560 box, with two forks.
 * Each fork has a long way (5 spaces, mostly blue, bulging out) and a short cut
 * (3 spaces on the edge, mostly red). Static data, never in state.
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

export const VIEW_W = 1240
export const VIEW_H = 560
export const SPACE_R = 24

const LEFT = 70
const RIGHT = 1170
const TOP = 125
const BOTTOM = 435
const EDGE_STEP = (RIGHT - LEFT) / 16
const SIDE_STEP = (BOTTOM - TOP) / 4

/** Kinds of the 40 loop spaces, clockwise from the top-left corner. */
const LOOP: SpaceKind[] = [
  'blue', 'blue', 'event', 'blue', 'red', 'shop', 'blue', 'red', 'event', 'red',
  'blue', 'duel', 'blue', 'event', 'blue', 'red', 'blue', 'lucky', 'blue', 'red',
  'blue', 'event', 'blue', 'shop', 'red', 'blue', 'blue', 'red', 'duel', 'red',
  'blue', 'event', 'blue', 'red', 'blue', 'lucky', 'blue', 'event', 'blue', 'red',
]
const LANE_TOP: SpaceKind[] = ['blue', 'lucky', 'blue', 'shop', 'blue']
const LANE_BOTTOM: SpaceKind[] = ['blue', 'event', 'blue', 'lucky', 'blue']

/** Fork nodes and where their lanes rejoin. */
export const FORK_TOP = 6
export const MERGE_TOP = 10
export const FORK_BOTTOM = 26
export const MERGE_BOTTOM = 30
export const LONG_TOP = [40, 41, 42, 43, 44]
export const LONG_BOTTOM = [45, 46, 47, 48, 49]

function loopXY(i: number): [number, number] {
  if (i <= 16) return [LEFT + i * EDGE_STEP, TOP]
  if (i <= 19) return [RIGHT, TOP + (i - 16) * SIDE_STEP]
  if (i <= 36) return [RIGHT - (i - 20) * EDGE_STEP, BOTTOM]
  return [LEFT, BOTTOM - (i - 36) * SIDE_STEP]
}

/** n points spread evenly by arc length along a half ellipse from a to b, bulging by `bulge` (negative = up). */
function arc(ax: number, bx: number, y: number, bulge: number, n: number): [number, number][] {
  const cx = (ax + bx) / 2
  const rx = (bx - ax) / 2
  const pts: [number, number][] = []
  const N = 400
  for (let k = 0; k <= N; k++) {
    const t = Math.PI - (Math.PI * k) / N
    pts.push([cx + rx * Math.cos(t), y + bulge * Math.sin(t)])
  }
  const acc = [0]
  for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
  const total = acc[acc.length - 1]
  const out: [number, number][] = []
  for (let j = 1; j <= n; j++) {
    const want = (total * j) / (n + 1)
    const k = acc.findIndex((a) => a >= want)
    out.push([Math.round(pts[k][0] * 10) / 10, Math.round(pts[k][1] * 10) / 10])
  }
  return out
}

function build(): Space[] {
  const spaces: Space[] = LOOP.map((kind, i) => {
    const [x, y] = loopXY(i)
    return { id: i, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind, next: [(i + 1) % LOOP.length] }
  })
  const top = arc(loopXY(FORK_TOP)[0], loopXY(MERGE_TOP)[0], TOP, -92, 5)
  top.forEach(([x, y], j) => spaces.push({ id: LONG_TOP[j], x, y, kind: LANE_TOP[j], next: [j < 4 ? LONG_TOP[j + 1] : MERGE_TOP] }))
  // The bottom edge runs right to left, so its lane runs from the larger x to the smaller.
  const bottom = arc(loopXY(MERGE_BOTTOM)[0], loopXY(FORK_BOTTOM)[0], BOTTOM, 92, 5).reverse()
  bottom.forEach(([x, y], j) => spaces.push({ id: LONG_BOTTOM[j], x, y, kind: LANE_BOTTOM[j], next: [j < 4 ? LONG_BOTTOM[j + 1] : MERGE_BOTTOM] }))
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
