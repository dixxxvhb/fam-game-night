/**
 * Tracks live in a fixed 1600 x 900 world (the TV shows all of it). Each track is a closed
 * centerline (smoothed, then resampled to even spacing) plus a half width. Everything about
 * "where am I on the track" goes through project(): arc length s along the centerline,
 * signed lateral offset d (+ is right of the direction of travel) and distance.
 *
 * Pure: no DOM, no randomness.
 */

export const WORLD_W = 1600
export const WORLD_H = 900

export type TrackId = 'oval' | 'eight' | 'swamp' | 'night'
export type Theme = TrackId

/** 0 ground, 1 under the bridge, 2 on the bridge. */
export type Level = 0 | 1 | 2

export interface Water { x: number; y: number; rx: number; ry: number }
export interface Gator { x: number; y: number; tx: number; ty: number }

export interface TrackDef {
  id: TrackId
  name: string
  blurb: string
  half: number
  /** Closed loop of points in driving order. The first point is the start line. */
  points: () => [number, number][]
  /** Smooth the points with a Catmull-Rom spline (off for already-dense generators). */
  smooth: boolean
  /** Item box rows, as fractions of the lap. */
  boxes: number[]
  water?: Water[]
  gator?: Gator
  lamps?: [number, number][]
  /** Figure eight: the bridge sits over the second pass through the crossing. */
  crossing?: { x: number; y: number; over: number; under: number }
}

export interface Track extends TrackDef {
  xs: number[]
  ys: number[]
  /** Unit tangents per sample. */
  tx: number[]
  ty: number[]
  level: Level[]
  n: number
  step: number
  L: number
  /** Arc-length ranges [from, to] of the bridge deck and the underpass (empty when none). */
  over: [number, number] | null
  under: [number, number] | null
}

/** Screen corners the TV HUD sits on. Tracks keep clear of them. */
export const HUD_RECTS: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { name: 'positions', x0: 0, y0: 0, x1: 340, y1: 250 },
  { name: 'laps', x0: 1300, y0: 0, x1: 1600, y1: 150 },
  { name: 'feed', x0: 0, y0: 800, x1: 480, y1: 900 },
]

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return out
}

function line(x0: number, y0: number, x1: number, y1: number, n: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])
  return out
}

export const TRACK_DEFS: TrackDef[] = [
  {
    id: 'oval',
    name: 'Oval',
    blurb: 'Two straights, two turns. Learn the drift here.',
    half: 70,
    smooth: false,
    // Clockwise on screen. Start on the bottom straight, heading left.
    points: () => [
      ...line(880, 690, 520, 690, 45),
      ...arc(520, 480, 210, Math.PI / 2, (3 * Math.PI) / 2, 90),
      ...line(520, 270, 1180, 270, 82),
      ...arc(1180, 480, 210, -Math.PI / 2, Math.PI / 2, 90),
      ...line(1180, 690, 880, 690, 37),
    ],
    boxes: [0.3, 0.78],
  },
  {
    id: 'eight',
    name: 'Figure Eight',
    blurb: 'One bridge, one tunnel, zero trust.',
    half: 60,
    smooth: false,
    points: () => {
      const out: [number, number][] = []
      const n = 720
      for (let i = 0; i < n; i++) {
        const t = Math.PI / 2 + (i / n) * Math.PI * 2
        out.push([920 + 520 * Math.sin(t), 490 + 500 * Math.sin(t) * Math.cos(t)])
      }
      return out
    },
    boxes: [0.16, 0.66],
    crossing: { x: 920, y: 490, over: 190, under: 120 },
  },
  {
    id: 'swamp',
    name: 'Swamp',
    blurb: 'Florida. Water slows you down. The gator does worse.',
    half: 60,
    smooth: true,
    points: () => [
      [1000, 730], [800, 735], [620, 725], [480, 675], [405, 560], [430, 430],
      [540, 355], [620, 255], [760, 195], [905, 240], [960, 360], [1060, 440],
      [1180, 390], [1240, 270], [1350, 250], [1440, 340], [1450, 500], [1380, 640],
      [1240, 715],
    ],
    boxes: [0.2, 0.62],
    water: [
      { x: 330, y: 560, rx: 80, ry: 120 },
      { x: 770, y: 330, rx: 85, ry: 55 },
      { x: 1515, y: 470, rx: 70, ry: 120 },
      { x: 1120, y: 600, rx: 110, ry: 60 },
    ],
    gator: { x: 760, y: 600, tx: 790, ty: 735 },
  },
  {
    id: 'night',
    name: 'Night Drive',
    blurb: 'Lights off downtown. Your headlights are the map.',
    half: 60,
    smooth: true,
    points: () => [
      [1000, 725], [760, 725], [520, 720], [430, 640], [430, 480], [500, 400],
      [640, 385], [700, 290], [720, 190], [830, 150], [990, 160], [1070, 240],
      [1070, 370], [1150, 445], [1300, 430], [1410, 500], [1430, 630], [1350, 715],
      [1190, 730],
    ],
    boxes: [0.24, 0.7],
    lamps: [[430, 720], [560, 300], [1090, 150], [1460, 410], [1250, 560], [820, 600]],
  },
]

export const TRACK_IDS = TRACK_DEFS.map((t) => t.id)

/** Centripetal Catmull-Rom through a closed loop of points. */
function catmullRom(pts: [number, number][], per = 16): [number, number][] {
  const out: [number, number][] = []
  const n = pts.length
  const tj = (ti: number, a: [number, number], b: [number, number]) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5)
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const t0 = 0
    const t1 = tj(t0, p0, p1)
    const t2 = tj(t1, p1, p2)
    const t3 = tj(t2, p2, p3)
    for (let k = 0; k < per; k++) {
      const t = t1 + ((t2 - t1) * k) / per
      const lerp = (a: [number, number], b: [number, number], ta: number, tb: number): [number, number] => {
        const w = tb === ta ? 0 : (t - ta) / (tb - ta)
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
      }
      const a1 = lerp(p0, p1, t0, t1)
      const a2 = lerp(p1, p2, t1, t2)
      const a3 = lerp(p2, p3, t2, t3)
      const b1 = lerp(a1, a2, t0, t2)
      const b2 = lerp(a2, a3, t1, t3)
      out.push(lerp(b1, b2, t1, t2))
    }
  }
  return out
}

/** Resample a closed polyline to evenly spaced points (about `spacing` apart). */
function resample(pts: [number, number][], spacing = 8): { xs: number[]; ys: number[]; L: number } {
  const n = pts.length
  const cum = [0]
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const L = cum[n]
  const m = Math.max(16, Math.round(L / spacing))
  const xs: number[] = []
  const ys: number[] = []
  let j = 0
  for (let k = 0; k < m; k++) {
    const s = (k * L) / m
    while (j < n - 1 && cum[j + 1] < s) j++
    const a = pts[j]
    const b = pts[(j + 1) % n]
    const seg = cum[j + 1] - cum[j]
    const w = seg > 0 ? (s - cum[j]) / seg : 0
    xs.push(a[0] + (b[0] - a[0]) * w)
    ys.push(a[1] + (b[1] - a[1]) * w)
  }
  // Exact closed length of the resampled loop.
  let L2 = 0
  for (let k = 0; k < m; k++) L2 += Math.hypot(xs[(k + 1) % m] - xs[k], ys[(k + 1) % m] - ys[k])
  return { xs, ys, L: L2 }
}

export function buildTrack(def: TrackDef): Track {
  const raw = def.points()
  const pts = def.smooth ? catmullRom(raw) : raw
  const { xs, ys, L } = resample(pts)
  const n = xs.length
  const step = L / n
  const tx: number[] = []
  const ty: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n
    const b = (i + 1) % n
    const dx = xs[b] - xs[a]
    const dy = ys[b] - ys[a]
    const len = Math.hypot(dx, dy) || 1
    tx.push(dx / len)
    ty.push(dy / len)
  }
  const level: Level[] = new Array(n).fill(0)
  let over: [number, number] | null = null
  let under: [number, number] | null = null
  if (def.crossing) {
    // The two passes through the crossing: nearest samples, at least a quarter lap apart.
    const c = def.crossing
    const d2 = (i: number) => (xs[i] - c.x) ** 2 + (ys[i] - c.y) ** 2
    let first = 0
    for (let i = 1; i < n; i++) if (d2(i) < d2(first)) first = i
    let second = -1
    for (let i = 0; i < n; i++) {
      const gap = Math.min(Math.abs(i - first), n - Math.abs(i - first))
      if (gap < n / 4) continue
      if (second < 0 || d2(i) < d2(second)) second = i
    }
    // Later pass = bridge. Earlier = underpass.
    const [u, o] = first < second ? [first, second] : [second, first]
    const mark = (center: number, halfLen: number, lv: Level) => {
      const k = Math.round(halfLen / step)
      for (let j = -k; j <= k; j++) level[(center + j + n) % n] = lv
      return [wrapS(center * step - halfLen, L), wrapS(center * step + halfLen, L)] as [number, number]
    }
    under = mark(u, c.under, 1)
    over = mark(o, c.over, 2)
  }
  return { ...def, xs, ys, tx, ty, level, n, step, L, over, under }
}

const cache = new Map<string, Track>()
export function getTrack(id: string): Track {
  const key = TRACK_IDS.includes(id as TrackId) ? id : 'oval'
  let t = cache.get(key)
  if (!t) {
    t = buildTrack(TRACK_DEFS.find((d) => d.id === key)!)
    cache.set(key, t)
  }
  return t
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

/** The track's own box plus a margin. Phones crop to it; a solo time trial is walled in by it. */
export function trackBounds(t: Track, margin = 30): Bounds {
  const pad = t.half + margin
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < t.n; i++) {
    if (t.xs[i] < x0) x0 = t.xs[i]
    if (t.xs[i] > x1) x1 = t.xs[i]
    if (t.ys[i] < y0) y0 = t.ys[i]
    if (t.ys[i] > y1) y1 = t.ys[i]
  }
  return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(WORLD_W, x1 + pad), y1: Math.min(WORLD_H, y1 + pad) }
}

export function wrapS(s: number, L: number): number {
  const r = s % L
  return r < 0 ? r + L : r
}

/** Signed shortest difference b - a on a loop of length L, in (-L/2, L/2]. */
export function deltaS(a: number, b: number, L: number): number {
  let d = (b - a) % L
  if (d > L / 2) d -= L
  if (d <= -L / 2) d += L
  return d
}

export interface Projection {
  /** Sample index of the segment start. */
  i: number
  /** Arc length along the centerline, 0..L. */
  s: number
  /** Signed lateral offset: + is right of the direction of travel. */
  d: number
  dist: number
}

function projSeg(t: Track, i: number, x: number, y: number) {
  const j = (i + 1) % t.n
  const ax = t.xs[i]
  const ay = t.ys[i]
  const bx = t.xs[j] - ax
  const by = t.ys[j] - ay
  const len2 = bx * bx + by * by || 1
  let w = ((x - ax) * bx + (y - ay) * by) / len2
  if (w < 0) w = 0
  else if (w > 1) w = 1
  const cx = ax + bx * w
  const cy = ay + by * w
  const dist2 = (x - cx) ** 2 + (y - cy) ** 2
  return { w, cx, cy, dist2 }
}

/**
 * Nearest point on the centerline. With a hint (last known index) it searches nearby first,
 * which keeps karts on the right branch where the figure eight crosses itself.
 */
export function project(t: Track, x: number, y: number, hint = -1): Projection {
  let best = -1
  let bestD = Infinity
  let bestW = 0
  const scan = (from: number, count: number) => {
    for (let k = 0; k < count; k++) {
      const i = (((from + k) % t.n) + t.n) % t.n
      const r = projSeg(t, i, x, y)
      if (r.dist2 < bestD) { bestD = r.dist2; best = i; bestW = r.w }
    }
  }
  const WIN = 40
  if (hint >= 0) scan(hint - WIN, WIN * 2 + 1)
  if (best < 0 || Math.sqrt(bestD) > t.half * 2.5) scan(0, t.n)
  const i = best
  const s = wrapS((i + bestW) * t.step, t.L)
  const j = (i + 1) % t.n
  const sx = t.xs[j] - t.xs[i]
  const sy = t.ys[j] - t.ys[i]
  const sl = Math.hypot(sx, sy) || 1
  const cx = t.xs[i] + sx * bestW
  const cy = t.ys[i] + sy * bestW
  const d = ((x - cx) * -sy + (y - cy) * sx) / sl
  return { i, s, d, dist: Math.sqrt(bestD) }
}

/** Point and unit tangent at arc length s. */
export function pointAt(t: Track, s: number): { x: number; y: number; tx: number; ty: number; i: number } {
  const ss = wrapS(s, t.L)
  const f = ss / t.step
  const i = Math.floor(f) % t.n
  const j = (i + 1) % t.n
  const w = f - Math.floor(f)
  const x = t.xs[i] + (t.xs[j] - t.xs[i]) * w
  const y = t.ys[i] + (t.ys[j] - t.ys[i]) * w
  const dx = t.xs[j] - t.xs[i]
  const dy = t.ys[j] - t.ys[i]
  const len = Math.hypot(dx, dy) || 1
  return { x, y, tx: dx / len, ty: dy / len, i }
}

/** Point at arc length s, offset d to the right of travel. */
export function offsetAt(t: Track, s: number, d: number): { x: number; y: number; a: number } {
  const p = pointAt(t, s)
  return { x: p.x - p.ty * d, y: p.y + p.tx * d, a: Math.atan2(p.ty, p.tx) }
}

export function levelAt(t: Track, i: number): Level {
  return t.level[((i % t.n) + t.n) % t.n] ?? 0
}

/** Two things on these levels can touch (nothing on the bridge touches anything in the tunnel). */
export function levelsTouch(a: Level, b: Level): boolean {
  return !((a === 1 && b === 2) || (a === 2 && b === 1))
}

export function inWater(t: Track, x: number, y: number): boolean {
  for (const w of t.water ?? []) {
    const dx = (x - w.x) / w.rx
    const dy = (y - w.y) / w.ry
    if (dx * dx + dy * dy <= 1) return true
  }
  return false
}

/** Starting grid: two columns behind the line, pole on the right of travel... then alternating. */
export function gridSpot(t: Track, slot: number): { x: number; y: number; a: number; s: number } {
  const row = Math.floor(slot / 2)
  const col = slot % 2 === 0 ? 1 : -1
  const back = 46 + row * 58 + (slot % 2) * 18
  const s = wrapS(-back, t.L)
  const p = offsetAt(t, s, col * Math.min(28, t.half - 22))
  return { ...p, s }
}
