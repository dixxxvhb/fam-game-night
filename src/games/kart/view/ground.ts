/**
 * The ground plane, painted once per track into a big power-of-two canvas (the Mode 7 floor
 * samples it). Ground checker aligned to CHECK world units so the shader can keep painting it
 * past the texture edge, water bodies, the road with striped curbs and tiled asphalt bands (so
 * speed reads), the checkered start line, grid slots, boost pads / ramps, prop shadows.
 */
import type { Prop, SceneThing, TrackLook } from '../contract'
import { gridSpot, offsetAt, pointAt, type Track } from '../tracks'
import { GROUND, propsFor, trackBox } from './look'

/** Ground checker size, world units (the shader repeats it outside the texture). */
export const CHECK = 64

export interface GroundTex {
  canvas: HTMLCanvasElement
  /** World point at texel (0, 0). */
  ox: number
  oy: number
  /** Texels per world unit. */
  scale: number
  /** Canvas size in texels. */
  tw: number
  th: number
  key: string
}

const pow2 = (v: number) => 2 ** Math.ceil(Math.log2(Math.max(1, v)))

function tracePath(c: CanvasRenderingContext2D, t: Track, from = 0, to = t.L) {
  c.beginPath()
  const len = to >= from ? to - from : to + t.L - from
  for (let d = 0; d <= len + 0.01; d += t.step) {
    const p = pointAt(t, from + d)
    if (d === 0) c.moveTo(p.x, p.y)
    else c.lineTo(p.x, p.y)
  }
  if (len >= t.L - 0.01) c.closePath()
}

function road(c: CanvasRenderingContext2D, t: Track, look: TrackLook, from?: number, to?: number) {
  const path = () => tracePath(c, t, from, to)
  c.lineJoin = 'round'
  c.lineCap = 'butt'
  // verge shadow + curb stripes + road + lighter tiles every 48 units
  path()
  c.strokeStyle = 'rgba(30,24,56,0.22)'
  c.lineWidth = t.half * 2 + 34
  c.stroke()
  c.strokeStyle = look.curbA
  c.lineWidth = t.half * 2 + 20
  c.stroke()
  c.setLineDash([24, 24])
  c.strokeStyle = look.curbB
  c.stroke()
  c.setLineDash([])
  c.strokeStyle = look.road
  c.lineWidth = t.half * 2
  c.stroke()
  c.setLineDash([48, 48])
  c.strokeStyle = 'rgba(255,255,255,0.07)'
  c.stroke()
  c.setLineDash([])
  // thin white edge lines inside the curbs
  for (const side of [-1, 1]) {
    c.beginPath()
    const len = from === undefined ? t.L : (to! >= from ? to! - from : to! + t.L - from)
    const s0 = from ?? 0
    for (let d = 0; d <= len; d += t.step) {
      const p = offsetAt(t, s0 + d, side * (t.half - 7))
      if (d === 0) c.moveTo(p.x, p.y)
      else c.lineTo(p.x, p.y)
    }
    c.strokeStyle = 'rgba(255,255,255,0.75)'
    c.lineWidth = 3
    c.stroke()
  }
  // center dashes
  path()
  c.setLineDash([26, 40])
  c.strokeStyle = 'rgba(255,255,255,0.45)'
  c.lineWidth = 4
  c.stroke()
  c.setLineDash([])
}

function startLine(c: CanvasRenderingContext2D, t: Track) {
  const p = pointAt(t, 0)
  const sq = 12
  const n = Math.ceil((t.half * 2) / sq)
  c.save()
  c.translate(p.x, p.y)
  c.rotate(Math.atan2(p.ty, p.tx))
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < n; i++) {
      c.fillStyle = (i + row) % 2 ? '#1E1838' : '#FFFFFF'
      c.fillRect(-sq * 1.5 + row * sq, -t.half + i * sq, sq, sq)
    }
  }
  c.restore()
  // grid slots: white brackets
  c.strokeStyle = 'rgba(255,255,255,0.8)'
  c.lineWidth = 4
  for (let i = 0; i < 8; i++) {
    const g = gridSpot(t, i)
    c.save()
    c.translate(g.x, g.y)
    c.rotate(g.a)
    c.beginPath()
    c.moveTo(14, -18)
    c.lineTo(26, -18)
    c.lineTo(26, 18)
    c.lineTo(14, 18)
    c.stroke()
    c.restore()
  }
}

function pad(c: CanvasRenderingContext2D, th: SceneThing, t: Track) {
  const a = th.a ?? (() => {
    // face along the road
    let best = 0
    let bd = Infinity
    for (let i = 0; i < t.n; i += 2) {
      const d = (t.xs[i] - th.x) ** 2 + (t.ys[i] - th.y) ** 2
      if (d < bd) { bd = d; best = i }
    }
    return Math.atan2(t.ty[best], t.tx[best])
  })()
  c.save()
  c.translate(th.x, th.y)
  c.rotate(a)
  if (th.kind === 'pad') {
    c.fillStyle = '#FF8A2E'
    c.strokeStyle = '#1E1838'
    c.lineWidth = 4
    c.beginPath()
    c.roundRect(-34, -20, 68, 40, 8)
    c.fill()
    c.stroke()
    c.fillStyle = '#FFE36A'
    for (const x of [-20, 2]) {
      c.beginPath()
      c.moveTo(x, -13)
      c.lineTo(x + 16, 0)
      c.lineTo(x, 13)
      c.lineTo(x + 7, 0)
      c.closePath()
      c.fill()
    }
  } else {
    // ramp: hazard stripes across the whole road
    c.save()
    c.beginPath()
    c.rect(-18, -t.half, 36, t.half * 2)
    c.clip()
    c.fillStyle = '#FFDA3D'
    c.fillRect(-18, -t.half, 36, t.half * 2)
    c.fillStyle = '#1E1838'
    for (let y = -t.half - 40; y < t.half; y += 24) {
      c.beginPath()
      c.moveTo(-18, y)
      c.lineTo(-18, y + 12)
      c.lineTo(18, y + 48)
      c.lineTo(18, y + 36)
      c.fill()
    }
    c.restore()
  }
  c.restore()
}

function propShadow(c: CanvasRenderingContext2D, p: Prop) {
  const big = ['ferris', 'coaster', 'building', 'gantry', 'rocket', 'tower', 'gate'].includes(p.kind)
  const r = big ? 60 : p.kind === 'cone' || p.kind === 'barrel' || p.kind === 'reeds' || p.kind === 'buoy' ? 10 : 26
  c.beginPath()
  c.ellipse(p.x + r * 0.3, p.y + r * 0.15, r, r * 0.55, 0, 0, Math.PI * 2)
  c.fillStyle = 'rgba(30,24,56,0.2)'
  c.fill()
}

export function groundKey(t: Track, look: TrackLook, things: SceneThing[]): string {
  const fixed = things.filter((x) => x.kind === 'pad' || x.kind === 'ramp')
  return `${t.id}:${t.L.toFixed(1)}:${look.ground}:${look.road}:${fixed.map((x) => `${x.kind}${Math.round(x.x)},${Math.round(x.y)}`).join(';')}`
}

/** Paint the floor texture. maxW/maxH cap the texel size (phones pass 2048). */
export function paintGround(t: Track, look: TrackLook, things: SceneThing[], maxW = 4096, maxH = 2048): GroundTex {
  const b = trackBox(t, 320)
  const bw = b.x1 - b.x0
  const bh = b.y1 - b.y0
  const scale = Math.min(2, maxW / bw, maxH / bh)
  const tw = Math.min(maxW, pow2(bw * scale))
  const th = Math.min(maxH, pow2(bh * scale))
  // align the origin to the checker so the shader's outside pattern lines up
  const ox = Math.floor(b.x0 / CHECK) * CHECK
  const oy = Math.floor(b.y0 / CHECK) * CHECK
  const cv = document.createElement('canvas')
  cv.width = tw
  cv.height = th
  const c = cv.getContext('2d')!
  c.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale)
  const ww = tw / scale
  const wh = th / scale
  const [g0, g1] = GROUND[look.ground]
  c.fillStyle = g0
  c.fillRect(ox, oy, ww, wh)
  c.fillStyle = g1
  for (let y = oy; y < oy + wh; y += CHECK) {
    for (let x = ox; x < ox + ww; x += CHECK) {
      if (((Math.floor(x / CHECK) + Math.floor(y / CHECK)) & 1) === 1) c.fillRect(x, y, CHECK, CHECK)
    }
  }
  // speckles so the ground has grain up close
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const speck = look.ground === 'water' ? 'rgba(255,255,255,0.35)' : look.ground === 'asphalt' ? 'rgba(255,255,255,0.05)' : 'rgba(30,24,56,0.08)'
  c.fillStyle = speck
  const count = Math.round((ww * wh) / 900)
  for (let i = 0; i < count; i++) {
    const x = ox + rnd() * ww
    const y = oy + rnd() * wh
    if (look.ground === 'water') c.fillRect(x, y, 10, 2)
    else c.fillRect(x, y, 3, 3)
  }
  if (look.ground === 'grass' || look.ground === 'swamp') {
    const cols = ['#FFFFFF', '#FFDA3D', '#FF8FB4']
    for (let i = 0; i < count / 6; i++) {
      c.fillStyle = cols[i % 3]
      c.fillRect(ox + rnd() * ww, oy + rnd() * wh, 4, 4)
    }
  }
  // water bodies
  for (const w of t.water ?? []) {
    c.beginPath()
    c.ellipse(w.x, w.y, w.rx + 10, w.ry + 10, 0, 0, Math.PI * 2)
    c.fillStyle = look.ground === 'swamp' ? '#7A6A40' : '#F8D894'
    c.fill()
    c.beginPath()
    c.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2)
    c.fillStyle = look.ground === 'swamp' ? '#3A8A7A' : '#2AA8E0'
    c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.55)'
    c.lineWidth = 4
    c.beginPath()
    c.ellipse(w.x, w.y, w.rx - 8, w.ry - 8, 0, 0, Math.PI * 2)
    c.stroke()
    c.lineWidth = 3
    for (let i = 0; i < 6; i++) {
      const x = w.x + (rnd() - 0.5) * w.rx
      const y = w.y + (rnd() - 0.5) * w.ry
      c.beginPath()
      c.moveTo(x - 12, y)
      c.quadraticCurveTo(x, y - 6, x + 12, y)
      c.stroke()
    }
  }
  for (const p of propsFor(t)) propShadow(c, p)
  // road: the whole loop, then the bridge deck again on top of the underpass
  road(c, t, look)
  if (t.over) {
    c.save()
    tracePath(c, t, t.over[0], t.over[1])
    c.strokeStyle = 'rgba(30,24,56,0.35)'
    c.lineWidth = t.half * 2 + 60
    c.stroke()
    c.restore()
    road(c, t, look, t.over[0], t.over[1])
    // rails
    for (const side of [-1, 1]) {
      c.beginPath()
      const [a0, a1] = t.over
      const len = a1 >= a0 ? a1 - a0 : a1 + t.L - a0
      for (let d = 0; d <= len; d += t.step) {
        const p = offsetAt(t, a0 + d, side * (t.half + 14))
        if (d === 0) c.moveTo(p.x, p.y)
        else c.lineTo(p.x, p.y)
      }
      c.strokeStyle = '#1E1838'
      c.lineWidth = 10
      c.stroke()
      c.strokeStyle = '#C9C4DA'
      c.lineWidth = 5
      c.stroke()
    }
  }
  startLine(c, t)
  for (const x of things) if (x.kind === 'pad' || x.kind === 'ramp') pad(c, x, t)
  return { canvas: cv, ox, oy, scale, tw, th, key: groundKey(t, look, things) }
}
