import { describe, expect, it } from 'vitest'
import { cleanStroke, cleanText, densify, inkUsed, pointCount, sameTitle, simplify, STROKE_COST, tidy, titleKey } from './strokes'

describe('simplify', () => {
  it('drops points on a straight line and keeps the ends', () => {
    const p: number[] = []
    for (let i = 0; i <= 100; i++) p.push(i * 5, i * 5)
    expect(simplify(p)).toEqual([0, 0, 500, 500])
  })
  it('keeps corners', () => {
    const p = [0, 0, 250, 0, 500, 0, 500, 250, 500, 500]
    expect(simplify(p)).toEqual([0, 0, 500, 0, 500, 500])
  })
  it('leaves dots and two-point lines alone', () => {
    expect(simplify([10, 10])).toEqual([10, 10])
    expect(simplify([10, 10, 20, 20])).toEqual([10, 10, 20, 20])
  })
})

describe('densify', () => {
  it('fills long runs so corners stay sharp, and never moves the kept points', () => {
    const p = densify([0, 0, 100, 0], 24)
    expect(p).toEqual([0, 0, 20, 0, 40, 0, 60, 0, 80, 0, 100, 0])
    expect(densify([5, 5], 24)).toEqual([5, 5])
  })
  it('a hand-drawn square comes out much smaller than it went in, corners intact', () => {
    const raw: number[] = []
    const side = (x0: number, y0: number, x1: number, y1: number) => { for (let t = 0; t < 1; t += 0.005) raw.push(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)) }
    side(100, 100, 900, 100); side(900, 100, 900, 900); side(900, 900, 100, 900); side(100, 900, 100, 100)
    const out = tidy(raw)
    expect(out.length).toBeLessThan(raw.length / 3)
    for (const [x, y] of [[900, 100], [900, 900], [100, 900]]) {
      let hit = false
      for (let i = 0; i < out.length; i += 2) if (Math.abs(out[i] - x) <= 5 && Math.abs(out[i + 1] - y) <= 5) hit = true
      expect(hit).toBe(true)
    }
  })
})

describe('cleanStroke', () => {
  const ok = { c: '#E5484D', w: 8, p: [1, 2, 3, 4] }
  it('clamps, rounds and trims to the budget', () => {
    expect(cleanStroke({ c: '#000000', w: 8.4, p: [-5, 1200, 3.6, 4.4] }, 100)).toEqual({ c: '#000000', w: 8, p: [0, 1000, 4, 4] })
    expect(cleanStroke(ok, STROKE_COST + 1)?.p).toEqual([1, 2])
    expect(cleanStroke(ok, STROKE_COST)).toBeNull()
    expect(cleanStroke(ok, 0)).toBeNull()
  })
  it('rejects junk', () => {
    for (const bad of [null, 3, 'x', { ...ok, c: 'red' }, { ...ok, w: 0 }, { ...ok, w: 81 }, { ...ok, p: [1] }, { ...ok, p: [] }, { ...ok, p: 'no' }]) {
      expect(cleanStroke(bad, 100)).toBeNull()
    }
  })
  it('counts points', () => {
    expect(pointCount([ok, { ...ok, p: [1, 2] }])).toBe(3)
    expect(inkUsed([ok, { ...ok, p: [1, 2] }])).toBe(3 + 2 * STROKE_COST)
  })
})

describe('text', () => {
  it('cleans typed lines', () => {
    expect(cleanText('  hi\n\tthere  ', 20)).toBe('hi there')
    expect(cleanText('abcdef', 3)).toBe('abc')
    expect(cleanText(5, 3)).toBe('')
  })
  it('compares titles loosely', () => {
    expect(titleKey('The Cat, a Hat!')).toBe('cathat')
    expect(sameTitle('a duck in a hat', 'The duck in the hat.')).toBe(true)
    expect(sameTitle('a duck in a hat', 'a duck in a cap')).toBe(false)
    expect(sameTitle('a cat in a hat', 'a bat in a hat')).toBe(false)
    expect(sameTitle('a duck', 'a dock')).toBe(false)
    expect(sameTitle('a seagull stealing fries', 'a seagul stealing fries')).toBe(true)
    expect(sameTitle('a confused pirate at a spin class', 'a confused pirat at a spin clas')).toBe(true)
    expect(sameTitle('a duck in a hat', 'a goose on a bike')).toBe(false)
  })
})
