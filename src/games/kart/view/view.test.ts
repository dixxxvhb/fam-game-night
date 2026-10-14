import { describe, expect, it } from 'vitest'
import { getTrack, pointAt } from '../tracks'
import { chaseCam, chaseRig, flyoverCam, KART_W, newChase, overviewCam, project, stepChase, unproject, viewIndex } from './camera'
import { layoutPanes } from './layout'
import { trackBox } from './look'

describe('layoutPanes', () => {
  const W = 1280
  const H = 720
  it('1 racer fills the box inside the frame', () => {
    const p = layoutPanes('split', ['a'], W, H, 6)
    expect(p).toEqual([{ id: 'a', kind: 'chase', x: 6, y: 6, w: 1268, h: 708 }])
  })
  it('2 racers side by side, equal, no overlap', () => {
    const [a, b] = layoutPanes('split', ['a', 'b'], W, H, 6)
    expect(a.w).toBeCloseTo(b.w)
    expect(a.h).toBe(b.h)
    expect(a.x + a.w).toBeLessThanOrEqual(b.x)
    expect(b.x + b.w).toBeCloseTo(W - 6)
  })
  it('3 racers = quad with the minimap fourth', () => {
    const p = layoutPanes('split', ['a', 'b', 'c'], W, H, 6)
    expect(p.map((x) => x.kind)).toEqual(['chase', 'chase', 'chase', 'minimap'])
    const m = p[3]
    expect(m.x + m.w).toBeCloseTo(W - 6)
    expect(m.y + m.h).toBeCloseTo(H - 6)
  })
  it('4 racers = quad, 5+ or none = overview', () => {
    expect(layoutPanes('split', ['a', 'b', 'c', 'd'], W, H).every((x) => x.kind === 'chase')).toBe(true)
    expect(layoutPanes('split', ['a', 'b', 'c', 'd', 'e'], W, H)[0].kind).toBe('overview')
    expect(layoutPanes('split', [], W, H)[0].kind).toBe('overview')
  })
  it('single has no frame', () => {
    expect(layoutPanes('single', ['me'], 390, 300)).toEqual([{ id: 'me', kind: 'chase', x: 0, y: 0, w: 390, h: 300 }])
  })
})

describe('camera math', () => {
  it('project and unproject agree on the ground', () => {
    const cam = { x: 100, y: 200, yaw: 0.7, H: 60, f: 450, hy: 120, w: 640, h: 360, fogNear: 700, fogFar: 2000, sprite: 1, props: 1, clear: 150 }
    const g = unproject(cam, 400, 300)!
    const p = project(cam, g.x, g.y)!
    expect(p.sx).toBeCloseTo(400, 3)
    expect(p.sy).toBeCloseTo(300, 3)
  })
  it('points behind the camera do not project', () => {
    const cam = { x: 0, y: 0, yaw: 0, H: 60, f: 450, hy: 120, w: 640, h: 360, fogNear: 700, fogFar: 2000, sprite: 1, props: 1, clear: 150 }
    expect(project(cam, -50, 0)).toBeNull()
  })
  it('view index: 0 from behind, 4 facing us, 2 nose to screen right', () => {
    // camera at origin looking +x; kart ahead at (100, 0)
    expect(viewIndex(0, 0, 100, 0, 0)).toBe(0)
    expect(viewIndex(0, 0, 100, 0, Math.PI)).toBe(4)
    // heading +y (y down) = turned clockwise = pointing to the camera's right
    expect(viewIndex(0, 0, 100, 0, Math.PI / 2)).toBe(2)
    expect(viewIndex(0, 0, 100, 0, -Math.PI / 2)).toBe(6)
  })
  it('chase cam puts the kart low in the middle of the pane at a steady size', () => {
    for (const [w, h] of [[640, 360], [1280, 720], [626, 708], [390, 300], [844, 390]]) {
      const st = newChase('a')
      stepChase(st, { x: 500, y: 400, a: 0.3, spin: false, boost: false, z: 0, shake: 0 }, 1 / 60)
      const cam = chaseCam(st, w, h, 0)
      const p = project(cam, 500, 400)!
      expect(p.sx).toBeCloseTo(w / 2, 0)
      expect(p.sy / h).toBeGreaterThan(0.78)
      expect(p.sy / h).toBeLessThan(0.9)
      const px = KART_W * p.k
      expect(px).toBeCloseTo(Math.min(0.2 * w, 0.34 * h), 0)
      expect(chaseRig(w, h).H).toBeGreaterThan(10)
    }
  })
  it('overview frames the whole track', () => {
    for (const id of ['oval', 'eight', 'swamp', 'night']) {
      const t = getTrack(id)
      const cam = overviewCam(trackBox(t, 40), 1280, 720)
      for (let s = 0; s < t.L; s += 40) {
        const q = pointAt(t, s)
        const p = project(cam, q.x, q.y)!
        expect(p).not.toBeNull()
        expect(p.sx).toBeGreaterThan(0)
        expect(p.sx).toBeLessThan(1280)
        expect(p.sy).toBeGreaterThan(0)
        expect(p.sy).toBeLessThan(720)
      }
    }
  })
  it('flyover ends behind the start line looking at it', () => {
    for (const id of ['oval', 'eight', 'swamp', 'night']) {
      const t = getTrack(id)
      const cam = flyoverCam(t, 1, 1280, 720)
      const s0 = pointAt(t, 0)
      const p = project(cam, s0.x, s0.y)!
      expect(p).not.toBeNull()
      expect(Math.abs(p.sx - 640)).toBeLessThan(320)
      expect(p.sy).toBeGreaterThan(cam.hy)
      expect(p.sy).toBeLessThan(720)
    }
  })
})
