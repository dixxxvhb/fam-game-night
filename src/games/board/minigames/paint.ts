import type { MgBase, Minigame } from './types'
import { botNoise, isInt, isNum, judge, noise, obj, seedFrom, strHash } from './util'
import {
  FIELD, HOLD_MS, STEP, StickCursor, body, dist, quantize, reducePos, reduceStick, simIds, simMemo, stepAt, stepTime, stepWalker, stickMove,
  walkSpawn, type Body, type RtBase,
} from './rt'

/**
 * Wet Paint: the boardwalk is a grid of planks. Run over a plank and it turns your color
 * (painting over someone else's counts). Most planks when the whistle goes wins.
 * Co-op: paint the whole boardwalk together before the clock runs out. 1 vs 2: the solo
 * against the team's average.
 */

export const PAINT_MS = 25_000
export const COLS = 16
export const ROWS = 7
export const CELLS = COLS * ROWS
export const CELL_W = (FIELD.x1 - FIELD.x0) / COLS
export const CELL_H = (FIELD.y1 - FIELD.y0) / ROWS
/** Co-op: this share of the planks painted (any color) wins. */
const MAX_BATCH = 40

export interface PaintState extends MgBase, RtBase {
  /** Owner of each plank as a seat index into players, or -1. */
  cells: number[]
  /** Bots: the sim time their painting has been reported up to. */
  upTo: Record<string, number>
  /** Co-op: when the last plank got painted. */
  fullAt: number | null
  /** Co-op: how far (host time) the House's power washer has been applied. */
  washT: number
}

/** Co-op only: Mingo power-washes the boardwalk, one sweep at a time (relative ms, direction). */
export const WASHES: readonly { from: number; to: number; dir: 1 | -1; rows: [number, number] }[] = [
  { from: 7000, to: 11_500, dir: 1, rows: [0, 1] },
  { from: 15_000, to: 19_500, dir: -1, rows: [4, 6] },
]

/** The washer's current sweep, if any. */
export function washNow(s: Pick<PaintState, 'format' | 'startAt'>, t: number) {
  if (s.format !== 'coop') return null
  const e = t - s.startAt
  return WASHES.find((w) => e >= w.from && e <= w.to) ?? null
}

/** Where the washer is (world x) at host time t, or null when it is not out. */
export function washX(s: Pick<PaintState, 'format' | 'startAt'>, t: number): number | null {
  if (s.format !== 'coop') return null
  const e = t - s.startAt
  for (const w of WASHES) {
    if (e < w.from || e > w.to) continue
    const f = (e - w.from) / (w.to - w.from)
    return w.dir > 0 ? FIELD.x0 - 6 + f * (FIELD.x1 - FIELD.x0 + 12) : FIELD.x1 + 6 - f * (FIELD.x1 - FIELD.x0 + 12)
  }
  return null
}

export function cellAt(x: number, y: number): number {
  const c = Math.max(0, Math.min(COLS - 1, Math.floor((x - FIELD.x0) / CELL_W)))
  const r = Math.max(0, Math.min(ROWS - 1, Math.floor((y - FIELD.y0) / CELL_H)))
  return r * COLS + c
}

export function cellCenter(i: number): [number, number] {
  const c = i % COLS
  const r = Math.floor(i / COLS)
  return [FIELD.x0 + (c + 0.5) * CELL_W, FIELD.y0 + (r + 0.5) * CELL_H]
}

export function paintSpawn(s: Pick<PaintState, 'players'>, id: string): [number, number] {
  return walkSpawn(Math.max(0, s.players.indexOf(id)), s.players.length)
}

export function counts(s: Pick<PaintState, 'players' | 'cells'>): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(s.players.map((id) => [id, 0]))
  for (const o of s.cells) if (o >= 0 && s.players[o] !== undefined) out[s.players[o]]++
  return out
}

export function painted(s: Pick<PaintState, 'cells'>): number {
  return s.cells.filter((o) => o >= 0).length
}

// ---------------- the bot sim ----------------

export interface PaintWorld {
  step: number
  bodies: Record<string, Body>
  cur: Record<string, StickCursor>
  /** Planks each bot ran onto, with the sim time. */
  trail: Record<string, { c: number; t: number }[]>
  last: Record<string, number>
}

export const paintSim = simMemo<PaintState, PaintWorld>(
  (s) => {
    const bodies: Record<string, Body> = {}
    const cur: Record<string, StickCursor> = {}
    const trail: Record<string, { c: number; t: number }[]> = {}
    const last: Record<string, number> = {}
    for (const id of simIds(s)) {
      const [x, y] = paintSpawn(s, id)
      bodies[id] = body(x, y)
      cur[id] = new StickCursor(s.sticks[id])
      trail[id] = []
      last[id] = -1
    }
    return { step: 0, bodies, cur, trail, last }
  },
  (s, w) => {
    const t0 = stepTime(s.startAt, w.step)
    const t1 = t0 + STEP
    const over = t0 >= endAt(s)
    for (const id in w.bodies) {
      const b = w.bodies[id]
      const [sx, sy] = over ? [0, 0] : w.cur[id].at(t0)
      stepWalker(b, sx, sy)
      if (over) continue
      const c = cellAt(b.x, b.y)
      if (c !== w.last[id]) { w.last[id] = c; w.trail[id].push({ c, t: t1 }) }
    }
    w.step++
  },
)

export function paintAt(s: PaintState, t: number): PaintWorld {
  return paintSim(s, Math.max(0, Math.min(stepAt(s.startAt, t), stepAt(s.startAt, s.startAt + PAINT_MS + HOLD_MS))))
}

// ---------------- the minigame ----------------

export const paint: Minigame<PaintState> = {
  id: 'paint',
  name: 'Wet Paint',
  rule: 'Run over the boardwalk planks to paint them your color. Paint over everyone else. Most planks wins.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: 'Paint every plank before the clock runs out. Mingo is power-washing.',
  soloRule: 'The other two are scored on their average.',
  setup: (a) => ({
    players: a.players, format: a.format, solo: a.solo, startAt: a.startAt,
    seed: seedFrom(a.random), sticks: {}, pos: {},
    cells: Array.from({ length: CELLS }, () => -1),
    upTo: {},
    fullAt: null,
    washT: a.startAt,
  }),
  reduce(s, id, type, payload, ctx) {
    const seat = s.players.indexOf(id)
    if (seat < 0) return s
    const now = ctx.now
    if (type === 'stick') return reduceStick(s, id, payload, now)
    if (type === 'pos') return reducePos(s, id, payload, now)
    if (type === 'paint') {
      if (now < s.startAt || now > endAt(s) + 400) return s
      const p = obj(payload)
      const list = p.c
      if (!Array.isArray(list) || !list.length || list.length > MAX_BATCH || !list.every((c) => isInt(c, 0, CELLS - 1))) return s
      let changed = false
      const cells = [...s.cells]
      for (const c of list as number[]) if (cells[c] !== seat) { cells[c] = seat; changed = true }
      let upTo = s.upTo
      if (isNum(p.upTo, s.startAt, now + 1) && p.upTo > (s.upTo[id] ?? -Infinity)) upTo = { ...s.upTo, [id]: p.upTo }
      if (!changed && upTo === s.upTo) return s
      const full = s.format === 'coop' && s.fullAt === null && cells.every((o) => o >= 0) ? now : s.fullAt
      return { ...s, cells: changed ? cells : s.cells, upTo, fullAt: full }
    }
    return s
  },
  tick(s, ctx) {
    // The washer clears every plank in each column it passes (co-op only).
    if (s.format !== 'coop' || s.fullAt !== null || ctx.now <= s.washT || ctx.now > s.startAt + PAINT_MS) return s
    const a = washX(s, s.washT)
    const b = washX(s, ctx.now)
    const lo = Math.min(a ?? b ?? 0, b ?? a ?? 0)
    const hi = Math.max(a ?? b ?? 0, b ?? a ?? 0)
    const pass = washNow(s, ctx.now) ?? washNow(s, s.washT)
    let cells = s.cells
    if (pass && (a !== null || b !== null)) {
      for (let c = 0; c < COLS; c++) {
        const x = FIELD.x0 + (c + 0.5) * CELL_W
        if (x < lo || x > hi) continue
        for (let r = pass.rows[0]; r <= pass.rows[1]; r++) {
          const i = r * COLS + c
          if (cells[i] >= 0) { if (cells === s.cells) cells = [...s.cells]; cells[i] = -1 }
        }
      }
    }
    return { ...s, cells, washT: ctx.now }
  },
  done: (s, now) => now >= endAt(s) + HOLD_MS,
  result(s) {
    const sc = counts(s)
    const top = [...s.players].sort((a, b) => sc[b] - sc[a])
    const total = painted(s)
    const pct = Math.round((total / CELLS) * 100)
    return judge(s, {
      scores: sc,
      better: 'high',
      team: 'avg',
      lines: Object.fromEntries(s.players.map((id) => [id, `${sc[id]} ${sc[id] === 1 ? 'plank' : 'planks'}`])),
      coop: () => total >= CELLS,
      headline: (r) => {
        if (s.format === 'coop') return r.success ? 'Every plank painted. The park is impressed. Mildly.' : `${pct}% painted. Mingo will finish it. Slowly.`
        if (s.format === '1v2' && s.solo) return r.winner === 'solo' ? `@{${s.solo}} out-painted the team` : r.winner === 'team' ? `The team out-painted @{${s.solo}}` : 'A perfect tie. Suspicious.'
        return sc[top[0]] === sc[top[1]] ? `Tied at ${sc[top[0]]} planks` : `@{${top[0]}} painted ${sc[top[0]]} of ${CELLS} planks`
      },
      moment: s.format !== 'coop' && top[0] && sc[top[0]] >= CELLS / 2 ? { playerId: top[0], label: 'Wet Paint', text: `Painted half the boardwalk (${sc[top[0]]} planks)` } : null,
    })
  },
  bot(s, id, ctx) {
    const now = ctx.now
    if (!(id in s.sticks)) return { type: 'stick', payload: { x: 0, y: 0 } }
    if (now < s.startAt || now > s.startAt + PAINT_MS + 300) return null
    const w = paintAt(s, now)
    const seen = s.upTo[id] ?? -Infinity
    const fresh = (w.trail[id] ?? []).filter((e) => e.t > seen && e.t <= now)
    const report = fresh.length ? { type: 'paint', payload: { c: fresh.slice(0, MAX_BATCH).map((e) => e.c), upTo: fresh[Math.min(fresh.length, MAX_BATCH) - 1].t } } : null
    const b = w.bodies[id]
    // Steering first unless the paint report is getting stale (one move per tick, like a phone).
    const steer = b && now < endAt(s) ? stickMove(s, id, botAim(s, id, b, now), now) : null
    if (steer && !(report && now - fresh[0].t > 380)) return steer
    return report
  },
}

/** Time up, or (co-op) the moment the last plank got painted. */
export function endAt(s: PaintState): number {
  return Math.min(s.startAt + PAINT_MS, s.fullAt ?? Infinity)
}

function botAim(s: PaintState, id: string, b: Body, now: number): [number, number] {
  const seat = s.players.indexOf(id)
  const h = strHash(id) ^ s.seed
  const slot = Math.floor((now - s.startAt) / 900)
  if (noise(h, slot, 51) < 0.1) return [0, 0]
  const sc = counts(s)
  const leader = s.players.reduce((a, x) => (sc[x] > sc[a] ? x : a), s.players[0])
  const here = cellAt(b.x, b.y)
  let best = -1
  let bestScore = -Infinity
  for (let i = 0; i < CELLS; i++) {
    const o = s.cells[i]
    if (o === seat || i === here) continue
    if (s.format === 'coop' && o >= 0) continue
    if (s.format === '1v2' && s.solo && o >= 0 && (s.players[o] === s.solo) === (id === s.solo)) continue
    const [cx, cy] = cellCenter(i)
    const d = dist(b.x, b.y, cx, cy)
    const worth = o < 0 ? 1 : s.players[o] === leader ? 1.25 : 1.1
    const score = worth / (d + 6) + botNoise(id, i, slot) * 0.012
    if (score > bestScore) { bestScore = score; best = i }
  }
  if (best < 0) return [0, 0]
  const [cx, cy] = cellCenter(best)
  return quantize(cx - b.x, cy - b.y, 1)
}
