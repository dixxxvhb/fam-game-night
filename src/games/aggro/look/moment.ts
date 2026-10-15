import { BASE, isHome, isStar, posXY, type XY } from '../geometry'
import { HIT_MS, HOP_MS, type AggroState, type LastMove } from '../logic'

/**
 * The board at a moment in time: where every marble is drawn, what is in the air, and which
 * effect is playing. Pure (no React, no DOM), so the TV, the phone and the tests all read the
 * same timeline. Times are host-clock ms; positions are grid units (see geometry.ts).
 */

/** The knocked marble starts flying a beat after the hit lands. */
export const KNOCK_DELAY = 70
export const KNOCK_MS = 780
export const STAR_FX_MS = 900
export const SWIRL_MS = 1_000
export const HOME_FX_MS = 1_600
export const POP_FX_MS = 650
export const SHAKE_MS = 520

export type HopStyle = 'hop' | 'zap' | 'pop' | 'swirl'

export interface DrawnMarble {
  seat: number
  m: number
  /** Grid position. */
  x: number
  y: number
  /** Height above the board in grid units (0 = sitting in its hole). */
  lift: number
  /** 1 = round; under 1 squashed flat on a landing. */
  squash: number
  /** Spin in degrees (the knocked marble tumbles). */
  spin: number
  /** In flight this frame (draw on top). */
  flying: boolean
}

export interface Fx {
  /** Landing time of the current move (host ms), 0 = nothing moving. */
  hopEnd: number
  /** The mover is in the air. */
  moving: boolean
  /** ms since the Aggro hit landed, -1 when there is none. */
  aggro: number
  /** ms since landing on a star, -1 otherwise. */
  star: number
  starAt: XY | null
  /** Live star-hop zap: age (-1 = none) and the stars crossed so far. */
  zap: number
  zapPts: XY[]
  /** Center swirl age, -1 when none. */
  swirl: number
  /** A marble just got home: the age of the glow (-1 none), its seat and hole. */
  home: number
  homeSeat: number
  homeAt: XY | null
  /** Coming out of base: age of the pop at the start hole. */
  pop: number
  popAt: XY | null
  /** The winning move landed: ms since (-1 = not a win). */
  win: number
  /** Screen shake strength 0..1. */
  shake: number
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f
export const ease = (f: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, f))) / 2

export const hopEndOf = (L: LastMove) => L.at + L.path.length * HOP_MS

export function hopStyle(L: Pick<LastMove, 'kind' | 'hops'>, i: number): HopStyle {
  if (L.kind === 'out' && i === 0) return 'pop'
  if (L.kind === 'stars' && i < L.hops) return 'zap'
  if (L.kind === 'center-in' || L.kind === 'center-out') return 'swirl'
  return 'hop'
}

const ARC: Record<HopStyle, number> = { hop: 0.55, zap: 0.12, pop: 1.5, swirl: 1.1 }

/** Where the mover is at time t (and how high), or null if it is not in the air now. */
export function moverAt(s: Pick<AggroState, 'arms'>, L: LastMove, t: number) {
  const end = hopEndOf(L)
  if (t < L.at || t >= end) return null
  const arm = s.arms[L.seat]
  const k = (t - L.at) / HOP_MS
  const i = Math.min(L.path.length - 1, Math.floor(k))
  const f = Math.min(1, k - i)
  const a = posXY(i === 0 ? L.from : L.path[i - 1], arm, L.m)
  const b = posXY(L.path[i], arm, L.m)
  const style = hopStyle(L, i)
  const e = style === 'zap' ? f : ease(f)
  let x = lerp(a[0], b[0], e)
  let y = lerp(a[1], b[1], e)
  if (style === 'swirl') {
    // Spiral into (or out of) the well: most of a half turn on the way.
    const ang = (1 - e) * Math.PI * 0.9 * (L.kind === 'center-in' ? 1 : -1)
    const rx = x * Math.cos(ang) - y * Math.sin(ang)
    const ry = x * Math.sin(ang) + y * Math.cos(ang)
    x = rx
    y = ry
  }
  return { x, y, lift: Math.sin(Math.PI * f) * ARC[style], k, i, style }
}

/** Every marble as drawn at time t, plus the effect clocks. */
export function frameAt(s: Pick<AggroState, 'arms' | 'marbles' | 'last'>, t: number): { marbles: DrawnMarble[]; fx: Fx } {
  const L = s.last
  const fx: Fx = {
    hopEnd: 0, moving: false, aggro: -1, star: -1, starAt: null, zap: -1, zapPts: [], swirl: -1,
    home: -1, homeSeat: -1, homeAt: null, pop: -1, popAt: null, win: -1, shake: 0,
  }
  const out: DrawnMarble[] = []
  const end = L ? hopEndOf(L) : 0
  const landed = !L || t >= end
  if (L) {
    fx.hopEnd = end
    fx.moving = t >= L.at && t < end
  }
  s.marbles.forEach((row, seat) => {
    const arm = s.arms[seat]
    row.forEach((pos0, m) => {
      let pos = pos0
      const d: DrawnMarble = { seat, m, x: 0, y: 0, lift: 0, squash: 1, spin: 0, flying: false }
      if (L && !landed && seat === L.seat && m === L.m) {
        const mv = moverAt(s, L, t)
        if (mv) {
          d.x = mv.x
          d.y = mv.y
          d.lift = mv.lift
          d.flying = true
          if (mv.k - mv.i < 0.12 && mv.i > 0) d.squash = 0.86
          out.push(d)
          return
        }
        pos = L.from
      }
      if (L && L.hit === seat && L.hitM === m && pos0 === BASE) {
        const spot = posXY(L.path[L.path.length - 1], s.arms[L.seat], L.m)
        const age = t - end - KNOCK_DELAY
        if (!landed || age < 0) {
          d.x = spot[0]
          d.y = spot[1]
          out.push(d)
          return
        }
        if (age < KNOCK_MS) {
          const f = age / KNOCK_MS
          const home = posXY(BASE, arm, m)
          const e = 1 - (1 - f) * (1 - f)
          d.x = lerp(spot[0], home[0], e)
          d.y = lerp(spot[1], home[1], e)
          d.lift = Math.sin(Math.PI * f) * 3.4
          d.spin = f * 720
          d.flying = true
          out.push(d)
          return
        }
        if (age < KNOCK_MS + 180) d.squash = 0.82
      }
      const xy = posXY(pos, arm, m)
      d.x = xy[0]
      d.y = xy[1]
      // Landing thump for the mover.
      if (L && landed && seat === L.seat && m === L.m && t - end < 160) d.squash = 0.8 + 0.2 * ((t - end) / 160)
      out.push(d)
    })
  })

  if (L) {
    const arm = s.arms[L.seat]
    const age = t - end
    const to = L.path[L.path.length - 1]
    if (L.hit >= 0 && age >= 0 && age < HIT_MS + 400) {
      fx.aggro = age
      fx.shake = age < SHAKE_MS ? 1 - age / SHAKE_MS : 0
    }
    if (isStar(to) && age >= 0 && age < STAR_FX_MS) {
      fx.star = age
      fx.starAt = posXY(to, arm, L.m)
    }
    if (L.kind === 'stars' && t >= L.at) {
      const crossed = Math.min(L.hops, Math.floor((t - L.at) / HOP_MS) + 1)
      const zapAge = t - (L.at + L.hops * HOP_MS)
      if (zapAge < 600) {
        fx.zap = Math.max(0, zapAge)
        fx.zapPts = [posXY(L.from, arm, L.m), ...L.path.slice(0, crossed).map((p) => posXY(p, arm, L.m))]
      }
    }
    if (L.kind === 'center-in' || L.kind === 'center-out') {
      const start = L.kind === 'center-in' ? end - HOP_MS * 0.6 : L.at
      const sa = t - start
      if (sa >= 0 && sa < SWIRL_MS) fx.swirl = sa
    }
    if (isHome(to) && !isHome(L.from) && age >= 0 && age < HOME_FX_MS) {
      fx.home = age
      fx.homeSeat = L.seat
      fx.homeAt = posXY(to, arm, L.m)
    }
    if (L.kind === 'out') {
      const pa = t - (L.at + HOP_MS)
      if (pa >= 0 && pa < POP_FX_MS) {
        fx.pop = pa
        fx.popAt = posXY(L.path[0], arm, L.m)
      }
    }
    if (L.won && age >= 0) fx.win = age
  }
  return { marbles: out, fx }
}

/** The camera's interest in the current move, 0..1, and where to look (grid units). */
export function cameraAt(s: Pick<AggroState, 'arms' | 'last'>, t: number): { w: number; x: number; y: number } {
  const L = s.last
  if (!L) return { w: 0, x: 0, y: 0 }
  const end = hopEndOf(L)
  const hold = end + (L.hit >= 0 ? 1_250 : 350)
  const IN = 380
  const OUT = 800
  let w = 0
  if (t >= L.at - IN && t < hold) w = ease((t - (L.at - IN)) / IN)
  else if (t >= hold && t < hold + OUT) w = 1 - ease((t - hold) / OUT)
  if (w <= 0) return { w: 0, x: 0, y: 0 }
  const arm = s.arms[L.seat]
  // Follow the path smoothly (no hop easing), clamped to the move.
  const k = Math.min(L.path.length, Math.max(0, (t - L.at) / HOP_MS))
  const i = Math.min(L.path.length - 1, Math.floor(k))
  const a = posXY(i === 0 ? L.from : L.path[i - 1], arm, L.m)
  const b = posXY(L.path[i], arm, L.m)
  const f = k >= L.path.length ? 1 : k - i
  let x = lerp(a[0], b[0], f)
  let y = lerp(a[1], b[1], f)
  if (L.hit >= 0 && t > end) {
    // Pull back between the hit and the victim's base so both read.
    const base = posXY(BASE, s.arms[L.hit], L.hitM)
    const g = ease((t - end) / 500) * 0.5
    x = lerp(x, base[0], g)
    y = lerp(y, base[1], g)
  }
  return { w, x, y }
}

/** When this move's animation is completely over (effects included). */
export function settledAt(L: LastMove | null): number {
  if (!L) return 0
  const end = hopEndOf(L)
  return end + Math.max(HOME_FX_MS, L.hit >= 0 ? HIT_MS + 400 : 0, SWIRL_MS, STAR_FX_MS) + 900
}
