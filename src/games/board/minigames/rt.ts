import { isNum, obj } from './util'

/**
 * Shared real-time kit for the action minigames (Coconut Drop, Coin Frenzy, Bumper Tubes).
 *
 * How they network (no host-run sim needed, so it works the same on the TV, in apart mode,
 * and in the sandbox):
 *  - Each phone owns its own critter. The pad steps its physics on a fixed 50 ms grid
 *    (aligned to startAt), streams its position about 10 times a second, and reports the
 *    discrete things it measured (hit by a coconut, grabbed coin 12, fell out) as normal
 *    minigame actions. The host judges and caps them, first claim wins.
 *  - Bots play through the same action path: they send `stick` moves (recorded in state with
 *    the host time) and report their own hits. Their bodies come from a deterministic sim
 *    every device runs from state (seed + sticks + events), so the TV, every phone and the
 *    host agree on where a bot is without streaming it. The sim uses only + - * / and sqrt
 *    (no trig, no pow) so every browser gets the same numbers.
 *  - When bots are in the round, phones also send a coarse `pos` a few times a second so
 *    bots can chase or aim at people. Bot AI reads it; the sim never does.
 */

/** Fixed physics step, ms. */
export const STEP = 50
export const DT = STEP / 1000

/** The playfield, in world units (16:9). */
export const WORLD_W = 160
export const WORLD_H = 90

/** A critter's body radius. */
export const BODY_R = 4.5

/** Where a running critter's feet can go (the sea is along the top, heads need room). */
export const FIELD = { x0: 8, x1: WORLD_W - 8, y0: 17, y1: WORLD_H - 4 } as const

/** Hold the end of a round on screen this long before the board moves on (the winner moment). */
export const HOLD_MS = 1800

/** 16 compass directions, hard coded so every engine agrees. */
export const DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [0.9239, 0.3827], [0.7071, 0.7071], [0.3827, 0.9239],
  [0, 1], [-0.3827, 0.9239], [-0.7071, 0.7071], [-0.9239, 0.3827],
  [-1, 0], [-0.9239, -0.3827], [-0.7071, -0.7071], [-0.3827, -0.9239],
  [0, -1], [0.3827, -0.9239], [0.7071, -0.7071], [0.9239, -0.3827],
]

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  /** Position one step ago (for smooth drawing between steps). */
  px: number
  py: number
}

export interface StickEv { t: number; x: number; y: number }
export interface PosEv { x: number; y: number; vx: number; vy: number; t: number }

/** What every action-minigame state carries for bots and positions. */
export interface RtBase {
  seed: number
  /** Bots' joystick moves, in order. A player with an entry here is drawn from the sim. */
  sticks: Record<string, StickEv[]>
  /** Latest coarse position from each phone (only sent when bots play). */
  pos: Record<string, PosEv>
}

export function body(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, px: x, py: y }
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

/** Round to 2 decimals (for sticks and positions on the wire). */
export function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Clamp a stick vector to length 1, with a small dead zone. */
export function normStick(x: number, y: number): [number, number] {
  const m = Math.sqrt(x * x + y * y)
  if (m < 0.12) return [0, 0]
  if (m > 1) return [x / m, y / m]
  return [x, y]
}

/** The nearest of the 16 directions (for bots), times a magnitude of 0, 0.5 or 1. */
export function quantize(dx: number, dy: number, mag: number): [number, number] {
  const m = Math.sqrt(dx * dx + dy * dy)
  if (m < 1e-6 || mag <= 0) return [0, 0]
  let best = 0
  let bestDot = -2
  for (let i = 0; i < 16; i++) {
    const d = (DIRS[i][0] * dx + DIRS[i][1] * dy) / m
    if (d > bestDot) { bestDot = d; best = i }
  }
  const k = mag >= 0.75 ? 1 : 0.5
  return [DIRS[best][0] * k, DIRS[best][1] * k]
}

// ---------------- walkers (Coconut Drop, Coin Frenzy) ----------------

export const WALK_SPEED = 56
/** How much of the gap to the target velocity closes each step. */
const WALK_GRIP = 0.42

/** One fixed step of a running critter: snappy, clamped to the field. */
export function stepWalker(b: Body, sx: number, sy: number, speed = WALK_SPEED) {
  b.px = b.x
  b.py = b.y
  b.vx += (sx * speed - b.vx) * WALK_GRIP
  b.vy += (sy * speed - b.vy) * WALK_GRIP
  b.x += b.vx * DT
  b.y += b.vy * DT
  if (b.x < FIELD.x0) { b.x = FIELD.x0; b.vx = 0 }
  if (b.x > FIELD.x1) { b.x = FIELD.x1; b.vx = 0 }
  if (b.y < FIELD.y0) { b.y = FIELD.y0; b.vy = 0 }
  if (b.y > FIELD.y1) { b.y = FIELD.y1; b.vy = 0 }
}

/** Clamp a point into the field. */
export function inField(x: number, y: number): [number, number] {
  return [Math.max(FIELD.x0, Math.min(FIELD.x1, x)), Math.max(FIELD.y0, Math.min(FIELD.y1, y))]
}

/** Starting spots on a walking field, by seat, spread across the middle. */
export function walkSpawn(i: number, n: number): [number, number] {
  const gap = WORLD_W / (n + 1)
  return [gap * (i + 1), (FIELD.y0 + FIELD.y1) / 2 + (i % 2 === 0 ? -6 : 6)]
}

// ---------------- the step grid ----------------

/** Step index for a host time (step 0 = startAt). */
export function stepAt(startAt: number, t: number): number {
  return Math.floor((t - startAt) / STEP)
}

/** Host time of a step. */
export function stepTime(startAt: number, k: number): number {
  return startAt + k * STEP
}

// ---------------- actions shared by all action minigames ----------------

const STICK_MIN_GAP = 90
const STICK_CAP = 600

/** A bot's (or anyone's) joystick move. Recorded with the host time. */
export function reduceStick<S extends RtBase & { players: string[]; startAt: number }>(s: S, id: string, payload: unknown, now: number, allowed = true): S {
  if (!allowed || !s.players.includes(id)) return s
  const p = obj(payload)
  if (!isNum(p.x, -1.01, 1.01) || !isNum(p.y, -1.01, 1.01)) return s
  if (now < s.startAt - 4000) return s
  const list = s.sticks[id] ?? []
  const last = list[list.length - 1]
  if (last && now - last.t < STICK_MIN_GAP) return s
  if (last && last.x === r2(p.x) && last.y === r2(p.y)) return s
  if (list.length >= STICK_CAP) return s
  const [x, y] = normStick(p.x, p.y)
  return { ...s, sticks: { ...s.sticks, [id]: [...list, { t: Math.max(now, s.startAt), x: r2(x), y: r2(y) }] } }
}

/** A phone's coarse position (for bot AI). Latest only. */
export function reducePos<S extends RtBase & { players: string[] }>(s: S, id: string, payload: unknown, now: number): S {
  if (!s.players.includes(id)) return s
  const p = obj(payload)
  if (!isNum(p.x, -20, WORLD_W + 20) || !isNum(p.y, -20, WORLD_H + 20)) return s
  const vx = isNum(p.vx, -400, 400) ? p.vx : 0
  const vy = isNum(p.vy, -400, 400) ? p.vy : 0
  const prev = s.pos[id]
  if (prev && now - prev.t < 200) return s
  return { ...s, pos: { ...s.pos, [id]: { x: r2(p.x), y: r2(p.y), vx: r2(vx), vy: r2(vy), t: now } } }
}

/** The stick a sim-driven player holds at host time t. Walks a cursor forward. */
export class StickCursor {
  private i = -1
  private list: StickEv[]
  constructor(list: StickEv[]) { this.list = list }
  at(t: number): [number, number] {
    while (this.i + 1 < this.list.length && this.list[this.i + 1].t <= t) this.i++
    return this.i < 0 ? [0, 0] : [this.list[this.i].x, this.list[this.i].y]
  }
}

/** The last stick a bot sent (for "did it change" checks). */
export function lastStick(s: RtBase, id: string): StickEv | null {
  const l = s.sticks[id]
  return l && l.length ? l[l.length - 1] : null
}

/** A bot move only if it changed and the bot is not spamming. */
export function stickMove(s: RtBase, id: string, want: [number, number], now: number): { type: 'stick'; payload: { x: number; y: number } } | null {
  const last = lastStick(s, id)
  const x = r2(want[0])
  const y = r2(want[1])
  if (last && last.x === x && last.y === y) return null
  if (last && now - last.t < 160) return null
  return { type: 'stick', payload: { x, y } }
}

/**
 * Memo for a deterministic sim keyed on the (immutable) minigame state object: asking again
 * for a later time continues from where it stopped, asking for an earlier time or a new state
 * starts over. Pure in effect: same state + time = same answer.
 */
export function simMemo<S extends object, W extends { step: number }>(init: (s: S) => W, advance: (s: S, w: W) => void) {
  const cache = new WeakMap<S, W>()
  return (s: S, toStep: number): W => {
    let w = cache.get(s)
    if (!w || w.step > toStep) { w = init(s); cache.set(s, w) }
    let guard = 0
    while (w.step < toStep && guard++ < 4000) advance(s, w)
    return w
  }
}

/** The ids drawn from the sim (bots), in seat order. */
export function simIds(s: RtBase & { players: string[] }): string[] {
  return s.players.filter((id) => id in s.sticks)
}
