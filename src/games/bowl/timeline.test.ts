import { describe, expect, it } from 'vitest'
import { inSlowMo, msAt, replayMs, rollMs, sampleAt, SLOW_RATE, WINDUP_MS } from './timeline'
import { mingoLine, MINGO, streakWord } from './lines'

describe('roll timeline', () => {
  const r = { n: 100, dt: 50, hit: 40 }

  it('plays at normal speed without a hit', () => {
    const miss = { n: 100, dt: 50, hit: -1 }
    expect(replayMs(miss)).toBe(99 * 50)
    expect(sampleAt(miss, 500)).toBe(10)
    expect(sampleAt(miss, 1e9)).toBe(99)
  })

  it('slows down around the hit and the clock adds up', () => {
    expect(replayMs(r)).toBeGreaterThan(99 * 50)
    expect(rollMs(r)).toBe(WINDUP_MS + replayMs(r))
    // Before the slow window: normal speed.
    expect(sampleAt(r, 1000)).toBe(20)
    // Inside it: slower.
    const a = sampleAt(r, msAt(r, 40))
    const b = sampleAt(r, msAt(r, 40) + 50)
    expect(a).toBeCloseTo(40)
    expect(b - a).toBeCloseTo(SLOW_RATE)
    expect(inSlowMo(r, 41)).toBe(true)
    expect(inSlowMo(r, 20)).toBe(false)
    // The end of the replay is reached exactly at replayMs.
    expect(sampleAt(r, replayMs(r))).toBeCloseTo(99)
  })

  it('msAt is the inverse of sampleAt', () => {
    for (const f of [0, 10, 38, 40, 45, 49, 60, 99]) expect(sampleAt(r, msAt(r, f))).toBeCloseTo(f)
  })
})

describe('Mingo', () => {
  it('has a line for every kind, no em dashes, same line on every screen', () => {
    for (const list of Object.values(MINGO)) for (const l of list) expect(l).not.toMatch(/—|–/)
    const res = { n: 7, by: 'x', kind: 'strike' as const, label: 'STRIKE', line: '', pins: 10, streak: 1 }
    expect(mingoLine(res)).toBe(mingoLine({ ...res }))
    expect(MINGO.turkey).toContain(mingoLine({ ...res, streak: 3 }))
    expect(streakWord(3)).toBe('TURKEY')
    expect(streakWord(1)).toBeNull()
  })
})
