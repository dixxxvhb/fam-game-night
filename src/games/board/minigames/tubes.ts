import type { MgBase, MgResult, Minigame } from './types'
import { isNum, noise, obj, secs1, seedFrom, strHash } from './util'
import {
  DT, HOLD_MS, STEP, StickCursor, body, dist, quantize, reducePos, reduceStick, simIds, simMemo, stepAt, stepTime, stickMove,
  type Body, type RtBase,
} from './rt'

/**
 * Bumper Tubes: everyone in an inner tube in the wave pool. Steer, ram, bounce. Leave the pool
 * and you are out. The lifeguard pulls the lane rope in as the clock runs down. Last one
 * floating wins. 1 vs 2: the solo rides the big tube; the other two have to knock it out.
 */

export const TUBES_MS = 30_000
export const POOL_X = 80
export const POOL_Y = 45
export const POOL_R0 = 40
export const POOL_R1 = 23
export const SHRINK_AT = 11_000
export const TUBE_R = 6.5
export const BIG_R = 8.6
export const BIG_MASS = 2.2
/** Thrust (units/s^2), drag per 50 ms step, top speed. */
export const THRUST = 88
export const DRAG = 0.93
export const MAX_V = 95
/** Bounciness, and a minimum shove so every bump reads. */
export const BOUNCE = 1.25
export const KICK = 16
export const BUMP_GAP_MS = 250
const MAX_BUMP = 160

export interface TubeBump { by: string; to: string; ix: number; iy: number; t: number }

export interface TubesState extends MgBase, RtBase {
  /** When each player left the pool (host time), or null. */
  outs: Record<string, number | null>
  /** Shoves phones gave to bot tubes (bots get their own physics from the sim). */
  bumps: TubeBump[]
}

// ---------------- physics (shared by the sim and the phones) ----------------

export function poolR(startAt: number, t: number): number {
  const e = t - startAt - SHRINK_AT
  if (e <= 0) return POOL_R0
  const f = Math.min(1, e / (TUBES_MS - SHRINK_AT))
  return POOL_R0 + (POOL_R1 - POOL_R0) * f
}

export function tubeR(s: Pick<TubesState, 'format' | 'solo'>, id: string): number {
  return s.format === '1v2' && id === s.solo ? BIG_R : TUBE_R
}

export function tubeMass(s: Pick<TubesState, 'format' | 'solo'>, id: string): number {
  return s.format === '1v2' && id === s.solo ? BIG_MASS : 1
}

/** One step of a tube: thrust, drag, speed cap, move. */
export function stepTube(b: Body, sx: number, sy: number) {
  b.px = b.x
  b.py = b.y
  b.vx = (b.vx + sx * THRUST * DT) * DRAG
  b.vy = (b.vy + sy * THRUST * DT) * DRAG
  const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
  if (v > MAX_V) { b.vx = (b.vx / v) * MAX_V; b.vy = (b.vy / v) * MAX_V }
  b.x += b.vx * DT
  b.y += b.vy * DT
}

export interface Hit { dvx: number; dvy: number; px: number; py: number; ovx: number; ovy: number }

/**
 * Tube `a` against tube `o`: what happens to `a` (velocity change and push out of overlap) and
 * what happens to `o` (its velocity change). Null when they are not touching.
 */
export function collide(a: { x: number; y: number; vx: number; vy: number }, ra: number, ma: number, o: { x: number; y: number; vx: number; vy: number }, ro: number, mo: number): Hit | null {
  const dx = a.x - o.x
  const dy = a.y - o.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d >= ra + ro || d < 1e-6) return null
  const nx = dx / d
  const ny = dy / d
  const over = ra + ro - d
  const share = mo / (ma + mo)
  const vrel = (a.vx - o.vx) * nx + (a.vy - o.vy) * ny
  if (vrel >= 0) return { dvx: 0, dvy: 0, px: nx * over * share, py: ny * over * share, ovx: 0, ovy: 0 }
  const j = (-(1 + BOUNCE) * vrel) / (1 / ma + 1 / mo)
  const ka = j / ma + KICK * share
  const ko = j / mo + KICK * (1 - share)
  return { dvx: nx * ka, dvy: ny * ka, px: nx * over * share, py: ny * over * share, ovx: -nx * ko, ovy: -ny * ko }
}

export function isOut(startAt: number, t: number, x: number, y: number): boolean {
  return dist(x, y, POOL_X, POOL_Y) > poolR(startAt, t)
}

const SPAWN: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-22, 0], [22, 0]],
  3: [[0, -20], [19, 11], [-19, 11]],
  4: [[-22, 0], [22, 0], [0, -20], [0, 20]],
}

export function tubeSpawn(s: Pick<TubesState, 'players' | 'format' | 'solo'>, id: string): [number, number] {
  if (s.format === '1v2' && s.solo) {
    if (id === s.solo) return [POOL_X, POOL_Y]
    const team = s.players.filter((p) => p !== s.solo)
    const [dx, dy] = team.indexOf(id) === 0 ? [-26, 0] : [26, 0]
    return [POOL_X + dx, POOL_Y + dy]
  }
  const n = Math.min(4, Math.max(1, s.players.length))
  const [dx, dy] = SPAWN[n][Math.max(0, s.players.indexOf(id)) % n]
  return [POOL_X + dx, POOL_Y + dy]
}

// ---------------- the bot sim ----------------

export interface TubesWorld {
  step: number
  bodies: Record<string, Body>
  cur: Record<string, StickCursor>
  outs: Record<string, number>
  bi: number
}

export const tubesSim = simMemo<TubesState, TubesWorld>(
  (s) => {
    const bodies: Record<string, Body> = {}
    const cur: Record<string, StickCursor> = {}
    for (const id of simIds(s)) {
      const [x, y] = tubeSpawn(s, id)
      bodies[id] = body(x, y)
      cur[id] = new StickCursor(s.sticks[id])
    }
    return { step: 0, bodies, cur, outs: {}, bi: 0 }
  },
  (s, w) => {
    const t0 = stepTime(s.startAt, w.step)
    const t1 = t0 + STEP
    const over = t0 >= endAt(s)
    while (w.bi < s.bumps.length && s.bumps[w.bi].t <= t1) {
      const b = s.bumps[w.bi++]
      const tb = w.bodies[b.to]
      if (tb && !(b.to in w.outs)) { tb.vx += b.ix; tb.vy += b.iy }
    }
    const ids = Object.keys(w.bodies).filter((id) => !(id in w.outs))
    for (const id of ids) {
      const [sx, sy] = over ? [0, 0] : w.cur[id].at(t0)
      stepTube(w.bodies[id], sx, sy)
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = w.bodies[ids[i]]
        const o = w.bodies[ids[j]]
        const h = collide(a, tubeR(s, ids[i]), tubeMass(s, ids[i]), o, tubeR(s, ids[j]), tubeMass(s, ids[j]))
        if (!h) continue
        const k = tubeMass(s, ids[i]) / tubeMass(s, ids[j])
        a.vx += h.dvx; a.vy += h.dvy; a.x += h.px; a.y += h.py
        o.vx += h.ovx; o.vy += h.ovy; o.x -= h.px * k; o.y -= h.py * k
      }
    }
    if (!over) {
      for (const id of ids) {
        const b = w.bodies[id]
        if (isOut(s.startAt, t1, b.x, b.y)) { w.outs[id] = t1; b.vx *= 0.3; b.vy *= 0.3 }
      }
    }
    w.step++
  },
)

export function tubesAt(s: TubesState, t: number): TubesWorld {
  return tubesSim(s, Math.max(0, Math.min(stepAt(s.startAt, t), stepAt(s.startAt, s.startAt + TUBES_MS + HOLD_MS))))
}

// ---------------- rules ----------------

export function endAt(s: TubesState): number {
  const timeUp = s.startAt + TUBES_MS
  const outs = s.players.map((id) => s.outs[id]).filter((t): t is number => t !== null && t !== undefined).sort((a, b) => a - b)
  let early = Infinity
  if (s.format === '1v2' && s.solo) {
    const so = s.outs[s.solo]
    const team = s.players.filter((id) => id !== s.solo)
    const teamOuts = team.map((id) => s.outs[id]).filter((t): t is number => t !== null && t !== undefined)
    if (so !== null && so !== undefined) early = so
    else if (teamOuts.length === team.length) early = Math.max(...teamOuts)
  } else if (s.players.length >= 2 && outs.length >= s.players.length - 1) early = outs[s.players.length - 2]
  return Math.min(timeUp, early)
}

export function floating(s: TubesState, id: string, t: number): boolean {
  const o = s.outs[id]
  return o === null || o === undefined || o > t
}

function tubesResult(s: TubesState): MgResult {
  const end = endAt(s)
  const alive = s.players.filter((id) => floating(s, id, end))
  const lines: Record<string, string> = {}
  const scores: Record<string, number> = {}
  for (const id of s.players) {
    if (floating(s, id, end)) { scores[id] = 1e7; lines[id] = 'Still floating' }
    else { scores[id] = s.outs[id]! - s.startAt; lines[id] = `Splashed at ${secs1(s.outs[id]! - s.startAt)}` }
  }
  const places: Record<string, number> = {}
  const order = [...s.players].sort((a, b) => scores[b] - scores[a])
  order.forEach((id, i) => { const prev = order[i - 1]; places[id] = prev !== undefined && scores[prev] === scores[id] ? places[prev] : i + 1 })
  if (s.format === '1v2' && s.solo) {
    const winner: 'solo' | 'team' = floating(s, s.solo, end) ? 'solo' : 'team'
    for (const id of s.players) places[id] = (id === s.solo) === (winner === 'solo') ? 1 : 2
    return {
      places, winner, lines,
      headline: winner === 'solo' ? `@{${s.solo}} rode the big tube and nobody could move it` : `The team sank @{${s.solo}}. Big tube, small problem.`,
      moment: null,
    }
  }
  let headline = 'Everybody fell in. The lifeguard is not paid enough for this.'
  if (alive.length === 1) headline = `@{${alive[0]}} rules the wave pool`
  else if (alive.length > 1) headline = `${alive.length === 2 ? `@{${alive[0]}} and @{${alive[1]}}` : 'Everyone'} still floating at the whistle`
  return { places, lines, headline, moment: null }
}

export const tubes: Minigame<TubesState> = {
  id: 'tubes',
  name: 'Bumper Tubes',
  rule: 'Steer your inner tube. Ram the others out of the pool. The pool shrinks. Last one floating wins.',
  formats: ['ffa', '1v2', 'duel'],
  soloRule: 'The solo rides the big heavy tube and just has to stay in. The other two have to knock it out.',
  setup: (a) => ({
    players: a.players, format: a.format, solo: a.solo, startAt: a.startAt,
    seed: seedFrom(a.random), sticks: {}, pos: {},
    outs: Object.fromEntries(a.players.map((id) => [id, null])), bumps: [],
  }),
  reduce(s, id, type, payload, ctx) {
    if (!s.players.includes(id)) return s
    const now = ctx.now
    if (type === 'stick') return reduceStick(s, id, payload, now)
    if (type === 'pos') return reducePos(s, id, payload, now)
    if (type === 'out') {
      if (!floating(s, id, Infinity) || now < s.startAt || now > endAt(s) + 300) return s
      return { ...s, outs: { ...s.outs, [id]: Math.min(now, s.startAt + TUBES_MS) } }
    }
    if (type === 'bump') {
      const p = obj(payload)
      const to = p.to
      if (typeof to !== 'string' || to === id || !s.players.includes(to) || !(to in s.sticks) || !floating(s, to, now)) return s
      if (!isNum(p.ix, -MAX_BUMP, MAX_BUMP) || !isNum(p.iy, -MAX_BUMP, MAX_BUMP)) return s
      if (now < s.startAt || now >= endAt(s) || s.bumps.length >= 400) return s
      const last = [...s.bumps].reverse().find((b) => b.by === id && b.to === to)
      if (last && now - last.t < BUMP_GAP_MS - 60) return s
      return { ...s, bumps: [...s.bumps, { by: id, to, ix: Math.round(p.ix * 10) / 10, iy: Math.round(p.iy * 10) / 10, t: now }] }
    }
    return s
  },
  tick: (s) => s,
  done: (s, now) => now >= endAt(s) + HOLD_MS,
  result: tubesResult,
  bot(s, id, ctx) {
    const now = ctx.now
    if (!(id in s.sticks)) return { type: 'stick', payload: { x: 0, y: 0 } }
    if (now < s.startAt || !floating(s, id, now)) return null
    const w = tubesAt(s, now)
    if (id in w.outs) return { type: 'out' }
    if (now >= endAt(s)) return null
    const b = w.bodies[id]
    if (!b) return null
    return stickMove(s, id, botSteer(s, w, id, b, now), now)
  },
}

/** Where a tube is, as best the host knows: the sim for bots, the last report for phones. */
function tubeGuess(s: TubesState, w: TubesWorld, id: string, now: number): { x: number; y: number; vx: number; vy: number } | null {
  const sb = w.bodies[id]
  if (sb) return sb
  const p = s.pos[id]
  if (!p) return null
  const age = Math.min(0.6, (now - p.t) / 1000)
  return { x: p.x + p.vx * age, y: p.y + p.vy * age, vx: p.vx, vy: p.vy }
}

function botSteer(s: TubesState, w: TubesWorld, id: string, b: Body, now: number): [number, number] {
  const h = strHash(id) ^ s.seed
  const R = poolR(s.startAt, now)
  const fromC = dist(b.x, b.y, POOL_X, POOL_Y)
  // Near the edge and drifting out: paddle home.
  const outward = ((b.x - POOL_X) * b.vx + (b.y - POOL_Y) * b.vy) / Math.max(1, fromC)
  if (fromC > R - 8 - Math.max(0, outward) * 0.12) return quantize(POOL_X - b.x, POOL_Y - b.y, 1)
  const slot = Math.floor((now - s.startAt) / 1400)
  if (noise(h, slot, 41) < 0.16) return [0, 0]
  const rivals = s.players.filter((o) => o !== id && floating(s, o, now) && !(o in w.outs) && (s.format !== '1v2' || (id === s.solo) !== (o === s.solo)))
  let tgt: { x: number; y: number; vx: number; vy: number } | null = null
  let best = Infinity
  for (const o of rivals) {
    const g = tubeGuess(s, w, o, now)
    if (!g) continue
    const d = dist(b.x, b.y, g.x, g.y) * (0.8 + noise(h, slot, strHash(o)) * 0.5)
    if (d < best) { best = d; tgt = g }
  }
  if (s.format === '1v2' && id === s.solo) {
    // The big tube just holds the middle and shoves whoever comes close.
    if (!tgt || best > 18) return fromC > 6 ? quantize(POOL_X - b.x, POOL_Y - b.y, 0.5) : [0, 0]
  }
  if (!tgt) return quantize(POOL_X - b.x, POOL_Y - b.y, 0.5)
  // Come at them from the middle so the hit sends them toward the edge.
  const tc = dist(tgt.x, tgt.y, POOL_X, POOL_Y)
  const lead = 0.25
  const px = tgt.x + tgt.vx * lead
  const py = tgt.y + tgt.vy * lead
  if (tc > 4 && fromC > tc + 2) {
    const ux = (tgt.x - POOL_X) / tc
    const uy = (tgt.y - POOL_Y) / tc
    return quantize(px - ux * 12 - b.x, py - uy * 12 - b.y, 1)
  }
  return quantize(px - b.x, py - b.y, 1)
}
