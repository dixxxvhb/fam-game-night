import { describe, expect, it } from 'vitest'
import { depthScale, floorY, laneOffset, runnerAt, VIEW, wallX } from './corridor'

describe('finale corridor perspective', () => {
  it('shrinks toward the exit and never flips', () => {
    expect(depthScale(0)).toBe(1)
    for (let d = 1; d <= 10; d++) expect(depthScale(d)).toBeLessThan(depthScale(d - 1))
    expect(depthScale(10)).toBeGreaterThan(0.2)
  })

  it('the floor rises toward the vanishing point and the walls close in', () => {
    expect(floorY(0)).toBe(VIEW.nearY)
    expect(floorY(10)).toBeGreaterThan(VIEW.vy)
    expect(floorY(10)).toBeLessThan(floorY(5))
    const [l0, r0] = wallX(0)
    const [l10, r10] = wallX(10)
    expect(r0 - l0).toBeGreaterThan(r10 - l10)
    expect((l10 + r10) / 2).toBe(VIEW.vx)
  })

  it('spreads lanes evenly and centres a lone runner', () => {
    expect(laneOffset(0, 1)).toBe(0)
    expect(laneOffset(0, 3)).toBe(-1)
    expect(laneOffset(1, 3)).toBe(0)
    expect(laneOffset(2, 3)).toBe(1)
  })

  it('runners past the exit stand in the doorway, not beyond it', () => {
    expect(runnerAt(14, 1, 3)).toEqual(runnerAt(10, 1, 3))
    expect(runnerAt(-2, 0, 3)).toEqual(runnerAt(0, 0, 3))
    const near = runnerAt(0, 0, 3)
    const far = runnerAt(9, 0, 3)
    expect(far.s).toBeLessThan(near.s)
    expect(Math.abs(far.x - VIEW.vx)).toBeLessThan(Math.abs(near.x - VIEW.vx))
  })

  it('scales with a shorter hall so the door is always the same distance away', () => {
    expect(depthScale(5, 5)).toBeCloseTo(depthScale(10, 10))
  })
})
