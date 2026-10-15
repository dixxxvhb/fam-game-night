import { describe, expect, it } from 'vitest'
import { chipCount, chipUnit } from './chips'
import { STINGERS, TRACKS } from './music'
import { CATEGORIES } from '../_quiz/categories'
import { LINES, chipLine, revealLine } from './lines'
import {
  SLICE, SPIN_ANIM_MS, flapperAngle, landingAngle, pegCount, restAngle, spinAngle, spinPlan, wedgeAt,
} from './wheelMath'

describe('wheel math', () => {
  it('lands every category under the pointer', () => {
    for (const c of CATEGORIES) {
      expect(wedgeAt(landingAngle(c.key))).toBe(c.key)
      for (const key of ['1-0', '2-3', '4-0', 'x']) {
        const plan = spinPlan(key, c.key)
        expect(wedgeAt(spinAngle(plan, SPIN_ANIM_MS))).toBe(c.key)
        expect(wedgeAt(spinAngle(plan, SPIN_ANIM_MS + 5_000))).toBe(c.key)
      }
    }
  })

  it('starts from the resting angle and turns at least five times', () => {
    const plan = spinPlan('2-1', 'florida')
    expect(plan.from).toBe(restAngle('2-1'))
    expect(spinAngle(plan, 0)).toBe(plan.from)
    expect(plan.to - plan.from).toBeGreaterThanOrEqual(5 * 360)
    expect(plan.to - plan.from).toBeLessThan(7 * 360)
  })

  it('is deterministic: same key, same spin', () => {
    expect(spinPlan('3-2', 'movies')).toEqual(spinPlan('3-2', 'movies'))
    expect(spinAngle(spinPlan('3-2', 'movies'), 1234)).toBe(spinAngle(spinPlan('3-2', 'movies'), 1234))
  })

  it('pulls back, then only moves forward while it slows down', () => {
    const plan = spinPlan('1-0', 'tv')
    expect(spinAngle(plan, 100)).toBeLessThan(plan.from)
    let prev = spinAngle(plan, 300)
    let prevStep = Infinity
    for (let t = 400; t <= SPIN_ANIM_MS * 0.9; t += 100) {
      const a = spinAngle(plan, t)
      expect(a).toBeGreaterThanOrEqual(prev)
      const step = a - prev
      expect(step).toBeLessThanOrEqual(prevStep + 1e-9)
      prevStep = step
      prev = a
    }
  })

  it('ticks once per wedge edge and pushes the flapper as a peg arrives', () => {
    expect(pegCount(SLICE * 3 + 1)).toBe(3)
    expect(flapperAngle(SLICE * 0.5)).toBe(0)
    expect(flapperAngle(SLICE * 0.95)).toBeLessThan(0)
    expect(flapperAngle(SLICE * 0.99)).toBeLessThan(flapperAngle(SLICE * 0.9))
    expect(flapperAngle(SLICE * 1.01)).toBe(0)
  })
})

describe('Chip lines', () => {
  it('never uses em dashes or names that do not belong', () => {
    for (const pool of Object.values(LINES)) {
      for (const line of pool) {
        expect(line).not.toMatch(/\u2014/)
        expect(line.toLowerCase()).not.toContain('malik')
      }
    }
  })

  it('fills in names and categories and agrees on every screen', () => {
    expect(chipLine('pick', 0, { name: 'Torii' })).toContain('Torii')
    expect(chipLine('landed', 4, { cat: 'Florida' })).toContain('Florida')
    expect(chipLine('pick', 7, { name: 'A' })).toBe(chipLine('pick', 7, { name: 'A' }))
  })

  it('picks the right reveal moment', () => {
    const ps = ['a', 'b', 'c']
    const base = { correct: 1, first: null, steal: false }
    expect(revealLine({ ...base, picks: { a: 0, b: 2, c: null } }, ps, false)).toEqual({ kind: 'allWrong', who: null })
    expect(revealLine({ ...base, picks: { a: 1, b: 1, c: 1 } }, ps, false).kind).toBe('allRight')
    expect(revealLine({ ...base, picks: { a: 0, b: 1, c: 0 } }, ps, false)).toEqual({ kind: 'right', who: 'b' })
    expect(revealLine({ ...base, steal: true, first: 'c', picks: { a: 1, b: 1, c: 1 } }, ps, false)).toEqual({ kind: 'stole', who: 'c' })
    expect(revealLine({ ...base, picks: { a: 1, b: 0, c: 0 } }, ps, true)).toEqual({ kind: 'finalRight', who: 'a' })
    expect(revealLine({ ...base, picks: { a: 0, b: 0, c: 0 } }, ps, true).kind).toBe('finalWrong')
  })
})

describe('chips', () => {
  it('draws no chips for nothing and at least one for anything', () => {
    expect(chipCount(0, 100)).toBe(0)
    expect(chipCount(5, 100)).toBe(1)
    expect(chipCount(450, 100)).toBe(5)
    expect(chipCount(99999, 100, 14)).toBe(14)
  })
  it('sizes a chip so the biggest bank is a tall stack', () => {
    expect(chipUnit([1200, 300])).toBe(100)
    expect(chipUnit([0])).toBe(50)
    expect(chipCount(1200, chipUnit([1200, 300]))).toBe(12)
  })
})

describe('music', () => {
  it('writes every bar as 16 steps and prefixes ids with the game', () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.id.startsWith('trivia-')).toBe(true)
      for (const part of t.parts) for (const bar of part.bars) expect(bar.trim().split(/\s+/)).toHaveLength(16)
    }
    for (const st of Object.values(STINGERS)) expect(st.id.startsWith('trivia-')).toBe(true)
  })
})
