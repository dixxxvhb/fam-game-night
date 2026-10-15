import { describe, expect, it } from 'vitest'
import { LETTERS } from './logic'
import { clockMood, LAND_MS, LEVER_MS, REEL_LEN, reelStrip, ROLL_MS, rollPhase, writeStartedAt } from './machine'

describe('letter machine', () => {
  it('prints a reel that ends on the letter, from real letters, never doubling up', () => {
    for (const L of LETTERS) {
      for (let round = 0; round < 5; round++) {
        const strip = reelStrip(L, round)
        expect(strip).toHaveLength(REEL_LEN)
        expect(strip.at(-1)).toBe(L)
        expect(strip.at(-2)).not.toBe(L)
        for (const x of strip) expect(LETTERS).toContain(x)
        for (let i = 1; i < strip.length; i++) expect(strip[i]).not.toBe(strip[i - 1])
      }
    }
  })
  it('draws the same strip on every screen', () => {
    expect(reelStrip('M', 2)).toEqual(reelStrip('M', 2))
    expect(reelStrip('M', 1)).not.toEqual(reelStrip('M', 2))
  })
  it('pulls, spins, lands, then gets out of the way', () => {
    expect(rollPhase('write', 0)).toBe('lever')
    expect(rollPhase('write', LEVER_MS)).toBe('spin')
    expect(rollPhase('write', LAND_MS - 1)).toBe('spin')
    expect(rollPhase('write', LAND_MS)).toBe('landed')
    expect(rollPhase('write', ROLL_MS)).toBe('done')
    expect(rollPhase('judge', 100)).toBe('done')
    expect(rollPhase('write', -5)).toBe('done')
  })
  it('knows when the write stage began', () => {
    expect(writeStartedAt({ endsAt: 125_000, stageTotal: 120_000 })).toBe(5_000)
  })
  it('speeds the clock up in the last ten seconds', () => {
    expect(clockMood(60)).toBe('calm')
    expect(clockMood(11)).toBe('calm')
    expect(clockMood(10)).toBe('hurry')
    expect(clockMood(6)).toBe('hurry')
    expect(clockMood(5)).toBe('panic')
    expect(clockMood(1)).toBe('panic')
    expect(clockMood(0)).toBe('up')
  })
})
