import { describe, expect, it } from 'vitest'
import { QUESTIONS } from './questions'
import { CAT_KEYS, CATEGORIES } from './categories'
import { catsWith, drawQuestion, prepare, readPick } from './bank'

let seed = 3
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

describe('the question bank', () => {
  it('has at least 400 questions and 20 in every category', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(400)
    expect(CATEGORIES).toHaveLength(15)
    for (const k of CAT_KEYS) {
      const inCat = QUESTIONS.filter((q) => q.cat === k)
      expect(inCat.length, k).toBeGreaterThanOrEqual(20)
      // Enough hard ones for a Trivia Night final, enough easy ones for round one.
      expect(inCat.filter((q) => q.difficulty === 3).length, `${k} hard`).toBeGreaterThanOrEqual(4)
      expect(inCat.filter((q) => q.difficulty <= 2).length, `${k} easy`).toBeGreaterThanOrEqual(10)
    }
  })

  it('every question has four different options and one valid answer', () => {
    for (const q of QUESTIONS) {
      expect(CAT_KEYS, q.id).toContain(q.cat)
      expect(q.id.startsWith(`${q.cat}-`), q.id).toBe(true)
      expect(q.options, q.id).toHaveLength(4)
      expect(new Set(q.options.map(norm)).size, q.id).toBe(4)
      for (const o of q.options) {
        expect(o.trim(), q.id).toBe(o)
        expect(o.length, `${q.id} option "${o}"`).toBeGreaterThan(0)
        expect(o.length, `${q.id} option "${o}"`).toBeLessThanOrEqual(48)
      }
      expect(Number.isInteger(q.answer), q.id).toBe(true)
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0)
      expect(q.answer, q.id).toBeLessThanOrEqual(3)
      expect([1, 2, 3], q.id).toContain(q.difficulty)
      expect(q.q.length, q.id).toBeLessThanOrEqual(160)
      expect(q.q.trim().length, q.id).toBeGreaterThan(10)
    }
  })

  it('has no duplicate ids or questions', () => {
    const ids = new Set<string>()
    const texts = new Set<string>()
    for (const q of QUESTIONS) {
      expect(ids.has(q.id), q.id).toBe(false)
      ids.add(q.id)
      expect(texts.has(norm(q.q)), q.id).toBe(false)
      texts.add(norm(q.q))
    }
  })

  it('has no dashes, emojis or placeholders', () => {
    for (const q of QUESTIONS) {
      for (const text of [q.q, ...q.options]) {
        expect(text, q.id).not.toMatch(/[–—]/)
        expect(text, q.id).not.toMatch(/\p{Extended_Pictographic}/u)
        expect(text, q.id).not.toMatch(/TODO|placeholder/i)
      }
    }
  })

  it('keeps the right answer spread across positions', () => {
    const counts = [0, 0, 0, 0]
    for (const q of QUESTIONS) counts[q.answer]++
    for (const c of counts) expect(c).toBeGreaterThan(QUESTIONS.length * 0.15)
  })
})

describe('drawing questions', () => {
  it('shuffles options but keeps the answer pointing at the right text', () => {
    for (const q of QUESTIONS.slice(0, 60)) {
      const live = prepare(q, random)
      expect(live.options).toHaveLength(4)
      expect([...live.options].sort()).toEqual([...q.options].sort())
      expect(live.options[live.answer]).toBe(q.options[q.answer])
    }
  })

  it('respects category, difficulty and used, then falls back instead of running dry', () => {
    const q = drawQuestion({ used: [], cat: 'dance', min: 3, max: 3 }, random)
    expect(q.cat).toBe('dance')
    expect(q.difficulty).toBe(3)
    const hardDance = QUESTIONS.filter((x) => x.cat === 'dance' && x.difficulty === 3).map((x) => x.id)
    // All the hard dance ones used: still dance, any difficulty.
    const next = drawQuestion({ used: hardDance, cat: 'dance', min: 3, max: 3 }, random)
    expect(next.cat).toBe('dance')
    expect(hardDance).not.toContain(next.id)
    expect(catsWith(hardDance, 3, 3)).not.toContain('dance')
    // Everything used: it repeats rather than crash.
    const all = QUESTIONS.map((x) => x.id)
    expect(drawQuestion({ used: all, cat: 'tv' }, random).cat).toBe('tv')
    // avoid skips a category when none is asked for.
    for (let i = 0; i < 30; i++) expect(drawQuestion({ used: [], avoid: 'food' }, random).cat).not.toBe('food')
  })

  it('reads picks strictly', () => {
    expect(readPick({ pick: 0 })).toBe(0)
    expect(readPick({ pick: 3 })).toBe(3)
    for (const bad of [null, undefined, 1, {}, { pick: 4 }, { pick: -1 }, { pick: 2.5 }, { pick: '1' }, { pick: NaN }]) {
      expect(readPick(bad)).toBeNull()
    }
  })
})
