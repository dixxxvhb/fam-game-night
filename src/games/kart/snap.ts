/**
 * 'kart:pos' on the receiving end: decode the host's compact snapshots into the same scene shape
 * the host draws from its own World (TurnpikeScene), and interpolate between two of them so a
 * screen at 60 fps looks smooth off 10 snapshots a second. Pure: time is passed in.
 */
import type { CritterId, SceneThing } from './contract'
import { BARREL_ROWS, ITEM_KINDS, type ItemKind, type PosSnapshot, type KartRow } from './sim'
import type { EngineKartFx, SceneKart, TurnpikeScene } from './render'
import { BOX_LANES, levelAt, offsetAt, pointAt, project, type Level, type Track } from './tracks'

/** Host sends a snapshot this often. */
export const POS_EVERY_MS = 100
/** Screens draw this far in the past, so there is (almost) always a newer snapshot to blend toward. */
export const INTERP_DELAY_MS = 150

/** Who sits in which grid seat (seat = index). Build it from state.grid + the room's players. */
export interface RosterEntry { id: string; name: string; color: string; char: CritterId | null }
export type Roster = RosterEntry[]

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u
}
function lerpAngle(a: number, b: number, u: number) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * u
}

/** A snapshot between a and b (u 0..1). Positions blend; everything discrete comes from b. */
export function interpolate(a: PosSnapshot, b: PosSnapshot, u: number): PosSnapshot {
  if (u >= 1 || a === b) return b
  const uu = Math.max(0, u)
  const k: KartRow[] = b.k.map((row) => {
    const prev = a.k.find((r) => r[0] === row[0])
    if (!prev) return row
    const ang = lerpAngle(prev[3] / 100, row[3] / 100, uu)
    return [row[0], lerp(prev[1], row[1], uu), lerp(prev[2], row[2], uu), ang * 100, lerp(prev[4], row[4], uu), row[5], row[6], row[7], row[8], row[9]]
  })
  const flat = (x: number[] | undefined, y: number[] | undefined, stride: number, angleAt = -1): number[] | undefined => {
    if (!y) return y
    if (!x || x.length !== y.length) return y
    return y.map((v, i) => (i % stride === angleAt ? lerpAngle(x[i] / 100, v / 100, uu) * 100 : lerp(x[i], v, uu)))
  }
  return {
    ...b,
    t: lerp(a.t, b.t, uu),
    k,
    mg: flat(a.mg, b.mg, 2),
    cc: flat(a.cc, b.cc, 3, 2),
    pl: flat(a.pl, b.pl, 3, 2),
    hu: flat(a.hu, b.hu, 2),
    lc: b.lc,
    wd: lerp(a.wd ?? 0, b.wd ?? 0, uu),
    rk: lerp(a.rk ?? 0, b.rk ?? 0, uu),
    sh: lerp(a.sh ?? 0, b.sh ?? 0, uu),
    g: b.g !== undefined && a.g !== undefined && b.g < 1000 && a.g < 1000 ? lerp(a.g, b.g, uu) : b.g,
  }
}

function itemOf(code: number): { item: ItemKind | null; uses: number } {
  if (!code) return { item: null, uses: 0 }
  const idx = code % 100
  const item = ITEM_KINDS[idx - 1] ?? null
  return { item, uses: item === 'cafecito3' ? Math.floor(code / 100) : 0 }
}

/** Kart heights on the figure eight: a per-seat projection hint keeps the bridge right. */
export type Hints = Map<number, number>

function levelFor(t: Track, x: number, y: number, hints: Hints, seat: number): Level {
  const pr = project(t, x, y, hints.get(seat) ?? -1)
  hints.set(seat, pr.i)
  return levelAt(t, pr.i)
}

/** Box positions for a track (same order as the host's world.boxes). */
const boxCache = new WeakMap<Track, { x: number; y: number; level: Level }[]>()
function boxesOf(t: Track): { x: number; y: number; level: Level }[] {
  let out = boxCache.get(t)
  if (!out) {
    out = []
    for (const at of t.features.boxes ?? []) {
      for (const d of BOX_LANES) {
        const p = offsetAt(t, at * t.L, d * t.half)
        out.push({ x: p.x, y: p.y, level: levelAt(t, pointAt(t, at * t.L).i) })
      }
    }
    boxCache.set(t, out)
  }
  return out
}

/** Track coin positions (same order as the host's non-loose world.coins). */
const coinCache = new WeakMap<Track, { x: number; y: number }[]>()
function coinsOf(t: Track): { x: number; y: number }[] {
  let out = coinCache.get(t)
  if (!out) {
    out = []
    for (const line of t.features.coins ?? []) {
      for (let i = 0; i < line.n; i++) {
        const p = offsetAt(t, line.at * t.L + i * 46, line.d * t.half)
        out.push({ x: p.x, y: p.y })
      }
    }
    coinCache.set(t, out)
  }
  return out
}

const staticCache = new WeakMap<Track, SceneThing[]>()
function padsAndRamps(t: Track): SceneThing[] {
  let out = staticCache.get(t)
  if (!out) {
    out = [
      ...(t.features.pads ?? []).map((p) => {
        const s = p.at * t.L + ((p.len ?? 0.012) * t.L) / 2
        const q = offsetAt(t, s, p.d * t.half)
        return { kind: 'pad' as const, x: q.x, y: q.y, a: q.a }
      }),
      ...(t.features.ramps ?? []).map((r) => {
        const q = offsetAt(t, r.at * t.L + ((r.len ?? 0.008) * t.L) / 2, 0)
        return { kind: 'ramp' as const, x: q.x, y: q.y, a: q.a }
      }),
    ]
    staticCache.set(t, out)
  }
  return out
}

/** One snapshot (raw or interpolated) to a full TurnpikeScene. `laps` from state; `time` for drawing clocks. */
export function decodeSnapshot(track: Track, roster: Roster, snap: PosSnapshot, laps: number, hints: Hints = new Map()): TurnpikeScene {
  const karts: SceneKart[] = []
  const fx: Record<string, EngineKartFx> = {}
  const placeBySeat = new Map(snap.o.map((seat, i) => [seat, i + 1]))
  for (const row of snap.k) {
    const [seat, x, y, a100, z, steer10, f, lapsDone, coins, code] = row
    const r = roster[seat]
    if (!r) continue
    const { item, uses } = itemOf(code)
    const mt = ((f >> 14) & 3) as 0 | 1 | 2 | 3
    karts.push({
      id: r.id, seat, color: r.color, initial: r.name.slice(0, 1).toUpperCase(), x, y, a: a100 / 100,
      level: levelFor(track, x, y, hints, seat),
      spin: (f & 1) > 0, shield: (f & 2) > 0, boost: (f & 4) > 0, drift: (f & 8) > 0, charged: mt >= 2,
      charge: mt >= 3 ? 1.9 : mt === 2 ? 1.2 : mt === 1 ? 0.6 : 0, wet: (f & 1024) > 0, steer: steer10 / 10,
    })
    fx[r.id] = {
      char: r.char, z, mt, coins, item, uses, rolling: (f & 16) > 0, bugs: (f & 32) > 0, small: (f & 64) > 0,
      trick: (f & 128) > 0, place: placeBySeat.get(seat) ?? seat + 1, lap: Math.min(laps, lapsDone + 1), finished: (f & 256) > 0,
      off: (f & 512) > 0, slip: (f & 2048) > 0, sputter: (f & 4096) > 0, rocket: (f & 8192) > 0,
    }
  }
  const things: SceneThing[] = [...padsAndRamps(track)]
  const boxes = boxesOf(track).map((b, i) => ({ ...b, on: ((snap.bx ?? 0) >> i) & 1 ? true : false }))
  for (const b of boxes) things.push({ kind: 'box', x: b.x, y: b.y, on: b.on })
  coinsOf(track).forEach((c, i) => {
    const chunk = snap.cn?.[Math.floor(i / 30)] ?? 0
    things.push({ kind: 'coin', x: c.x, y: c.y, on: ((chunk >> (i % 30)) & 1) === 1 })
  })
  const lc = snap.lc ?? []
  for (let i = 0; i + 1 < lc.length; i += 2) things.push({ kind: 'coin', x: lc[i], y: lc[i + 1], on: true })
  const mg = snap.mg ?? []
  const peels: TurnpikeScene['peels'] = []
  for (let i = 0; i + 1 < mg.length; i += 2) {
    things.push({ kind: 'mango', x: mg[i], y: mg[i + 1] })
    peels.push({ x: mg[i], y: mg[i + 1], level: 0 })
  }
  const missiles: TurnpikeScene['missiles'] = []
  const cc = snap.cc ?? []
  for (let i = 0; i + 2 < cc.length; i += 3) {
    things.push({ kind: 'coconut', x: cc[i], y: cc[i + 1], a: cc[i + 2] / 100 })
    missiles.push({ x: cc[i], y: cc[i + 1], a: cc[i + 2] / 100 })
  }
  const pl = snap.pl ?? []
  for (let i = 0; i + 2 < pl.length; i += 3) {
    things.push({ kind: 'pelican', x: pl[i], y: pl[i + 1], a: pl[i + 2] / 100, z: 30 })
    missiles.push({ x: pl[i], y: pl[i + 1], a: pl[i + 2] / 100 })
  }
  const hu = snap.hu ?? []
  for (let i = 0; i + 1 < hu.length; i += 2) things.push({ kind: 'hurricane', x: hu[i], y: hu[i + 1] })
  const br = snap.br ?? []
  let bi = 0
  for (const at of BARREL_ROWS) {
    if (bi >= br.length) break
    for (let j = 0; j < 2 && bi < br.length; j++, bi++) {
      const p = offsetAt(track, at * track.L, (br[bi] / 10) * track.half)
      things.push({ kind: 'barrel', x: p.x, y: p.y })
    }
  }
  const g = snap.g ?? 0
  const gatorExt = (g % 1000) / 100
  const lair = track.gator
  const gatorTip = lair && gatorExt > 0 ? { x: lair.x + (lair.tx - lair.x) * gatorExt, y: lair.y + (lair.ty - lair.y) * gatorExt } : null
  const order = snap.o.map((seat) => roster[seat]?.id).filter((id): id is string => Boolean(id))
  return {
    track, time: snap.t, karts, boxes, peels, missiles, gatorExt, gatorWarn: g >= 1000,
    fx, things, shake: (snap.sh ?? 0) / 100, wind: (snap.wd ?? 0) / 100, rocket: (snap.rk ?? 0) / 100,
    gatorTip, order, laps, wave: (snap.wv ?? 0) / 100, smoke: (snap.sm ?? 0) / 100, gatorWarnOn: g >= 1000,
  }
}

/** Sanity check for whatever arrived on 'kart:pos'. */
export function isSnapshot(d: unknown): d is PosSnapshot {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  return typeof o.t === 'number' && Array.isArray(o.k) && Array.isArray(o.o) && o.k.every((r) => Array.isArray(r) && r.length >= 10)
}

/**
 * Keeps the last few snapshots and hands back the scene to draw at a moment. Push with the local
 * receive time; ask for `now - INTERP_DELAY_MS`. Snapshots from a new race (time going backwards)
 * clear the buffer.
 */
export class SnapBuffer {
  private list: { at: number; d: PosSnapshot }[] = []
  private hints: Hints = new Map()
  max = 10

  push(d: unknown, at: number) {
    if (!isSnapshot(d)) return
    const last = this.list[this.list.length - 1]
    if (last && d.t < last.d.t - 1000) { this.list = []; this.hints = new Map() }
    this.list.push({ at, d })
    if (this.list.length > this.max) this.list.shift()
  }

  clear() {
    this.list = []
    this.hints = new Map()
  }

  get size() {
    return this.list.length
  }

  /** The newest raw snapshot. */
  latest(): PosSnapshot | null {
    return this.list[this.list.length - 1]?.d ?? null
  }

  /** The interpolated snapshot for local time `renderAt`. */
  sample(renderAt: number): PosSnapshot | null {
    const list = this.list
    if (!list.length) return null
    if (renderAt <= list[0].at) return list[0].d
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i]
      const b = list[i + 1]
      if (a.at <= renderAt && b.at >= renderAt) {
        const span = b.at - a.at
        return interpolate(a.d, b.d, span > 0 ? (renderAt - a.at) / span : 1)
      }
    }
    return list[list.length - 1].d
  }

  /** The scene to draw at local time `renderAt` (usually now - INTERP_DELAY_MS). */
  scene(track: Track, roster: Roster, laps: number, renderAt: number): TurnpikeScene | null {
    const s = this.sample(renderAt)
    return s ? decodeSnapshot(track, roster, s, laps, this.hints) : null
  }
}

/** The racer's own HUD bits from a snapshot (phones): place, lap, coins, item, roulette, drift tier. */
export function hudOf(snap: PosSnapshot, seat: number, laps: number): {
  place: number; lap: number; coins: number; item: ItemKind | null; uses: number; rolling: boolean; mt: 0 | 1 | 2 | 3; finished: boolean
} | null {
  const row = snap.k.find((r) => r[0] === seat)
  if (!row) return null
  const f = row[6]
  const { item, uses } = itemOf(row[9])
  return {
    place: snap.o.indexOf(seat) + 1 || seat + 1, lap: Math.min(laps, row[7] + 1), coins: row[8], item, uses,
    rolling: (f & 16) > 0, mt: ((f >> 14) & 3) as 0 | 1 | 2 | 3, finished: (f & 256) > 0,
  }
}
