import { PIN_SPOT } from './score'

/**
 * The roll, simulated on the host in one go. Top-down 2D in inches: x across the lane
 * (0 = middle, + = right as the bowler sees it), y from the foul line toward the pins.
 * Fixed 1 ms steps, plain circle physics, no randomness but a tiny seeded jitter in the
 * pin spots and the release, so the same throw with the same seed always gives the same pins.
 *
 * Pins stand until they're shoved more than FALL_DIST off their spot; then they topple in
 * the direction they were moving, and a toppling pin takes out a neighbor it lands on.
 */

export interface Throw { x: number; aim: number; speed: number; curve: number }

/** One pin's track: from sample k on, [x, y, s] per sample (tenths of an inch). Before k it sat at t[0..1]. */
export interface PinTrack { id: number; k: number; t: number[] }

/**
 * Compact replay: ball [x, y] per sample until it drops into the pit, pins as tracks.
 * s per pin sample: 0..9 standing (wobble), 10..45 down (lying at (s - 10) * 10 degrees), 99 gone.
 */
export interface Replay { dt: number; n: number; ball: number[]; pins: PinTrack[] }

export interface SimResult {
  knocked: number[]
  left: number[]
  gutter: boolean
  replay: Replay
  mph: number
  /** Sample index when the ball first touched a pin, or -1. */
  hit: number
}

// Lane geometry (inches), the real thing.
export const LANE_HALF = 20.75
export const GUTTER_W = 9.25
export const KICK = LANE_HALF + GUTTER_W
export const HEAD = 720
export const PIT_Y = HEAD + 34.2
export const BALL_R = 4.25
export const PIN_R = 2.38
export const PIN_H = 15
export const START_HALF = LANE_HALF - BALL_R - 0.6
export const AIM_MAX_DEG = 2.6
export const ARROWS_Y = 180
export const GUTTER_X = LANE_HALF + GUTTER_W / 2
export const MIN_V = 150
export const MAX_V = 400

const DT = 0.001
const SAMPLE_MS = 50
const STEPS_PER_SAMPLE = SAMPLE_MS
const M_BALL = 15
const M_PIN = 3.5
const E_BALL_PIN = 0.75
const E_PIN_PIN = 0.6
const E_KICK = 0.35
/** Hook: sideways pull at full curve and 300 in/s, once the ball is out of the oil. */
const HOOK = 58
const V_REF = 300
const OIL_END = 380
const HOOK_FULL = 560
const DRAG = 9
const STAND_DECEL = 620
const DOWN_DECEL = 170
export const FALL_DIST = 1.5
const PIN_R_DOWN = 3.8
const TIP_T = 0.2
const TOPPLE_JITTER = 0.3
const TIP_V = 85
const TIP_REACH = PIN_H - 2
const TIP_WIDTH = PIN_R + 2.4
const MAX_T = 9
const AFTER_PINS_T = 2.4

export const pinSpot = (id: number) => ({ x: PIN_SPOT[id].x, y: HEAD + PIN_SPOT[id].y })

export function speedToV(speed: number) {
  return MIN_V + (MAX_V - MIN_V) * speed
}
export function vToMph(v: number) {
  return (v * 3600) / 63360
}
/** Where a straight ball from this setup would cross the head pin row. */
export function aimCross(x: number, aim: number): number {
  return x * START_HALF + Math.tan((aim * AIM_MAX_DEG * Math.PI) / 180) * HEAD
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Pin {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  sx: number
  sy: number
  down: boolean
  gone: boolean
  wob: number
  ang: number
  w: number
}

interface Topple { at: number; pin: Pin; vx: number; vy: number }

export function simulate(th: Throw, standing: number[], seed: number): SimResult {
  const rnd = mulberry32(seed)
  const j = (amt: number) => (rnd() * 2 - 1) * amt

  const angle = ((th.aim * AIM_MAX_DEG + j(0.03)) * Math.PI) / 180
  const v0 = speedToV(th.speed) * (1 + j(0.005))
  const curve = th.curve + j(0.02)
  const ball = {
    x: th.x * START_HALF + j(0.15),
    y: 0,
    vx: Math.sin(angle) * v0,
    vy: Math.cos(angle) * v0,
    gutter: false,
    gone: false,
  }

  const pins: Pin[] = standing.map((id) => {
    const s = pinSpot(id)
    const x = s.x + j(0.12)
    const y = s.y + j(0.12)
    return { id, x, y, vx: 0, vy: 0, sx: x, sy: y, down: false, gone: false, wob: 0, ang: 0, w: 0 }
  })

  const topples: Topple[] = []
  let t = 0
  let step = 0
  let hitStep = -1
  let atPins = -1
  let quietSince = -1
  let gutterBall = false

  const ballTrack: number[] = []
  const pinTracks: number[][] = pins.map(() => [])

  const fall = (p: Pin) => {
    if (p.down) return
    p.down = true
    let dx = p.vx
    let dy = p.vy
    if (Math.hypot(dx, dy) < 1e-3) { dx = p.x - p.sx; dy = p.y - p.sy }
    // Pins tumble a little their own way: a few degrees of seeded wobble on the way down.
    const a = Math.atan2(dy, dx) + j(TOPPLE_JITTER)
    dx = Math.cos(a)
    dy = Math.sin(a)
    p.ang = a
    // Whatever it lands on goes too, a beat later.
    for (const q of pins) {
      if (q === p || q.down || q.gone) continue
      const rx = q.x - p.x
      const ry = q.y - p.y
      const along = rx * dx + ry * dy
      const perp = Math.abs(rx * dy - ry * dx)
      if (along <= 0 || along > TIP_REACH + PIN_R || perp > TIP_WIDTH) continue
      const rl = Math.hypot(rx, ry) || 1
      const ux = dx * 0.7 + (rx / rl) * 0.3
      const uy = dy * 0.7 + (ry / rl) * 0.3
      const ul = Math.hypot(ux, uy) || 1
      const mag = TIP_V * (1 - (perp / TIP_WIDTH) * 0.6)
      topples.push({ at: t + TIP_T * Math.min(1, along / TIP_REACH), pin: q, vx: (ux / ul) * mag, vy: (uy / ul) * mag })
    }
  }

  const kick = (p: Pin, dvx: number, dvy: number) => {
    p.vx += dvx
    p.vy += dvy
    if (!p.down) p.wob = Math.min(1, Math.max(p.wob, Math.hypot(dvx, dvy) / 42))
  }

  const collide = (
    ax: number, ay: number, avx: number, avy: number, ma: number,
    bx: number, by: number, bvx: number, bvy: number, mb: number,
    r: number, e: number,
  ): null | { nx: number; ny: number; jn: number; push: number; tang: number } => {
    const dx = bx - ax
    const dy = by - ay
    const d2 = dx * dx + dy * dy
    if (d2 >= r * r) return null
    const d = Math.sqrt(d2) || 1e-6
    const nx = dx / d
    const ny = dy / d
    const rv = (bvx - avx) * nx + (bvy - avy) * ny
    const tang = (bvx - avx) * -ny + (bvy - avy) * nx
    const jn = rv < 0 ? (-(1 + e) * rv) / (1 / ma + 1 / mb) : 0
    return { nx, ny, jn, push: r - d, tang }
  }

  const sample = () => {
    if (!ball.gone) ballTrack.push(Math.round(ball.x * 10), Math.round(ball.y * 10))
    pins.forEach((p, i) => {
      let s: number
      if (p.gone) s = 99
      else if (p.down) s = 10 + ((Math.round((p.ang * 180) / Math.PI / 10) % 36) + 36) % 36
      else s = Math.round(Math.min(1, p.wob) * 9)
      pinTracks[i].push(Math.round(p.x * 10), Math.round(p.y * 10), s)
    })
  }

  sample()
  while (t < MAX_T) {
    step += 1
    t = step * DT

    // Ball
    if (!ball.gone) {
      if (ball.gutter) {
        // Drop into the middle of the channel and run along it.
        ball.vx = (Math.sign(ball.x) * GUTTER_X - ball.x) * 14
      } else {
        const g = ball.y < OIL_END ? 0 : ball.y > HOOK_FULL ? 1 : (ball.y - OIL_END) / (HOOK_FULL - OIL_END)
        ball.vx += curve * HOOK * g * (ball.vy / V_REF) * DT
      }
      ball.vy = Math.max(40, ball.vy - DRAG * DT)
      ball.x += ball.vx * DT
      ball.y += ball.vy * DT
      // Off the edge of the lane, anywhere before the pit: into the channel. A gutter ball
      // if it hadn't touched a pin yet.
      if (!ball.gutter && Math.abs(ball.x) > LANE_HALF) {
        ball.gutter = true
        if (hitStep < 0) gutterBall = true
      }
      if (atPins < 0 && ball.y >= HEAD - BALL_R - PIN_R) atPins = t
      if (ball.y > PIT_Y + BALL_R) ball.gone = true
    }

    // Pins
    for (const p of pins) {
      if (p.gone) continue
      const sp = Math.hypot(p.vx, p.vy)
      if (sp > 0) {
        const dec = (p.down ? DOWN_DECEL : STAND_DECEL) * DT
        const k = sp > dec ? (sp - dec) / sp : 0
        p.vx *= k
        p.vy *= k
      }
      p.x += p.vx * DT
      p.y += p.vy * DT
      p.wob *= 1 - 2.2 * DT
      if (p.down) {
        p.ang += p.w * DT
        p.w *= 1 - 2.5 * DT
      } else if (Math.hypot(p.x - p.sx, p.y - p.sy) > FALL_DIST) {
        fall(p)
      }
      const r = p.down ? PIN_R_DOWN : PIN_R
      if (Math.abs(p.x) > KICK - r) {
        p.x = Math.sign(p.x) * (KICK - r)
        p.vx *= -E_KICK
        p.vy *= 0.85
        if (!p.down) fall(p)
      }
      if (p.y > PIT_Y + 1) p.gone = true
    }

    // Ball against pins
    if (!ball.gone && !ball.gutter) {
      for (const p of pins) {
        if (p.gone) continue
        const c = collide(ball.x, ball.y, ball.vx, ball.vy, M_BALL, p.x, p.y, p.vx, p.vy, M_PIN, BALL_R + (p.down ? PIN_R_DOWN : PIN_R), E_BALL_PIN)
        if (!c) continue
        if (hitStep < 0) hitStep = step
        ball.vx -= (c.jn / M_BALL) * c.nx
        ball.vy -= (c.jn / M_BALL) * c.ny
        kick(p, (c.jn / M_PIN) * c.nx, (c.jn / M_PIN) * c.ny)
        if (p.down) p.w += c.tang / 9
        else if (c.jn > 0) p.w = c.tang / 9
        const tot = M_BALL + M_PIN
        ball.x -= c.nx * c.push * (M_PIN / tot)
        ball.y -= c.ny * c.push * (M_PIN / tot)
        p.x += c.nx * c.push * (M_BALL / tot)
        p.y += c.ny * c.push * (M_BALL / tot)
      }
    }

    // Pins against pins
    for (let a = 0; a < pins.length; a++) {
      const p = pins[a]
      if (p.gone) continue
      for (let b = a + 1; b < pins.length; b++) {
        const q = pins[b]
        if (q.gone) continue
        const r = (p.down ? PIN_R_DOWN : PIN_R) + (q.down ? PIN_R_DOWN : PIN_R)
        const c = collide(p.x, p.y, p.vx, p.vy, M_PIN, q.x, q.y, q.vx, q.vy, M_PIN, r, E_PIN_PIN)
        if (!c) continue
        kick(p, -(c.jn / M_PIN) * c.nx, -(c.jn / M_PIN) * c.ny)
        kick(q, (c.jn / M_PIN) * c.nx, (c.jn / M_PIN) * c.ny)
        if (p.down) p.w -= c.tang / 12
        if (q.down) q.w += c.tang / 12
        p.x -= c.nx * c.push * 0.5
        p.y -= c.ny * c.push * 0.5
        q.x += c.nx * c.push * 0.5
        q.y += c.ny * c.push * 0.5
      }
    }

    // Toppling pins landing on neighbors
    for (let i = topples.length - 1; i >= 0; i--) {
      const tp = topples[i]
      if (tp.at > t) continue
      topples.splice(i, 1)
      if (!tp.pin.down && !tp.pin.gone) kick(tp.pin, tp.vx, tp.vy)
    }

    if (step % STEPS_PER_SAMPLE === 0) {
      sample()
      const ballDone = ball.gone
      const still = pins.every((p) => p.gone || Math.hypot(p.vx, p.vy) < 3) && topples.length === 0
      if (ballDone && still) {
        if (quietSince < 0) quietSince = t
        if (t - quietSince >= 0.25) break
      } else quietSince = -1
      if (atPins >= 0 && t - atPins > AFTER_PINS_T && ball.gone) break
    }
  }

  const replay: Replay = {
    dt: SAMPLE_MS,
    n: pinTracks[0] ? pinTracks[0].length / 3 : ballTrack.length / 2,
    ball: ballTrack,
    pins: pins.map((p, i) => compactTrack(p.id, pinTracks[i])),
  }
  if (!pins.length) replay.n = Math.floor(t * 1000 / SAMPLE_MS) + 1
  const knocked = pins.filter((p) => p.down || p.gone).map((p) => p.id)
  const left = pins.filter((p) => !p.down && !p.gone).map((p) => p.id)
  return {
    knocked,
    left,
    gutter: gutterBall,
    replay,
    mph: Math.round(vToMph(v0)),
    hit: hitStep < 0 ? -1 : Math.floor(hitStep / STEPS_PER_SAMPLE),
  }
}

/** Drop the samples where the pin sat still at the start and the repeats at the end. */
function compactTrack(id: number, full: number[]): PinTrack {
  const n = full.length / 3
  const same = (a: number, b: number) => full[a * 3] === full[b * 3] && full[a * 3 + 1] === full[b * 3 + 1] && full[a * 3 + 2] === full[b * 3 + 2]
  let first = 0
  while (first < n - 1 && same(first, first + 1)) first += 1
  let last = n - 1
  while (last > first && same(last, last - 1)) last -= 1
  return { id, k: first, t: full.slice(first * 3, (last + 1) * 3) }
}

/** A pin's [x, y, s] at sample i (inches, s as stored). */
export function pinAt(tr: PinTrack, i: number): [number, number, number] {
  const len = tr.t.length / 3
  const k = Math.max(0, Math.min(len - 1, i - tr.k))
  return [tr.t[k * 3] / 10, tr.t[k * 3 + 1] / 10, tr.t[k * 3 + 2]]
}

/** First sample index at which a pin is down (or gone), or -1. */
export function pinDownAt(tr: PinTrack): number {
  const len = tr.t.length / 3
  for (let k = 0; k < len; k++) if (tr.t[k * 3 + 2] >= 10) return tr.k + k
  return -1
}
