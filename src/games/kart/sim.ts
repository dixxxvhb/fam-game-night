/**
 * The Turnpike race simulation. Runs only on the device that owns the race: the TV in together
 * mode, the host phone in apart mode, each phone for its own time trial. Fixed timestep, seeded
 * randomness, no DOM. The World is a mutable object (it is not game state: it never goes over the
 * wire whole; 'kart:pos' snapshots do, see snapshot() below and snap.ts).
 */
import type { CritterId, SceneThing, SpeedClass, TurnpikeItem, TurnpikeSceneExtra } from './contract'
import { COIN_MAX, ROULETTE_MS, ROCKET_WINDOW_MS } from './contract'
import type { Scene, SceneKart, TurnpikeScene, EngineKartFx } from './render'
import {
  BOX_LANES, deltaS, getTrack, gridSpot, inMud, inWater, levelAt, levelsTouch, offsetAt, pointAt, project, trackBounds,
  type Bounds, type Level, type Track,
} from './tracks'

export type ItemKind = TurnpikeItem
export const ITEM_KINDS: ItemKind[] = ['cafecito', 'cafecito3', 'mango', 'coconut', 'pelican', 'floatie', 'lovebugs', 'storm', 'hurricane']
export const ITEM_NAMES: Record<ItemKind, string> = {
  cafecito: 'Cafecito', cafecito3: 'Triple Cafecito', mango: 'Mango', coconut: 'Coconut', pelican: 'Pelican',
  floatie: 'Floatie', lovebugs: 'Love Bugs', storm: 'Storm', hurricane: 'Hurricane',
}

/**
 * What a phone sends: steer -1..1 (0.1 steps), gas, hop/drift held (b), item press counter (f).
 * (The contract names them h and u on the wire; input.ts accepts both.)
 */
export interface KartInput { s: number; g: 0 | 1; b: 0 | 1; f: number }
export const NEUTRAL: KartInput = { s: 0, g: 0, b: 0, f: 0 }

export const STEP = 1 / 60
/** Top speed on Rush Hour, world units a second. */
export const VMAX = 240
export const BOOST_MUL = 1.45
export const SPEED_MUL: Record<SpeedClass, number> = { sunday: 0.85, rush: 1, florida: 1.16 }
const ACCEL = 330
const COAST = 90
const TURN = 2.7
export const KART_R = 16
const GRAVITY = 900
const PELICAN_SPEED = 560
const PELICAN_LIFE = 5
const COCONUT_SPEED = 620
const COCONUT_LIFE = 4
const HURRICANE_SPEED = 950
const MANGO_MAX = 12
const BOX_RESPAWN = 3
const COIN_RESPAWN = 10
const LOOSE_COIN_LIFE = 8
/** Each coin adds this share of top speed. */
export const COIN_SPEED = 0.012
/** Mini-turbo: drift charge (seconds-ish) for blue, orange, pink sparks, and the boost each gives. */
export const MT_TIERS = [0.55, 1.15, 1.85]
export const MT_BOOST = [0.45, 0.8, 1.25]
export const SLIP_TIME = 1.2
const SURFACE_SLOW = { grass: 0.55, sand: 0.5, mud: 0.45, water: 0.45 } as const

export interface Kart {
  id: string
  seat: number
  name: string
  color: string
  char: CritterId | null
  x: number
  y: number
  /** Height above the track and its vertical speed (ramps, hops). */
  z: number
  vz: number
  /** Heading, radians (screen coords, y down). */
  a: number
  /** Speed along the heading and sideways (kart frame). */
  vf: number
  vl: number
  /** Effective steer this step, for drawing. */
  steer: number
  hint: number
  s: number
  d: number
  level: Level
  /** Unwrapped progress: laps * L + s. Starts slightly negative (behind the line). */
  prog: number
  laps: number
  lapMs: number[]
  finished: boolean
  finishMs: number | null
  spin: number
  spinDir: number
  invuln: number
  boost: number
  drift: -1 | 0 | 1
  charge: number
  item: ItemKind | null
  /** Uses left on a Triple Cafecito. */
  uses: number
  /** Roulette seconds left; the item is not usable until 0. */
  rolling: number
  shield: number
  coins: number
  /** Love bugs on the windshield, seconds. */
  bugs: number
  /** Shrunk by the storm, seconds. */
  small: number
  /** Rocket start too early: engine sputters, seconds. */
  sputter: number
  /** Slipstream build-up, seconds. */
  slip: number
  slipFx: number
  trick: boolean
  lastF: number | null
  lastB: boolean
  /** Race time (ms, negative before GO) the start key went down, or null when up. */
  rkSince: number | null
  rockets: number
  hits: number
  off: boolean
  wet: boolean
  mud: boolean
  /** Lowest place held after the start settled (for the comeback highlight). */
  worst: number
  /** Driven by the AI below instead of a phone. */
  bot: boolean
}

/** An AI driver's memory. Skill 0..1 sets how clean its lines are, how often it drifts, its speed. */
export interface Brain {
  skill: number
  steer: number
  hold: number
  noise: number
  noiseFor: number
  lift: number
  drifting: boolean
  itemAt: number
  f: number
  /** When (ms before GO, negative) it hits the start key. */
  rocketAt: number
  hop: number
}

export interface Box { x: number; y: number; level: Level; respawn: number }
export interface Coin { x: number; y: number; level: Level; respawn: number; loose: boolean; life: number; safe: string | null; safeFor: number }
export interface Mango { id: number; x: number; y: number; level: Level; owner: string; safe: number; age: number }
export interface Coconut { id: number; x: number; y: number; vx: number; vy: number; hint: number; level: Level; owner: string; age: number; bounces: number }
export interface Pelican { id: number; s: number; d: number; x: number; y: number; a: number; level: Level; owner: string; target: string | null; age: number }
export interface Hurricane { id: number; s: number; x: number; y: number; owner: string; target: string | null; age: number }
export interface GatorState { phase: 'lurk' | 'warn' | 'lunge'; t: number; next: number; ext: number }
export interface GustState { phase: 'calm' | 'warn' | 'gust'; t: number; next: number; dir: -1 | 1; v: number }
export interface RocketState { phase: 'wait' | 'lift'; t: number }
export interface WaveState { phase: 'calm' | 'warn' | 'splash'; t: number; next: number }
export interface BarrelRow { at: number; lanes: number[] }
export interface Pad { s0: number; s1: number; d: number }
export interface Ramp { s0: number; s1: number }

export interface World {
  track: Track
  laps: number
  speed: SpeedClass
  vmax: number
  gas: 'auto' | 'hold'
  /** Ms since GO (negative before). */
  time: number
  started: boolean
  karts: Kart[]
  boxes: Box[]
  coins: Coin[]
  mangos: Mango[]
  coconuts: Coconut[]
  pelicans: Pelican[]
  hurricanes: Hurricane[]
  pads: Pad[]
  ramps: Ramp[]
  gator: GatorState | null
  gust: GustState | null
  rocket: RocketState | null
  wave: WaveState | null
  barrels: BarrelRow[]
  barrelLap: number
  shake: number
  items: boolean
  order: string[]
  rng: () => number
  nextId: number
  lastLeadAt: number
  /** Walls: the whole track world for a race; a phone's solo trial is walled to the track box. */
  bounds: Bounds
  brains: Record<string, Brain>
}

export type HitKind = 'mango' | 'coconut' | 'pelican' | 'gator' | 'storm' | 'hurricane' | 'wave'
export type BoostWhy = 'mt' | 'pad' | 'slip' | 'trick' | 'rocket' | 'item'

export type SimEvent =
  | { t: 'lap'; id: string; lap: number; time: number }
  | { t: 'finish'; id: string; time: number; place: number }
  | { t: 'hit'; id: string; by: string | null; kind: HitKind }
  | { t: 'block'; id: string; by: string | null }
  | { t: 'roll'; id: string }
  | { t: 'pickup'; id: string; item: ItemKind }
  | { t: 'use'; id: string; item: ItemKind }
  | { t: 'lead'; id: string }
  | { t: 'boost'; id: string; why: BoostWhy; tier?: number }
  | { t: 'rocket'; id: string; ok: boolean }
  | { t: 'coin'; id: string; coins: number }
  | { t: 'drop'; id: string; n: number }
  | { t: 'bump'; id: string }
  | { t: 'bugs'; by: string; ids: string[] }
  | { t: 'storm'; by: string }
  | { t: 'hurricane'; by: string; target: string | null }
  | { t: 'liftoff' }
  | { t: 'gust'; dir: -1 | 1 }
  | { t: 'wave' }
  | { t: 'gator' }
  | { t: 'barrels' }
  | { t: 'finalLap'; id: string }

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export function angleWrap(a: number): number {
  let r = a % (Math.PI * 2)
  if (r > Math.PI) r -= Math.PI * 2
  if (r < -Math.PI) r += Math.PI * 2
  return r
}

// ---------------- items by position ----------------

type Table = [ItemKind, number][]
/** Leaders get defense, the back gets the big stuff. Storm and Hurricane only exist at the back. */
export const ITEM_TABLES: Record<'leader' | 'front' | 'mid' | 'back', Table> = {
  leader: [['mango', 45], ['coconut', 25], ['floatie', 25], ['cafecito', 5]],
  front: [['mango', 25], ['coconut', 25], ['floatie', 20], ['cafecito', 15], ['pelican', 10], ['lovebugs', 5]],
  mid: [['mango', 10], ['coconut', 15], ['floatie', 10], ['cafecito', 20], ['cafecito3', 12], ['pelican', 20], ['lovebugs', 13]],
  back: [['mango', 3], ['coconut', 7], ['floatie', 5], ['cafecito', 15], ['cafecito3', 25], ['pelican', 20], ['lovebugs', 13], ['storm', 6], ['hurricane', 6]],
}

export function itemBucket(place: number, n: number): keyof typeof ITEM_TABLES {
  if (n <= 1) return 'mid'
  if (place <= 1) return 'leader'
  const r = (place - 1) / (n - 1)
  if (r <= 0.34) return 'front'
  if (r <= 0.67) return 'mid'
  return 'back'
}

/** Roll an item for the kart in `place` of `n`, with u in [0, 1). Back of the pack rolls better. */
export function rollItem(place: number, n: number, u: number): ItemKind {
  const table = ITEM_TABLES[itemBucket(place, n)]
  const total = table.reduce((a, [, w]) => a + w, 0)
  let x = clamp(Number.isFinite(u) ? u : 0, 0, 0.999999) * total
  for (const [kind, w] of table) {
    if (x < w) return kind
    x -= w
  }
  return table[0][0]
}

// ---------------- world ----------------

export interface RacerInfo { id: string; name: string; color: string; bot?: boolean; char?: CritterId | null }

export function makeWorld(opts: {
  trackId: string; laps: number; racers: RacerInfo[]; seed: number; items?: boolean; walled?: boolean
  speed?: SpeedClass; gas?: 'auto' | 'hold'
}): World {
  const track = getTrack(opts.trackId)
  const speed: SpeedClass = opts.speed && opts.speed in SPEED_MUL ? opts.speed : 'rush'
  const karts: Kart[] = opts.racers.map((r, seat) => {
    const g = gridSpot(track, seat)
    const pr = project(track, g.x, g.y)
    return {
      id: r.id, seat, name: r.name, color: r.color, char: r.char ?? null,
      x: g.x, y: g.y, z: 0, vz: 0, a: g.a, vf: 0, vl: 0, steer: 0,
      hint: pr.i, s: pr.s, d: pr.d, level: levelAt(track, pr.i),
      prog: deltaS(0, pr.s, track.L), laps: 0, lapMs: [], finished: false, finishMs: null,
      spin: 0, spinDir: 1, invuln: 0, boost: 0, drift: 0, charge: 0,
      item: null, uses: 0, rolling: 0, shield: 0, coins: 0, bugs: 0, small: 0, sputter: 0, slip: 0, slipFx: 0,
      trick: false, lastF: null, lastB: false, rkSince: null, rockets: 0,
      hits: 0, off: false, wet: false, mud: false, worst: 1, bot: Boolean(r.bot),
    }
  })
  const items = opts.items ?? true
  const f = track.features
  const boxes: Box[] = []
  if (items) {
    for (const at of f.boxes ?? []) {
      for (const d of BOX_LANES) {
        const p = offsetAt(track, at * track.L, d * track.half)
        boxes.push({ x: p.x, y: p.y, level: levelAt(track, pointAt(track, at * track.L).i), respawn: 0 })
      }
    }
  }
  const coins: Coin[] = []
  for (const line of f.coins ?? []) {
    for (let i = 0; i < line.n; i++) {
      const s = line.at * track.L + i * 46
      const p = offsetAt(track, s, line.d * track.half)
      coins.push({ x: p.x, y: p.y, level: levelAt(track, pointAt(track, s).i), respawn: 0, loose: false, life: 0, safe: null, safeFor: 0 })
    }
  }
  const pads: Pad[] = (f.pads ?? []).map((p) => ({ s0: p.at * track.L, s1: p.at * track.L + (p.len ?? 0.012) * track.L, d: p.d * track.half }))
  const ramps: Ramp[] = (f.ramps ?? []).map((r) => ({ s0: r.at * track.L, s1: r.at * track.L + (r.len ?? 0.008) * track.L }))
  const hz = f.hazards ?? []
  const rng = mulberry32(opts.seed)
  const brains: Record<string, Brain> = {}
  const skillBase = speed === 'sunday' ? 0.35 : speed === 'florida' ? 0.72 : 0.55
  for (const k of karts) {
    if (!k.bot) continue
    const skill = skillBase + rng() * 0.26
    // Most bots time the start; the sloppier ones sometimes go early.
    const early = rng() < (1 - skill) * 0.35
    const rocketAt = early ? -(ROCKET_WINDOW_MS + 200 + rng() * 600) : -(80 + rng() * (ROCKET_WINDOW_MS - 120))
    brains[k.id] = { skill, steer: 0, hold: 0, noise: 0, noiseFor: 0, lift: 0, drifting: false, itemAt: 0, f: 0, rocketAt, hop: 0 }
  }
  const barrels: BarrelRow[] = hz.includes('barrels')
    ? BARREL_ROWS.map((at) => ({ at, lanes: barrelLanes(rng) }))
    : []
  return {
    track, laps: Math.max(1, Math.round(opts.laps)), speed, vmax: VMAX * SPEED_MUL[speed], gas: opts.gas === 'hold' ? 'hold' : 'auto',
    time: 0, started: false, karts, boxes, coins, mangos: [], coconuts: [], pelicans: [], hurricanes: [], pads, ramps,
    gator: track.gator && hz.includes('gator') ? { phase: 'lurk', t: 0, next: 4 + rng() * 4, ext: 0 } : null,
    gust: hz.includes('wind') ? { phase: 'calm', t: 0, next: 4 + rng() * 3, dir: 1, v: 0 } : null,
    rocket: hz.includes('rocket') && track.pad ? { phase: 'wait', t: 0 } : null,
    wave: hz.includes('wave') && track.waveAt !== null ? { phase: 'calm', t: 0, next: 5 + rng() * 4 } : null,
    barrels, barrelLap: 0, shake: 0,
    items, order: karts.map((k) => k.id), rng, nextId: 1, lastLeadAt: 0,
    bounds: opts.walled ? trackBounds(track) : { x0: 0, y0: 0, x1: track.w, y1: track.h },
    brains,
  }
}

/** I-4 construction: barrel rows (s fractions). */
export const BARREL_ROWS = [0.15, 0.4, 0.66, 0.88]

/** Two barrels per row, in two of three lanes (-0.6, 0, 0.6 of the half width). */
function barrelLanes(rng: () => number): number[] {
  const lanes = [-0.6, 0, 0.6]
  const skip = Math.floor(rng() * 3)
  return lanes.filter((_, i) => i !== skip)
}

/** Barrel positions right now, world coords. */
export function barrelSpots(w: World): { x: number; y: number; level: Level }[] {
  const t = w.track
  const out: { x: number; y: number; level: Level }[] = []
  for (const row of w.barrels) {
    for (const d of row.lanes) {
      const p = offsetAt(t, row.at * t.L, d * t.half)
      out.push({ x: p.x, y: p.y, level: levelAt(t, pointAt(t, row.at * t.L).i) })
    }
  }
  return out
}

/** Finished karts by finish time, then everyone else by progress. */
export function raceOrder(karts: Kart[]): string[] {
  return [...karts]
    .sort((a, b) => {
      if (a.finished && b.finished) return (a.finishMs ?? 0) - (b.finishMs ?? 0)
      if (a.finished !== b.finished) return a.finished ? -1 : 1
      return b.prog - a.prog
    })
    .map((k) => k.id)
}

/**
 * Where to be across the road just ahead (world units off the centerline): around I-4's barrels,
 * and (bots) onto a boost pad.
 */
export function laneAhead(w: World, k: Kart, pads = false): number {
  const t = w.track
  for (const row of w.barrels) {
    const ahead = deltaS(k.s, row.at * t.L, t.L)
    if (ahead < -30 || ahead > 280) continue
    const free = [-0.6, 0, 0.6].filter((d) => !row.lanes.includes(d))
    const best = free.sort((x, y) => Math.abs(x * t.half - k.d) - Math.abs(y * t.half - k.d))[0] ?? 0
    return best * t.half
  }
  if (pads) {
    for (const p of w.pads) {
      const ahead = deltaS(k.s, p.s0, t.L)
      if (ahead > 40 && ahead < 340) return p.d
    }
  }
  return 0
}

/** Steer toward a point ahead on the road (around barrels, or offset d). Finished karts and QA use it. */
export function autoSteer(w: World, k: Kart, look = 110, d?: number): number {
  const off = d ?? laneAhead(w, k)
  const p = off ? offsetAt(w.track, k.s + look, off) : pointAt(w.track, k.s + look)
  const want = Math.atan2(p.y - k.y, p.x - k.x)
  return clamp(angleWrap(want - k.a) * 2.2, -1, 1)
}

function setWorldVel(k: Kart, wx: number, wy: number) {
  const fx = Math.cos(k.a)
  const fy = Math.sin(k.a)
  k.vf = wx * fx + wy * fy
  k.vl = -wx * fy + wy * fx
}
function worldVel(k: Kart): [number, number] {
  const fx = Math.cos(k.a)
  const fy = Math.sin(k.a)
  return [fx * k.vf - fy * k.vl, fy * k.vf + fx * k.vl]
}

/** Mini-turbo tier for a drift charge: 0 none, 1 blue, 2 orange, 3 pink. */
export function mtTier(charge: number): 0 | 1 | 2 | 3 {
  return charge >= MT_TIERS[2] ? 3 : charge >= MT_TIERS[1] ? 2 : charge >= MT_TIERS[0] ? 1 : 0
}

function giveBoost(k: Kart, secs: number, why: BoostWhy, ev: SimEvent[], tier?: number) {
  k.boost = Math.max(k.boost, secs)
  ev.push(tier ? { t: 'boost', id: k.id, why, tier } : { t: 'boost', id: k.id, why })
}

function dropCoins(w: World, k: Kart, ev: SimEvent[]) {
  const n = Math.min(3, k.coins)
  if (n <= 0) return
  k.coins -= n
  for (let i = 0; i < n; i++) {
    const ang = k.a + Math.PI + (w.rng() - 0.5) * 2.2
    const r = 34 + w.rng() * 40
    w.coins.push({ x: k.x + Math.cos(ang) * r, y: k.y + Math.sin(ang) * r, level: k.level, respawn: 0, loose: true, life: LOOSE_COIN_LIFE, safe: k.id, safeFor: 1.2 })
  }
  ev.push({ t: 'drop', id: k.id, n })
}

function hit(w: World, k: Kart, kind: HitKind, by: string | null, ev: SimEvent[]) {
  if (k.invuln > 0 || k.finished) return
  if (k.shield > 0) {
    k.shield = 0
    k.invuln = 0.6
    ev.push({ t: 'block', id: k.id, by })
    return
  }
  k.spin = kind === 'coconut' || kind === 'pelican' || kind === 'hurricane' ? 1.3 : kind === 'gator' ? 1.2 : kind === 'storm' || kind === 'wave' ? 0.7 : 1.0
  k.spinDir = w.rng() < 0.5 ? -1 : 1
  k.invuln = k.spin + 0.8
  k.vf *= kind === 'coconut' || kind === 'pelican' || kind === 'hurricane' ? 0.25 : 0.45
  k.drift = 0
  k.charge = 0
  k.boost = 0
  k.slip = 0
  if (by && by !== k.id) {
    const shooter = w.karts.find((x) => x.id === by)
    if (shooter) shooter.hits += 1
  }
  ev.push({ t: 'hit', id: k.id, by, kind })
  dropCoins(w, k, ev)
}

function placeOf(w: World, id: string): number {
  return w.order.indexOf(id) + 1
}

function fireItem(w: World, k: Kart, ev: SimEvent[]) {
  const item = k.item
  if (!item || k.spin > 0 || k.rolling > 0) return
  if (item === 'cafecito3') {
    k.uses = Math.max(0, (k.uses || 3) - 1)
    if (k.uses <= 0) k.item = null
  } else k.item = null
  const fx = Math.cos(k.a)
  const fy = Math.sin(k.a)
  const t = w.track
  if (item === 'cafecito' || item === 'cafecito3') giveBoost(k, 1.2, 'item', ev)
  else if (item === 'floatie') k.shield = 10
  else if (item === 'mango') {
    w.mangos.push({ id: w.nextId++, x: k.x - fx * 32, y: k.y - fy * 32, level: k.level, owner: k.id, safe: 0.7, age: 0 })
    if (w.mangos.length > MANGO_MAX) w.mangos.shift()
  } else if (item === 'coconut') {
    const sp = COCONUT_SPEED + Math.max(0, k.vf) * 0.6
    w.coconuts.push({ id: w.nextId++, x: k.x + fx * 30, y: k.y + fy * 30, vx: fx * sp, vy: fy * sp, hint: k.hint, level: k.level, owner: k.id, age: 0, bounces: 0 })
  } else if (item === 'pelican') {
    const idx = w.order.indexOf(k.id)
    let target: string | null = null
    for (let i = idx - 1; i >= 0; i--) {
      const tk = w.karts.find((x) => x.id === w.order[i])
      if (tk && !tk.finished) { target = tk.id; break }
    }
    const p = offsetAt(t, k.s + 34, k.d)
    w.pelicans.push({ id: w.nextId++, s: k.s + 34, d: k.d, x: p.x, y: p.y, a: p.a, level: k.level, owner: k.id, target, age: 0 })
  } else if (item === 'lovebugs') {
    const ids: string[] = []
    for (const id of w.order.slice(0, Math.max(0, placeOf(w, k.id) - 1))) {
      const o = w.karts.find((x) => x.id === id)
      if (!o || o.finished) continue
      o.bugs = 3
      ids.push(id)
    }
    ev.push({ t: 'bugs', by: k.id, ids })
  } else if (item === 'storm') {
    ev.push({ t: 'storm', by: k.id })
    for (const o of w.karts) {
      if (o.id === k.id || o.finished) continue
      if (o.shield > 0) { o.shield = 0; o.invuln = 0.6; ev.push({ t: 'block', id: o.id, by: k.id }); continue }
      o.invuln = 0
      hit(w, o, 'storm', k.id, ev)
      o.small = 3
    }
  } else if (item === 'hurricane') {
    const lead = w.karts.find((x) => x.id === w.order[0])
    const target = lead && lead.id !== k.id && !lead.finished ? lead.id : null
    const p = pointAt(t, k.s)
    w.hurricanes.push({ id: w.nextId++, s: k.s, x: p.x, y: p.y, owner: k.id, target, age: 0 })
    ev.push({ t: 'hurricane', by: k.id, target })
  }
  ev.push({ t: 'use', id: k.id, item })
}

/** The key that counts for a rocket start: gas in hold mode, hop/drift with auto gas (gas is always on). */
export function startKey(w: World, inp: KartInput): boolean {
  return w.gas === 'hold' ? inp.g === 1 : inp.b === 1
}

/**
 * Before GO: call with the time to GO (ms, positive) every frame of the countdown. Records when
 * each kart's start key went down, for the rocket start. Bots follow their plan.
 */
export function prestep(w: World, inputs: Record<string, KartInput | undefined>, msToGo: number) {
  const tRel = -Math.max(0, msToGo)
  w.time = Math.min(w.time, tRel)
  for (const k of w.karts) {
    let down: boolean
    if (k.bot) down = tRel >= (w.brains[k.id]?.rocketAt ?? 0)
    else down = startKey(w, inputs[k.id] ?? NEUTRAL)
    if (down && k.rkSince === null) k.rkSince = tRel
    if (!down) k.rkSince = null
  }
}

/** At GO: rocket start, sputter, or nothing. Bots that never saw a prestep use their plan. */
function resolveStart(w: World, inputs: Record<string, KartInput | undefined>, ev: SimEvent[]) {
  w.started = true
  for (const k of w.karts) {
    let since = k.rkSince
    if (k.bot && since === null) since = w.brains[k.id]?.rocketAt ?? null
    if (!k.bot && since !== null && !startKey(w, inputs[k.id] ?? NEUTRAL)) since = null
    if (since === null) continue
    if (since >= -ROCKET_WINDOW_MS) {
      k.rockets += 1
      giveBoost(k, 1.0, 'rocket', ev)
      k.vf = Math.max(k.vf, w.vmax * 0.5)
      ev.push({ t: 'rocket', id: k.id, ok: true })
    } else {
      k.sputter = 0.9
      ev.push({ t: 'rocket', id: k.id, ok: false })
    }
  }
}

function onRamp(w: World, s: number): boolean {
  for (const r of w.ramps) {
    const ds = deltaS(r.s0, s, w.track.L)
    if (ds >= 0 && ds <= r.s1 - r.s0) return true
  }
  return false
}

function stepKart(w: World, k: Kart, inp: KartInput, dt: number, ev: SimEvent[]) {
  if (k.finished) inp = { s: autoSteer(w, k), g: 1, b: 0, f: k.lastF ?? 0 }

  // Item is a press counter: use on every increase. The first message only syncs it.
  if (k.lastF === null) k.lastF = inp.f
  else if (inp.f !== k.lastF) {
    if (inp.f > k.lastF) fireItem(w, k, ev)
    k.lastF = inp.f
  }
  const held = inp.b === 1
  const press = held && !k.lastB
  k.lastB = held

  if (k.invuln > 0) k.invuln = Math.max(0, k.invuln - dt)
  if (k.shield > 0) k.shield = Math.max(0, k.shield - dt)
  if (k.bugs > 0) k.bugs = Math.max(0, k.bugs - dt)
  if (k.small > 0) k.small = Math.max(0, k.small - dt)
  if (k.sputter > 0) k.sputter = Math.max(0, k.sputter - dt)
  if (k.slipFx > 0) k.slipFx = Math.max(0, k.slipFx - dt)
  if (k.rolling > 0) {
    k.rolling = Math.max(0, k.rolling - dt)
    if (k.rolling === 0 && k.item) ev.push({ t: 'pickup', id: k.id, item: k.item })
  }

  const air = k.z > 0 || k.vz > 0
  // Hop: a little bounce on the ground; in the air off a ramp, a trick.
  if (press && k.spin <= 0) {
    if (!air) k.vz = 110
    else if (k.z > 8 && !k.trick) k.trick = true
  }

  if (k.spin > 0) {
    k.spin = Math.max(0, k.spin - dt)
    k.a += k.spinDir * 11 * dt
    const [wx, wy] = worldVel(k)
    const decay = Math.exp(-2.2 * dt)
    setWorldVel(k, wx * decay, wy * decay)
    k.steer = 0
  } else {
    const steerIn = clamp(Number.isFinite(inp.s) ? inp.s : 0, -1, 1)
    const vmax = w.vmax
    if (!air && k.drift === 0 && held && Math.abs(steerIn) >= 0.45 && k.vf > vmax * 0.4) {
      k.drift = steerIn > 0 ? 1 : -1
      k.charge = 0
    }
    if (k.drift !== 0) {
      if (!held || k.vf < vmax * 0.3) {
        const tier = mtTier(k.charge)
        if (tier > 0) giveBoost(k, MT_BOOST[tier - 1], 'mt', ev, tier)
        k.drift = 0
        k.charge = 0
      } else if (!air) {
        k.charge += dt * (0.55 + 0.6 * Math.max(0, steerIn * k.drift))
      }
    }
    const eff = k.drift !== 0 ? k.drift * clamp(0.6 + 0.55 * steerIn * k.drift, 0.3, 1.15) : steerIn
    k.steer = eff

    let max = vmax * (1 + COIN_SPEED * k.coins)
    if (k.small > 0) max *= 0.75
    if (!air) {
      if (k.off) max *= SURFACE_SLOW[w.track.surface]
      else if (k.mud) max *= SURFACE_SLOW.mud
      if (k.wet && !k.off) max *= 0.45
    }
    if (smokeAt(w, k)) max *= 0.7
    if (k.finished) max *= 0.7
    if (k.boost > 0) {
      k.boost = Math.max(0, k.boost - dt)
      // Boosting ignores off-road.
      max = vmax * BOOST_MUL * (1 + COIN_SPEED * k.coins) * (k.small > 0 ? 0.8 : 1)
      k.vf = Math.min(max, k.vf + 900 * dt)
    }
    const accel = ACCEL * SPEED_MUL[w.speed]
    if (k.sputter > 0) {
      k.vf = Math.min(k.vf, 30)
    } else if (inp.g === 1 || k.boost > 0) {
      if (k.vf < max) k.vf = Math.min(max, k.vf + accel * dt * (k.vf < 0 ? 2 : 1))
    } else {
      k.vf -= Math.sign(k.vf) * Math.min(Math.abs(k.vf), COAST * dt)
    }
    if (k.vf > max) k.vf = max + (k.vf - max) * Math.exp(-3 * dt)

    const sf = clamp(Math.abs(k.vf) / 110, 0, 1)
    const da = TURN * (k.drift !== 0 ? 1.25 : 1) * (air ? 0.45 : 1) * sf * eff * (k.vf >= 0 ? 1 : -1) * dt
    if (da !== 0) {
      const c = Math.cos(da)
      const s = Math.sin(da)
      const vf = k.vf * c + k.vl * s
      const vl = -k.vf * s + k.vl * c
      k.a += da
      k.vf = vf
      k.vl = vl
    }
    const grip = air ? 1 : k.drift !== 0 ? 6 : k.off ? 8 : 14
    k.vl *= Math.exp(-grip * dt)
  }
  k.a = angleWrap(k.a)

  // Vertical: ramps launch, gravity lands.
  if (k.z <= 0 && k.vz <= 0 && k.vf > w.vmax * 0.35 && onRamp(w, k.s)) k.vz = Math.min(380, k.vf * 1.4)
  if (k.z > 0 || k.vz > 0) {
    k.z += k.vz * dt
    k.vz -= GRAVITY * dt
    if (k.z <= 0) {
      k.z = 0
      k.vz = 0
      if (k.trick) {
        k.trick = false
        giveBoost(k, 0.6, 'trick', ev)
      }
    }
  }

  const [wx, wy] = worldVel(k)
  k.x += wx * dt
  k.y += wy * dt
  // Keys wind: a sideways shove (world north/south; the bridges run east/west).
  if (w.gust && w.gust.phase === 'gust' && !k.finished) k.y += w.gust.dir * 75 * w.gust.v * dt
  const R = KART_R
  let bx = wx
  let by = wy
  let bumped = false
  const b = w.bounds
  if (k.x < b.x0 + R) { k.x = b.x0 + R; bx = Math.abs(bx) * 0.3; bumped = true }
  if (k.x > b.x1 - R) { k.x = b.x1 - R; bx = -Math.abs(bx) * 0.3; bumped = true }
  if (k.y < b.y0 + R) { k.y = b.y0 + R; by = Math.abs(by) * 0.3; bumped = true }
  if (k.y > b.y1 - R) { k.y = b.y1 - R; by = -Math.abs(by) * 0.3; bumped = true }
  if (bumped) setWorldVel(k, bx, by)

  trackKart(w, k, dt, ev)
}

function smokeAt(w: World, k: Kart): boolean {
  const r = w.rocket
  const pad = w.track.pad
  if (!r || !pad || r.phase !== 'lift' || r.t > 14) return false
  return (k.x - pad.x) ** 2 + (k.y - pad.y) ** 2 < 520 * 520
}

/** Smoke over the Launch Pad, 0..1 (thick right after liftoff, gone by 14 s). */
export function smokeLevel(w: World): number {
  const r = w.rocket
  if (!r || r.phase !== 'lift' || r.t > 14) return 0
  return r.t < 2 ? r.t / 2 : Math.max(0, 1 - (r.t - 2) / 12)
}

/** Update where the kart is on the track, and count laps. Reversing over the line never counts. */
export function trackKart(w: World, k: Kart, dt: number, ev: SimEvent[]) {
  const t = w.track
  const pr = project(t, k.x, k.y, k.hint)
  k.hint = pr.i
  k.level = levelAt(t, pr.i)
  k.off = pr.dist > t.half - 4
  k.wet = t.surface === 'water' ? k.off : inWater(t, k.x, k.y)
  k.mud = !k.off && inMud(t, pr.s, pr.d)
  const lim = w.vmax * BOOST_MUL * 1.7 * dt + 4
  const ds = clamp(deltaS(k.s, pr.s, t.L), -lim, lim)
  k.s = pr.s
  k.d = pr.d
  k.prog += ds
  const done = Math.floor(k.prog / t.L)
  if (!k.finished && done > k.laps) {
    k.laps = done
    // When, inside this step, did the line get crossed?
    const over = k.prog - done * t.L
    const frac = ds > 0 ? clamp(over / ds, 0, 1) : 0
    const at = Math.max(0, Math.round(w.time - frac * dt * 1000))
    k.lapMs.push(at)
    ev.push({ t: 'lap', id: k.id, lap: k.laps, time: at })
    if (k.laps >= w.laps) {
      k.finished = true
      k.finishMs = at
      k.drift = 0
      const place = w.karts.filter((x) => x.finished).length
      ev.push({ t: 'finish', id: k.id, time: at, place })
    } else if (k.laps === w.laps - 1) ev.push({ t: 'finalLap', id: k.id })
  }
}

function collide(w: World) {
  const ks = w.karts
  const R2 = KART_R * 2
  for (let i = 0; i < ks.length; i++) {
    for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i]
      const b = ks[j]
      if (!levelsTouch(a.level, b.level) || Math.abs(a.z - b.z) > 20) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= R2 * R2 || d2 === 0) continue
      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const push = (R2 - d) / 2
      // Small karts (storm) get shoved more.
      const wa = a.small > 0 && b.small <= 0 ? 1.6 : b.small > 0 && a.small <= 0 ? 0.4 : 1
      a.x -= nx * push * wa
      a.y -= ny * push * wa
      b.x += nx * push * (2 - wa)
      b.y += ny * push * (2 - wa)
      const [avx, avy] = worldVel(a)
      const [bvx, bvy] = worldVel(b)
      const rel = (avx - bvx) * nx + (avy - bvy) * ny
      if (rel > 0) {
        const imp = (1 + 0.5) * rel / 2
        setWorldVel(a, avx - imp * nx, avy - imp * ny)
        setWorldVel(b, bvx + imp * nx, bvy + imp * ny)
      }
    }
  }
}

/** Slipstream: tuck in right behind someone at speed for SLIP_TIME = a small boost. */
function slipstream(w: World, dt: number, ev: SimEvent[]) {
  for (const k of w.karts) {
    if (k.finished || k.spin > 0 || k.boost > 0 || k.vf < w.vmax * 0.6) { k.slip = Math.max(0, k.slip - dt * 2); continue }
    const fx = Math.cos(k.a)
    const fy = Math.sin(k.a)
    let tucked = false
    for (const o of w.karts) {
      if (o === k || !levelsTouch(o.level, k.level)) continue
      const dx = o.x - k.x
      const dy = o.y - k.y
      const along = dx * fx + dy * fy
      const side = Math.abs(-dx * fy + dy * fx)
      if (along > 36 && along < 170 && side < 26) { tucked = true; break }
    }
    if (tucked) {
      k.slip += dt
      if (k.slip >= SLIP_TIME) {
        k.slip = 0
        k.slipFx = 0.7
        giveBoost(k, 0.7, 'slip', ev)
      }
    } else k.slip = Math.max(0, k.slip - dt * 2)
  }
}

function stepItems(w: World, dt: number, ev: SimEvent[]) {
  const n = w.karts.length
  const t = w.track
  for (const box of w.boxes) {
    if (box.respawn > 0) { box.respawn = Math.max(0, box.respawn - dt); continue }
    for (const k of w.karts) {
      if (k.finished || k.z > 24 || !levelsTouch(box.level, k.level)) continue
      if ((k.x - box.x) ** 2 + (k.y - box.y) ** 2 > (KART_R + 18) ** 2) continue
      box.respawn = BOX_RESPAWN
      if (!k.item && k.rolling <= 0 && k.spin <= 0) {
        const place = w.order.indexOf(k.id) + 1
        k.item = rollItem(place, n, w.rng())
        k.uses = k.item === 'cafecito3' ? 3 : 0
        k.rolling = ROULETTE_MS / 1000
        ev.push({ t: 'roll', id: k.id })
      }
      break
    }
  }

  for (let i = w.coins.length - 1; i >= 0; i--) {
    const c = w.coins[i]
    if (c.loose) {
      c.life -= dt
      if (c.safeFor > 0) c.safeFor = Math.max(0, c.safeFor - dt)
      if (c.life <= 0) { w.coins.splice(i, 1); continue }
    } else if (c.respawn > 0) { c.respawn = Math.max(0, c.respawn - dt); continue }
    for (const k of w.karts) {
      if (k.finished || k.z > 24 || !levelsTouch(c.level, k.level)) continue
      if (c.loose && c.safe === k.id && c.safeFor > 0) continue
      if ((k.x - c.x) ** 2 + (k.y - c.y) ** 2 > (KART_R + 12) ** 2) continue
      k.coins = Math.min(COIN_MAX, k.coins + 1)
      ev.push({ t: 'coin', id: k.id, coins: k.coins })
      if (c.loose) w.coins.splice(i, 1)
      else c.respawn = COIN_RESPAWN
      break
    }
  }

  for (const k of w.karts) {
    if (k.finished || k.z > 4) continue
    for (const p of w.pads) {
      const ds = deltaS(p.s0, k.s, t.L)
      if (ds < 0 || ds > p.s1 - p.s0 || Math.abs(k.d - p.d) > 40) continue
      if (k.boost < 0.5) giveBoost(k, 0.9, 'pad', ev)
    }
  }

  for (let i = w.mangos.length - 1; i >= 0; i--) {
    const p = w.mangos[i]
    p.age += dt
    if (p.safe > 0) p.safe = Math.max(0, p.safe - dt)
    for (const k of w.karts) {
      if (k.finished || k.z > 12 || !levelsTouch(p.level, k.level)) continue
      if (k.id === p.owner && p.safe > 0) continue
      if ((k.x - p.x) ** 2 + (k.y - p.y) ** 2 > (KART_R + 11) ** 2) continue
      if (k.invuln > 0) continue
      w.mangos.splice(i, 1)
      hit(w, k, 'mango', p.owner, ev)
      break
    }
  }

  for (let i = w.coconuts.length - 1; i >= 0; i--) {
    const c = w.coconuts[i]
    c.age += dt
    c.x += c.vx * dt
    c.y += c.vy * dt
    const pr = project(t, c.x, c.y, c.hint)
    c.hint = pr.i
    c.level = levelAt(t, pr.i)
    let gone = c.age > COCONUT_LIFE
    if (pr.dist > t.half + 6) {
      // Bounce off the road edge: reflect across the edge's normal.
      if (c.bounces >= 2) gone = true
      else {
        c.bounces += 1
        const p = pointAt(t, pr.s)
        const nx = -p.ty * Math.sign(pr.d || 1)
        const ny = p.tx * Math.sign(pr.d || 1)
        const dot = c.vx * nx + c.vy * ny
        if (dot > 0) { c.vx -= 2 * dot * nx; c.vy -= 2 * dot * ny }
        const back = pr.dist - (t.half + 2)
        c.x -= nx * back
        c.y -= ny * back
      }
    }
    if (!gone) {
      for (const k of w.karts) {
        if (k.finished || k.z > 20 || !levelsTouch(c.level, k.level)) continue
        if (k.id === c.owner && c.age < 0.5) continue
        if ((k.x - c.x) ** 2 + (k.y - c.y) ** 2 > (KART_R + 12) ** 2) continue
        if (k.invuln > 0 && k.shield <= 0) continue
        hit(w, k, 'coconut', c.owner, ev)
        gone = true
        break
      }
    }
    if (gone) w.coconuts.splice(i, 1)
  }

  for (let i = w.pelicans.length - 1; i >= 0; i--) {
    const m = w.pelicans[i]
    m.age += dt
    m.s += PELICAN_SPEED * dt
    const target = m.target ? w.karts.find((k) => k.id === m.target && !k.finished) : undefined
    if (target) {
      const ahead = deltaS(m.s, target.s, t.L)
      if (ahead > -40 && ahead < 500) m.d += clamp(target.d - m.d, -150 * dt, 150 * dt)
    }
    m.d = clamp(m.d, -(t.half + 20), t.half + 20)
    const p = offsetAt(t, m.s, m.d)
    m.x = p.x
    m.y = p.y
    m.a = p.a
    m.level = levelAt(t, pointAt(t, m.s).i)
    let gone = m.age > PELICAN_LIFE
    if (!gone) {
      for (const k of w.karts) {
        if (k.id === m.owner || k.finished || !levelsTouch(m.level, k.level)) continue
        if ((k.x - m.x) ** 2 + (k.y - m.y) ** 2 > (KART_R + 12) ** 2) continue
        if (k.invuln > 0 && k.shield <= 0) continue
        hit(w, k, 'pelican', m.owner, ev)
        gone = true
        break
      }
    }
    if (gone) w.pelicans.splice(i, 1)
  }

  for (let i = w.hurricanes.length - 1; i >= 0; i--) {
    const h = w.hurricanes[i]
    h.age += dt
    const target = h.target ? w.karts.find((k) => k.id === h.target && !k.finished) : undefined
    if (!target || h.age > 12) { w.hurricanes.splice(i, 1); continue }
    h.s += HURRICANE_SPEED * dt
    const p = pointAt(t, h.s)
    h.x = p.x
    h.y = p.y
    const gap = deltaS(h.s, target.s, t.L)
    if (gap < 30) {
      // Landfall: the target and anyone close by.
      w.shake = Math.max(w.shake, 1)
      for (const k of w.karts) {
        if (k.finished) continue
        if (k.id !== target.id && (k.x - target.x) ** 2 + (k.y - target.y) ** 2 > 210 * 210) continue
        if (k.id === h.owner) continue
        k.invuln = 0
        hit(w, k, 'hurricane', h.owner, ev)
      }
      w.hurricanes.splice(i, 1)
    }
  }
}

function stepHazards(w: World, dt: number, ev: SimEvent[]) {
  const t = w.track
  const g = w.gator
  const lair = t.gator
  if (g && lair) {
    g.t += dt
    if (g.phase === 'lurk') {
      g.next -= dt
      g.ext = 0
      if (g.next <= 0) { g.phase = 'warn'; g.t = 0; ev.push({ t: 'gator' }) }
    } else if (g.phase === 'warn') {
      if (g.t >= 0.9) { g.phase = 'lunge'; g.t = 0 }
    } else if (g.phase === 'lunge') {
      const T = 1.5
      g.ext = g.t < 0.25 ? g.t / 0.25 : g.t > T - 0.35 ? Math.max(0, (T - g.t) / 0.35) : 1
      if (g.t >= T) { g.phase = 'lurk'; g.t = 0; g.ext = 0; g.next = 6 + w.rng() * 7 }
      if (g.ext > 0.5) {
        const tipx = lair.x + (lair.tx - lair.x) * g.ext
        const tipy = lair.y + (lair.ty - lair.y) * g.ext
        for (const k of w.karts) {
          if (k.finished || k.z > 30) continue
          if (distToSeg(k.x, k.y, lair.x, lair.y, tipx, tipy) < KART_R + 18) hit(w, k, 'gator', null, ev)
        }
      }
    }
  }

  const gu = w.gust
  if (gu) {
    gu.t += dt
    if (gu.phase === 'calm') {
      gu.v = 0
      if (gu.t >= gu.next) { gu.phase = 'warn'; gu.t = 0; gu.dir = w.rng() < 0.5 ? -1 : 1; ev.push({ t: 'gust', dir: gu.dir }) }
    } else if (gu.phase === 'warn') {
      gu.v = 0.2 * (gu.t / 1.2)
      if (gu.t >= 1.2) { gu.phase = 'gust'; gu.t = 0 }
    } else {
      const T = 2.6
      gu.v = Math.sin(Math.PI * clamp(gu.t / T, 0, 1))
      if (gu.t >= T) { gu.phase = 'calm'; gu.t = 0; gu.v = 0; gu.next = 5 + w.rng() * 4 }
    }
  }

  const r = w.rocket
  if (r) {
    const leadLaps = Math.max(0, ...w.karts.map((k) => k.laps))
    if (r.phase === 'wait' && leadLaps >= 1) {
      r.phase = 'lift'
      r.t = 0
      ev.push({ t: 'liftoff' })
    } else if (r.phase === 'lift') {
      r.t += dt
      if (r.t < 3) w.shake = Math.max(w.shake, 0.8 * (1 - r.t / 3))
    }
  }

  const wv = w.wave
  if (wv && t.waveAt !== null) {
    wv.t += dt
    if (wv.phase === 'calm') {
      if (wv.t >= wv.next) { wv.phase = 'warn'; wv.t = 0 }
    } else if (wv.phase === 'warn') {
      if (wv.t >= 1.3) { wv.phase = 'splash'; wv.t = 0; ev.push({ t: 'wave' }) }
    } else {
      if (wv.t < 0.25) {
        const center = t.waveAt * t.L
        for (const k of w.karts) {
          if (k.finished || k.z > 20) continue
          if (Math.abs(deltaS(center, k.s, t.L)) > 230) continue
          hit(w, k, 'wave', null, ev)
        }
      }
      if (wv.t >= 1.0) { wv.phase = 'calm'; wv.t = 0; wv.next = 6 + w.rng() * 5 }
    }
  }

  if (w.barrels.length) {
    const leadLaps = Math.max(0, ...w.karts.map((k) => k.laps))
    if (leadLaps > w.barrelLap) {
      // The crew moves the barrels every lap. Nobody knows why.
      w.barrelLap = leadLaps
      for (const row of w.barrels) row.lanes = barrelLanes(w.rng)
      ev.push({ t: 'barrels' })
    }
    for (const b of barrelSpots(w)) {
      for (const k of w.karts) {
        if (k.finished || k.z > 20 || !levelsTouch(b.level, k.level)) continue
        const dx = k.x - b.x
        const dy = k.y - b.y
        const d2 = dx * dx + dy * dy
        const R = KART_R + 18
        if (d2 >= R * R || d2 === 0) continue
        const d = Math.sqrt(d2)
        k.x = b.x + (dx / d) * R
        k.y = b.y + (dy / d) * R
        const [vx, vy] = worldVel(k)
        const nx = dx / d
        const ny = dy / d
        const dot = vx * nx + vy * ny
        if (dot < 0) setWorldVel(k, (vx - 1.4 * dot * nx) * 0.6, (vy - 1.4 * dot * ny) * 0.6)
        if (k.invuln <= 0) { k.invuln = 0.4; ev.push({ t: 'bump', id: k.id }) }
      }
    }
  }

  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 0.9)
}

export function gatorTip(w: World): { x: number; y: number } | null {
  const lair = w.track.gator
  if (!lair || !w.gator) return null
  return { x: lair.x + (lair.tx - lair.x) * w.gator.ext, y: lair.y + (lair.ty - lair.y) * w.gator.ext }
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const l2 = vx * vx + vy * vy || 1
  const u = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1)
  return Math.hypot(px - (ax + vx * u), py - (ay + vy * u))
}

// ---------------- the AI driver ----------------

/** Bot speed cap as a share of vmax: skill sets the base, rubber band pulls toward the best human. */
export function botCap(w: World, k: Kart): number {
  const b = w.brains[k.id]
  const base = 0.78 + 0.14 * (b?.skill ?? 0.6)
  const humans = w.karts.filter((x) => !x.bot && !x.finished)
  if (!humans.length) return base
  const ref = Math.max(...humans.map((h) => h.prog))
  const gap = ref - k.prog
  return clamp(base + clamp(gap / 1600, -0.12, 0.16), 0.62, 1.0)
}

function aheadKart(w: World, k: Kart): Kart | undefined {
  const i = w.order.indexOf(k.id)
  return i > 0 ? w.karts.find((x) => x.id === w.order[i - 1]) : undefined
}
function behindKart(w: World, k: Kart): Kart | undefined {
  const i = w.order.indexOf(k.id)
  return i >= 0 && i < w.order.length - 1 ? w.karts.find((x) => x.id === w.order[i + 1]) : undefined
}

/** Should a bot use the item in hand right now? Intent first, then impatience. */
function botWantsItem(w: World, k: Kart, b: Brain, want: number): boolean {
  const item = k.item
  if (!item || k.rolling > 0) return false
  const held = w.time - b.itemAt
  const ahead = aheadKart(w, k)
  const behind = behindKart(w, k)
  const gapAhead = ahead ? ahead.prog - k.prog : Infinity
  const gapBehind = behind ? k.prog - behind.prog : Infinity
  switch (item) {
    case 'mango':
      return gapBehind < 170 || held > 7000
    case 'coconut': {
      if (ahead && gapAhead < 520 && gapAhead > 30) {
        const ang = Math.atan2(ahead.y - k.y, ahead.x - k.x)
        if (Math.abs(angleWrap(ang - k.a)) < 0.22) return true
      }
      return held > 9000
    }
    case 'floatie': {
      if (placeOf(w, k.id) === 1) {
        // Hold it while leading; pop it when something is coming.
        const threat = w.coconuts.some((c) => c.owner !== k.id && (c.x - k.x) ** 2 + (c.y - k.y) ** 2 < 260 * 260)
          || w.pelicans.some((p) => p.target === k.id && Math.abs(deltaS(p.s, k.s, w.track.L)) < 300)
          || w.hurricanes.some((h) => h.target === k.id)
        return threat
      }
      return held > 2500
    }
    case 'cafecito':
    case 'cafecito3':
      return held > 600 && Math.abs(want) < 0.3 && !k.off
    default:
      return held > 900
  }
}

/**
 * The AI driver: follows the road ahead (toward boost pads, around barrels), reacts in chunks,
 * wobbles (less with skill, more with love bugs), lifts now and then, drifts hard turns for
 * mini-turbos, tricks off ramps, and uses items with intent. Rubber-banded toward the best human.
 * Decent, beatable, and deterministic for a given world seed.
 */
export function botInput(w: World, k: Kart, dt = STEP): KartInput {
  const b = w.brains[k.id]
  if (!b) return { ...NEUTRAL, g: 1 }
  const look = 80 + 60 * b.skill
  // Lane: a barrel just ahead pushes; a boost pad just ahead pulls.
  const want = autoSteer(w, k, look, laneAhead(w, k, true))
  b.noiseFor -= dt
  if (b.noiseFor <= 0) {
    b.noise = (w.rng() * 2 - 1) * ((1 - b.skill) * 0.9 + (k.bugs > 0 ? 0.6 : 0))
    b.noiseFor = 0.25 + w.rng() * 0.5
  }
  b.hold -= 1
  if (b.hold <= 0) {
    b.steer = Math.round(clamp(want + b.noise, -1, 1) * 10) / 10
    b.hold = 3 + Math.floor(w.rng() * (10 - 7 * b.skill))
  }
  if (b.lift > 0) b.lift = Math.max(0, b.lift - dt)
  else if (w.rng() < (1 - b.skill) * 0.005) b.lift = 0.2 + w.rng() * 0.4
  // Drift the hard turns; let go once it straightens out (a mini-turbo if it charged).
  if (!b.drifting && Math.abs(want) >= 0.75 && k.vf > w.vmax * 0.6 && w.rng() < b.skill * 0.05) b.drifting = true
  if (b.drifting && (Math.abs(want) < 0.3 || mtTier(k.charge) >= (b.skill > 0.8 ? 3 : 2))) b.drifting = false
  // In the air off a ramp: a trick, most of the time.
  let hop = false
  if (k.z > 10 && !k.trick && b.hop <= 0 && w.rng() < b.skill) { hop = true; b.hop = 0.3 }
  if (b.hop > 0) b.hop = Math.max(0, b.hop - dt)
  if (k.item && k.rolling <= 0) {
    if (!b.itemAt) b.itemAt = w.time
    else if (botWantsItem(w, k, b, want)) { b.f += 1; b.itemAt = k.item === 'cafecito3' && k.uses > 1 ? w.time : 0 }
  } else b.itemAt = 0
  const cap = w.vmax * botCap(w, k)
  return { s: b.steer, g: b.lift > 0 || (k.vf > cap && k.boost <= 0) ? 0 : 1, b: b.drifting || hop ? 1 : 0, f: b.f }
}

/** Advance the world one fixed step. Returns what happened. */
export function step(w: World, inputs: Record<string, KartInput | undefined>, dt = STEP): SimEvent[] {
  const ev: SimEvent[] = []
  if (w.time < 0) w.time = 0
  w.time += dt * 1000
  const used: Record<string, KartInput> = {}
  for (const k of w.karts) used[k.id] = k.bot ? botInput(w, k, dt) : inputs[k.id] ?? NEUTRAL
  if (!w.started) resolveStart(w, used, ev)
  for (const k of w.karts) stepKart(w, k, used[k.id], dt, ev)
  collide(w)
  slipstream(w, dt, ev)
  stepItems(w, dt, ev)
  stepHazards(w, dt, ev)
  const order = raceOrder(w.karts)
  if (order[0] !== w.order[0] && w.time - w.lastLeadAt > 2500 && w.time > 4000) {
    const lead = w.karts.find((k) => k.id === order[0])
    if (lead && !lead.finished && w.karts.length > 1) {
      w.lastLeadAt = w.time
      ev.push({ t: 'lead', id: lead.id })
    }
  }
  w.order = order
  if (w.time > 8000) {
    order.forEach((id, i) => {
      const k = w.karts.find((x) => x.id === id)
      if (k && !k.finished && i + 1 > k.worst) k.worst = i + 1
    })
  }
  return ev
}

/** Progress in laps (e.g. 1.42 = 42% into lap 2), for placing karts that did not finish. */
export function progressOf(w: World, k: Kart): number {
  if (k.finished) return w.laps
  return Math.max(0, Math.round((k.prog / w.track.L) * 100) / 100)
}

/** Fastest possible lap on a track (Florida Man, full coins, all boost), with margin: anything quicker is junk. */
export function minLapMs(trackId: string): number {
  const t = getTrack(trackId)
  return Math.round(((t.L * 0.7) / (VMAX * SPEED_MUL.florida * BOOST_MUL * (1 + COIN_SPEED * COIN_MAX))) * 1000)
}

// ---------------- the scene every renderer draws ----------------

export function kartFx(w: World, k: Kart): EngineKartFx {
  return {
    char: k.char, z: Math.round(k.z * 10) / 10, mt: k.drift !== 0 ? mtTier(k.charge) : 0, coins: k.coins,
    item: k.item, rolling: k.rolling > 0, bugs: k.bugs > 0, small: k.small > 0, trick: k.trick,
    place: Math.max(1, w.order.indexOf(k.id) + 1), lap: Math.min(w.laps, k.laps + 1), finished: k.finished,
    uses: k.uses, slip: k.slipFx > 0, sputter: k.sputter > 0, off: k.off && k.z <= 0, rocket: k.rockets > 0 && w.time < 2500 && k.boost > 0,
  }
}

function sceneKartOf(k: Kart): SceneKart {
  return {
    id: k.id, seat: k.seat, color: k.color, initial: k.name.slice(0, 1).toUpperCase(),
    x: k.x, y: k.y, a: k.a, level: k.level, spin: k.spin > 0, shield: k.shield > 0, boost: k.boost > 0,
    drift: k.drift !== 0, charged: mtTier(k.charge) >= 2, charge: k.charge, wet: k.wet && k.z <= 0, steer: k.steer,
  }
}

/** Static things (pads, ramps) per track, built once. */
const staticThings = new WeakMap<World, SceneThing[]>()
function padsAndRamps(w: World): SceneThing[] {
  let out = staticThings.get(w)
  if (!out) {
    const t = w.track
    out = [
      ...w.pads.map((p) => { const q = offsetAt(t, (p.s0 + p.s1) / 2, p.d); return { kind: 'pad' as const, x: q.x, y: q.y, a: q.a } }),
      ...w.ramps.map((r) => { const q = offsetAt(t, (r.s0 + r.s1) / 2, 0); return { kind: 'ramp' as const, x: q.x, y: q.y, a: q.a } }),
    ]
    staticThings.set(w, out)
  }
  return out
}

/** Wave state as one number: 0 calm, 0..1 building (warning), 1 splashing. */
export function waveLevel(w: World): number {
  const v = w.wave
  if (!v || v.phase === 'calm') return 0
  if (v.phase === 'warn') return clamp(v.t / 1.3, 0.01, 0.99)
  return 1
}

/** Everything a renderer needs, from the host's own World. */
export function turnpikeScene(w: World): TurnpikeScene {
  const things: SceneThing[] = [...padsAndRamps(w)]
  for (const b of w.boxes) things.push({ kind: 'box', x: b.x, y: b.y, on: b.respawn <= 0 })
  for (const c of w.coins) things.push({ kind: 'coin', x: c.x, y: c.y, on: c.loose || c.respawn <= 0 })
  for (const m of w.mangos) things.push({ kind: 'mango', x: m.x, y: m.y })
  for (const c of w.coconuts) things.push({ kind: 'coconut', x: c.x, y: c.y, a: Math.atan2(c.vy, c.vx) })
  for (const p of w.pelicans) things.push({ kind: 'pelican', x: p.x, y: p.y, a: p.a, z: 30 })
  for (const h of w.hurricanes) things.push({ kind: 'hurricane', x: h.x, y: h.y })
  for (const b of barrelSpots(w)) things.push({ kind: 'barrel', x: b.x, y: b.y })
  const extra: Omit<TurnpikeSceneExtra, 'fx'> & { fx: Record<string, EngineKartFx> } = {
    fx: Object.fromEntries(w.karts.map((k) => [k.id, kartFx(w, k)])),
    things,
    shake: Math.round(w.shake * 100) / 100,
    wind: w.gust ? w.gust.dir * w.gust.v : 0,
    rocket: w.rocket && w.rocket.phase === 'lift' ? clamp(w.rocket.t / 9, 0, 1) : 0,
    gatorTip: w.gator && w.gator.ext > 0 ? gatorTip(w) : null,
    order: [...w.order],
    laps: w.laps,
  }
  const base: Scene = {
    track: w.track,
    time: w.time,
    karts: w.karts.map(sceneKartOf),
    boxes: w.boxes.map((b) => ({ x: b.x, y: b.y, on: b.respawn <= 0, level: b.level })),
    peels: w.mangos.map((p) => ({ x: p.x, y: p.y, level: p.level })),
    missiles: [
      ...w.pelicans.map((m) => ({ x: m.x, y: m.y, a: m.a })),
      ...w.coconuts.map((c) => ({ x: c.x, y: c.y, a: Math.atan2(c.vy, c.vx) })),
    ],
    gatorExt: w.gator?.ext ?? 0,
    gatorWarn: w.gator?.phase === 'warn',
  }
  return { ...base, ...extra, wave: waveLevel(w), smoke: smokeLevel(w), gatorWarnOn: w.gator?.phase === 'warn' }
}

// ---------------- compact snapshots for other screens ('kart:pos') ----------------

/**
 * Per kart: [seat, x, y, angle*100, z, steer*10, flags, laps, coins, item].
 * flags: 1 spin, 2 shield, 4 boost, 8 drift, 16 rolling, 32 bugs, 64 small, 128 trick, 256 finished,
 * 512 off-road, 1024 wet, 2048 slipstream, 4096 sputter, 8192 rocket start, mt tier << 14 (2 bits).
 * item: 0 none, else ITEM_KINDS index + 1; Triple Cafecito uses ride in the hundreds (uses*100 + idx).
 */
export type KartRow = [number, number, number, number, number, number, number, number, number, number]
export interface PosSnapshot {
  /** Race time, ms. */
  t: number
  k: KartRow[]
  /** Order, seats, 1st first. */
  o: number[]
  /** Box bitmask (bit i = box i is up). */
  bx?: number
  /** Track coins up, 30-bit chunks. */
  cn?: number[]
  /** Loose coins, flat [x, y, ...]. */
  lc?: number[]
  /** Mangos [x, y, ...], coconuts [x, y, a*100, ...], pelicans [x, y, a*100, ...], hurricanes [x, y, ...]. */
  mg?: number[]
  cc?: number[]
  pl?: number[]
  hu?: number[]
  /** Barrel lanes, row by row, d*10. */
  br?: number[]
  /** Gator ext*100, +1000 while warning. */
  g?: number
  /** wind*100, rocket*100, shake*100, wave*100, smoke*100. */
  wd?: number
  rk?: number
  sh?: number
  wv?: number
  sm?: number
}

export function kartFlags(w: World, k: Kart): number {
  const fx = kartFx(w, k)
  return (k.spin > 0 ? 1 : 0) | (k.shield > 0 ? 2 : 0) | (k.boost > 0 ? 4 : 0) | (k.drift !== 0 ? 8 : 0)
    | (k.rolling > 0 ? 16 : 0) | (k.bugs > 0 ? 32 : 0) | (k.small > 0 ? 64 : 0) | (k.trick ? 128 : 0)
    | (k.finished ? 256 : 0) | (fx.off ? 512 : 0) | (k.wet && k.z <= 0 ? 1024 : 0) | (fx.slip ? 2048 : 0)
    | (k.sputter > 0 ? 4096 : 0) | (fx.rocket ? 8192 : 0) | (fx.mt << 14)
}

export function itemCode(k: Pick<Kart, 'item' | 'uses'>): number {
  if (!k.item) return 0
  const idx = ITEM_KINDS.indexOf(k.item) + 1
  return k.item === 'cafecito3' ? Math.max(1, k.uses) * 100 + idx : idx
}

const r1 = (v: number) => Math.round(v)
const nz = (v: number) => (v === 0 ? undefined : v)

export function snapshot(w: World): PosSnapshot {
  const seatOf = new Map(w.karts.map((k) => [k.id, k.seat]))
  let bx = 0
  w.boxes.forEach((b, i) => { if (b.respawn <= 0 && i < 31) bx |= 1 << i })
  const track = w.coins.filter((c) => !c.loose)
  const cn: number[] = []
  track.forEach((c, i) => {
    const chunk = Math.floor(i / 30)
    if (cn.length <= chunk) cn.push(0)
    if (c.respawn <= 0) cn[chunk] |= 1 << (i % 30)
  })
  const loose = w.coins.filter((c) => c.loose)
  const out: PosSnapshot = {
    t: r1(w.time),
    k: w.karts.map((k) => [k.seat, r1(k.x), r1(k.y), r1(k.a * 100), r1(k.z), Math.round(k.steer * 10), kartFlags(w, k), k.laps, k.coins, itemCode(k)]),
    o: w.order.map((id) => seatOf.get(id) ?? 0),
  }
  if (w.boxes.length) out.bx = bx
  if (track.length) out.cn = cn
  if (loose.length) out.lc = loose.flatMap((c) => [r1(c.x), r1(c.y)])
  if (w.mangos.length) out.mg = w.mangos.flatMap((m) => [r1(m.x), r1(m.y)])
  if (w.coconuts.length) out.cc = w.coconuts.flatMap((c) => [r1(c.x), r1(c.y), r1(Math.atan2(c.vy, c.vx) * 100)])
  if (w.pelicans.length) out.pl = w.pelicans.flatMap((p) => [r1(p.x), r1(p.y), r1(p.a * 100)])
  if (w.hurricanes.length) out.hu = w.hurricanes.flatMap((h) => [r1(h.x), r1(h.y)])
  if (w.barrels.length) out.br = w.barrels.flatMap((row) => row.lanes.map((d) => Math.round(d * 10)))
  if (w.gator) out.g = nz(Math.round(w.gator.ext * 100) + (w.gator.phase === 'warn' ? 1000 : 0))
  if (w.gust) out.wd = nz(Math.round(w.gust.dir * w.gust.v * 100))
  if (w.rocket) out.rk = nz(w.rocket.phase === 'lift' ? Math.round(clamp(w.rocket.t / 9, 0, 1) * 100) : 0)
  out.sh = nz(Math.round(w.shake * 100))
  if (w.wave) out.wv = nz(Math.round(waveLevel(w) * 100))
  if (w.rocket) out.sm = nz(Math.round(smokeLevel(w) * 100))
  for (const key of Object.keys(out) as (keyof PosSnapshot)[]) if (out[key] === undefined) delete out[key]
  return out
}
