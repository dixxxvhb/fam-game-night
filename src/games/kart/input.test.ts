import { describe, expect, it } from 'vitest'
import {
  gravityRight, InputSender, maxPerRollingSecond, MAX_PER_SEC, MIN_GAP_MS, quantizeSteer, sanitizeInput, steerWithHysteresis, tiltToSteer,
} from './input'
import type { KartInput } from './sim'

let seed = 11
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

describe('quantize', () => {
  it('clamps and snaps to tenths', () => {
    expect(quantizeSteer(0.04)).toBe(0)
    expect(quantizeSteer(0.06)).toBe(0.1)
    expect(quantizeSteer(-0.44)).toBe(-0.4)
    expect(quantizeSteer(3)).toBe(1)
    expect(quantizeSteer(-9)).toBe(-1)
    expect(Object.is(quantizeSteer(-0.01), -0)).toBe(false)
    expect(quantizeSteer(NaN)).toBe(0)
    expect(quantizeSteer(Infinity)).toBe(0)
  })
  it('holds steady through jitter at a step edge', () => {
    let q = 0.3
    for (const raw of [0.34, 0.36, 0.33, 0.355, 0.349, 0.36]) q = steerWithHysteresis(raw, q)
    expect(q).toBe(0.3)
    q = steerWithHysteresis(0.38, q)
    expect(q).toBe(0.4)
    expect(steerWithHysteresis(NaN, 0.2)).toBe(0.2)
  })
})

describe('sanitizeInput (host side)', () => {
  it('cleans good input', () => {
    expect(sanitizeInput({ s: 0.73, g: 1, b: 0, f: 4 })).toEqual({ s: 0.7, g: 1, b: 0, f: 4 })
    expect(sanitizeInput({ s: -5, g: true, b: true, f: 2.9 })).toEqual({ s: -1, g: 1, b: 1, f: 2 })
    expect(sanitizeInput({ s: 0 })).toEqual({ s: 0, g: 0, b: 0, f: 0 })
  })
  it('drops junk', () => {
    for (const junk of [null, undefined, 3, 'left', [], [1, 2], { s: 'x' }, { s: NaN }, { s: 0, f: 'many' }, { f: 1 }]) {
      expect(sanitizeInput(junk)).toBeNull()
    }
    expect(sanitizeInput({ s: 0.5, g: 'yes', b: 2, f: -4 })).toEqual({ s: 0.5, g: 0, b: 0, f: 0 })
  })
})

describe('InputSender: the 10 a second rule', () => {
  it('never sends more than 10 in any rolling second, even under a storm of changes', () => {
    const sent: { at: number; m: KartInput }[] = []
    let clock = 0
    const tx = new InputSender((m) => sent.push({ at: clock, m }))
    let f = 0
    // 60 seconds of a twitchy thumb: a new input every 1-15 ms, pumped every 50 ms.
    let nextPump = 0
    while (clock < 60_000) {
      clock += 1 + Math.floor(rand() * 15)
      if (rand() < 0.05) f += 1
      tx.set({ s: quantizeSteer(rand() * 2 - 1), g: rand() < 0.5 ? 1 : 0, b: rand() < 0.3 ? 1 : 0, f }, clock)
      while (nextPump <= clock) { tx.pump(nextPump); nextPump += 50 }
    }
    const times = sent.map((x) => x.at)
    expect(maxPerRollingSecond(times)).toBeLessThanOrEqual(MAX_PER_SEC)
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(MIN_GAP_MS)
    expect(maxPerRollingSecond(times)).toBeLessThanOrEqual(9)
    // It still kept up: close to the cap, not starved.
    expect(sent.length).toBeGreaterThan(450)
    expect(tx.total).toBe(sent.length)
  })

  it('sends the latest value once things settle, and the fire counter always gets through', () => {
    const sent: KartInput[] = []
    const tx = new InputSender((m) => sent.push(m))
    tx.set({ s: 0, g: 1, b: 0, f: 0 }, 0)
    tx.set({ s: 0.5, g: 1, b: 0, f: 0 }, 10)
    tx.set({ s: 0.6, g: 1, b: 0, f: 1 }, 20)
    tx.set({ s: 0.7, g: 1, b: 0, f: 2 }, 30)
    expect(sent).toHaveLength(1)
    tx.pump(110)
    expect(sent).toHaveLength(1)
    tx.pump(120)
    expect(sent).toHaveLength(2)
    expect(sent[1]).toEqual({ s: 0.7, g: 1, b: 0, f: 2 })
  })

  it('sends only on change, plus a keepalive every second', () => {
    const at: number[] = []
    let clock = 0
    const tx = new InputSender(() => at.push(clock))
    const same = { s: 0.2, g: 1 as const, b: 0 as const, f: 0 }
    for (clock = 0; clock <= 5000; clock += 50) tx.set(same, clock)
    expect(at).toEqual([0, 1000, 2000, 3000, 4000, 5000])
    tx.stop()
    for (; clock <= 9000; clock += 50) tx.pump(clock)
    expect(at).toHaveLength(6)
  })

  it('counts rolling windows right', () => {
    expect(maxPerRollingSecond([])).toBe(0)
    expect(maxPerRollingSecond([0, 100, 200, 999, 1000, 1100])).toBe(4)
    expect(maxPerRollingSecond(Array.from({ length: 30 }, (_, i) => i * 100))).toBe(10)
  })
})

describe('tilt', () => {
  it('is zero held level, and lowering the right side steers right', () => {
    expect(Math.abs(gravityRight(0, 0, 0))).toBeLessThan(1e-9)
    expect(Math.abs(gravityRight(90, 0, 0))).toBeLessThan(1e-9)
    // portrait, lying back, roll right 30 degrees
    expect(gravityRight(0, 30, 0)).toBeCloseTo(0.5, 5)
    expect(gravityRight(0, -30, 0)).toBeCloseTo(-0.5, 5)
    // landscape (top of the phone to the left): the right end of the screen is the phone's bottom,
    // so lifting the top (beta up) drops the right end: steer right.
    expect(gravityRight(30, 0, 90)).toBeCloseTo(0.5, 5)
    expect(gravityRight(-30, 0, 90)).toBeCloseTo(-0.5, 5)
    // top to the right: the same lift steers left
    expect(gravityRight(30, 0, -90)).toBeCloseTo(-0.5, 5)
    expect(gravityRight(30, 0, 270)).toBeCloseTo(-0.5, 5)
  })
  it('maps to steering with a dead zone and full lock', () => {
    expect(tiltToSteer(0.02, 0)).toBe(0)
    expect(tiltToSteer(0.5, 0)).toBe(1)
    expect(tiltToSteer(-0.9, 0)).toBe(-1)
    expect(tiltToSteer(0.27, 0)).toBeCloseTo(0.5, 1)
    // calibrated zero
    expect(tiltToSteer(0.3, 0.3)).toBe(0)
  })
})
