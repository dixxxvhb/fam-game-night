import { describe, expect, it } from 'vitest'
import { isSplit, leaveName, position, scoreCard } from './score'

const rep = (n: number, v: number[]) => Array.from({ length: n }, () => v).flat()

describe('scoreCard', () => {
  it('all strikes: 300 in ten frames, 150 in five', () => {
    expect(scoreCard(rep(12, [10]), 10).total).toBe(300)
    expect(scoreCard(rep(7, [10]), 5).total).toBe(150)
    expect(scoreCard(rep(12, [10]), 10).cells[9].marks).toEqual(['X', 'X', 'X'])
  })

  it('all spares with a 5 bonus: 150 in ten frames', () => {
    const card = scoreCard([...rep(10, [5, 5]), 5], 10)
    expect(card.total).toBe(150)
    expect(card.cells[0].marks).toEqual(['5', '/'])
    expect(card.cells[9].marks).toEqual(['5', '/', '5'])
  })

  it('gutter game is zero, shown as dashes', () => {
    const card = scoreCard(rep(10, [0, 0]), 10)
    expect(card.total).toBe(0)
    expect(card.cells[0].marks).toEqual(['-', '-'])
  })

  it('scores the classic sheet: 167', () => {
    const rolls = [10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1]
    const card = scoreCard(rolls, 10)
    expect(card.total).toBe(167)
    expect(card.cells.map((c) => c.total)).toEqual([20, 39, 48, 66, 74, 84, 90, 120, 148, 167])
  })

  it('tenth frame: strike, strike, strike / strike then open / spare then strike / open', () => {
    const nine = rep(9, [0, 0])
    expect(scoreCard([...nine, 10, 10, 10], 10).total).toBe(30)
    expect(scoreCard([...nine, 10, 7, 2], 10).total).toBe(19)
    expect(scoreCard([...nine, 10, 7, 2], 10).cells[9].marks).toEqual(['X', '7', '2'])
    expect(scoreCard([...nine, 10, 7, 3], 10).cells[9].marks).toEqual(['X', '7', '/'])
    expect(scoreCard([...nine, 9, 1, 10], 10).total).toBe(20)
    expect(scoreCard([...nine, 9, 1, 5], 10).total).toBe(15)
    expect(scoreCard([...nine, 7, 2], 10).total).toBe(9)
  })

  it('five-frame games treat frame 5 as the last frame', () => {
    expect(scoreCard([10, 10, 10, 10, 10, 10, 10], 5).total).toBe(150)
    expect(scoreCard([10, 10, 10, 10, 9, 1, 10], 5).total).toBe(30 + 30 + 29 + 20 + 20)
  })

  it('leaves frames unsettled until their bonus balls are in', () => {
    const card = scoreCard([10, 7], 5)
    expect(card.cells[0].total).toBeNull()
    expect(card.total).toBe(0)
    expect(card.live).toBe(17 + 7)
    const spare = scoreCard([6, 4], 5)
    expect(spare.cells[0].total).toBeNull()
    expect(scoreCard([6, 4, 3], 5).cells[0].total).toBe(13)
  })
})

describe('position', () => {
  it('walks frames, balls and fresh racks', () => {
    expect(position([], 5)).toEqual({ frame: 0, ball: 0, fresh: true })
    expect(position([7], 5)).toEqual({ frame: 0, ball: 1, fresh: false })
    expect(position([10], 5)).toEqual({ frame: 1, ball: 0, fresh: true })
    expect(position([7, 2], 5)).toEqual({ frame: 1, ball: 0, fresh: true })
    const four = [10, 10, 10, 10]
    expect(position(four, 5)).toEqual({ frame: 4, ball: 0, fresh: true })
    expect(position([...four, 10], 5)).toEqual({ frame: 4, ball: 1, fresh: true })
    expect(position([...four, 10, 4], 5)).toEqual({ frame: 4, ball: 2, fresh: false })
    expect(position([...four, 10, 10], 5)).toEqual({ frame: 4, ball: 2, fresh: true })
    expect(position([...four, 6], 5)).toEqual({ frame: 4, ball: 1, fresh: false })
    expect(position([...four, 6, 4], 5)).toEqual({ frame: 4, ball: 2, fresh: true })
    expect(position([...four, 6, 3], 5).frame).toBe(5)
    expect(position([...four, 10, 4, 5], 5).frame).toBe(5)
  })
})

describe('splits', () => {
  it('knows a split from a leave', () => {
    expect(isSplit([7, 10])).toBe(true)
    expect(isSplit([4, 6])).toBe(true)
    expect(isSplit([2, 7])).toBe(true)
    expect(isSplit([3, 10])).toBe(true)
    expect(isSplit([5, 7])).toBe(true)
    expect(isSplit([8, 10])).toBe(true)
    expect(isSplit([4, 6, 7, 10])).toBe(true)
    expect(isSplit([1, 2, 4])).toBe(false)
    expect(isSplit([2, 8])).toBe(false)
    expect(isSplit([4, 7])).toBe(false)
    expect(isSplit([7])).toBe(false)
    expect(isSplit([1, 7, 10])).toBe(false)
    expect(leaveName([10, 7])).toBe('7-10')
  })
})
