import { describe, expect, it } from 'vitest'
import { STINGERS, TRACKS } from './music'

const NOTE = /^[A-G][#b]?-?\d$/
const DRUMS = new Set(['kick', 'snare', 'hat', 'ohat', 'clap', 'rim', 'tick', 'tom', 'crash', 'shaker'])

describe('Operation Percent music data', () => {
  it('every bar is 16 steps of valid tokens', () => {
    for (const t of TRACKS) {
      expect(t.id.startsWith('percent-')).toBe(true)
      for (const part of t.parts) {
        for (const bar of part.bars) {
          const toks = bar.trim().split(/\s+/)
          expect(toks, `${t.id} ${part.inst}: ${bar}`).toHaveLength(16)
          for (const tok of toks) {
            if (tok === '.') continue
            const [n, len] = tok.split(':')
            if (DRUMS.has(part.inst)) expect(['x', 'o']).toContain(n)
            else expect(n, `${t.id} ${tok}`).toMatch(NOTE)
            if (len) expect(Number(len)).toBeGreaterThan(0)
          }
        }
      }
    }
  })
  it('stingers are short and named for this game', () => {
    for (const s of STINGERS) {
      expect(s.id.startsWith('percent-')).toBe(true)
      for (const [, note, step, len] of s.notes) {
        expect(note).toMatch(NOTE)
        expect(step).toBeGreaterThanOrEqual(0)
        expect(len).toBeGreaterThan(0)
      }
    }
  })
})
