import { describe, expect, it } from 'vitest'
import { freshFirst } from './shuffle'

describe('freshFirst', () => {
  it('puts unseen items first, then the ones seen longest ago', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    const out = freshFirst(pool, (x) => x, ['d', 'b'])
    expect(out.slice(0, 3).sort()).toEqual(['a', 'c', 'e'])
    expect(out.slice(3)).toEqual(['d', 'b'])
  })
  it('works with nothing used and keeps every item', () => {
    const out = freshFirst([1, 2, 3], (x) => String(x))
    expect(out.sort()).toEqual([1, 2, 3])
  })
})
