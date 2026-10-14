import { FORK_BOTTOM, FORK_TOP, LONG_BOTTOM, LONG_TOP, MERGE_BOTTOM, MERGE_TOP, SPACES } from '../../map'

/** Geometry for the park world: smooth curves through points, the route ribbons, the coast. */

export type Pt = [number, number]

/** A smooth SVG path through points (Catmull-Rom as cubic Beziers). `closed` loops it. */
export function smooth(pts: Pt[], closed = false, tension = 1): string {
  const n = pts.length
  if (n < 2) return ''
  const at = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  const f = (v: number) => Math.round(v * 10) / 10
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension]
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? `${d} Z` : d
}

const xy = (id: number): Pt => [SPACES[id].x, SPACES[id].y]

/** The main loop ribbon (spaces 0..39, closed). */
export const LOOP_D = smooth(Array.from({ length: 40 }, (_, i) => xy(i)), true)

/** An open lane from a fork to its merge, through the long-way spaces. */
function laneD(fork: number, lane: number[], merge: number): string {
  const pts = [xy(fork), ...lane.map(xy), xy(merge)]
  return smooth(pts)
}
export const SWAMP_D = laneD(FORK_TOP, LONG_TOP, MERGE_TOP)
export const PIER_D = laneD(FORK_BOTTOM, LONG_BOTTOM, MERGE_BOTTOM)

/** The island coastline (closed). The pier sticks out past it on the right. */
export const COAST: Pt[] = [
  [800, 1068], [640, 1074], [470, 1056], [330, 1020], [190, 985], [92, 910], [56, 790], [66, 660], [112, 560],
  [160, 450], [214, 330], [306, 215], [430, 140], [580, 108], [720, 122], [820, 150], [930, 124], [1080, 108],
  [1215, 128], [1290, 165], [1335, 240], [1352, 330], [1356, 430], [1362, 530], [1385, 640], [1404, 745],
  [1378, 862], [1312, 952], [1222, 1012], [1110, 1056], [975, 1070],
]
export const COAST_D = smooth(COAST, true)

/** Palm Beach: the wide sand in the bottom right. */
export const BEACH_D = smooth([[1000, 1066], [1130, 1010], [1240, 940], [1310, 850], [1360, 730], [1385, 640], [1412, 760], [1385, 870], [1318, 960], [1225, 1022], [1110, 1066]], true)

/** Gator Swamp: murky water in the bottom left. */
export const SWAMP_POOLS: { d: string }[] = [
  { d: smooth([[96, 720], [138, 640], [196, 650], [206, 726], [232, 806], [290, 852], [336, 920], [300, 968], [210, 960], [128, 912], [96, 820]], true) },
  { d: smooth([[300, 1000], [372, 985], [420, 1012], [370, 1040], [300, 1032]], true) },
]

/** The lagoon in the middle of the park. */
export const LAGOON_D = smooth([[730, 590], [800, 545], [900, 556], [950, 610], [930, 690], [850, 720], [760, 705], [716, 650]], true)

/** Coaster Hill: a raised green mound top left. */
export const HILL_D = smooth([[380, 560], [460, 470], [600, 450], [720, 500], [760, 600], [680, 660], [500, 668], [400, 630]], true)

/** The Gift Shop plaza: paved, round, top middle (inside the path's dip). */
export const PLAZA = { x: 772, y: 205, rx: 150, ry: 62 }

/** The Front Gate plaza at the bottom (space 0 sits in front of the arch). */
export const GATE = { x: 800, y: 990 }

/** A point a fraction of the way from space a to space b. */
export function between(a: number, b: number, t: number): Pt {
  return [SPACES[a].x + (SPACES[b].x - SPACES[a].x) * t, SPACES[a].y + (SPACES[b].y - SPACES[a].y) * t]
}

/** Scenic names for the lanes, shown on the signposts under the rule label. */
export const LANE_PLACE: Record<number, [string, string]> = {
  [FORK_TOP]: ['Swamp walk', 'Hug the fence'],
  [FORK_BOTTOM]: ['The pier', 'Boardwalk'],
}

/** Bounds of everything that matters (for the wide camera and the mini map). */
export const BOUNDS = { x0: 50, y0: 95, x1: 1500, y1: 1085 }
