import { describe, expect, it } from 'vitest'
import { aimCross, pinAt, simulate, START_HALF } from './sim'
import { ALL_PINS } from './score'
import { straightAt, BOT_LINE } from './logic'

describe('simulate', () => {
  it('is deterministic: same throw and seed, same pins and the same replay', () => {
    const th = { x: 0.4, aim: 0.05, speed: 0.6, curve: -0.4 }
    const a = simulate(th, ALL_PINS, 12345)
    const b = simulate(th, ALL_PINS, 12345)
    expect(b).toEqual(a)
    expect(JSON.stringify(b.replay)).toBe(JSON.stringify(a.replay))
  })

  it('accounts for every standing pin, knocked or left', () => {
    for (let seed = 1; seed < 20; seed++) {
      const r = simulate({ x: (seed % 5) / 5 - 0.4, aim: 0, speed: seed / 20, curve: 0 }, ALL_PINS, seed)
      expect([...r.knocked, ...r.left].sort((x, y) => x - y)).toEqual(ALL_PINS)
    }
  })

  it('a ball off the edge before the pins is a gutter ball and touches nothing', () => {
    const r = simulate({ x: 1, aim: 1, speed: 0.6, curve: 0 }, ALL_PINS, 7)
    expect(r.gutter).toBe(true)
    expect(r.knocked).toEqual([])
    expect(r.hit).toBe(-1)
    const hook = simulate({ x: -1, aim: -0.5, speed: 0.3, curve: -1 }, ALL_PINS, 7)
    expect(hook.gutter).toBe(true)
  })

  it('a ball into the pocket carries most of the rack', () => {
    let total = 0
    for (let seed = 1; seed <= 10; seed++) total += simulate(BOT_LINE, ALL_PINS, seed * 97).knocked.length
    expect(total / 10).toBeGreaterThanOrEqual(8)
  })

  it('a straight ball at a lone pin picks it up', () => {
    for (const pin of [7, 10, 5]) {
      const line = straightAt(pin === 7 ? -18 : pin === 10 ? 18 : 0, pin === 7 ? 0.4 : pin === 10 ? -0.4 : 0)
      const r = simulate({ ...line, speed: 0.6, curve: 0 }, [pin], 3)
      expect(r.knocked).toEqual([pin])
    }
  })

  it('a weak swing is a slower ball than a strong one', () => {
    const slow = simulate({ x: 0, aim: 0, speed: 0.1, curve: 0 }, ALL_PINS, 1)
    const fast = simulate({ x: 0, aim: 0, speed: 0.9, curve: 0 }, ALL_PINS, 1)
    expect(slow.mph).toBeLessThan(fast.mph)
    expect(slow.hit).toBeGreaterThan(fast.hit)
  })

  it('curve hooks the ball the way it says', () => {
    const endX = (curve: number) => {
      const r = simulate({ x: 0, aim: 0, speed: 0.5, curve }, [], 1)
      const b = r.replay.ball
      for (let i = 0; i < b.length; i += 2) if (b[i + 1] >= 7000) return b[i] / 10
      return 0
    }
    expect(endX(0.6)).toBeGreaterThan(8)
    expect(endX(-0.6)).toBeLessThan(-8)
    expect(Math.abs(endX(0))).toBeLessThan(1)
  })

  it('keeps the replay small and short', () => {
    for (const speed of [0, 0.5, 1]) {
      const r = simulate({ x: 0.1, aim: 0, speed, curve: 0 }, ALL_PINS, 5)
      expect(JSON.stringify(r.replay).length).toBeLessThan(20_000)
      expect(r.replay.n * r.replay.dt).toBeLessThan(9_000)
      for (const tr of r.replay.pins) {
        const [x, y] = pinAt(tr, 0)
        expect(Number.isInteger(x * 10) && Number.isInteger(y * 10)).toBe(true)
      }
    }
  })

  it('aimCross: where a straight setup crosses the head pin row', () => {
    expect(aimCross(0, 0)).toBe(0)
    expect(aimCross(1, 0)).toBeCloseTo(START_HALF)
    expect(aimCross(0, 1)).toBeGreaterThan(25)
  })
})
