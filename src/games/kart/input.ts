/**
 * Phone input: quantizing, the rate limiter that keeps every phone at or under 10 messages a
 * second on 'kart:in', the host-side sanitizer, and tilt math. Pure (time is passed in).
 */
import type { KartInput } from './sim'

export const MAX_PER_SEC = 10
/** 120 ms apart caps a phone at 9 in any second: one under the hard limit, for network bunching. */
export const MIN_GAP_MS = 120
export const KEEPALIVE_MS = 1000

/** Clamp to -1..1 and snap to 0.1 steps (never -0). */
export function quantizeSteer(v: number): number {
  if (!Number.isFinite(v)) return 0
  const q = Math.round(Math.max(-1, Math.min(1, v)) * 10) / 10
  return q === 0 ? 0 : q
}

/** Quantize with a little hysteresis so tilt jitter near a step edge doesn't spam messages. */
export function steerWithHysteresis(raw: number, prev: number, band = 0.07): number {
  if (!Number.isFinite(raw)) return prev
  if (Math.abs(raw - prev) < band) return prev
  return quantizeSteer(raw)
}

export function sameInput(a: KartInput, b: KartInput): boolean {
  return a.s === b.s && a.g === b.g && a.b === b.b && a.f === b.f
}

/** Host side: turn whatever arrived on the stream into a clean input, or null for junk. */
export function sanitizeInput(d: unknown): KartInput | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const o = d as Record<string, unknown>
  const s = Number(o.s)
  const f = Number(o.f ?? 0)
  if (!Number.isFinite(s) || !Number.isFinite(f)) return null
  return {
    s: quantizeSteer(s),
    g: o.g === 1 || o.g === true ? 1 : 0,
    b: o.b === 1 || o.b === true ? 1 : 0,
    f: Math.max(0, Math.min(1_000_000, Math.floor(f))),
  }
}

/**
 * Sends the current input only when it changes, plus a keepalive every second.
 * Hard cap: never two sends within MIN_GAP_MS and never more than MAX_PER_SEC in any
 * rolling second. A change that arrives too soon is held and sent (latest value) on pump().
 */
export class InputSender {
  private desired: KartInput | null = null
  private last: KartInput | null = null
  private lastAt = -Infinity
  private times: number[] = []
  /** Every send time, for the QA counter. */
  log: number[] = []
  total = 0
  private out: (m: KartInput) => void
  private minGap: number
  private maxPerSec: number
  private keepalive: number

  constructor(out: (m: KartInput) => void, opts: { minGapMs?: number; maxPerSec?: number; keepaliveMs?: number } = {}) {
    this.out = out
    this.minGap = opts.minGapMs ?? MIN_GAP_MS
    this.maxPerSec = Math.min(opts.maxPerSec ?? MAX_PER_SEC, MAX_PER_SEC)
    this.keepalive = opts.keepaliveMs ?? KEEPALIVE_MS
  }

  set(input: KartInput, now: number) {
    this.desired = input
    this.pump(now)
  }

  /** Call often (every ~50 ms). Sends a held change or the keepalive when allowed. */
  pump(now: number) {
    const want = this.desired
    if (!want) return
    const changed = !this.last || !sameInput(want, this.last)
    if (!changed && now - this.lastAt < this.keepalive) return
    if (now - this.lastAt < this.minGap) return
    while (this.times.length && this.times[0] <= now - 1000) this.times.shift()
    if (this.times.length >= this.maxPerSec) return
    this.times.push(now)
    this.lastAt = now
    this.last = want
    this.total += 1
    this.log.push(now)
    if (this.log.length > 4000) this.log = this.log.slice(-2000)
    this.out(want)
  }

  /** Stop sending until set() is called again. */
  stop() {
    this.desired = null
  }
}

/** Most sends inside any rolling 1000 ms window of a send log. */
export function maxPerRollingSecond(times: number[]): number {
  let best = 0
  let j = 0
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] >= 1000) j++
    best = Math.max(best, i - j + 1)
  }
  return best
}

/**
 * Tilt: the share of gravity pointing toward the right edge of the screen, -1..1.
 * Works whether the phone is held upright like a wheel or lying back in your hands:
 * lowering the right side of the screen steers right. beta/gamma in degrees
 * (DeviceOrientationEvent), screenAngle in degrees (screen.orientation.angle).
 */
export function gravityRight(beta: number, gamma: number, screenAngle: number): number {
  const b = (beta * Math.PI) / 180
  const g = (gamma * Math.PI) / 180
  const th = (screenAngle * Math.PI) / 180
  const dx = Math.sin(g) * Math.cos(b)
  const dy = -Math.sin(b)
  return Math.max(-1, Math.min(1, dx * Math.cos(th) - dy * Math.sin(th)))
}

/** Steering from the gravity share, around a calibrated zero. About 30 degrees is full lock. */
export function tiltToSteer(right: number, zero: number, full = 0.5, dead = 0.04): number {
  const v = right - zero
  if (Math.abs(v) < dead) return 0
  const sign = v > 0 ? 1 : -1
  return Math.max(-1, Math.min(1, (sign * (Math.abs(v) - dead)) / (full - dead)))
}
