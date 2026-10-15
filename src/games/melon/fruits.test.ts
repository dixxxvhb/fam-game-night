import { describe, expect, it } from 'vitest'
import {
  clock,
  decodeSnap,
  encodeSnap,
  fmt,
  fruit,
  FRUITS,
  isTier,
  junkFor,
  MAX_SNAP_FRUIT,
  mergeScore,
  pointsForPair,
  TIERS,
  WATERMELON_BONUS,
  WORLD_W,
  withArticle,
} from './fruits'

describe('tier table', () => {
  it('has the 11 fruits in order, each bigger than the last, each its own color', () => {
    expect(FRUITS.map((f) => f.name)).toEqual([
      'cherry', 'strawberry', 'grape', 'orange', 'persimmon', 'apple', 'pear', 'peach', 'pineapple', 'melon', 'watermelon',
    ])
    expect(FRUITS).toHaveLength(TIERS)
    FRUITS.forEach((f, i) => {
      expect(f.tier).toBe(i + 1)
      if (i > 0) expect(f.r).toBeGreaterThan(FRUITS[i - 1].r)
    })
    expect(new Set(FRUITS.map((f) => f.color)).size).toBe(TIERS)
    // a watermelon still fits in the jar with room to spare
    expect(FRUITS[10].r * 2).toBeLessThan(WORLD_W * 0.7)
  })
  it('looks up and clamps tiers', () => {
    expect(fruit(1).name).toBe('cherry')
    expect(fruit(11).name).toBe('watermelon')
    expect(fruit(0).name).toBe('cherry')
    expect(fruit(99).name).toBe('watermelon')
    expect(isTier(5)).toBe(true)
    expect(isTier(0)).toBe(false)
    expect(isTier(12)).toBe(false)
    expect(isTier(2.5)).toBe(false)
    expect(isTier('3')).toBe(false)
  })
})

describe('scoring', () => {
  it('pays triangular numbers by the tier you make', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(mergeScore)).toEqual([1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66])
  })
  it('pays a pair by what it becomes, and two watermelons pop for the bonus', () => {
    expect(pointsForPair(1)).toBe(3)
    expect(pointsForPair(4)).toBe(15)
    expect(pointsForPair(10)).toBe(66)
    expect(pointsForPair(11)).toBe(WATERMELON_BONUS)
    expect(WATERMELON_BONUS).toBe(100)
  })
  it('throws junk only for tier 5 and up, capped', () => {
    expect(junkFor(2)).toBe(0)
    expect(junkFor(4)).toBe(0)
    expect(junkFor(5)).toBe(2)
    expect(junkFor(7)).toBe(4)
    expect(junkFor(11)).toBe(6)
  })
  it('formats numbers, clocks and fruit names', () => {
    expect(fmt(1240)).toBe('1,240')
    expect(clock(120_000)).toBe('2:00')
    expect(clock(61_001)).toBe('1:02')
    expect(clock(-5)).toBe('0:00')
    expect(withArticle('orange')).toBe('an orange')
    expect(withArticle('watermelon')).toBe('a watermelon')
  })
})

describe('jar snapshot', () => {
  it('rounds to ints and round-trips', () => {
    const snap = encodeSnap(41.6, [{ tier: 3, x: 100.4, y: 700.6 }, { tier: 11, x: 300, y: 600.2 }])
    expect(snap).toEqual({ s: 42, f: [{ t: 3, x: 100, y: 701 }, { t: 11, x: 300, y: 600 }] })
    expect(decodeSnap(JSON.parse(JSON.stringify(snap)))).toEqual(snap)
  })
  it('carries danger as 0..100 only when there is some', () => {
    expect(encodeSnap(0, [], 0)).toEqual({ s: 0, f: [] })
    const snap = encodeSnap(5, [], 0.426)
    expect(snap.d).toBe(43)
    expect(decodeSnap(JSON.parse(JSON.stringify(snap)))).toEqual(snap)
    expect(decodeSnap({ s: 1, f: [], d: 900 })!.d).toBe(100)
    expect(decodeSnap({ s: 1, f: [], d: 'x' })).toEqual({ s: 1, f: [] })
  })
  it('caps the fruit count both ways', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ tier: 1, x: i, y: 500 }))
    expect(encodeSnap(0, many).f).toHaveLength(MAX_SNAP_FRUIT)
    expect(decodeSnap({ s: 0, f: many.map((m) => ({ t: 1, x: m.x, y: m.y })) })!.f).toHaveLength(MAX_SNAP_FRUIT)
  })
  it('rejects junk and drops bad fruit', () => {
    expect(decodeSnap(null)).toBeNull()
    expect(decodeSnap('hi')).toBeNull()
    expect(decodeSnap({ s: 'lots', f: [] })).toBeNull()
    expect(decodeSnap({ s: 10 })).toBeNull()
    expect(decodeSnap({ s: Number.NaN, f: [] })).toBeNull()
    const d = decodeSnap({
      s: 5,
      f: [{ t: 2, x: 10, y: 20 }, { t: 0, x: 1, y: 1 }, { t: 12, x: 1, y: 1 }, { t: 3, x: 'a', y: 1 }, null, 7, { t: 4, x: 1e9, y: -1e9 }],
    })!
    expect(d.f).toEqual([{ t: 2, x: 10, y: 20 }, { t: 4, x: 800, y: -400 }])
    expect(decodeSnap({ s: -5, f: [] })!.s).toBe(0)
  })
})
