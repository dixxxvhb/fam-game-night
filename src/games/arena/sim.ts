/**
 * The Arena simulation. Runs only on the host (inside the TV Stage) at a fixed 30 steps a
 * second. Deterministic given (seed, inputs). It is NOT game state: it lives in a ref on the
 * host and is mutated in place by step(). What the game needs to remember (kills, power-ups,
 * who won the round) leaves through the events step() returns.
 */

export type Dir = 'u' | 'd' | 'l' | 'r'
export type PowerKind = 'bomb' | 'range' | 'speed' | 'kick'

export const COLS = 13
export const ROWS = 11
export const STEP_HZ = 30
export const STEP_MS = 1000 / STEP_HZ
/** 2.5 s fuse. */
export const FUSE_STEPS = 75
/** Blasts stay deadly for half a second. */
export const FLAME_STEPS = 15
/** The arena starts closing in after 90 s. */
export const SHRINK_AT_STEPS = 90 * STEP_HZ
/** One tile of wall every 8 steps once it starts. */
export const SHRINK_EVERY = 8
/** Once one (or nobody) is left, wait this long before it counts: the survivor can still blow up. */
export const SETTLE_STEPS = 45
/** Kicked bombs move one tile every 4 steps (7.5 tiles a second). */
export const SLIDE_STEPS = 4
/** Tiles per step: 8 steps per tile to start. */
export const BASE_SPEED = 1 / 8
export const SPEED_STEP = 1 / 40
export const MAX_SPEED = 4
export const MAX_BOMBS = 6
export const MAX_RANGE = 6
export const START_BOMBS = 1
export const START_RANGE = 2

export const FLOOR = 0
export const PILLAR = 1
export const CRATE = 2
export const WALL = 3

export const DIRS: Dir[] = ['u', 'd', 'l', 'r']
export const DX: Record<Dir, number> = { u: 0, d: 0, l: -1, r: 1 }
export const DY: Record<Dir, number> = { u: -1, d: 1, l: 0, r: 0 }
const OPP: Record<Dir, Dir> = { u: 'd', d: 'u', l: 'r', r: 'l' }

export interface SimPlayer {
  id: string
  /** Tile being left (or stood on). */
  c: number
  r: number
  /** Tile being moved to; equals (c, r) when standing still. */
  tc: number
  tr: number
  /** 0..1 from (c, r) toward (tc, tr). */
  p: number
  alive: boolean
  bombs: number
  range: number
  speed: number
  kick: boolean
  face: Dir
  /** Step this player went out, for the TV's pop. */
  diedAt: number | null
  /** Position before the last step, for smooth drawing between steps. */
  px: number
  py: number
}

export interface SimBomb {
  id: number
  c: number
  r: number
  owner: string
  fuse: number
  range: number
  slide: Dir | null
  slideAcc: number
}

export interface Flame {
  left: number
  owner: string
  /** Horizontal arm, vertical arm (center tiles have both). */
  h: boolean
  v: boolean
  /** Step it was laid or refreshed. */
  born: number
}

export interface Sim {
  t: number
  grid: number[]
  /** What each crate hides. */
  hidden: (PowerKind | null)[]
  /** Power-ups lying on the floor. */
  items: (PowerKind | null)[]
  flames: (Flame | null)[]
  bombs: SimBomb[]
  players: SimPlayer[]
  nextBomb: number
  /** Next index into SPIRAL for the shrink. */
  shrinkIdx: number
  /** Tile -> step it turned to wall (for the drop-in on the TV). */
  fallen: Record<number, number>
  settle: number | null
  result: { winner: string | null } | null
}

export interface SimInput {
  d: Dir | null
  bomb: boolean
}

export type SimEvent =
  | { type: 'bomb'; who: string }
  | { type: 'boom'; n: number }
  | { type: 'kick'; who: string }
  | { type: 'kill'; by: string | null; victim: string }
  | { type: 'power'; who: string; kind: PowerKind }
  | { type: 'shrink'; i: number }
  | { type: 'end'; winner: string | null }

export const idx = (c: number, r: number) => r * COLS + c
export const inBounds = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS
export const isPillarSpot = (c: number, r: number) => c % 2 === 1 && r % 2 === 1

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Spawn spots: four corners, then the middle of the top and bottom edges.
const TL: [number, number] = [0, 0]
const TR: [number, number] = [COLS - 1, 0]
const BL: [number, number] = [0, ROWS - 1]
const BR: [number, number] = [COLS - 1, ROWS - 1]
const TM: [number, number] = [(COLS - 1) / 2, 0]
const BM: [number, number] = [(COLS - 1) / 2, ROWS - 1]
export const SPAWN_SPOTS = [TL, TR, BL, BR, TM, BM]

/** Where each seat starts, by player count. Two face off across the diagonal, three make a triangle. */
export function spawnsFor(n: number): [number, number][] {
  if (n <= 2) return [TL, BR]
  if (n === 3) return [TL, TR, BM]
  if (n === 4) return [TL, BR, TR, BL]
  if (n === 5) return [TL, BR, TR, BL, TM]
  return [TL, BR, TR, BL, TM, BM]
}

/** Spawn tiles plus their open neighbors, kept clear of crates (every spot, so the layout stays symmetric). */
export function safeTiles(): Set<number> {
  const out = new Set<number>()
  for (const [c, r] of SPAWN_SPOTS) {
    out.add(idx(c, r))
    for (const d of DIRS) {
      const nc = c + DX[d]
      const nr = r + DY[d]
      if (inBounds(nc, nr) && !isPillarSpot(nc, nr)) out.add(idx(nc, nr))
    }
  }
  return out
}

/** Every tile once, clockwise from the top-left corner, ring by ring toward the middle. */
export const SPIRAL: number[] = (() => {
  const out: number[] = []
  let top = 0
  let bottom = ROWS - 1
  let left = 0
  let right = COLS - 1
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push(idx(c, top))
    for (let r = top + 1; r <= bottom; r++) out.push(idx(right, r))
    if (top < bottom) for (let c = right - 1; c >= left; c--) out.push(idx(c, bottom))
    if (left < right) for (let r = bottom - 1; r > top; r--) out.push(idx(left, r))
    top++
    bottom--
    left++
    right--
  }
  return out
})()

export const CRATE_CHANCE = 0.68
export const POWER_CHANCE = 0.36

function pickKind(x: number): PowerKind {
  if (x < 0.32) return 'bomb'
  if (x < 0.64) return 'range'
  if (x < 0.84) return 'speed'
  return 'kick'
}

/** Seeded layout, mirrored left-right and top-bottom so every corner gets the same deal. */
export function makeLayout(seed: number): { grid: number[]; hidden: (PowerKind | null)[] } {
  const random = rng(seed)
  const grid = new Array<number>(COLS * ROWS).fill(FLOOR)
  const hidden = new Array<PowerKind | null>(COLS * ROWS).fill(null)
  const safe = safeTiles()
  const halfC = (COLS - 1) / 2
  const halfR = (ROWS - 1) / 2
  for (let r = 0; r <= halfR; r++) {
    for (let c = 0; c <= halfC; c++) {
      // Always draw three numbers per tile so the layout only depends on the seed.
      const a = random()
      const b = random()
      const k = random()
      let g = FLOOR
      let h: PowerKind | null = null
      if (isPillarSpot(c, r)) g = PILLAR
      else if (!safe.has(idx(c, r)) && a < CRATE_CHANCE) {
        g = CRATE
        if (b < POWER_CHANCE) h = pickKind(k)
      }
      for (const [mc, mr] of [[c, r], [COLS - 1 - c, r], [c, ROWS - 1 - r], [COLS - 1 - c, ROWS - 1 - r]]) {
        grid[idx(mc, mr)] = g
        hidden[idx(mc, mr)] = h
      }
    }
  }
  return { grid, hidden }
}

/** A fresh round. Players listed in `out` (already knocked out this round, e.g. after the TV reloads) start out. */
export function newSim(seed: number, ids: string[], opts: { out?: string[] } = {}): Sim {
  const { grid, hidden } = makeLayout(seed)
  const spots = spawnsFor(ids.length)
  const players: SimPlayer[] = ids.map((id, i) => {
    const [c, r] = spots[i % spots.length]
    const alive = !(opts.out ?? []).includes(id)
    return {
      id, c, r, tc: c, tr: r, p: 0, alive,
      bombs: START_BOMBS, range: START_RANGE, speed: 0, kick: false,
      face: r === 0 ? 'd' : 'u', diedAt: alive ? null : 0, px: c, py: r,
    }
  })
  return {
    t: 0,
    grid,
    hidden,
    items: new Array(COLS * ROWS).fill(null),
    flames: new Array(COLS * ROWS).fill(null),
    bombs: [],
    players,
    nextBomb: 1,
    shrinkIdx: 0,
    fallen: {},
    settle: null,
    result: null,
  }
}

// ---------------- queries ----------------

export function solidAt(sim: Sim, c: number, r: number): boolean {
  if (!inBounds(c, r)) return true
  const g = sim.grid[idx(c, r)]
  return g === PILLAR || g === CRATE || g === WALL
}

export function bombAt(sim: Sim, c: number, r: number): SimBomb | undefined {
  return sim.bombs.find((b) => b.c === c && b.r === r)
}

export const isMoving = (p: SimPlayer) => p.tc !== p.c || p.tr !== p.r

/** The tile a player counts as standing on: the nearer of the two. */
export function tileOf(p: SimPlayer): [number, number] {
  return p.p < 0.5 ? [p.c, p.r] : [p.tc, p.tr]
}

export function posOf(p: SimPlayer): [number, number] {
  return [p.c + (p.tc - p.c) * p.p, p.r + (p.tr - p.r) * p.p]
}

export function moveDir(p: SimPlayer): Dir | null {
  if (p.tc > p.c) return 'r'
  if (p.tc < p.c) return 'l'
  if (p.tr > p.r) return 'd'
  if (p.tr < p.r) return 'u'
  return null
}

export const speedOf = (p: SimPlayer) => BASE_SPEED + p.speed * SPEED_STEP

const openFor = (sim: Sim, c: number, r: number) => !solidAt(sim, c, r) && !bombAt(sim, c, r)

/** Free for a sliding bomb: no wall, crate, bomb, or player on it. */
function slideFree(sim: Sim, c: number, r: number): boolean {
  if (!openFor(sim, c, r)) return false
  return !sim.players.some((p) => p.alive && ((p.c === c && p.r === r) || (p.tc === c && p.tr === r)))
}

// ---------------- step pieces ----------------

function placeBomb(sim: Sim, pl: SimPlayer, events: SimEvent[]) {
  const [c, r] = tileOf(pl)
  if (solidAt(sim, c, r) || bombAt(sim, c, r)) return
  if (sim.bombs.filter((b) => b.owner === pl.id).length >= pl.bombs) return
  sim.bombs.push({ id: sim.nextBomb++, c, r, owner: pl.id, fuse: FUSE_STEPS, range: pl.range, slide: null, slideAcc: 0 })
  events.push({ type: 'bomb', who: pl.id })
}

function tryKick(sim: Sim, b: SimBomb, d: Dir, who: string, events: SimEvent[]) {
  if (b.slide) return
  if (!slideFree(sim, b.c + DX[d], b.r + DY[d])) return
  b.slide = d
  b.slideAcc = 0
  events.push({ type: 'kick', who })
}

function canReturn(sim: Sim, pl: SimPlayer): boolean {
  if (solidAt(sim, pl.c, pl.r)) return false
  // Past halfway you've left the tile behind; a bomb there now blocks the way back.
  return pl.p < 0.5 || !bombAt(sim, pl.c, pl.r)
}

function turnAround(pl: SimPlayer) {
  const { c, r } = pl
  pl.c = pl.tc
  pl.r = pl.tr
  pl.tc = c
  pl.tr = r
  pl.p = 1 - pl.p
}

export function movePlayer(sim: Sim, pl: SimPlayer, d: Dir | null, events: SimEvent[]) {
  let budget = speedOf(pl)
  for (let guard = 0; guard < 6 && budget > 1e-9; guard++) {
    if (isMoving(pl)) {
      const md = moveDir(pl)!
      if (d && d !== md) {
        // Back the way you came, or a turn whose lane is behind you (nearest tile wins).
        const back = d === OPP[md] || (pl.p < 0.5 && openFor(sim, pl.c + DX[d], pl.r + DY[d]))
        if (back && canReturn(sim, pl)) turnAround(pl)
      }
      const go = Math.min(budget, 1 - pl.p)
      pl.p += go
      budget -= go
      if (pl.p >= 1 - 1e-6) {
        pl.c = pl.tc
        pl.r = pl.tr
        pl.p = 0
      } else break
    } else {
      if (!d) break
      pl.face = d
      const nc = pl.c + DX[d]
      const nr = pl.r + DY[d]
      if (solidAt(sim, nc, nr)) break
      const b = bombAt(sim, nc, nr)
      if (b) {
        if (pl.kick) tryKick(sim, b, d, pl.id, events)
        break
      }
      pl.tc = nc
      pl.tr = nr
      pl.p = 0
    }
  }
}

export function applyPower(pl: { bombs: number; range: number; speed: number; kick: boolean }, kind: PowerKind) {
  if (kind === 'bomb') pl.bombs = Math.min(MAX_BOMBS, pl.bombs + 1)
  else if (kind === 'range') pl.range = Math.min(MAX_RANGE, pl.range + 1)
  else if (kind === 'speed') pl.speed = Math.min(MAX_SPEED, pl.speed + 1)
  else pl.kick = true
}

function pickUp(sim: Sim, pl: SimPlayer, events: SimEvent[]) {
  const [c, r] = tileOf(pl)
  const k = idx(c, r)
  const kind = sim.items[k]
  if (!kind) return
  sim.items[k] = null
  applyPower(pl, kind)
  events.push({ type: 'power', who: pl.id, kind })
}

function slideBombs(sim: Sim) {
  for (const b of sim.bombs) {
    if (!b.slide) continue
    b.slideAcc += 1
    if (b.slideAcc < SLIDE_STEPS) continue
    b.slideAcc = 0
    const nc = b.c + DX[b.slide]
    const nr = b.r + DY[b.slide]
    if (slideFree(sim, nc, nr)) {
      b.c = nc
      b.r = nr
      if (!slideFree(sim, nc + DX[b.slide], nr + DY[b.slide])) b.slide = null
    } else {
      b.slide = null
    }
  }
}

function lay(sim: Sim, c: number, r: number, owner: string, h: boolean, v: boolean) {
  const k = idx(c, r)
  const f = sim.flames[k]
  if (f) {
    // A fresh blast takes the tile over; two blasts in the same step: the first one keeps it.
    if (f.born !== sim.t) f.owner = owner
    f.left = FLAME_STEPS
    f.h = f.h || h
    f.v = f.v || v
    f.born = sim.t
  } else {
    sim.flames[k] = { left: FLAME_STEPS, owner, h, v, born: sim.t }
  }
}

/** Decay old flames, then set off every bomb whose fuse ran out or that sits in a blast. Chains in one step. */
export function explode(sim: Sim, events: SimEvent[]) {
  for (let k = 0; k < sim.flames.length; k++) {
    const f = sim.flames[k]
    if (f && --f.left <= 0) sim.flames[k] = null
  }
  const queue = sim.bombs.filter((b) => b.fuse <= 0 || sim.flames[idx(b.c, b.r)])
  if (!queue.length) return
  const done = new Set<number>()
  const crates = new Set<number>()
  let n = 0
  while (queue.length) {
    const b = queue.shift()!
    if (done.has(b.id)) continue
    done.add(b.id)
    n += 1
    sim.bombs = sim.bombs.filter((x) => x.id !== b.id)
    lay(sim, b.c, b.r, b.owner, true, true)
    for (const d of DIRS) {
      const horiz = d === 'l' || d === 'r'
      for (let i = 1; i <= b.range; i++) {
        const c = b.c + DX[d] * i
        const r = b.r + DY[d] * i
        if (!inBounds(c, r)) break
        const k = idx(c, r)
        const g = sim.grid[k]
        if (g === PILLAR || g === WALL) break
        lay(sim, c, r, b.owner, horiz, !horiz)
        if (g === CRATE) {
          // Crates stop the blast. They stay solid until every blast this step has run.
          crates.add(k)
          break
        }
        sim.items[k] = null
        const other = sim.bombs.find((x) => x.c === c && x.r === r && !done.has(x.id))
        if (other) {
          queue.push(other)
          break
        }
      }
    }
  }
  for (const k of crates) {
    sim.grid[k] = FLOOR
    sim.items[k] = sim.hidden[k]
    sim.hidden[k] = null
  }
  events.push({ type: 'boom', n })
}

function knockOut(sim: Sim, pl: SimPlayer, by: string | null, events: SimEvent[]) {
  if (!pl.alive) return
  pl.alive = false
  pl.diedAt = sim.t
  events.push({ type: 'kill', by, victim: pl.id })
}

function burn(sim: Sim, events: SimEvent[]) {
  for (const pl of sim.players) {
    if (!pl.alive) continue
    const [c, r] = tileOf(pl)
    const f = sim.flames[idx(c, r)]
    if (f) knockOut(sim, pl, f.owner, events)
  }
}

function fillTile(sim: Sim, k: number, events: SimEvent[]) {
  sim.grid[k] = WALL
  sim.hidden[k] = null
  sim.items[k] = null
  sim.flames[k] = null
  sim.fallen[k] = sim.t
  sim.bombs = sim.bombs.filter((b) => idx(b.c, b.r) !== k)
  for (const pl of sim.players) {
    if (!pl.alive) continue
    const [c, r] = tileOf(pl)
    if (idx(c, r) === k) knockOut(sim, pl, null, events)
    else if (isMoving(pl) && idx(pl.tc, pl.tr) === k) {
      // Heading into the falling tile: back to where you were.
      pl.tc = pl.c
      pl.tr = pl.r
      pl.p = 0
    }
  }
  events.push({ type: 'shrink', i: k })
}

function shrink(sim: Sim, events: SimEvent[]) {
  if (sim.t < SHRINK_AT_STEPS || (sim.t - SHRINK_AT_STEPS) % SHRINK_EVERY !== 0) return
  while (sim.shrinkIdx < SPIRAL.length) {
    const k = SPIRAL[sim.shrinkIdx++]
    const g = sim.grid[k]
    if (g === PILLAR || g === WALL) continue
    fillTile(sim, k, events)
    return
  }
}

function settle(sim: Sim, events: SimEvent[]) {
  const alive = sim.players.filter((p) => p.alive)
  const over = sim.players.length >= 2 ? alive.length <= 1 : alive.length === 0
  if (!over) return
  if (sim.settle === null) sim.settle = SETTLE_STEPS
  sim.settle -= 1
  if (sim.settle > 0) return
  const winner = alive.length === 1 ? alive[0].id : null
  sim.result = { winner }
  events.push({ type: 'end', winner })
}

/** Seconds until the walls start closing in (0 once they are). */
export function shrinkIn(sim: Sim): number {
  return Math.max(0, (SHRINK_AT_STEPS - sim.t) / STEP_HZ)
}

/** One 1/30 s step. Mutates the sim. Returns what happened. */
export function step(sim: Sim, inputs: Record<string, SimInput | undefined>): SimEvent[] {
  if (sim.result) return []
  const events: SimEvent[] = []
  sim.t += 1
  for (const pl of sim.players) {
    const [x, y] = posOf(pl)
    pl.px = x
    pl.py = y
  }
  for (const pl of sim.players) {
    if (pl.alive && inputs[pl.id]?.bomb) placeBomb(sim, pl, events)
  }
  for (const pl of sim.players) {
    if (!pl.alive) continue
    movePlayer(sim, pl, inputs[pl.id]?.d ?? null, events)
    pickUp(sim, pl, events)
  }
  slideBombs(sim)
  for (const b of sim.bombs) b.fuse -= 1
  explode(sim, events)
  burn(sim, events)
  shrink(sim, events)
  settle(sim, events)
  return events
}
