import { INK, type CritterId, type Mood } from '../../board/park/cast'
import { n1, shade } from './raster'
import { critterBack } from './backs'

/**
 * The karts are a tiny orthographic 3D model (boxes, lofts, tubes, wheels) projected to SVG for
 * any of the 8 views, so every angle and every lean is consistent. The driver is the real
 * CritterArt billboarded into the seat (front art when they face the camera, a hand-drawn back
 * of the head when they face away).
 *
 * Model space: x = right, y = forward (nose), z = up. 1 unit = 1 sprite pixel.
 */

export type KartPose = 'drive' | 'left' | 'right' | 'spin' | 'trick' | 'hurt'
export const KART_POSES: KartPose[] = ['drive', 'left', 'right', 'spin', 'trick', 'hurt']

/**
 * Kart sprite geometry. Canvas is W x H; (AX, AY) is the point on the road under the middle of the
 * kart (the anchor: put it on the kart's ground position). BODY_W is the kart's width in pixels
 * seen from behind (view 0, wheels included): scale = wantedKartWidthPx / BODY_W.
 */
export const KART = { W: 192, H: 192, AX: 96, AY: 160, BODY_W: 112 } as const

const PITCH = (24 * Math.PI) / 180

type V = [number, number, number]

interface Poly { k: 'poly'; pts: V[]; fill: string; bias: number; both?: boolean; flat?: boolean }
interface Tube { k: 'tube'; pts: V[]; w: number; color: string; bias: number }
interface Wheel { k: 'wheel'; c: V; r: number; w: number; tire: string; hub: string; steer: number; bias: number }
type Part = Poly | Tube | Wheel

// ---------------- builders ----------------

function sub(a: V, b: V): V { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function cross(a: V, b: V): V { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function dot(a: V, b: V): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function norm(a: V): V { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
function centroid(pts: V[]): V {
  const c: V = [0, 0, 0]
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2] }
  return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length]
}
function faceNormal(pts: V[]): V {
  // Newell's method: robust for any planar-ish polygon.
  const n: V = [0, 0, 0]
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    n[0] += (a[1] - b[1]) * (a[2] + b[2])
    n[1] += (a[2] - b[2]) * (a[0] + b[0])
    n[2] += (a[0] - b[0]) * (a[1] + b[1])
  }
  return norm(n)
}

/** Faces of a closed solid, each wound so its normal points away from `center`. */
function solid(faces: V[][], fill: string, bias = 0): Poly[] {
  const all = faces.flat()
  const center = centroid(all)
  return faces.map((f) => {
    const n = faceNormal(f)
    const out = dot(n, sub(centroid(f), center)) >= 0
    return { k: 'poly' as const, pts: out ? f : [...f].reverse(), fill, bias }
  })
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fill: string, bias = 0): Poly[] {
  const p = (x: number, y: number, z: number): V => [x, y, z]
  return solid([
    [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)],
    [p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), p(x1, y0, z0)],
    [p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0)],
    [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)],
    [p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)],
    [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)],
  ], fill, bias)
}

/** A profile in the (y, z) plane extruded across x0..x1 (wedges, tails, fins with thickness). */
function prismX(profile: [number, number][], x0: number, x1: number, fill: string, bias = 0): Poly[] {
  const a = profile.map(([y, z]): V => [x0, y, z])
  const b = profile.map(([y, z]): V => [x1, y, z])
  return loft([a, b], fill, bias, true)
}

/** Sides between consecutive rings (same point count), plus the two end caps. */
function loft(rings: V[][], fill: string | string[], bias = 0, caps = true): Poly[] {
  const faces: V[][] = []
  const fills: string[] = []
  const fillAt = (i: number) => (Array.isArray(fill) ? fill[i % fill.length] : fill)
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r]
    const B = rings[r + 1]
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length
      faces.push([A[i], A[j], B[j], B[i]])
      fills.push(fillAt(r))
    }
  }
  if (caps) {
    faces.push([...rings[0]])
    fills.push(fillAt(0))
    faces.push([...rings[rings.length - 1]])
    fills.push(fillAt(rings.length - 2))
  }
  const all = rings.flat()
  const center = centroid(all)
  return faces.map((f, i) => {
    const n = faceNormal(f)
    const out = dot(n, sub(centroid(f), center)) >= 0
    return { k: 'poly' as const, pts: out ? f : [...f].reverse(), fill: fills[i], bias }
  })
}

/** Octagon-ish ring across x (half width w) and z (z0..z1), at depth y. `round` 0..1 chamfer. */
function ringXZ(y: number, w: number, z0: number, z1: number, round = 0.35): V[] {
  const h = z1 - z0
  const cx = Math.min(w, h / 2) * round * 2
  const cz = Math.min(w, h / 2) * round * 2
  return [
    [-w + cx, y, z0], [w - cx, y, z0], [w, y, z0 + cz], [w, y, z1 - cz],
    [w - cx, y, z1], [-w + cx, y, z1], [-w, y, z1 - cz], [-w, y, z0 + cz],
  ]
}

/** A flat decal (both-sided, drawn just after the face it sits on). */
function decal(pts: V[], fill: string, bias = -3): Poly {
  return { k: 'poly', pts, fill, bias, both: true, flat: true }
}

function bez(p0: V, p1: V, p2: V, p3: V, n = 10): V[] {
  const out: V[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1], a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]])
  }
  return out
}

function tube(pts: V[], w: number, color: string, bias = 0): Tube {
  return { k: 'tube', pts, w, color, bias }
}

function wheel(c: V, r: number, w: number, hub: string, steer = 0, tire = '#2A2440'): Wheel {
  return { k: 'wheel', c, r, w, tire, hub, steer, bias: 0 }
}

// ---------------- the karts ----------------

const CHASSIS = '#3C3658'
const METAL = '#CFCADF'
const LIGHT = '#F4F1FA'
const HEAD = '#FFE27A'

interface Build {
  parts: Part[]
  /** Seat point (the critter's hips sit here). */
  seat: V
  /** Critter size multiplier. */
  scale?: number
}

function wheels4(hub: string, steer: number, opts: { rr?: number; fr?: number; rx?: number; fx?: number; ry?: number; fy?: number; rw?: number; fw?: number } = {}): Wheel[] {
  const rr = opts.rr ?? 19
  const fr = opts.fr ?? 15
  const rx = opts.rx ?? 48
  const fx = opts.fx ?? 44
  const ry = opts.ry ?? -40
  const fy = opts.fy ?? 46
  const rw = opts.rw ?? 18
  const fw = opts.fw ?? 14
  return [
    wheel([-rx, ry, rr], rr, rw, hub), wheel([rx, ry, rr], rr, rw, hub),
    wheel([-fx, fy, fr], fr, fw, hub, steer), wheel([fx, fy, fr], fr, fw, hub, steer),
  ]
}

/** The standard go-kart every critter's kart starts from. */
function base(body: string, accent: string, steer: number, o: { spoiler?: boolean; plate?: boolean; bumper?: string; hub?: string; engine?: boolean } = {}): Part[] {
  const dark = shade(body, -0.16)
  const parts: Part[] = [
    ...box(-40, 40, -60, 62, 7, 15, CHASSIS),
    ...box(-30, 30, -32, 30, 14, 36, body),
    ...box(-40, -30, -30, 26, 12, 28, dark),
    ...box(30, 40, -30, 26, 12, 28, dark),
    ...prismX([[30, 14], [66, 12], [66, 22], [30, 35]], -26, 26, body),
    decal([[-7, 31, 35.6], [7, 31, 35.6], [7, 65, 23.4], [-7, 65, 23.4]], accent),
    ...box(-16, 16, -27, -21, 32, 46, dark),
    ...wheels4(o.hub ?? LIGHT, steer),
  ]
  if (o.bumper !== '') parts.push(...box(-34, 34, 62, 72, 8, 18, o.bumper ?? LIGHT))
  if (o.bumper === undefined || o.bumper === LIGHT) {
    parts.push(decal([[-28, 72.4, 11], [-18, 72.4, 11], [-18, 72.4, 16], [-28, 72.4, 16]], HEAD))
    parts.push(decal([[18, 72.4, 11], [28, 72.4, 11], [28, 72.4, 16], [18, 72.4, 16]], HEAD))
  }
  if (o.engine !== false) {
    parts.push(...box(-24, 24, -58, -32, 14, 34, '#5B5577'))
    parts.push(tube(bez([-11, -58, 24], [-11, -64, 24], [-12, -66, 28], [-12, -68, 32], 4), 6, METAL))
    parts.push(tube(bez([11, -58, 24], [11, -64, 24], [12, -66, 28], [12, -68, 32], 4), 6, METAL))
  }
  if (o.plate !== false && o.engine !== false) {
    parts.push(decal([[-10, -58.6, 17], [10, -58.6, 17], [10, -58.6, 28], [-10, -58.6, 28]], LIGHT))
    parts.push(decal([[-6, -58.9, 20], [6, -58.9, 20], [6, -58.9, 25], [-6, -58.9, 25]], accent, -4))
  }
  if (o.spoiler !== false) {
    parts.push(tube([[-16, -50, 34], [-16, -58, 47]], 4, CHASSIS))
    parts.push(tube([[16, -50, 34], [16, -58, 47]], 4, CHASSIS))
    parts.push(...box(-38, 38, -64, -54, 46, 52, accent, -1))
  }
  return parts
}

function teethStrip(y: number, x0: number, x1: number, zTop: number, zBot: number, n: number): Poly {
  // One zigzag polygon: a jaw full of teeth on the front face of the bumper.
  const pts: V[] = []
  const w = (x1 - x0) / n
  pts.push([x0, y, zTop])
  for (let i = 0; i < n; i++) {
    pts.push([x0 + w * (i + 0.5), y, zBot])
    pts.push([x0 + w * (i + 1), y, zTop])
  }
  return decal(pts, '#FFFFFF')
}

function build(char: CritterId | null, color: string, steer: number): Build {
  const seat: V = [0, -10, 26]
  if (char == null) return { parts: base(color, '#FFFFFF', steer), seat }
  switch (char) {
    case 'chomp': {
      const body = '#4DB84A'
      const dark = '#2F8A3A'
      const parts = base(body, color, steer, { bumper: '#7A1E3A', plate: false })
      parts.push(teethStrip(72.5, -32, 32, 18, 13, 8))
      parts.push(teethStrip(72.5, -32, 32, 8, 12.5, 8))
      // nostrils on the nose, a tail with scutes off the back
      parts.push(...box(-14, -6, 58, 64, 20, 26, dark), ...box(6, 14, 58, 64, 20, 26, dark))
      parts.push(...prismX([[-58, 30], [-92, 13], [-92, 8], [-58, 16]], -9, 9, body))
      for (let i = 0; i < 3; i++) {
        const y = -64 - i * 9
        const z = 28 - i * 4.6
        parts.push(...prismX([[y + 4, z - 1], [y - 1, z + 6], [y - 5, z - 2]], -3, 3, dark, -1))
      }
      return { parts, seat }
    }
    case 'mattie': {
      // Round and in no hurry: one big bubble hull, little wheels, a boat prop on the back.
      const body = '#8EA6C2'
      const light = '#B9CADC'
      const parts: Part[] = [
        ...loft([
          ringXZ(-62, 26, 10, 26, 0.45), ringXZ(-50, 40, 7, 34, 0.45), ringXZ(-24, 44, 6, 38, 0.45),
          ringXZ(30, 44, 6, 36, 0.45), ringXZ(58, 38, 7, 26, 0.45), ringXZ(72, 24, 9, 19, 0.45),
        ], [body, body, body, body, body]),
        decal([[-8, 34, 36.4], [8, 34, 36.4], [8, 58, 26.6], [-8, 58, 26.6]], color),
        ...box(-16, 16, -27, -21, 32, 46, shade(body, -0.16)),
        ...wheels4('#FFE27A', steer, { rr: 14, fr: 12, rx: 44, fx: 42, rw: 14, fw: 12, ry: -36, fy: 44 }),
        decal([[-30, 72.6, 12], [-20, 72.6, 12], [-20, 72.6, 17], [-30, 72.6, 17]], HEAD),
        decal([[20, 72.6, 12], [30, 72.6, 12], [30, 72.6, 17], [20, 72.6, 17]], HEAD),
        tube([[0, -62, 18], [0, -72, 18]], 4, METAL),
        decal([[-1, -72, 18], [-4, -74, 30], [4, -74, 30], [1, -72, 18]], light, -2),
        decal([[-1, -72, 18], [-4, -74, 6], [4, -74, 6], [1, -72, 18]], light, -2),
      ]
      return { parts, seat: [0, -8, 28] }
    }
    case 'pete': {
      // A pouch cargo box on the back with a fish that did not make it in.
      const body = '#FFA02E'
      const parts = base(body, color, steer, { spoiler: false, plate: false })
      // the pouch: a hanging sack under the box
      parts.push(...loft([
        [[-24, -62, 32], [24, -62, 32], [24, -40, 32], [-24, -40, 32]],
        [[-20, -66, 18], [20, -66, 18], [20, -40, 18], [-20, -40, 18]],
      ], '#FF8A24', -1))
      parts.push(...box(-26, 26, -64, -38, 32, 50, '#FFB43C'))
      parts.push(...box(-27, 27, -65, -37, 50, 54, '#F7F5EF'))
      parts.push(tube(bez([6, -46, 54], [8, -50, 64], [10, -54, 66], [12, -58, 70], 5), 6, '#9FC4D8'))
      parts.push(decal([[12, -58, 70], [5, -60, 77], [19, -60, 77]], '#9FC4D8', -2))
      parts.push(tube([[-27, -51, 52], [-27, -51, 30]], 3, INK))
      return { parts, seat }
    }
    case 'pickles': {
      // Beat up and proud of it: a trash can lid for a bumper, a patch, a curly tail antenna.
      const body = '#A9A1B8'
      const parts = base(body, color, steer, { bumper: '', plate: true, hub: '#F3A9B9' })
      const lid: V[] = []
      for (let i = 0; i < 14; i++) {
        const t = (i / 14) * Math.PI * 2
        lid.push([Math.cos(t) * 26, 70, 18 + Math.sin(t) * 12])
      }
      parts.push(...loft([lid, lid.map(([x, , z]): V => [x * 0.9, 74, 18 + (z - 18) * 0.9])], METAL))
      parts.push(decal([[-4, 74.6, 16], [4, 74.6, 16], [4, 74.6, 20], [-4, 74.6, 20]], '#8C87A6'))
      parts.push(decal([[-40.4, -14, 15], [-40.4, 6, 14], [-40.4, 8, 25], [-40.4, -12, 26]], '#E6E0EC'))
      parts.push(decal([[40.4, -14, 15], [40.4, 6, 14], [40.4, 8, 25], [40.4, -12, 26]], '#E6E0EC'))
      parts.push(tube([...bez([18, -60, 52], [22, -66, 74], [30, -70, 92], [22, -66, 98], 8), ...bez([22, -66, 98], [14, -62, 102], [12, -60, 90], [20, -62, 88], 6).slice(1)], 5, '#F3A9B9'))
      return { parts, seat }
    }
    case 'dillo': {
      // Armor-plated: banded shell over the engine, bands on the nose.
      const body = '#C99560'
      const band = '#9C7048'
      const parts = base(body, color, steer, { spoiler: false, engine: false, plate: false })
      const shellRings: V[][] = []
      const ys = [-66, -58, -50, -42, -34]
      for (const y of ys) {
        const r = y === -66 || y === -34 ? 22 : 30
        const ring: V[] = []
        for (let i = 0; i <= 8; i++) {
          const t = Math.PI * (i / 8)
          ring.push([Math.cos(t) * r, y, 14 + Math.sin(t) * (r + 4)])
        }
        shellRings.push(ring)
      }
      parts.push(...loft(shellRings, ['#C4966A', band, '#C4966A', band]))
      parts.push(decal([[-26, 36.4, 32.4], [26, 36.4, 32.4], [26, 42, 30.6], [-26, 42, 30.6]], band))
      parts.push(decal([[-26, 48, 28.6], [26, 48, 28.6], [26, 54, 26.6], [-26, 54, 26.6]], band))
      parts.push(tube([[-12, -66, 20], [-14, -74, 22]], 6, METAL), tube([[12, -66, 20], [14, -74, 22]], 6, METAL))
      return { parts, seat }
    }
    case 'ibby': {
      // White with red trim, a long curved beak for a hood ornament, a trash can riding shotgun.
      const body = '#F0605A'
      const parts = base(body, color, steer, { spoiler: false })
      parts.push(tube(bez([0, 66, 22], [0, 84, 24], [0, 96, 18], [0, 102, 8], 10), 6, '#EE6E5B'))
      // black wingtip spoiler
      parts.push(tube([[-16, -50, 34], [-16, -58, 47]], 4, CHASSIS), tube([[16, -50, 34], [16, -58, 47]], 4, CHASSIS))
      parts.push(...prismX([[-52, 50], [-66, 47], [-70, 42], [-56, 46]], -40, 40, INK, -1))
      parts.push(decal([[-20, -55, 50.3], [20, -55, 50.3], [20, -62, 48.6], [-20, -62, 48.6]], '#FBFAF6', -4))
      const can: V[] = []
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * Math.PI * 2
        can.push([31 + Math.cos(t) * 9, -12 + Math.sin(t) * 9, 28])
      }
      parts.push(...loft([can, can.map(([x, y]): V => [31 + (x - 31) * 1.1, -12 + (y + 12) * 1.1, 52])], '#8C9AA8'))
      parts.push(...loft([can.map(([x, y]): V => [31 + (x - 31) * 1.25, -12 + (y + 12) * 1.25, 52]), can.map(([x, y]): V => [31 + (x - 31) * 1.25, -12 + (y + 12) * 1.25, 56])], '#AEB9C4'))
      return { parts, seat: [-6, -10, 26] }
    }
    case 'shelly': {
      // A shell for a roof over the back half, flippers for side skirts.
      const body = '#2C9C86'
      const parts = base(body, color, steer, { spoiler: false })
      const ring = (y: number, w: number, z: number): V[] => {
        const r: V[] = []
        for (let i = 0; i <= 10; i++) {
          const t = Math.PI * (i / 10)
          r.push([Math.cos(t) * w, y, 30 + Math.sin(t) * z])
        }
        return r
      }
      parts.push(...loft([ring(-68, 20, 10), ring(-58, 36, 26), ring(-44, 40, 32), ring(-30, 34, 26), ring(-24, 22, 12)], ['#2E9D86', '#4CC1A4', '#2E9D86', '#4CC1A4']))
      parts.push(...prismX([[-20, 14], [20, 14], [30, 6], [-6, 4]], -50, -40, '#A8D876'))
      parts.push(...prismX([[-20, 14], [20, 14], [30, 6], [-6, 4]], 40, 50, '#A8D876'))
      return { parts, seat: [0, -4, 26] }
    }
    case 'zippy': {
      // Spiky crest down the back, a dewlap flag under the nose, a curly tail.
      const body = '#79CF34'
      const dark = '#56AA22'
      const parts = base(body, color, steer, { spoiler: false })
      for (let i = 0; i < 4; i++) {
        const y = -36 - i * 6
        parts.push(...prismX([[y + 3, 34], [y, 44 - i * 1.5], [y - 3, 34]], -2.5, 2.5, dark, -1))
      }
      const dew: V[] = []
      for (let i = 0; i <= 8; i++) {
        const t = Math.PI * (i / 8)
        dew.push([0, 50 + Math.cos(t) * 12, 12 - Math.sin(t) * 10])
      }
      parts.push({ k: 'poly', pts: dew, fill: '#FF4F6E', bias: 0, both: true })
      parts.push(tube([...bez([0, -58, 22], [0, -80, 18], [0, -92, 30], [0, -84, 40], 8), ...bez([0, -84, 40], [0, -78, 46], [0, -74, 36], [0, -80, 34], 6).slice(1)], 7, body))
      return { parts, seat }
    }
  }
}

// ---------------- projection ----------------

interface Cam { right: V; up: V; toCam: V }

function camFor(view: number): Cam {
  const t = (((view % 8) + 8) % 8) * (Math.PI / 4)
  const s = Math.sin(t)
  const c = Math.cos(t)
  const sp = Math.sin(PITCH)
  const cp = Math.cos(PITCH)
  return {
    right: [c, -s, 0],
    up: [sp * s, sp * c, cp],
    toCam: [-s * cp, -c * cp, sp],
  }
}

interface Rot { yaw: number; pitch: number; roll: number; pivot: V; lift: number }

function rotate(p: V, r: Rot): V {
  let x = p[0] - r.pivot[0]
  let y = p[1] - r.pivot[1]
  let z = p[2] - r.pivot[2]
  // yaw about z (positive = nose to the left)
  let cs = Math.cos(r.yaw)
  let sn = Math.sin(r.yaw)
  ;[x, y] = [x * cs - y * sn, x * sn + y * cs]
  // pitch about x (positive = nose up)
  cs = Math.cos(r.pitch)
  sn = Math.sin(r.pitch)
  ;[y, z] = [y * cs - z * sn, y * sn + z * cs]
  // roll about y (positive = left side down)
  cs = Math.cos(r.roll)
  sn = Math.sin(r.roll)
  ;[x, z] = [x * cs - z * sn, x * sn + z * cs]
  return [x + r.pivot[0], y + r.pivot[1], z + r.pivot[2] + r.lift]
}

function rotDir(d: V, r: Rot): V {
  const o = rotate([0, 0, 0], { ...r, pivot: [0, 0, 0], lift: 0 })
  const p = rotate(d, { ...r, pivot: [0, 0, 0], lift: 0 })
  return sub(p, o)
}

const LIGHT_DIR = norm([-0.35, 0.3, 0.88])

function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const crs = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const q of p) { while (lower.length >= 2 && crs(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  const upper: [number, number][] = []
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && crs(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

const pathOf = (pts: [number, number][], close = true) => 'M' + pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join(' L') + (close ? ' Z' : '')

export interface KartLayers {
  w: number
  h: number
  /** SVG markup drawn under the driver. */
  before: string
  /** The driver: wrap the critter markup (120 x 140 coords) in <g transform={transform}>, then draw overlay. */
  driver: { transform: string; mood: Mood; back: boolean; backMarkup: string; overlay: string } | null
  /** SVG markup drawn over the driver. */
  after: string
}

const MOOD: Record<KartPose, Mood> = { drive: 'idle', left: 'idle', right: 'idle', spin: 'sad', trick: 'happy', hurt: 'sad' }

/** Projects the kart for one view + pose into SVG layers (no critter markup; see sprites.ts). */
export function kartLayers(char: CritterId | null, color: string, view: number, pose: KartPose): KartLayers {
  const steer = pose === 'left' ? 0.4 : pose === 'right' ? -0.4 : 0
  const b = build(char, color, steer)
  const rot: Rot = {
    yaw: pose === 'left' ? 0.16 : pose === 'right' ? -0.16 : pose === 'spin' ? 0.55 : 0,
    pitch: pose === 'trick' ? 0.32 : pose === 'hurt' ? -0.06 : 0,
    roll: pose === 'left' ? -0.1 : pose === 'right' ? 0.1 : pose === 'trick' ? -0.22 : pose === 'hurt' ? 0.14 : pose === 'spin' ? 0.12 : 0,
    pivot: pose === 'trick' ? [0, -40, 0] : [0, 0, 0],
    lift: pose === 'trick' ? 6 : 0,
  }
  const cam = camFor(view)
  const P = (p: V): [number, number] => {
    const q = rotate(p, rot)
    return [KART.AX + dot(q, cam.right), KART.AY - dot(q, cam.up)]
  }
  const depth = (p: V) => -dot(rotate(p, rot), cam.toCam)

  // `inkFill` / `inkTube` are the fat dark outline under everything. All of it is one color and
  // sits under the paint, so it is merged into a few paths (far fewer SVG elements to rasterize).
  interface Item { d: number; inkFill?: string; inkTube?: [number, string]; paint: string; driver?: boolean }
  const items: Item[] = []
  const SW = 3.2
  const OUT = 9

  for (const part of b.parts) {
    if (part.k === 'poly') {
      const n = rotDir(faceNormal(part.pts), rot)
      const facing = dot(n, cam.toCam)
      if (!part.both && facing <= 0.02) continue
      const pts = part.pts.map(P)
      const d = pathOf(pts)
      let fill = part.fill
      if (!part.flat) {
        const l = dot(n, LIGHT_DIR)
        fill = l > 0.72 ? shade(part.fill, 0.2) : l > 0.05 ? part.fill : shade(part.fill, -0.14)
      }
      items.push({
        d: depth(centroid(part.pts)) + part.bias,
        inkFill: d,
        paint: `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`,
      })
    } else if (part.k === 'tube') {
      const pts = part.pts.map(P)
      const d = pathOf(pts, false)
      items.push({
        d: depth(centroid(part.pts)) + part.bias,
        inkTube: [part.w + OUT, d],
        paint: `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${part.w + SW * 2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${part.color}" stroke-width="${part.w}" stroke-linecap="round" stroke-linejoin="round"/>`,
      })
    } else {
      const axis: V = [Math.cos(part.steer), Math.sin(part.steer), 0]
      const up: V = [0, 0, 1]
      const e1 = norm(cross(axis, up))
      const ring = (off: number, rs: number): V[] => {
        const out: V[] = []
        for (let i = 0; i < 18; i++) {
          const t = (i / 18) * Math.PI * 2
          out.push([
            part.c[0] + axis[0] * off + (e1[0] * Math.cos(t) + up[0] * Math.sin(t)) * part.r * rs,
            part.c[1] + axis[1] * off + (e1[1] * Math.cos(t) + up[1] * Math.sin(t)) * part.r * rs,
            part.c[2] + axis[2] * off + (e1[2] * Math.cos(t) + up[2] * Math.sin(t)) * part.r * rs,
          ])
        }
        return out
      }
      const half = part.w / 2
      const a = ring(-half, 1).map(P)
      const bb = ring(half, 1).map(P)
      const hd = pathOf(hull([...a, ...bb]))
      const ax = rotDir(axis, rot)
      const side = dot(ax, cam.toCam) >= 0 ? half : -half
      const facing = Math.abs(dot(ax, cam.toCam))
      let paint = `<path d="${hd}" fill="${part.tire}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`
      if (facing > 0.12) {
        paint += `<path d="${pathOf(ring(side, 0.98).map(P))}" fill="#4A4466" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`
        paint += `<path d="${pathOf(ring(side + Math.sign(side) * 0.6, 0.52).map(P))}" fill="${part.hub}" stroke="${INK}" stroke-width="${SW * 0.8}" stroke-linejoin="round"/>`
      } else {
        // tread blocks across the tire when we see it edge-on
        const c0 = P(part.c)
        paint += `<path d="M${n1(c0[0] - 3)} ${n1(c0[1] - part.r * 0.7)} V${n1(c0[1] + part.r * 0.7)}" stroke="#4A4466" stroke-width="2.4"/>`
      }
      items.push({
        d: depth(part.c) + part.bias,
        inkFill: hd,
        paint,
      })
    }
  }

  // ---- the driver ----
  let driver: KartLayers['driver'] = null
  let overlay = ''
  const seatD = depth(b.seat)
  if (char) {
    const fwd = rotDir([0, 1, 0], rot)
    const facing = dot(fwd, cam.toCam) // > 0: they face the camera
    const s = P(b.seat)
    const top = P([b.seat[0], b.seat[1], b.seat[2] + 40])
    const ang = (Math.atan2(top[0] - s[0], s[1] - top[1]) * 180) / Math.PI
    const noseX = dot(fwd, cam.right)
    const cs = 0.8 * (b.scale ?? 1)
    const back = facing < -0.3
    // Face the way the kart points: flip so beaks and snouts lead toward the nose.
    const flip = !back && noseX < -0.05
    const squish = 0.82 + 0.18 * Math.abs(facing)
    const transform = `translate(${n1(s[0])} ${n1(s[1])}) rotate(${n1(ang)}) scale(${(cs * squish * (flip ? -1 : 1)).toFixed(3)} ${cs.toFixed(3)}) translate(-60 -112)`
    if (facing > 0.25) {
      // steering wheel in front of the chest
      overlay += `<g transform="translate(${n1(s[0])} ${n1(s[1] - 14)}) rotate(${n1(ang)})"><ellipse cx="0" cy="0" rx="13" ry="${n1(4 + 3 * facing)}" fill="none" stroke="${INK}" stroke-width="7"/><ellipse cx="0" cy="0" rx="13" ry="${n1(4 + 3 * facing)}" fill="none" stroke="#5B5577" stroke-width="3"/></g>`
    }
    driver = { transform, mood: MOOD[pose], back, backMarkup: back ? critterBack(char, Math.max(-1, Math.min(1, noseX))) : '', overlay }
    items.push({ d: seatD - 0.5, paint: '', driver: true })
  }

  items.sort((a, b2) => b2.d - a.d)
  const fills = items.filter((i) => i.inkFill).map((i) => i.inkFill).join(' ')
  const tubes = new Map<number, string[]>()
  for (const i of items) if (i.inkTube) { const l = tubes.get(i.inkTube[0]) ?? []; l.push(i.inkTube[1]); tubes.set(i.inkTube[0], l) }
  let ink = fills ? `<path d="${fills}" fill="${INK}" stroke="${INK}" stroke-width="${OUT}" stroke-linejoin="round"/>` : ''
  for (const [w, ds] of tubes) ink += `<path d="${ds.join(' ')}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
  let before = `<g>${ink}</g>`
  let after = ''
  let passed = false
  for (const it of items) {
    if (it.driver) { passed = true; continue }
    if (passed) after += it.paint
    else before += it.paint
  }

  // ---- pose effects (screen space) ----
  const headTop = P([b.seat[0], b.seat[1], b.seat[2] + 78])
  if (pose === 'spin') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4
      const x = headTop[0] + Math.cos(a) * 26
      const y = headTop[1] + Math.sin(a) * 7 - 4
      after += `<path d="${starD(x, y, 7)}" fill="#FFDA3D" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`
    }
    after += `<ellipse cx="${n1(headTop[0])}" cy="${n1(headTop[1] - 4)}" rx="26" ry="7" fill="none" stroke="${INK}" stroke-width="2.4" stroke-dasharray="6 6"/>`
  }
  if (pose === 'hurt') {
    const fwd = rotDir([0, 1, 0], rot)
    const ahead = dot(fwd, cam.toCam) > 0.2
    const e0 = P([0, -56, 40])
    const e: [number, number] = ahead ? [headTop[0] + 40, headTop[1] + 40] : e0
    after += puff(e[0] - 10, e[1] - 6, 9) + puff(e[0] + 6, e[1] - 16, 11) + puff(e[0] - 4, e[1] - 30, 8)
  }
  if (pose === 'trick') {
    const c = P([0, 0, 40])
    for (const [dx, dy, r] of [[-62, -40, 6], [60, -50, 7], [52, 6, 5]] as const) {
      after += `<path d="${starD(c[0] + dx, c[1] + dy, r)}" fill="#FFFFFF" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
    }
  }
  return { w: KART.W, h: KART.H, before, driver, after }
}

function starD(cx: number, cy: number, r: number): string {
  const pts: [number, number][] = []
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4
    const rr = i % 2 === 0 ? r : r * 0.42
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  return pathOf(pts)
}

function puff(x: number, y: number, r: number): string {
  return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${r}" fill="#B9B4C8" stroke="${INK}" stroke-width="3"/><circle cx="${n1(x - r * 0.3)}" cy="${n1(y - r * 0.3)}" r="${n1(r * 0.35)}" fill="#E6E2F0"/>`
}

/**
 * Which of the 8 sprite views to draw for a kart, given its heading and the camera's heading
 * (both world radians, direction of travel = (cos a, sin a), y down, as in sim.ts).
 * 0 = camera directly behind; the index steps clockwise around the kart as seen from above,
 * so 2 = camera on the kart's left side (nose points screen-left), 4 = head-on, 6 = right side.
 */
export function viewFor(kartA: number, camA: number): number {
  const v = Math.round((camA - kartA) / (Math.PI / 4))
  return ((v % 8) + 8) % 8
}
