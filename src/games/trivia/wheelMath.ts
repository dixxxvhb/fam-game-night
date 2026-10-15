import { CATEGORIES, type CatKey } from '../_quiz/categories'

/**
 * The wheel's motion, as pure math, so every screen (TV, phones, apart phones) draws the
 * same wheel at the same angle from the host clock. Angles are degrees, clockwise, with the
 * pointer (the flapper) at the top. The wheel spins clockwise.
 */

export const WEDGES = CATEGORIES.length
export const SLICE = 360 / WEDGES
/** How long the spin takes before it lands. The spin phase is longer; the rest is the landing moment. */
export const SPIN_ANIM_MS = 3_400
/** Share of the spin spent pulling back before the launch. */
const WINDUP = 0.07
/** Share of the spin spent settling back from the overshoot (the flapper nudges it home). */
const SETTLE = 0.07
const PULLBACK = 9
const OVERSHOOT = 3.2

export function mod(a: number, n: number) {
  return ((a % n) + n) % n
}

/** FNV-1a, so a string key always gives the same wheel. */
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Rotation that puts the middle of a category's wedge under the pointer. */
export function landingAngle(cat: CatKey): number {
  const i = CATEGORIES.findIndex((c) => c.key === cat)
  return mod(360 - (i * SLICE + SLICE / 2), 360)
}

/** Which category sits under the pointer at a rotation. */
export function wedgeAt(angle: number): CatKey {
  const i = Math.floor(mod(-angle, 360) / SLICE) % WEDGES
  return CATEGORIES[i].key
}

/** Where the wheel rests before a spin. Same key, same angle, on every screen. */
export function restAngle(key: string): number {
  return hashStr(key) % 360
}

export interface SpinPlan { from: number; to: number }

/** From the resting angle, five or six turns, landing somewhere inside the wedge (not always dead center). */
export function spinPlan(key: string, cat: CatKey): SpinPlan {
  const from = restAngle(key)
  const h = hashStr(`${key}:${cat}`)
  const jitter = ((h % 1000) / 1000 - 0.5) * SLICE * 0.6
  const target = landingAngle(cat) + jitter
  const turns = 5 + (h % 2)
  return { from, to: from + turns * 360 + mod(target - from, 360) }
}

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3)
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)

/**
 * The angle at `elapsed` ms into the spin: a short pull back, a hard launch that bleeds speed
 * (cubic ease out, so the last turn crawls past the pegs), a little overshoot, then it settles.
 */
export function spinAngle(p: SpinPlan, elapsed: number): number {
  const t = Math.max(0, Math.min(1, elapsed / SPIN_ANIM_MS))
  if (t <= 0) return p.from
  if (t >= 1) return p.to
  if (t < WINDUP) return p.from - PULLBACK * Math.sin((Math.PI * t) / WINDUP)
  if (t < 1 - SETTLE) {
    const u = (t - WINDUP) / (1 - WINDUP - SETTLE)
    return p.from + (p.to + OVERSHOOT - p.from) * easeOutCubic(u)
  }
  const u = (t - (1 - SETTLE)) / SETTLE
  return p.to + OVERSHOOT * (1 - easeInOut(u))
}

/** Degrees per second at `elapsed` (for the motion smear). */
export function spinSpeed(p: SpinPlan, elapsed: number): number {
  const dt = 16
  return Math.abs(spinAngle(p, elapsed + dt) - spinAngle(p, elapsed)) * (1000 / dt)
}

/** How many peg boundaries the wheel has passed: the flapper ticks each time this changes. */
export function pegCount(angle: number): number {
  return Math.floor(angle / SLICE)
}

/**
 * The flapper's rotation (deg) at a wheel angle. A peg sits on every wedge edge; as one comes
 * up to the pointer it pushes the flapper's tip along, then slips past and the flapper snaps
 * back. Negative = tip pushed clockwise (right).
 */
export function flapperAngle(angle: number, max = 26): number {
  const approach = SLICE - mod(angle, SLICE)
  const zone = SLICE * 0.32
  if (approach >= zone) return 0
  return -max * (1 - approach / zone)
}
