import type { MgBase, MgResult, Minigame } from './types'
import { botNoise, clamp, isInt, isNum, noise, obj, secs1, seedFrom, strHash } from './util'
import {
  BODY_R, DIRS, FIELD, HOLD_MS, STEP, StickCursor, WALK_SPEED, WORLD_H, WORLD_W, body, dist, reducePos, reduceStick, simIds, simMemo,
  stepAt, stepTime, stepWalker, stickMove, walkSpawn, type Body, type RtBase,
} from './rt'

/**
 * Coconut Drop: coconuts fall on the beach, a shadow warns where. Get bonked and you lose a
 * life; lose them all and you are out. Last critter standing wins. 1 vs 2: the solo sits in
 * the palm and throws coconuts at the other two. Co-op: nobody runs out of lives.
 */

export const COCO_MS = 30_000
export const FALL_MS = 1100
export const BIG_FALL_MS = 1400
export const VOLLEY_FALL_MS = 1450
export const INVULN_MS = 1400
export const NUT_R = 6.5
export const BIG_R = 10
export const DROP_R = 8
export const DROP_GAP_MS = 550
export const MAX_DROPS = 60
export const LIVES = 3
/** A coconut bonks you if your center is this close to its center, plus its radius. */
export const HIT_PAD = BODY_R * 0.8

export interface Nut {
  /** Base coconuts 0-499, volleys 500-999, solo drops 1000+. */
  k: number
  /** Spawn (shadow appears) and landing, host time. */
  at: number
  land: number
  x: number
  y: number
  r: number
  kind: 'nut' | 'big' | 'volley' | 'drop'
}

export interface CocoHit { k: number; t: number }

export interface CocoState extends MgBase, RtBase {
  /** Lives each dodger starts with (the 1 vs 2 solo has none). */
  lives: Record<string, number>
  hits: Record<string, CocoHit[]>
  /** 1 vs 2: what the solo threw. */
  drops: { x: number; y: number; t: number }[]
}

// ---------------- the coconut schedule ----------------

const baseCache = new Map<string, Nut[]>()

/** The coconuts that fall no matter what (relative times), from the seed. */
function baseNuts(seed: number, format: string): Nut[] {
  const key = `${seed}|${format}`
  const hit = baseCache.get(key)
  if (hit) return hit
  const out: Nut[] = []
  const slow = format === '1v2' ? 1.75 : 1
  let t = 700
  let k = 0
  while (t < COCO_MS - BIG_FALL_MS && k < 480) {
    const f = t / COCO_MS
    const big = k % 7 === 6
    const r = big ? BIG_R : NUT_R
    out.push({
      k,
      at: t,
      land: t + (big ? BIG_FALL_MS : FALL_MS),
      x: FIELD.x0 + noise(seed, k, 2) * (FIELD.x1 - FIELD.x0),
      y: FIELD.y0 + noise(seed, k, 3) * (FIELD.y1 - FIELD.y0),
      r,
      kind: big ? 'big' : 'nut',
    })
    t += (760 - 520 * f) * slow * (0.7 + noise(seed, k, 1) * 0.6)
    k++
  }
  // Volleys: a whole row (or column) at once, with a gap to run through.
  const VOLLEYS = format === '1v2' ? [11_000, 22_000] : [8000, 14_500, 20_500, 25_500]
  VOLLEYS.forEach((vt, vi) => {
    const row = noise(seed, vi, 7) < 0.55
    const n = row ? 10 : 6
    const span = row ? WORLD_W : FIELD.y1 - FIELD.y0 + 8
    const gap = Math.floor(noise(seed, vi, 8) * n) % n
    const line = row ? FIELD.y0 + 6 + noise(seed, vi, 9) * (FIELD.y1 - FIELD.y0 - 12) : 20 + noise(seed, vi, 9) * (WORLD_W - 40)
    for (let i = 0; i < n; i++) {
      if (i === gap || (row && i === (gap + 1) % n)) continue
      const along = (span / n) * (i + 0.5)
      out.push({ k: 500 + vi * 20 + i, at: vt, land: vt + VOLLEY_FALL_MS, x: row ? along : line, y: row ? line : FIELD.y0 - 4 + along, r: NUT_R + 1, kind: 'volley' })
    }
  })
  out.sort((a, b) => a.land - b.land || a.k - b.k)
  baseCache.set(key, out)
  if (baseCache.size > 40) baseCache.delete(baseCache.keys().next().value!)
  return out
}

const nutCache = new WeakMap<CocoState, Nut[]>()

/** Every coconut this round (host times), sorted by landing. */
export function nutsOf(s: CocoState): Nut[] {
  const hit = nutCache.get(s)
  if (hit) return hit
  const base = baseNuts(s.seed, s.format).map((n) => ({ ...n, at: s.startAt + n.at, land: s.startAt + n.land }))
  const drops: Nut[] = s.drops.map((d, i) => ({ k: 1000 + i, at: d.t, land: d.t + FALL_MS, x: d.x, y: d.y, r: DROP_R, kind: 'drop' }))
  const all = drops.length ? [...base, ...drops].sort((a, b) => a.land - b.land || a.k - b.k) : base
  nutCache.set(s, all)
  return all
}

export function nutByK(s: CocoState, k: number): Nut | null {
  return nutsOf(s).find((n) => n.k === k) ?? null
}

// ---------------- rules ----------------

export function dodgers(s: Pick<CocoState, 'players' | 'solo' | 'format'>): string[] {
  return s.format === '1v2' ? s.players.filter((id) => id !== s.solo) : s.players
}

export function outAt(s: CocoState, id: string): number | null {
  const h = s.hits[id]
  const n = s.lives[id] ?? 0
  return h && n > 0 && h.length >= n ? h[n - 1].t : null
}

/** When the round ends (before the hold): time up, or the early finish for the format. */
export function endAt(s: CocoState): number {
  const timeUp = s.startAt + COCO_MS
  const ds = dodgers(s)
  const outs = ds.map((id) => outAt(s, id)).filter((t): t is number => t !== null).sort((a, b) => a - b)
  let early = Infinity
  if (s.format === 'coop') early = outs.length ? outs[0] : Infinity
  else if (s.format === '1v2') early = outs.length === ds.length ? outs[outs.length - 1] : Infinity
  else if (ds.length >= 2 && outs.length >= ds.length - 1) early = outs[ds.length - 2]
  return Math.min(timeUp, early)
}

export function livesLeft(s: CocoState, id: string, upTo = Infinity): number {
  return Math.max(0, (s.lives[id] ?? 0) - (s.hits[id] ?? []).filter((h) => h.t <= upTo).length)
}

/** Would this coconut bonk a body at (x, y), given its earlier hits? Shared by the sim and the pad. */
export function bonks(n: Nut, x: number, y: number, hits: CocoHit[], lives: number): boolean {
  if (hits.length >= lives) return false
  const last = hits[hits.length - 1]
  if (last && n.land < last.t + INVULN_MS) return false
  return dist(x, y, n.x, n.y) <= n.r + HIT_PAD
}

/** Where a dodger starts. */
export function cocoSpawn(s: Pick<CocoState, 'players' | 'solo' | 'format'>, id: string): [number, number] {
  const ds = dodgers(s)
  return walkSpawn(Math.max(0, ds.indexOf(id)), ds.length)
}

// ---------------- the bot sim (deterministic, every device) ----------------

export interface CocoWorld {
  step: number
  bodies: Record<string, Body>
  hits: Record<string, CocoHit[]>
  cur: Record<string, StickCursor>
  ni: number
}

export const cocoSim = simMemo<CocoState, CocoWorld>(
  (s) => {
    const bodies: Record<string, Body> = {}
    const cur: Record<string, StickCursor> = {}
    const hits: Record<string, CocoHit[]> = {}
    for (const id of simIds(s)) {
      if (!(id in s.lives)) continue
      const [x, y] = cocoSpawn(s, id)
      bodies[id] = body(x, y)
      cur[id] = new StickCursor(s.sticks[id])
      hits[id] = []
    }
    // Skip coconuts that land before play starts (none do, but be safe).
    const nuts = nutsOf(s)
    let ni = 0
    while (ni < nuts.length && nuts[ni].land <= s.startAt) ni++
    return { step: 0, bodies, hits, cur, ni }
  },
  (s, w) => {
    const t0 = stepTime(s.startAt, w.step)
    const t1 = t0 + STEP
    const over = t0 >= endAt(s)
    for (const id in w.bodies) {
      const b = w.bodies[id]
      const out = w.hits[id].length >= (s.lives[id] ?? 0)
      const [sx, sy] = out || over ? [0, 0] : w.cur[id].at(t0)
      stepWalker(b, sx, sy)
    }
    const nuts = nutsOf(s)
    while (!over && w.ni < nuts.length && nuts[w.ni].land <= t1) {
      const n = nuts[w.ni++]
      for (const id in w.bodies) {
        const b = w.bodies[id]
        if (bonks(n, b.x, b.y, w.hits[id], s.lives[id] ?? 0)) w.hits[id].push({ k: n.k, t: n.land })
      }
    }
    w.step++
  },
)

/** The sim at host time t (bodies are at the last whole step). */
export function cocoAt(s: CocoState, t: number): CocoWorld {
  return cocoSim(s, Math.max(0, Math.min(stepAt(s.startAt, t), stepAt(s.startAt, s.startAt + COCO_MS + HOLD_MS))))
}

// ---------------- the minigame ----------------

function reduceHit(s: CocoState, id: string, payload: unknown, now: number): CocoState {
  if (!(id in s.lives)) return s
  const k = obj(payload).k
  if (!isInt(k, 0, 1999)) return s
  const n = nutByK(s, k)
  if (!n) return s
  const h = s.hits[id] ?? []
  if (h.length >= s.lives[id]) return s
  if (n.land > now + 500 || n.land < s.startAt || n.land > endAt(s)) return s
  if (h.some((x) => x.k === k)) return s
  const last = h[h.length - 1]
  if (last && n.land < last.t + INVULN_MS) return s
  return { ...s, hits: { ...s.hits, [id]: [...h, { k, t: n.land }] } }
}

function reduceDrop(s: CocoState, id: string, payload: unknown, now: number): CocoState {
  if (s.format !== '1v2' || id !== s.solo) return s
  const p = obj(payload)
  if (!isNum(p.x, -10, WORLD_W + 10) || !isNum(p.y, -10, WORLD_H + 10)) return s
  if (now < s.startAt || now > s.startAt + COCO_MS - FALL_MS || now >= endAt(s)) return s
  const last = s.drops[s.drops.length - 1]
  if ((last && now - last.t < DROP_GAP_MS) || s.drops.length >= MAX_DROPS) return s
  const x = Math.round(clamp(p.x, FIELD.x0, FIELD.x1) * 10) / 10
  const y = Math.round(clamp(p.y, FIELD.y0, FIELD.y1) * 10) / 10
  return { ...s, drops: [...s.drops, { x, y, t: now }] }
}

function cocoResult(s: CocoState): MgResult {
  const end = endAt(s)
  const ds = dodgers(s)
  const alive = ds.filter((id) => outAt(s, id) === null || outAt(s, id)! > end)
  const lines: Record<string, string> = {}
  const scores: Record<string, number> = {}
  for (const id of ds) {
    const o = outAt(s, id)
    const l = livesLeft(s, id, end)
    if (o === null || o > end) { scores[id] = 1e7 + l; lines[id] = `${l} ${l === 1 ? 'life' : 'lives'} left` }
    else { scores[id] = o - s.startAt; lines[id] = `Bonked out at ${secs1(o - s.startAt)}` }
  }
  const places: Record<string, number> = {}
  const rankIds = [...ds].sort((a, b) => scores[b] - scores[a])
  rankIds.forEach((id, i) => { const prev = rankIds[i - 1]; places[id] = prev !== undefined && scores[prev] === scores[id] ? places[prev] : i + 1 })

  if (s.format === '1v2' && s.solo) {
    const bonked = ds.reduce((a, id) => a + (s.hits[id] ?? []).filter((h) => h.t <= end).length, 0)
    const winner: 'solo' | 'team' = alive.length ? 'team' : 'solo'
    lines[s.solo] = `${bonked} ${bonked === 1 ? 'bonk' : 'bonks'} landed`
    for (const id of s.players) places[id] = (id === s.solo) === (winner === 'solo') ? 1 : 2
    return {
      places, winner, lines,
      headline: winner === 'team' ? `The team dodged it. @{${s.solo}} is out of coconuts.` : `@{${s.solo}} bonked everybody. From a tree.`,
      moment: winner === 'solo' ? { playerId: s.solo, label: 'Coconut Drop', text: 'Bonked the whole team out from the palm tree' } : null,
    }
  }
  if (s.format === 'coop') {
    const success = alive.length === ds.length
    const first = ds.find((id) => outAt(s, id) !== null && outAt(s, id)! <= end)
    return { places, success, lines, headline: success ? 'Everybody made it. The coconuts are furious.' : `@{${first}} ran out of lives. The House wins.`, moment: null }
  }
  const clean = alive.find((id) => livesLeft(s, id, end) === s.lives[id])
  let headline = 'Everybody got bonked. The coconuts win.'
  if (alive.length === 1) headline = `@{${alive[0]}} is the last critter standing`
  else if (alive.length > 1) {
    const most = Math.max(...alive.map((id) => livesLeft(s, id, end)))
    const top = alive.filter((id) => livesLeft(s, id, end) === most)
    headline = top.length === 1 ? `@{${top[0]}} kept the most lives` : `${andList(top.map((id) => `@{${id}}`))} tied on lives`
  }
  return { places, lines, headline, moment: clean ? { playerId: clean, label: 'Coconut Drop', text: 'Never got bonked once' } : null }
}

function andList(w: string[]): string {
  return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`
}

export const coconut: Minigame<CocoState> = {
  id: 'coconut',
  name: 'Coconut Drop',
  rule: 'Coconuts are falling. Watch the shadows. Do not be under one. Last critter standing wins.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: 'Nobody runs out of lives',
  soloRule: 'The solo sits in the palm and throws coconuts. Bonk them both out to win.',
  setup(a) {
    const ds = a.format === '1v2' ? a.players.filter((id) => id !== a.solo) : a.players
    const n = a.format === '1v2' ? 2 : LIVES
    return {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt,
      seed: seedFrom(a.random),
      sticks: {}, pos: {},
      lives: Object.fromEntries(ds.map((id) => [id, n])),
      hits: Object.fromEntries(ds.map((id) => [id, []])),
      drops: [],
    }
  },
  reduce(s, id, type, payload, ctx) {
    if (!s.players.includes(id)) return s
    if (type === 'hit') return reduceHit(s, id, payload, ctx.now)
    if (type === 'drop') return reduceDrop(s, id, payload, ctx.now)
    if (type === 'stick') return reduceStick(s, id, payload, ctx.now, id in s.lives)
    if (type === 'pos') return reducePos(s, id, payload, ctx.now)
    return s
  },
  tick: (s) => s,
  done: (s, now) => now >= endAt(s) + HOLD_MS,
  result: cocoResult,
  bot(s, id, ctx) {
    const now = ctx.now
    if (s.format === '1v2' && id === s.solo) return botDrop(s, id, now)
    if (!(id in s.lives)) return null
    if (!(id in s.sticks)) return { type: 'stick', payload: { x: 0, y: 0 } }
    if (now < s.startAt) return null
    const w = cocoAt(s, now)
    const mine = w.hits[id] ?? []
    const told = s.hits[id] ?? []
    const owed = mine.find((h) => !told.some((x) => x.k === h.k))
    if (owed) return { type: 'hit', payload: { k: owed.k } }
    if (told.length >= s.lives[id] || now >= endAt(s)) return null
    const b = w.bodies[id]
    if (!b) return null
    return stickMove(s, id, botDodge(s, id, b, now), now)
  },
}

/** Skill: how fast a bot notices a shadow, and how often it just does not. */
function botSkill(id: string) {
  return { react: 240 + botNoise(id, 1) * 280, miss: 0.2 + botNoise(id, 2) * 0.12, look: 560 + botNoise(id, 3) * 360 }
}

const CANDS: [number, number][] = [[0, 0], ...DIRS.map(([x, y]) => [x, y] as [number, number]), ...DIRS.map(([x, y]) => [x * 0.5, y * 0.5] as [number, number])]

function botDodge(s: CocoState, id: string, b: Body, now: number): [number, number] {
  const { react, miss, look } = botSkill(id)
  const h = strHash(id)
  const threats = nutsOf(s).filter((n) => n.at + react <= now && n.land > now && n.land - now <= look && noise(h, n.k, 9) >= miss)
  if (threats.length) {
    let best: [number, number] = [0, 0]
    let bestScore = -Infinity
    for (const c of CANDS) {
      let worst = 14
      for (const n of threats) {
        const go = Math.max(0, (n.land - now) / 1000 - 0.09) * WALK_SPEED
        const px = clamp(b.x + c[0] * go, FIELD.x0, FIELD.x1)
        const py = clamp(b.y + c[1] * go, FIELD.y0, FIELD.y1)
        worst = Math.min(worst, dist(px, py, n.x, n.y) - (n.r + HIT_PAD))
      }
      const lazy = c[0] === 0 && c[1] === 0 ? 1.2 : Math.abs(c[0]) + Math.abs(c[1]) < 1 ? 0.5 : 0
      const score = Math.min(worst, 6) + lazy
      if (score > bestScore) { bestScore = score; best = c }
    }
    return best
  }
  // Nothing coming: drift toward a spot that changes every few seconds.
  const slot = Math.floor((now - s.startAt) / 2600)
  const hx = 24 + noise(h, slot, 11) * (WORLD_W - 48)
  const hy = FIELD.y0 + 6 + noise(h, slot, 12) * (FIELD.y1 - FIELD.y0 - 12)
  const d = dist(b.x, b.y, hx, hy)
  if (d < 6) return [0, 0]
  let best = 0
  let bestDot = -2
  for (let i = 0; i < 16; i++) {
    const dot = (DIRS[i][0] * (hx - b.x) + DIRS[i][1] * (hy - b.y)) / d
    if (dot > bestDot) { bestDot = dot; best = i }
  }
  return [DIRS[best][0] * 0.5, DIRS[best][1] * 0.5]
}

/** Where a dodger is right now, as best this device knows (sim for bots, last pos for phones). */
export function guessPos(s: CocoState, id: string, now: number): [number, number] | null {
  if (id in s.sticks) { const b = cocoAt(s, now).bodies[id]; return b ? [b.x + b.vx * 0.5, b.y + b.vy * 0.5] : null }
  const p = s.pos[id]
  if (!p) return null
  const age = Math.min(1, (now - p.t) / 1000) + 0.5
  return [p.x + p.vx * age, p.y + p.vy * age]
}

function botDrop(s: CocoState, id: string, now: number) {
  if (now < s.startAt + 800 || now > s.startAt + COCO_MS - FALL_MS || now >= endAt(s)) return null
  const last = s.drops[s.drops.length - 1]
  const n = s.drops.length
  if (last && now - last.t < 650 + botNoise(id, n) * 650) return null
  const targets = dodgers(s).filter((t) => outAt(s, t) === null)
  if (!targets.length) return null
  const pick = targets[Math.floor(botNoise(id, n, 3) * targets.length) % targets.length]
  const at = guessPos(s, pick, now) ?? [20 + botNoise(id, n, 4) * (WORLD_W - 40), 15 + botNoise(id, n, 5) * (WORLD_H - 30)]
  const err = 12
  return { type: 'drop', payload: { x: Math.round((at[0] + (botNoise(id, n, 6) - 0.5) * err) * 10) / 10, y: Math.round((at[1] + (botNoise(id, n, 7) - 0.5) * err) * 10) / 10 } }
}
