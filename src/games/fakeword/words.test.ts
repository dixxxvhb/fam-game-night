import { describe, expect, it } from 'vitest'
import { WORDS } from './words'
import { isTruth, sameAnswer } from '../_lie/logic'

const BAD = /[–—‘’“”]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const DICTS = /^https:\/\/(en\.wiktionary\.org|www\.dictionary\.com|www\.merriam-webster\.com|www\.oed\.com|www\.collinsdictionary\.com|www\.oxfordlearnersdictionaries\.com)\//
const count = (s: string) => s.trim().split(/\s+/).length

describe('Fake Word words', () => {
  it('has at least 120', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(120)
  })

  it('has unique ids and words', () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length)
    expect(new Set(WORDS.map((w) => w.word.toLowerCase())).size).toBe(WORDS.length)
  })

  it('every entry is well formed', () => {
    for (const w of WORDS) {
      const at = w.word
      expect(w.id, at).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(w.word, at).toMatch(/^[a-z]+(-[a-z]+)*$/)
      expect(['noun', 'verb', 'adjective', 'adverb', 'interjection'], at).toContain(w.pos)
      expect(count(w.truth), at).toBeLessThan(12)
      expect(w.truth, at).not.toMatch(/\.$/)
      expect(w.house, at).toHaveLength(3)
      for (const h of w.house) {
        expect(count(h), `${at}: ${h}`).toBeLessThan(12)
        expect(h.length, `${at}: ${h}`).toBeLessThanOrEqual(90)
      }
      expect(w.url, at).toMatch(DICTS)
    }
  })

  it('no em dashes, curly quotes or emojis', () => {
    for (const w of WORDS) expect(JSON.stringify(w), w.word).not.toMatch(BAD)
  })

  it('no House definition is the truth, and the three are different', () => {
    for (const w of WORDS) {
      for (const h of w.house) {
        expect(h.toLowerCase(), w.word).not.toBe(w.truth.toLowerCase())
        expect(isTruth(h, w, 'word'), `${w.word}: ${h}`).toBe(false)
      }
      const [a, b, c] = w.house
      expect(sameAnswer(a, b) || sameAnswer(a, c) || sameAnswer(b, c), w.word).toBe(false)
    }
  })
})
