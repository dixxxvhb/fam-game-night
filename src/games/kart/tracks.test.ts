import { describe, expect, it } from 'vitest'
import { CUPS } from './contract'
import {
  deltaS, getTrack, gridSpot, inWater, levelsTouch, offsetAt, pointAt, project, TRACK_DEFS, TRACK_IDS, trackBounds, wrapS,
} from './tracks'

describe('track geometry', () => {
  it('eight tracks, the two cups use each exactly once', () => {
    expect(TRACK_IDS).toHaveLength(8)
    expect(CUPS.flatMap((c) => c.tracks).sort()).toEqual([...TRACK_IDS].sort())
  })

  for (const id of TRACK_IDS) {
    const t = getTrack(id)

    it(`${id}: is a closed, evenly spaced loop inside its world`, () => {
      expect(t.n).toBeGreaterThan(500)
      expect(t.L).toBeGreaterThan(6000)
      expect(t.w).toBeLessThan(5000)
      expect(t.h).toBeLessThan(3000)
      for (let i = 0; i < t.n; i++) {
        const j = (i + 1) % t.n
        const seg = Math.hypot(t.xs[j] - t.xs[i], t.ys[j] - t.ys[i])
        expect(seg).toBeGreaterThan(t.step * 0.5)
        expect(seg).toBeLessThan(t.step * 1.6)
        expect(t.xs[i] - t.half).toBeGreaterThan(100)
        expect(t.xs[i] + t.half).toBeLessThan(t.w - 100)
        expect(t.ys[i] - t.half).toBeGreaterThan(100)
        expect(t.ys[i] + t.half).toBeLessThan(t.h - 100)
      }
    })

    it(`${id}: the road never overlaps itself (except the flyover's bridge)`, () => {
      const far = Math.ceil((t.half * 4) / t.step)
      for (let i = 0; i < t.n; i += 3) {
        for (let j = i + far; j < t.n; j += 3) {
          if (t.n - (j - i) < far) continue
          if (t.level[i] !== 0 && t.level[j] !== 0) continue
          const d = Math.hypot(t.xs[i] - t.xs[j], t.ys[i] - t.ys[j])
          if (d < t.half * 2 + 20) throw new Error(`${id}: samples ${i} and ${j} are ${d.toFixed(0)} apart`)
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

    it(`${id}: has a name, a blurb in the house voice, a look and features`, () => {
      const def = TRACK_DEFS.find((d) => d.id === id)!
      expect(def.name.length).toBeGreaterThan(3)
      expect(def.blurb.length).toBeGreaterThan(40)
      expect(def.blurb).not.toMatch(/[—–]/) // no em or en dashes
      expect(def.blurb).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(t.look.skyTop).toMatch(/^#[0-9A-F]{6}$/i)
      expect(t.features.boxes?.length).toBeGreaterThanOrEqual(2)
      expect(t.features.pads?.length).toBeGreaterThanOrEqual(2)
      expect(t.features.coins?.length).toBeGreaterThanOrEqual(3)
      // Nothing to pick up sits off the road.
      for (const c of t.features.coins ?? []) expect(Math.abs(c.d)).toBeLessThan(0.8)
    })

    it(`${id}: 40 to 120 props, none on the road, all inside the world`, () => {
      expect(t.props.length).toBeGreaterThanOrEqual(40)
      expect(t.props.length).toBeLessThanOrEqual(120)
      for (const p of t.props) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(t.w)
        expect(p.y).toBeLessThanOrEqual(t.h)
        if (p.kind !== 'gate') expect(project(t, p.x, p.y).dist).toBeGreaterThan(t.half)
        for (const s of [p.text ?? '']) expect(s).not.toMatch(/[—–]/)
      }
    })

    it(`${id}: trackBounds fits the road inside the world`, () => {
      const b = trackBounds(t)
      expect(b.x0).toBeGreaterThanOrEqual(0)
      expect(b.x1).toBeLessThanOrEqual(t.w)
      expect(b.y1).toBeLessThanOrEqual(t.h)
      expect(b.x1 - b.x0).toBeGreaterThan(1000)
    })
  }

  it('wraps arc length both ways', () => {
    expect(wrapS(-10, 100)).toBe(90)
    expect(wrapS(250, 100)).toBe(50)
    expect(deltaS(95, 5, 100)).toBe(10)
    expect(deltaS(5, 95, 100)).toBe(-10)
  })

  it('flyover has a bridge over a tunnel, and they never touch', () => {
    const t = getTrack('eight')
    expect(t.over).not.toBeNull()
    expect(t.under).not.toBeNull()
    expect(t.level.filter((l) => l === 2).length).toBeGreaterThan(10)
    expect(t.level.filter((l) => l === 1).length).toBeGreaterThan(10)
    expect(levelsTouch(1, 2)).toBe(false)
    expect(levelsTouch(0, 2)).toBe(true)
    const c = t.cross!
    const overIdx = t.level.indexOf(2)
    const underIdx = t.level.indexOf(1)
    const onBridge = project(t, c.x, c.y, overIdx + 10)
    const inTunnel = project(t, c.x, c.y, underIdx + 10)
    expect(t.level[onBridge.i]).toBe(2)
    expect(t.level[inTunnel.i]).toBe(1)
  })

  it('hazard tracks carry what their hazards need', () => {
    expect(getTrack('swamp').gator).toBeTruthy()
    expect(getTrack('pier').waveAt).not.toBeNull()
    expect(getTrack('launch').pad).not.toBeNull()
    // The rocket's smoke (520 around the pad) covers a stretch of road, and the pad sits off it.
    const lp = getTrack('launch')
    const pad = lp.pad!
    let near = 0
    for (let i = 0; i < lp.n; i++) if (Math.hypot(lp.xs[i] - pad.x, lp.ys[i] - pad.y) < 520) near++
    expect(near).toBeGreaterThan(20)
    expect(project(lp, pad.x, pad.y).dist).toBeGreaterThan(lp.half + 60)
    expect(getTrack('keys').features.hazards).toContain('wind')
    expect(getTrack('night').features.hazards).toContain('barrels')
    expect(getTrack('night').look.night).toBe(true)
    // Coaster Hill: the lazy river crosses the road right after the ramp.
    const t = getTrack('coaster')
    const r = t.features.ramps![0]
    const after = offsetAt(t, (r.at + 0.02) * t.L, 0)
    expect(inWater(t, after.x, after.y)).toBe(true)
    const before = offsetAt(t, (r.at - 0.01) * t.L, 0)
    expect(inWater(t, before.x, before.y)).toBe(false)
  })
})
