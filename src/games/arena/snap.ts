/**
 * 'arena:snap': the host's arena, compact, for apart mode. The host device (the phone that hosts)
 * runs the Sim and sends one of these about 15 times a second; every other phone draws the arena
 * from them (SnapBuffer interpolates between two), and keeps the latest one so it can pick the
 * round up if it becomes the host (the platform's host handoff). A snapshot carries everything
 * the Sim holds, so decode(encode(sim)) is the same Sim and stepping it carries on exactly.
 * Pure: no DOM, time is passed in.
 */
import {
  COLS, CRATE, FLOOR, PILLAR, posOf, ROWS, WALL,
  type Dir, type Flame, type PowerKind, type Sim, type SimBomb, type SimPlayer,
} from './sim'

export const SNAP_KIND = 'arena:snap'
/** Host sends a snapshot this often (about 15 a second). */
export const SNAP_EVERY_MS = 66
/** Receivers draw this many sim steps in the past, so there is a newer snapshot to blend toward. */
export const INTERP_STEPS = 4
/** Walls that fell more than this many steps ago are sent without their fall time (the drop-in is long over). */
const FALL_KEEP = 60

export interface ArenaSnap {
  v: 1
  /** Round and layout seed this arena belongs to. */
  r: number
  s: number
  /** Player ids by seat. */
  ids: string[]
  t: number
  /** One char per tile: what is there and what it holds (see TILE). */
  g: string
  /** Bombs, 8 numbers each: id, c, r, owner seat, fuse, range, slide (0 none, 1-4 u d l r), slideAcc. */
  b: number[]
  /** Flames, 6 numbers each: tile, left, owner seat, h, v, steps since born. */
  f: number[]
  /** Players, 14 numbers each by seat: c, r, tc, tr, p, alive, bombs, range, speed, kick, face, diedAt (-1 none), px, py. */
  p: number[]
  /** nextBomb, shrinkIdx, settle (-1 none), result (-2 none, -1 nobody, else the winner's seat). */
  n: [number, number, number, number]
  /** Recently fallen walls: tile, steps ago. */
  w: number[]
}

const KINDS: (PowerKind | null)[] = [null, 'bomb', 'range', 'speed', 'kick']
const DIR_CODE: (Dir | null)[] = [null, 'u', 'd', 'l', 'r']
const FACE: Dir[] = ['u', 'd', 'l', 'r']

// Tile chars: a-e floor holding nothing/bomb/range/speed/kick, f pillar, g-k crate hiding
// nothing/bomb/range/speed/kick, l wall.
const A = 97
function tileChar(g: number, hidden: PowerKind | null, item: PowerKind | null): string {
  if (g === PILLAR) return 'f'
  if (g === WALL) return 'l'
  if (g === CRATE) return String.fromCharCode(A + 6 + KINDS.indexOf(hidden))
  return String.fromCharCode(A + KINDS.indexOf(item))
}

export function encode(sim: Sim, round: number, seed: number): ArenaSnap {
  const seat = new Map(sim.players.map((p, i) => [p.id, i]))
  let g = ''
  for (let k = 0; k < COLS * ROWS; k++) g += tileChar(sim.grid[k], sim.hidden[k], sim.items[k])
  const b: number[] = []
  for (const x of sim.bombs) b.push(x.id, x.c, x.r, seat.get(x.owner) ?? 0, x.fuse, x.range, DIR_CODE.indexOf(x.slide), x.slideAcc)
  const f: number[] = []
  sim.flames.forEach((x, k) => { if (x) f.push(k, x.left, seat.get(x.owner) ?? 0, x.h ? 1 : 0, x.v ? 1 : 0, sim.t - x.born) })
  const p: number[] = []
  for (const x of sim.players) {
    p.push(x.c, x.r, x.tc, x.tr, x.p, x.alive ? 1 : 0, x.bombs, x.range, x.speed, x.kick ? 1 : 0, FACE.indexOf(x.face), x.diedAt ?? -1, x.px, x.py)
  }
  const w: number[] = []
  for (const [k, at] of Object.entries(sim.fallen)) if (sim.t - at <= FALL_KEEP) w.push(Number(k), sim.t - at)
  const res = !sim.result ? -2 : sim.result.winner === null ? -1 : seat.get(sim.result.winner) ?? -1
  return {
    v: 1, r: round, s: seed, ids: sim.players.map((x) => x.id), t: sim.t, g, b, f, p,
    n: [sim.nextBomb, sim.shrinkIdx, sim.settle ?? -1, res],
    w,
  }
}

/** A snapshot back into a whole Sim (null for junk). */
export function decode(x: unknown): Sim | null {
  if (!isSnap(x)) return null
  const n = COLS * ROWS
  const grid = new Array<number>(n)
  const hidden = new Array<PowerKind | null>(n).fill(null)
  const items = new Array<PowerKind | null>(n).fill(null)
  for (let k = 0; k < n; k++) {
    const c = x.g.charCodeAt(k) - A
    if (c <= 4) { grid[k] = FLOOR; items[k] = KINDS[c] }
    else if (c === 5) grid[k] = PILLAR
    else if (c <= 10) { grid[k] = CRATE; hidden[k] = KINDS[c - 6] }
    else grid[k] = WALL
  }
  const owner = (i: number) => x.ids[i] ?? x.ids[0]
  const bombs: SimBomb[] = []
  for (let i = 0; i + 7 < x.b.length; i += 8) {
    const [id, c, r, o, fuse, range, slide, slideAcc] = x.b.slice(i, i + 8)
    bombs.push({ id, c, r, owner: owner(o), fuse, range, slide: DIR_CODE[slide] ?? null, slideAcc })
  }
  const flames: (Flame | null)[] = new Array(n).fill(null)
  for (let i = 0; i + 5 < x.f.length; i += 6) {
    const [k, left, o, h, v, age] = x.f.slice(i, i + 6)
    if (k >= 0 && k < n) flames[k] = { left, owner: owner(o), h: h === 1, v: v === 1, born: x.t - age }
  }
  const players: SimPlayer[] = x.ids.map((id, i) => {
    const q = x.p.slice(i * 14, i * 14 + 14)
    return {
      id, c: q[0], r: q[1], tc: q[2], tr: q[3], p: q[4], alive: q[5] === 1,
      bombs: q[6], range: q[7], speed: q[8], kick: q[9] === 1, face: FACE[q[10]] ?? 'd',
      diedAt: q[11] < 0 ? null : q[11], px: q[12], py: q[13],
    }
  })
  const fallen: Record<number, number> = {}
  // Older walls get a fall time far enough back that they are simply there.
  for (let k = 0; k < n; k++) if (grid[k] === WALL) fallen[k] = x.t - 10_000
  for (let i = 0; i + 1 < x.w.length; i += 2) fallen[x.w[i]] = x.t - x.w[i + 1]
  const [nextBomb, shrinkIdx, settle, res] = x.n
  return {
    t: x.t, grid, hidden, items, flames, bombs, players, nextBomb, shrinkIdx, fallen,
    settle: settle < 0 ? null : settle,
    result: res === -2 ? null : { winner: res === -1 ? null : x.ids[res] ?? null },
  }
}

function nums(a: unknown, stride: number): a is number[] {
  return Array.isArray(a) && a.length % stride === 0 && a.every((v) => typeof v === 'number' && Number.isFinite(v))
}

export function isSnap(x: unknown): x is ArenaSnap {
  if (!x || typeof x !== 'object') return false
  const o = x as Partial<ArenaSnap>
  return o.v === 1 && typeof o.r === 'number' && typeof o.s === 'number' && typeof o.t === 'number'
    && typeof o.g === 'string' && o.g.length === COLS * ROWS && /^[a-l]+$/.test(o.g)
    && Array.isArray(o.ids) && o.ids.length > 0 && o.ids.every((i) => typeof i === 'string')
    && nums(o.b, 8) && nums(o.f, 6) && nums(o.p, 14) && o.p!.length === o.ids.length * 14
    && nums(o.n, 4) && o.n!.length === 4 && nums(o.w, 2)
}

/**
 * Pick a round up from a snapshot (the new host after a handoff): the snapshot's Sim, if it is
 * this round's arena with these players. Anyone the game already counts as out stays out (a
 * kill can land in the game a moment before the next snapshot would have shown it).
 */
export function resume(snap: ArenaSnap | null, round: number, seed: number, order: string[], out: string[]): Sim | null {
  if (!snap || snap.r !== round || snap.s !== seed) return null
  if (snap.ids.length !== order.length || snap.ids.some((id, i) => id !== order[i])) return null
  const sim = decode(snap)
  if (!sim) return null
  for (const p of sim.players) {
    if (out.includes(p.id) && p.alive) {
      p.alive = false
      p.diedAt = sim.t
    }
  }
  return sim
}

// ---------------- receiving ----------------

interface Held { snap: ArenaSnap; sim: Sim }

/**
 * Receiver side: holds the last few snapshots and hands back a Sim to draw for "now", blended
 * between two snapshots. The host's step clock is mapped to this device's clock from the arrival
 * times (smoothed), and drawing runs INTERP_STEPS behind it.
 */
export class SnapBuffer {
  private held: Held[] = []
  private offset: number | null = null
  private key = ''

  /** The latest snapshot (to resume from). */
  get latest(): ArenaSnap | null {
    return this.held.at(-1)?.snap ?? null
  }

  push(snap: ArenaSnap, at: number): void {
    const key = `${snap.r}:${snap.s}`
    if (key !== this.key) { this.key = key; this.held = []; this.offset = null }
    const last = this.held.at(-1)
    if (last && snap.t <= last.snap.t) {
      if (snap.t === last.snap.t) this.held[this.held.length - 1] = { snap, sim: decode(snap)! }
      return
    }
    const sim = decode(snap)
    if (!sim) return
    this.held.push({ snap, sim })
    if (this.held.length > 8) this.held.shift()
    const o = at - snap.t * (1000 / 30)
    // Jitter only ever makes a message late: track the earliest arrival, drift slowly upward.
    this.offset = this.offset === null || o < this.offset ? o : this.offset + (o - this.offset) * 0.02
  }

  /**
   * The arena at local time `at`: a Sim whose players' px/py hold the earlier snapshot's spot
   * and `alpha` the blend toward the later one (the same contract the host's own draw uses),
   * plus the fractional step time for animations.
   */
  view(at: number): { sim: Sim; alpha: number; time: number } | null {
    const h = this.held
    if (!h.length || this.offset === null) return null
    const want = (at - this.offset) / (1000 / 30) - INTERP_STEPS
    const last = h[h.length - 1]
    if (want >= last.snap.t || h.length === 1) return { sim: settleView(last.sim), alpha: 1, time: last.snap.t }
    let i = h.length - 1
    while (i > 0 && h[i - 1].snap.t > want) i--
    if (i === 0) return { sim: settleView(h[0].sim), alpha: 1, time: h[0].snap.t }
    const a = h[i - 1]
    const b = h[i]
    const u = Math.max(0, Math.min(1, (want - a.snap.t) / (b.snap.t - a.snap.t)))
    for (const p of b.sim.players) {
      const q = a.sim.players.find((x) => x.id === p.id)
      const [x, y] = q ? posOf(q) : posOf(p)
      p.px = x
      p.py = y
    }
    return { sim: b.sim, alpha: u, time: a.snap.t + (b.snap.t - a.snap.t) * u }
  }
}

/** Nothing to blend toward: draw players where they are. */
function settleView(sim: Sim): Sim {
  for (const p of sim.players) {
    const [x, y] = posOf(p)
    p.px = x
    p.py = y
  }
  return sim
}

// ---------------- the last snapshot heard on this device ----------------

let lastHeard: ArenaSnap | null = null

/** Remember the newest snapshot this device heard (survives the Stage remounting as host). */
export function rememberSnap(s: ArenaSnap): void {
  if (!lastHeard || lastHeard.r !== s.r || lastHeard.s !== s.s || s.t >= lastHeard.t) lastHeard = s
}

export function lastSnap(): ArenaSnap | null {
  return lastHeard
}
