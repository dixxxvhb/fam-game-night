/**
 * The race simulation. Runs only on the device that owns the race: the TV in together mode,
 * each phone for its own time trial in apart mode. Fixed timestep, seeded randomness, no DOM.
 * The World is a mutable object (it is not game state: it never goes over the wire whole).
 */
import {
  deltaS, getTrack, gridSpot, inWater, levelAt, levelsTouch, offsetAt, pointAt, project, trackBounds,
  WORLD_H, WORLD_W, type Bounds, type Level, type Track,
} from './tracks'

export type ItemKind = 'boost' | 'peel' | 'missile' | 'shield'
export const ITEM_KINDS: ItemKind[] = ['boost', 'peel', 'missile', 'shield']
export const ITEM_NAMES: Record<ItemKind, string> = { boost: 'Boost', peel: 'Peel', missile: 'Missile', shield: 'Shield' }

/** What a phone sends: steer -1..1 (0.1 steps), gas, brake/drift held, fire press counter. */
export interface KartInput { s: number; g: 0 | 1; b: 0 | 1; f: number }
export const NEUTRAL: KartInput = { s: 0, g: 0, b: 0, f: 0 }

export const STEP = 1 / 60
export const VMAX = 240
export const BOOST_MUL = 1.45
const ACCEL = 330
const COAST = 90
const BRAKE = 520
const REVERSE_MAX = 70
const TURN = 2.7
export const KART_R = 16
const MISSILE_SPEED = 520
const MISSILE_LIFE = 5
const PEEL_MAX = 12
const BOX_RESPAWN = 3

export interface Kart {
  id: string
  seat: number
  name: string
  color: string
  x: number
  y: number
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
  shield: number
  lastF: number | null
  hits: number
  off: boolean
  wet: boolean
}

export interface Box { x: number; y: number; level: Level; respawn: number }
export interface Peel { id: number; x: number; y: number; level: Level; owner: string; safe: number; age: number }
export interface Missile { id: number; s: number; d: number; x: number; y: number; a: number; level: Level; owner: string; target: string | null; age: number }
export interface GatorState { phase: 'lurk' | 'warn' | 'lunge'; t: number; next: number; ext: number }

export interface World {
  track: Track
  laps: number
  /** Ms since GO. */
  time: number
  karts: Kart[]
  boxes: Box[]
  peels: Peel[]
  missiles: Missile[]
  gator: GatorState | null
  items: boolean
  order: string[]
  rng: () => number
  nextId: number
  lastLeadAt: number
  /** Walls. The TV race uses the whole screen; a phone's solo trial is walled to what it shows. */
  bounds: Bounds
}

export type SimEvent =
  | { t: 'lap'; id: string; lap: number; time: number }
  | { t: 'finish'; id: string; time: number; place: number }
  | { t: 'hit'; id: string; by: string | null; kind: 'peel' | 'missile' | 'gator' }
  | { t: 'block'; id: string; by: string | null }
  | { t: 'pickup'; id: string; item: ItemKind }
  | { t: 'use'; id: string; item: ItemKind }
  | { t: 'lead'; id: string }

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
export const ITEM_TABLES: Record<'leader' | 'front' | 'mid' | 'back', Table> = {
  leader: [['peel', 70], ['shield', 20], ['boost', 10], ['missile', 0]],
  front: [['peel', 35], ['shield', 25], ['boost', 22], ['missile', 18]],
  mid: [['peel', 20], ['shield', 20], ['boost', 30], ['missile', 30]],
  back: [['peel', 5], ['shield', 15], ['boost', 40], ['missile', 40]],
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
  let x = clamp(u, 0, 0.999999) * total
  for (const [kind, w] of table) {
    if (x < w) return kind
    x -= w
  }
  return table[0][0]
}

// ---------------- world ----------------

export interface RacerInfo { id: string; name: string; color: string }

export function makeWorld(opts: { trackId: string; laps: number; racers: RacerInfo[]; seed: number; items?: boolean; walled?: boolean }): World {
  const track = getTrack(opts.trackId)
  const karts: Kart[] = opts.racers.map((r, seat) => {
    const g = gridSpot(track, seat)
    const pr = project(track, g.x, g.y)
    return {
      id: r.id, seat, name: r.name, color: r.color,
      x: g.x, y: g.y, a: g.a, vf: 0, vl: 0, steer: 0,
      hint: pr.i, s: pr.s, d: pr.d, level: levelAt(track, pr.i),
      prog: deltaS(0, pr.s, track.L), laps: 0, lapMs: [], finished: false, finishMs: null,
      spin: 0, spinDir: 1, invuln: 0, boost: 0, drift: 0, charge: 0,
      item: null, shield: 0, lastF: null, hits: 0, off: false, wet: false,
    }
  })
  const items = opts.items ?? true
  const boxes: Box[] = []
  if (items) {
    for (const f of track.boxes) {
      for (const d of [-0.55, 0, 0.55]) {
        const p = offsetAt(track, f * track.L, d * track.half)
        const pr = project(track, p.x, p.y, pointAt(track, f * track.L).i)
        boxes.push({ x: p.x, y: p.y, level: levelAt(track, pr.i), respawn: 0 })
      }
    }
  }
  const rng = mulberry32(opts.seed)
  return {
    track, laps: Math.max(1, Math.round(opts.laps)), time: 0, karts, boxes, peels: [], missiles: [],
    gator: track.gator ? { phase: 'lurk', t: 0, next: 4 + rng() * 4, ext: 0 } : null,
    items, order: karts.map((k) => k.id), rng, nextId: 1, lastLeadAt: 0,
    bounds: opts.walled ? trackBounds(track) : { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H },
  }
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

/** Steer toward a point on the centerline ahead. Finished karts cruise on it (and QA drives with it). */
export function autoSteer(w: World, k: Kart, look = 110): number {
  const p = pointAt(w.track, k.s + look)
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

function hit(w: World, k: Kart, kind: 'peel' | 'missile' | 'gator', by: string | null, ev: SimEvent[]) {
  if (k.invuln > 0 || k.finished) return
  if (k.shield > 0) {
    k.shield = 0
    k.invuln = 0.6
    ev.push({ t: 'block', id: k.id, by })
    return
  }
  k.spin = kind === 'missile' ? 1.3 : kind === 'gator' ? 1.2 : 1.0
  k.spinDir = w.rng() < 0.5 ? -1 : 1
  k.invuln = k.spin + 0.8
  k.vf *= kind === 'missile' ? 0.25 : 0.45
  k.drift = 0
  k.charge = 0
  k.boost = 0
  if (by && by !== k.id) {
    const shooter = w.karts.find((x) => x.id === by)
    if (shooter) shooter.hits += 1
  }
  ev.push({ t: 'hit', id: k.id, by, kind })
}

function fireItem(w: World, k: Kart, ev: SimEvent[]) {
  const item = k.item
  if (!item || k.spin > 0) return
  k.item = null
  const fx = Math.cos(k.a)
  const fy = Math.sin(k.a)
  if (item === 'boost') k.boost = Math.max(k.boost, 1.2)
  else if (item === 'shield') k.shield = 12
  else if (item === 'peel') {
    w.peels.push({ id: w.nextId++, x: k.x - fx * 30, y: k.y - fy * 30, level: k.level, owner: k.id, safe: 0.7, age: 0 })
    if (w.peels.length > PEEL_MAX) w.peels.shift()
  } else if (item === 'missile') {
    const idx = w.order.indexOf(k.id)
    let target: string | null = null
    for (let i = idx - 1; i >= 0; i--) {
      const t = w.karts.find((x) => x.id === w.order[i])
      if (t && !t.finished) { target = t.id; break }
    }
    const p = offsetAt(w.track, k.s + 34, k.d)
    w.missiles.push({ id: w.nextId++, s: k.s + 34, d: k.d, x: p.x, y: p.y, a: p.a, level: k.level, owner: k.id, target, age: 0 })
  }
  ev.push({ t: 'use', id: k.id, item })
}

function stepKart(w: World, k: Kart, inp: KartInput, dt: number, ev: SimEvent[]) {
  if (k.finished) inp = { s: autoSteer(w, k), g: 1, b: 0, f: k.lastF ?? 0 }

  // FIRE is a press counter: fire on every increase. The first message only syncs it.
  if (k.lastF === null) k.lastF = inp.f
  else if (inp.f !== k.lastF) {
    if (inp.f > k.lastF) fireItem(w, k, ev)
    k.lastF = inp.f
  }

  if (k.invuln > 0) k.invuln = Math.max(0, k.invuln - dt)
  if (k.shield > 0) k.shield = Math.max(0, k.shield - dt)

  if (k.spin > 0) {
    k.spin = Math.max(0, k.spin - dt)
    k.a += k.spinDir * 11 * dt
    const [wx, wy] = worldVel(k)
    const decay = Math.exp(-2.2 * dt)
    setWorldVel(k, wx * decay, wy * decay)
    k.steer = 0
  } else {
    const steerIn = clamp(Number.isFinite(inp.s) ? inp.s : 0, -1, 1)
    const held = inp.b === 1
    if (k.drift === 0 && held && Math.abs(steerIn) >= 0.45 && k.vf > VMAX * 0.4) {
      k.drift = steerIn > 0 ? 1 : -1
      k.charge = 0
    }
    if (k.drift !== 0) {
      if (!held || k.vf < VMAX * 0.3) {
        if (k.charge >= 1.25) k.boost = Math.max(k.boost, 1.1)
        else if (k.charge >= 0.55) k.boost = Math.max(k.boost, 0.6)
        k.drift = 0
        k.charge = 0
      } else {
        k.charge += dt * (0.55 + 0.6 * Math.max(0, steerIn * k.drift))
      }
    }
    const eff = k.drift !== 0 ? k.drift * clamp(0.6 + 0.55 * steerIn * k.drift, 0.3, 1.15) : steerIn
    k.steer = eff
    const braking = held && k.drift === 0

    let max = VMAX
    if (k.off) max *= 0.5
    if (k.wet) max *= 0.4
    if (k.finished) max *= 0.7
    if (k.boost > 0) {
      k.boost = Math.max(0, k.boost - dt)
      max = VMAX * BOOST_MUL * (k.off ? 0.7 : 1) * (k.wet ? 0.6 : 1)
      k.vf = Math.min(max, k.vf + 900 * dt)
    }

    if (braking) {
      if (k.vf > 0) k.vf = Math.max(0, k.vf - BRAKE * dt)
      else k.vf = Math.max(-REVERSE_MAX, k.vf - 140 * dt)
    } else if (inp.g === 1 || k.boost > 0) {
      if (k.vf < max) k.vf = Math.min(max, k.vf + ACCEL * dt * (k.vf < 0 ? 2 : 1))
    } else {
      k.vf -= Math.sign(k.vf) * Math.min(Math.abs(k.vf), COAST * dt)
    }
    if (k.vf > max) k.vf = max + (k.vf - max) * Math.exp(-3 * dt)

    const sf = clamp(Math.abs(k.vf) / 110, 0, 1)
    const da = TURN * (k.drift !== 0 ? 1.25 : 1) * sf * eff * (k.vf >= 0 ? 1 : -1) * dt
    if (da !== 0) {
      const c = Math.cos(da)
      const s = Math.sin(da)
      const vf = k.vf * c + k.vl * s
      const vl = -k.vf * s + k.vl * c
      k.a += da
      k.vf = vf
      k.vl = vl
    }
    const grip = k.drift !== 0 ? 6 : k.off ? 8 : 14
    k.vl *= Math.exp(-grip * dt)
  }
  k.a = angleWrap(k.a)

  const [wx, wy] = worldVel(k)
  k.x += wx * dt
  k.y += wy * dt
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

/** Update where the kart is on the track, and count laps. Reversing over the line never counts. */
export function trackKart(w: World, k: Kart, dt: number, ev: SimEvent[]) {
  const t = w.track
  const pr = project(t, k.x, k.y, k.hint)
  k.hint = pr.i
  k.level = levelAt(t, pr.i)
  k.off = pr.dist > t.half - 4
  k.wet = inWater(t, k.x, k.y)
  const lim = VMAX * BOOST_MUL * 1.6 * dt + 4
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
      const place = w.karts.filter((x) => x.finished).length
      ev.push({ t: 'finish', id: k.id, time: at, place })
    }
  }
}

function collide(w: World) {
  const ks = w.karts
  const R2 = KART_R * 2
  for (let i = 0; i < ks.length; i++) {
    for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i]
      const b = ks[j]
      if (!levelsTouch(a.level, b.level)) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= R2 * R2 || d2 === 0) continue
      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const push = (R2 - d) / 2
      a.x -= nx * push
      a.y -= ny * push
      b.x += nx * push
      b.y += ny * push
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

function stepItems(w: World, dt: number, ev: SimEvent[]) {
  const n = w.karts.length
  for (const box of w.boxes) {
    if (box.respawn > 0) { box.respawn = Math.max(0, box.respawn - dt); continue }
    for (const k of w.karts) {
      if (k.finished || !levelsTouch(box.level, k.level)) continue
      if ((k.x - box.x) ** 2 + (k.y - box.y) ** 2 > (KART_R + 16) ** 2) continue
      box.respawn = BOX_RESPAWN
      if (!k.item && k.spin <= 0) {
        const place = w.order.indexOf(k.id) + 1
        k.item = rollItem(place, n, w.rng())
        ev.push({ t: 'pickup', id: k.id, item: k.item })
      }
      break
    }
  }

  for (let i = w.peels.length - 1; i >= 0; i--) {
    const p = w.peels[i]
    p.age += dt
    if (p.safe > 0) p.safe = Math.max(0, p.safe - dt)
    for (const k of w.karts) {
      if (k.finished || !levelsTouch(p.level, k.level)) continue
      if (k.id === p.owner && p.safe > 0) continue
      if ((k.x - p.x) ** 2 + (k.y - p.y) ** 2 > (KART_R + 11) ** 2) continue
      if (k.invuln > 0) continue
      w.peels.splice(i, 1)
      hit(w, k, 'peel', p.owner, ev)
      break
    }
  }

  const t = w.track
  for (let i = w.missiles.length - 1; i >= 0; i--) {
    const m = w.missiles[i]
    m.age += dt
    m.s += MISSILE_SPEED * dt
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
    let gone = m.age > MISSILE_LIFE
    if (!gone) {
      for (const k of w.karts) {
        if (k.id === m.owner || k.finished || !levelsTouch(m.level, k.level)) continue
        if ((k.x - m.x) ** 2 + (k.y - m.y) ** 2 > (KART_R + 10) ** 2) continue
        if (k.invuln > 0 && k.shield <= 0) continue
        hit(w, k, 'missile', m.owner, ev)
        gone = true
        break
      }
    }
    if (gone) w.missiles.splice(i, 1)
  }

  const g = w.gator
  const lair = t.gator
  if (g && lair) {
    g.t += dt
    if (g.phase === 'lurk') {
      g.next -= dt
      g.ext = 0
      if (g.next <= 0) { g.phase = 'warn'; g.t = 0 }
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
          if (k.finished) continue
          if (distToSeg(k.x, k.y, lair.x, lair.y, tipx, tipy) < KART_R + 16) hit(w, k, 'gator', null, ev)
        }
      }
    }
  }
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

/** Advance the world one fixed step. Returns what happened. */
export function step(w: World, inputs: Record<string, KartInput | undefined>, dt = STEP): SimEvent[] {
  const ev: SimEvent[] = []
  w.time += dt * 1000
  for (const k of w.karts) stepKart(w, k, inputs[k.id] ?? NEUTRAL, dt, ev)
  collide(w)
  stepItems(w, dt, ev)
  const order = raceOrder(w.karts)
  if (order[0] !== w.order[0] && w.time - w.lastLeadAt > 2500 && w.time > 4000) {
    const lead = w.karts.find((k) => k.id === order[0])
    if (lead && !lead.finished && w.karts.length > 1) {
      w.lastLeadAt = w.time
      ev.push({ t: 'lead', id: lead.id })
    }
  }
  w.order = order
  return ev
}

/** Progress in laps (e.g. 1.42 = 42% into lap 2), for placing karts that did not finish. */
export function progressOf(w: World, k: Kart): number {
  if (k.finished) return w.laps
  return Math.max(0, Math.round((k.prog / w.track.L) * 100) / 100)
}

/** Fastest possible lap on a track, with margin: anything quicker is junk. */
export function minLapMs(trackId: string): number {
  const t = getTrack(trackId)
  return Math.round(((t.L * 0.7) / (VMAX * BOOST_MUL)) * 1000)
}

// ---------------- compact snapshots for other screens ('kart:pos') ----------------

/** [seat, x, y, angle*100, laps, flags] per kart; flags: 1 spin, 2 shield, 4 boost, 8 drift, 16 drift charged. */
export type KartRow = [number, number, number, number, number, number]
export interface PosSnapshot {
  t: number
  k: KartRow[]
  pe: [number, number][]
  mi: [number, number, number][]
  g: number
  bx: number[]
}

export function kartFlags(k: Kart): number {
  return (k.spin > 0 ? 1 : 0) | (k.shield > 0 ? 2 : 0) | (k.boost > 0 ? 4 : 0) | (k.drift !== 0 ? 8 : 0) | (k.charge >= 1.25 ? 16 : 0)
}

export function snapshot(w: World): PosSnapshot {
  return {
    t: Math.round(w.time),
    k: w.karts.map((k) => [k.seat, Math.round(k.x), Math.round(k.y), Math.round(k.a * 100), k.laps, kartFlags(k)]),
    pe: w.peels.map((p) => [Math.round(p.x), Math.round(p.y)]),
    mi: w.missiles.map((m) => [Math.round(m.x), Math.round(m.y), Math.round(m.a * 100)]),
    g: w.gator ? Math.round(w.gator.ext * 100) : 0,
    bx: w.boxes.map((b) => (b.respawn > 0 ? 0 : 1)),
  }
}
