import { describe, expect, it } from 'vitest'
import { FACTS, type FactCat } from './facts'
import { isTruth, sameAnswer } from '../_lie/logic'

const BAD = /[–—‘’“”]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const CATS: FactCat[] = ['history', 'inventions', 'animals', 'science', 'food', 'laws', 'florida', 'disney', 'broadway', 'dance', 'music', 'sports', 'wildcard']
const words = (s: string) => s.trim().split(/\s+/).length

describe('Bluff facts', () => {
  it('has at least 120, with every category in the mix', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(120)
    for (const c of CATS.filter((c) => c !== 'wildcard')) {
      expect(FACTS.filter((f) => f.cat === c).length, c).toBeGreaterThanOrEqual(5)
    }
  })

  it('has unique ids and questions', () => {
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length)
    expect(new Set(FACTS.map((f) => f.q.toLowerCase())).size).toBe(FACTS.length)
  })

  it('every fact is well formed', () => {
    for (const f of FACTS) {
      const at = `${f.id}`
      expect(f.id, at).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(CATS, at).toContain(f.cat)
      expect(f.q.match(/____/g)?.length, at).toBe(1)
      expect(f.q.length, at).toBeLessThanOrEqual(140)
      expect(f.q, at).not.toMatch(/\b(a|an) ____/i)
      expect(words(f.truth), at).toBeLessThanOrEqual(4)
      expect(f.truth.trim(), at).toBe(f.truth)
      expect(f.truth, at).not.toMatch(/\.$/)
      expect(f.house, at).toHaveLength(3)
      for (const h of f.house) {
        expect(h.trim().length, at).toBeGreaterThan(0)
        expect(h.length, at).toBeLessThanOrEqual(60)
      }
      expect(f.source.length, at).toBeGreaterThan(2)
      expect(f.url, at).toMatch(/^https:\/\/\S+$/)
    }
  })

  it('no em dashes, curly quotes or emojis', () => {
    for (const f of FACTS) expect(JSON.stringify(f), f.id).not.toMatch(BAD)
  })

  it('no House lie is the truth, and the three are different', () => {
    for (const f of FACTS) {
      for (const h of f.house) {
        expect(h.toLowerCase(), f.id).not.toBe(f.truth.toLowerCase())
        expect(isTruth(h, f, 'blank'), `${f.id}: ${h}`).toBe(false)
      }
      const [a, b, c] = f.house
      expect(sameAnswer(a, b) || sameAnswer(a, c) || sameAnswer(b, c), f.id).toBe(false)
    }
  })
})
