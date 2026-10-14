import { describe, expect, it } from 'vitest'
import {
  deltaS, getTrack, gridSpot, HUD_RECTS, levelsTouch, offsetAt, pointAt, project, TRACK_IDS, WORLD_H, WORLD_W, wrapS,
} from './tracks'

describe('track geometry', () => {
  for (const id of TRACK_IDS) {
    const t = getTrack(id)

    it(`${id}: is a closed, evenly spaced loop inside the world`, () => {
      expect(t.n).toBeGreaterThan(100)
      expect(t.L).toBeGreaterThan(2000)
      for (let i = 0; i < t.n; i++) {
        const j = (i + 1) % t.n
        const seg = Math.hypot(t.xs[j] - t.xs[i], t.ys[j] - t.ys[i])
        expect(seg).toBeGreaterThan(t.step * 0.5)
        expect(seg).toBeLessThan(t.step * 1.6)
        // whole track surface stays on screen
        expect(t.xs[i] - t.half).toBeGreaterThan(10)
        expect(t.xs[i] + t.half).toBeLessThan(WORLD_W - 10)
        expect(t.ys[i] - t.half).toBeGreaterThan(10)
        expect(t.ys[i] + t.half).toBeLessThan(WORLD_H - 10)
      }
    })

    it(`${id}: keeps clear of the TV HUD corners`, () => {
      for (const r of HUD_RECTS) {
        for (let i = 0; i < t.n; i++) {
          const dx = Math.max(r.x0 - t.xs[i], 0, t.xs[i] - r.x1)
          const dy = Math.max(r.y0 - t.ys[i], 0, t.ys[i] - r.y1)
          const d = Math.hypot(dx, dy)
          if (d < t.half + 8) throw new Error(`${id} sample ${i} is ${d.toFixed(0)} from the ${r.name} HUD`)
        }
      }
    })

    it(`${id}: projecting a centerline point gives back its arc length`, () => {
      for (const frac of [0, 0.13, 0.37, 0.5, 0.81, 0.99]) {
        const s = frac * t.L
        const p = pointAt(t, s)
        const pr = project(t, p.x, p.y, p.i)
        expect(Math.abs(deltaS(s, pr.s, t.L))).toBeLessThan(1)
        expect(pr.dist).toBeLessThan(0.5)
        // offset to the right of travel shows as positive d
        const o = offsetAt(t, s, 30)
        const po = project(t, o.x, o.y, p.i)
        expect(po.d).toBeGreaterThan(25)
        expect(po.d).toBeLessThan(35)
      }
    })

    it(`${id}: grid spots are on track and behind the line`, () => {
      for (let slot = 0; slot < 6; slot++) {
        const g = gridSpot(t, slot)
        const pr = project(t, g.x, g.y)
        expect(pr.dist).toBeLessThan(t.half - 15)
        expect(deltaS(0, pr.s, t.L)).toBeLessThan(0)
        expect(deltaS(0, pr.s, t.L)).toBeGreaterThan(-400)
      }
    })
  }

  it('wraps arc length both ways', () => {
    expect(wrapS(-10, 100)).toBe(90)
    expect(wrapS(250, 100)).toBe(50)
    expect(deltaS(95, 5, 100)).toBe(10)
    expect(deltaS(5, 95, 100)).toBe(-10)
  })

  it('figure eight has a bridge over a tunnel, and they never touch', () => {
    const t = getTrack('eight')
    expect(t.over).not.toBeNull()
    expect(t.under).not.toBeNull()
    expect(t.level.filter((l) => l === 2).length).toBeGreaterThan(10)
    expect(t.level.filter((l) => l === 1).length).toBeGreaterThan(10)
    expect(levelsTouch(1, 2)).toBe(false)
    expect(levelsTouch(2, 1)).toBe(false)
    expect(levelsTouch(0, 2)).toBe(true)
    expect(levelsTouch(1, 1)).toBe(true)
    // At the crossing, a hint keeps each pass on its own branch.
    const c = t.crossing!
    const overIdx = t.level.indexOf(2)
    const underIdx = t.level.indexOf(1)
    const onBridge = project(t, c.x, c.y, overIdx + 10)
    const inTunnel = project(t, c.x, c.y, underIdx + 10)
    expect(t.level[onBridge.i]).toBe(2)
    expect(t.level[inTunnel.i]).toBe(1)
  })
})
