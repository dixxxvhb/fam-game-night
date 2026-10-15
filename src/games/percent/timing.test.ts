import { describe, expect, it } from 'vitest'
import { needleAt, swing, typed, sweep, SWEEP_MS, TEAR_AT, RESULTS_AT } from './timing'

describe('needle timing', () => {
  it('swing starts at 0 and ends exactly at 1', () => {
    expect(swing(0, 2000)).toBe(0)
    expect(swing(-5, 2000)).toBe(0)
    expect(swing(2000, 2000)).toBe(1)
    expect(swing(5000, 2000)).toBe(1)
    expect(swing(10, 0)).toBe(1)
  })
  it('swing overshoots once, then settles close to 1', () => {
    let max = 0
    for (let ms = 0; ms <= 2000; ms += 10) max = Math.max(max, swing(ms, 2000))
    expect(max).toBeGreaterThan(1.08)
    expect(max).toBeLessThan(1.25)
    expect(Math.abs(swing(1900, 2000) - 1)).toBeLessThan(0.01)
  })
  it('needleAt stays on the dial', () => {
    for (let ms = 0; ms <= 2200; ms += 25) {
      const v = needleAt(0, 97, ms, 2200)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
    expect(needleAt(0, 44, 2200, 2200)).toBe(44)
    expect(needleAt(30, 30, 700, 2200)).toBe(30)
  })
  it('the bar tears before the results land', () => {
    expect(TEAR_AT).toBeLessThan(SWEEP_MS)
    expect(SWEEP_MS).toBeLessThan(RESULTS_AT)
    expect(sweep(SWEEP_MS, SWEEP_MS)).toBe(1)
  })
  it('typed types a character at a time', () => {
    expect(typed('Hello', 0)).toBe('')
    expect(typed('Hello', 22 * 3)).toBe('Hel')
    expect(typed('Hello', 99999)).toBe('Hello')
  })
})
