import { describe, expect, it } from 'vitest'
import { swipeToThrow, type SwipePt } from './swipe'
import { swingFrom } from './motion'

/** A straight-ish swipe up `up` px in `ms`, drifting `drift` px sideways by the end. */
function swipe(up: number, ms: number, drift = 0, steps = 10): SwipePt[] {
  const pts: SwipePt[] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    pts.push({ x: 200 + drift * f * f, y: 600 - up * f, t: 1000 + ms * f })
  }
  return pts
}

describe('swipe throw', () => {
  it('needs a real swipe up', () => {
    expect(swipeToThrow([])).toBeNull()
    expect(swipeToThrow(swipe(40, 100))).toBeNull()
    expect(swipeToThrow(swipe(-200, 100))).toBeNull()
  })

  it('a faster swipe is a faster ball, a weak one is weak', () => {
    const slow = swipeToThrow(swipe(300, 700))!
    const fast = swipeToThrow(swipe(300, 110))!
    expect(slow.speed).toBeLessThan(0.15)
    expect(fast.speed).toBeGreaterThan(0.8)
  })

  it('sideways drift is the curve, either way; a straight swipe stays straight', () => {
    expect(swipeToThrow(swipe(300, 200, 0))!.curve).toBe(0)
    expect(swipeToThrow(swipe(300, 200, 10))!.curve).toBe(0)
    expect(swipeToThrow(swipe(300, 200, 80))!.curve).toBeGreaterThan(0.3)
    expect(swipeToThrow(swipe(300, 200, -160))!.curve).toBe(-1)
  })
})

describe('motion swing', () => {
  const samples = (peakAcc: number, gamma: number, ms = 600) => {
    const out = []
    for (let t = 0; t <= ms; t += 16) {
      const k = Math.sin((Math.PI * t) / ms)
      out.push({ t, acc: k * peakAcc, rot: k * 300, gamma: t > ms / 2 ? gamma : 0 })
    }
    return out
  }

  it('a tap is not a throw, and holding still is not a swing', () => {
    expect(swingFrom(samples(20, 0), 120)).toBe('short')
    expect(swingFrom([{ t: 0, acc: 0.1, rot: 2, gamma: 0 }, { t: 16, acc: 0.1, rot: 2, gamma: 0 }, { t: 32, acc: 0.1, rot: 2, gamma: 0 }, { t: 48, acc: 0.2, rot: 3, gamma: 0 }], 600)).toBe('weak')
  })

  it('a harder swing is faster; the wrist turn sets the curve', () => {
    const soft = swingFrom(samples(9, 0), 600)
    const hard = swingFrom(samples(28, 0), 600)
    if (typeof soft === 'string' || typeof hard === 'string') throw new Error('expected swings')
    expect(hard.speed).toBeGreaterThan(soft.speed)
    expect(soft.curve).toBe(0)
    const left = swingFrom(samples(18, -160), 600)
    const right = swingFrom(samples(18, 160), 600)
    if (typeof left === 'string' || typeof right === 'string') throw new Error('expected swings')
    expect(left.curve).toBeLessThan(-0.3)
    expect(right.curve).toBeGreaterThan(0.3)
  })
})
