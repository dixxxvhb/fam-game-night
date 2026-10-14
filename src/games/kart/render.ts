/**
 * Canvas drawing for Kart: TV and phone. Works from a Scene, which comes either straight from
 * the host's World or from interpolated 'kart:pos' snapshots.
 */
import { KART_R, turnpikeScene, type Kart, type World } from './sim'
import type { TurnpikeKartFx, TurnpikeSceneExtra } from './contract'
import { offsetAt, pointAt, project, levelAt, trackBounds, WORLD_H, WORLD_W, type Bounds, type Level, type Track } from './tracks'

export { trackBounds }

export interface SceneKart {
  id: string
  seat: number
  color: string
  initial: string
  x: number
  y: number
  a: number
  level: Level
  spin: boolean
  shield: boolean
  boost: boolean
  drift: boolean
  charged: boolean
  charge: number
  wet: boolean
  steer: number
}

export interface Scene {
  track: Track
  time: number
  karts: SceneKart[]
  boxes: { x: number; y: number; on: boolean; level: Level }[]
  peels: { x: number; y: number; level: Level }[]
  missiles: { x: number; y: number; a: number }[]
  gatorExt: number
  gatorWarn: boolean
  /** Ring this kart (your own, on a phone racing bots). */
  mine?: string | null
}

/** Per-kart extras beyond the contract's TurnpikeKartFx (engine lane; optional for renderers). */
export interface EngineKartFx extends TurnpikeKartFx {
  /** Triple Cafecito uses left (0 otherwise). */
  uses: number
  /** Slipstream boost just fired (draw wind lines). */
  slip: boolean
  /** Jumped the start: engine sputters (draw smoke puffs). */
  sputter: boolean
  /** On the grass/sand/mud off the road (draw dust). Water off-road is SceneKart.wet. */
  off: boolean
  /** Rocket start boost burning. */
  rocket: boolean
}

/**
 * The full Turnpike scene: render.ts Scene (old renderer) + the contract extras + a few engine
 * extras. Host: turnpikeScene(world). Everyone else: snap.ts decodes 'kart:pos' into the same shape.
 */
export type TurnpikeScene = Scene & TurnpikeSceneExtra & {
  fx: Record<string, EngineKartFx>
  /** Pier waves: 0 calm, 0..1 building (warning), 1 splashing. Where: track.waveAt. */
  wave: number
  /** Launch Pad smoke 0..1 around track.pad (karts in it are slowed). */
  smoke: number
  /** Swamp gator is about to lunge (bubbles). */
  gatorWarnOn: boolean
}

export interface View {
  /** CSS pixels of the canvas. */
  w: number
  h: number
  scale: number
  /** Rotated 90 degrees to fill a portrait phone. */
  rot: boolean
  dpr: number
  /** World point at the canvas's top-left (before rotation): a cropped view. */
  ox: number
  oy: number
}

export const PAL = {
  paper: '#0C1130',
  ink: '#E8ECFF',
  ink2: '#A6AED6',
  ink3: '#6E77A6',
  hot: '#FF6B3D',
  bad: '#FF5A6B',
  peel: '#F5C518',
}

const THEME: Record<string, { ground: string; road: string; curbA: string; curbB: string; deco: string }> = {
  oval: { ground: '#121A40', road: '#323C74', curbA: PAL.ink, curbB: PAL.hot, deco: '#18214F' },
  eight: { ground: '#121A40', road: '#323C74', curbA: PAL.ink, curbB: PAL.hot, deco: '#18214F' },
  swamp: { ground: '#0E2627', road: '#3B4157', curbA: '#C9D3B0', curbB: '#5C7A3E', deco: '#163634' },
  night: { ground: '#080B20', road: '#20285A', curbA: '#3A4378', curbB: '#2A3266', deco: '#0E1330' },
}

/** Fit the world (or a part of it) into a box. Portrait boxes can rotate the track to use the height. */
export function fitView(boxW: number, boxH: number, allowRotate: boolean, dpr: number, b?: Bounds): View {
  const bw = b ? b.x1 - b.x0 : WORLD_W
  const bh = b ? b.y1 - b.y0 : WORLD_H
  const flat = Math.min(boxW / bw, boxH / bh)
  const turned = Math.min(boxW / bh, boxH / bw)
  const rot = allowRotate && turned > flat * 1.05
  const ww = rot ? bh : bw
  const wh = rot ? bw : bh
  const scale = Math.max(0.05, rot ? turned : flat)
  return { w: Math.floor(ww * scale), h: Math.floor(wh * scale), scale, rot, dpr, ox: b?.x0 ?? 0, oy: b?.y0 ?? 0 }
}

export function applyView(ctx: CanvasRenderingContext2D, v: View) {
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0)
  if (v.rot) {
    ctx.translate(v.w, 0)
    ctx.rotate(Math.PI / 2)
  }
  ctx.scale(v.scale, v.scale)
  ctx.translate(-v.ox, -v.oy)
}

function loopPath(ctx: CanvasRenderingContext2D, t: Track) {
  ctx.beginPath()
  ctx.moveTo(t.xs[0], t.ys[0])
  for (let i = 1; i < t.n; i++) ctx.lineTo(t.xs[i], t.ys[i])
  ctx.closePath()
}

function rangePath(ctx: CanvasRenderingContext2D, t: Track, from: number, to: number) {
  const len = to >= from ? to - from : to + t.L - from
  ctx.beginPath()
  for (let d = 0; d <= len; d += t.step) {
    const p = pointAt(t, from + d)
    if (d === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
}

function roadStroke(ctx: CanvasRenderingContext2D, t: Track, path: () => void, theme: (typeof THEME)[string]) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'butt'
  path()
  ctx.strokeStyle = theme.curbA
  ctx.lineWidth = t.half * 2 + 12
  ctx.stroke()
  ctx.setLineDash([18, 18])
  ctx.strokeStyle = theme.curbB
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = theme.road
  ctx.lineWidth = t.half * 2
  ctx.stroke()
}

function drawWater(ctx: CanvasRenderingContext2D, t: Track) {
  for (const w of t.water ?? []) {
    ctx.save()
    ctx.translate(w.x, w.y)
    ctx.scale(w.rx, w.ry)
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.restore()
    ctx.fillStyle = '#1D5670'
    ctx.fill()
    ctx.strokeStyle = '#2D7A96'
    ctx.lineWidth = 3
    ctx.stroke()
    // ripples
    ctx.strokeStyle = '#2D7A96'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const ox = w.x + (i - 1) * w.rx * 0.4
      const oy = w.y + ((i % 2) - 0.5) * w.ry * 0.5
      ctx.beginPath()
      ctx.moveTo(ox - 14, oy)
      ctx.quadraticCurveTo(ox - 7, oy - 5, ox, oy)
      ctx.quadraticCurveTo(ox + 7, oy + 5, ox + 14, oy)
      ctx.stroke()
    }
  }
}

function drawReeds(ctx: CanvasRenderingContext2D, t: Track) {
  ctx.strokeStyle = '#3C6A3A'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const w of t.water ?? []) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3
      const x = w.x + Math.cos(a) * w.rx * 1.02
      const y = w.y + Math.sin(a) * w.ry * 1.02
      if (project(t, x, y).dist < t.half + 14) continue
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 4, y - 16)
      ctx.moveTo(x + 4, y)
      ctx.lineTo(x + 7, y - 13)
      ctx.stroke()
    }
  }
}

function drawStartLine(ctx: CanvasRenderingContext2D, t: Track) {
  const p = pointAt(t, 0)
  const nx = -p.ty
  const ny = p.tx
  const sq = 10
  const count = Math.floor((t.half * 2) / sq)
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < count; i++) {
      const d = -t.half + i * sq
      const along = row * sq - sq
      const x = p.x + nx * d + p.tx * along
      const y = p.y + ny * d + p.ty * along
      ctx.fillStyle = (i + row) % 2 === 0 ? PAL.ink : PAL.paper
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.atan2(p.ty, p.tx))
      ctx.fillRect(0, 0, sq, sq)
      ctx.restore()
    }
  }
}

function drawCityBlocks(ctx: CanvasRenderingContext2D, t: Track, theme: (typeof THEME)[string]) {
  ctx.fillStyle = theme.deco
  for (let x = 20; x < WORLD_W; x += 110) {
    for (let y = 20; y < WORLD_H; y += 110) {
      if (project(t, x + 45, y + 45).dist < t.half + 70) continue
      ctx.fillRect(x, y, 90, 90)
    }
  }
}

/** Everything that never moves, drawn once per size into its own canvas. */
export function drawStatic(ctx: CanvasRenderingContext2D, t: Track) {
  const theme = THEME[t.id] ?? THEME.oval
  ctx.fillStyle = theme.ground
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  if (t.id === 'night') drawCityBlocks(ctx, t, theme)
  roadStroke(ctx, t, () => loopPath(ctx, t), theme)
  if (t.id === 'swamp') {
    // Water goes over the road where they meet: a flooded road is still water.
    ctx.globalAlpha = 0.9
    drawWater(ctx, t)
    ctx.globalAlpha = 1
    drawReeds(ctx, t)
    const g = t.gator
    if (g) {
      ctx.fillStyle = '#163E37'
      ctx.beginPath()
      ctx.ellipse(g.x, g.y, 62, 40, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#2E6655'
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }
  if (t.id === 'eight' && t.under) {
    // Tunnel mouths: darker road under the bridge.
    rangePath(ctx, t, t.under[0], t.under[1])
    ctx.strokeStyle = '#262D5C'
    ctx.lineWidth = t.half * 2
    ctx.stroke()
  }
  drawStartLine(ctx, t)
}

/** The bridge deck, drawn over the tunnel but under karts on the bridge. */
export function drawBridge(ctx: CanvasRenderingContext2D, t: Track) {
  if (!t.over) return
  const [a, b] = t.over
  ctx.save()
  ctx.translate(8, 12)
  rangePath(ctx, t, a, b)
  ctx.strokeStyle = 'rgba(4,6,20,0.55)'
  ctx.lineWidth = t.half * 2 + 18
  ctx.lineCap = 'butt'
  ctx.stroke()
  ctx.restore()
  rangePath(ctx, t, a, b)
  ctx.lineCap = 'butt'
  ctx.strokeStyle = PAL.ink2
  ctx.lineWidth = t.half * 2 + 16
  ctx.stroke()
  ctx.strokeStyle = '#3B4785'
  ctx.lineWidth = t.half * 2
  ctx.stroke()
  // deck seams
  ctx.strokeStyle = '#323C74'
  ctx.lineWidth = 3
  const len = b >= a ? b - a : b + t.L - a
  for (let d = 20; d < len; d += 40) {
    const p = offsetAt(t, a + d, -t.half)
    const q = offsetAt(t, a + d, t.half)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawBox(ctx: CanvasRenderingContext2D, b: { x: number; y: number; on: boolean }, time: number, v: View) {
  if (!b.on) return
  const bob = 1 + 0.06 * Math.sin(time / 260 + b.x)
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.scale(bob, bob)
  ctx.rotate(Math.PI / 4)
  roundRect(ctx, -12, -12, 24, 24, 5)
  ctx.fillStyle = PAL.hot
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = PAL.ink
  ctx.stroke()
  ctx.rotate(-Math.PI / 4 - (v.rot ? Math.PI / 2 : 0))
  ctx.fillStyle = PAL.paper
  ctx.font = '16px Bungee, "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', 0, 1)
  ctx.restore()
}

function drawPeel(ctx: CanvasRenderingContext2D, p: { x: number; y: number }) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.fillStyle = PAL.peel
  ctx.strokeStyle = '#7A5A00'
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3)
    ctx.beginPath()
    ctx.ellipse(0, -8, 4.5, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawMissile(ctx: CanvasRenderingContext2D, m: { x: number; y: number; a: number }) {
  ctx.save()
  ctx.translate(m.x, m.y)
  ctx.rotate(m.a)
  ctx.fillStyle = 'rgba(255,107,61,0.45)'
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(-10 - i * 8, 0, 5 - i, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = PAL.bad
  ctx.strokeStyle = PAL.paper
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.lineTo(4, -6)
  ctx.lineTo(-12, -6)
  ctx.lineTo(-12, 6)
  ctx.lineTo(4, 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawGator(ctx: CanvasRenderingContext2D, s: Scene, time: number) {
  const g = s.track.gator
  if (!g) return
  const dx = g.tx - g.x
  const dy = g.ty - g.y
  const ang = Math.atan2(dy, dx)
  const ext = s.gatorExt
  const len = Math.hypot(dx, dy) * ext
  ctx.save()
  ctx.translate(g.x, g.y)
  ctx.rotate(ang)
  if (ext > 0.02) {
    // body
    ctx.fillStyle = '#5C9A3E'
    ctx.strokeStyle = '#1E3A1A'
    ctx.lineWidth = 3
    roundRect(ctx, -30, -17, len + 30, 34, 16)
    ctx.fill()
    ctx.stroke()
    // ridges
    ctx.fillStyle = '#3F7A2C'
    for (let x = -18; x < len - 20; x += 16) {
      ctx.beginPath()
      ctx.moveTo(x, -6)
      ctx.lineTo(x + 7, 0)
      ctx.lineTo(x, 6)
      ctx.fill()
    }
    // jaws with teeth
    const open = 0.35 + 0.25 * Math.sin(time / 70)
    ctx.save()
    ctx.translate(len, 0)
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.rotate(side * open)
      // teeth first, poking out of the jaw into the mouth
      ctx.fillStyle = PAL.ink
      for (let x = 4; x < 40; x += 7) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + 3, -side * 6)
        ctx.lineTo(x + 6, 0)
        ctx.fill()
      }
      ctx.fillStyle = '#5C9A3E'
      roundRect(ctx, -6, side < 0 ? -16 : 0, 48, 16, 7)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }
  // eyes
  const ex = ext > 0.02 ? len - 6 : 0
  const big = s.gatorWarn || ext > 0.02
  ctx.fillStyle = '#E2E86B'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(ex, side * 9, big ? 6 : 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PAL.paper
    ctx.beginPath()
    ctx.arc(ex + 1, side * 9, big ? 2.5 : 1.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#E2E86B'
  }
  ctx.restore()
  if (s.gatorWarn) {
    const r = 30 + ((time / 8) % 40)
    ctx.strokeStyle = 'rgba(232,236,255,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawKart(ctx: CanvasRenderingContext2D, k: SceneKart, time: number, v: View, size: number, mine = false) {
  ctx.save()
  ctx.translate(k.x, k.y)
  ctx.scale(size, size)
  if (mine) {
    ctx.strokeStyle = PAL.hot
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (k.shield) {
    ctx.save()
    ctx.rotate(time / 300)
    ctx.strokeStyle = 'rgba(232,236,255,0.85)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 7])
    ctx.beginPath()
    ctx.arc(0, 0, 27, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
  if (k.wet) {
    ctx.strokeStyle = 'rgba(141,200,232,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 22 + ((time / 20) % 8), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.rotate(k.a)
  if (k.boost) {
    const f = 14 + 8 * Math.abs(Math.sin(time / 40))
    ctx.fillStyle = PAL.hot
    ctx.beginPath()
    ctx.moveTo(-20, -8)
    ctx.lineTo(-20 - f, 0)
    ctx.lineTo(-20, 8)
    ctx.fill()
    ctx.fillStyle = PAL.peel
    ctx.beginPath()
    ctx.moveTo(-20, -4)
    ctx.lineTo(-20 - f * 0.55, 0)
    ctx.lineTo(-20, 4)
    ctx.fill()
  }
  if (k.drift) {
    const c = k.charged ? PAL.hot : k.charge >= 0.55 ? PAL.ink : PAL.ink3
    ctx.fillStyle = c
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const r = ((time / 30 + i * 37) % 10) / 10
      ctx.beginPath()
      ctx.arc(-18 - r * 14, side * (13 + r * 6), 2.6 - r * 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // wheels
  ctx.fillStyle = '#05071A'
  const steerA = k.steer * 0.45
  for (const [wx, wy, front] of [[11, -13, true], [11, 13, true], [-12, -13, false], [-12, 13, false]] as [number, number, boolean][]) {
    ctx.save()
    ctx.translate(wx, wy)
    if (front) ctx.rotate(steerA)
    roundRect(ctx, -6, -3.5, 12, 7, 2)
    ctx.fill()
    ctx.restore()
  }
  // body
  roundRect(ctx, -20, -12, 40, 24, 7)
  ctx.fillStyle = k.color
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = PAL.paper
  ctx.stroke()
  // nose bumper
  ctx.fillStyle = PAL.paper
  roundRect(ctx, 15, -9, 6, 18, 3)
  ctx.fill()
  // driver
  ctx.beginPath()
  ctx.arc(-3, 0, 9, 0, Math.PI * 2)
  ctx.fillStyle = PAL.ink
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = PAL.paper
  ctx.stroke()
  ctx.restore()
  // initial, kept upright for the room
  ctx.save()
  const hx = k.x + Math.cos(k.a) * -3 * size
  const hy = k.y + Math.sin(k.a) * -3 * size
  ctx.translate(hx, hy)
  if (v.rot) ctx.rotate(-Math.PI / 2)
  ctx.scale(size, size)
  ctx.fillStyle = PAL.paper
  ctx.font = '12px Bungee, "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(k.initial, 0, 1)
  ctx.restore()
}

function drawNight(ctx: CanvasRenderingContext2D, dark: HTMLCanvasElement, s: Scene, v: View) {
  const d = dark.getContext('2d')
  if (!d) return
  d.setTransform(1, 0, 0, 1, 0, 0)
  d.globalCompositeOperation = 'source-over'
  d.clearRect(0, 0, dark.width, dark.height)
  d.fillStyle = 'rgba(3,5,16,0.88)'
  d.fillRect(0, 0, dark.width, dark.height)
  applyView(d, v)
  d.globalCompositeOperation = 'destination-out'
  for (const [x, y] of s.track.lamps ?? []) {
    d.fillStyle = 'rgba(0,0,0,0.55)'
    d.beginPath()
    d.arc(x, y, 130, 0, Math.PI * 2)
    d.fill()
    d.fillStyle = 'rgba(0,0,0,0.5)'
    d.beginPath()
    d.arc(x, y, 80, 0, Math.PI * 2)
    d.fill()
  }
  for (const k of s.karts) {
    for (const [len, spread, alpha] of [[260, 0.42, 0.55], [160, 0.32, 0.6]] as [number, number, number][]) {
      d.fillStyle = `rgba(0,0,0,${alpha})`
      d.beginPath()
      d.moveTo(k.x + Math.cos(k.a) * 14, k.y + Math.sin(k.a) * 14)
      d.arc(k.x, k.y, len, k.a - spread, k.a + spread)
      d.closePath()
      d.fill()
    }
    d.fillStyle = 'rgba(0,0,0,0.7)'
    d.beginPath()
    d.arc(k.x, k.y, 46, 0, Math.PI * 2)
    d.fill()
  }
  d.globalCompositeOperation = 'source-over'
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(dark, 0, 0)
  ctx.restore()
}

export interface Layers {
  key: string
  base: HTMLCanvasElement
  bridge: HTMLCanvasElement | null
  dark: HTMLCanvasElement | null
}

function layerCanvas(v: View): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.round(v.w * v.dpr)
  c.height = Math.round(v.h * v.dpr)
  return c
}

export function makeLayers(t: Track, v: View): Layers {
  const key = `${t.id}:${v.w}x${v.h}:${v.rot}:${v.dpr}:${v.ox},${v.oy}`
  const base = layerCanvas(v)
  const bctx = base.getContext('2d')!
  applyView(bctx, v)
  drawStatic(bctx, t)
  let bridge: HTMLCanvasElement | null = null
  if (t.over) {
    bridge = layerCanvas(v)
    const c = bridge.getContext('2d')!
    applyView(c, v)
    drawBridge(c, t)
  }
  const dark = t.id === 'night' ? layerCanvas(v) : null
  return { key, base, bridge, dark }
}

/** Draw a whole frame. `size` scales karts (bigger on a small phone screen). */
export function renderScene(ctx: CanvasRenderingContext2D, s: Scene, v: View, layers: Layers, size = 1) {
  const time = s.time
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(layers.base, 0, 0)
  ctx.restore()
  applyView(ctx, v)

  const night = s.track.id === 'night'
  const upper = (lv: Level) => lv === 2
  // Hazards on the ground first; peels hide in the dark at night.
  for (const p of s.peels) if (!upper(p.level)) drawPeel(ctx, p)
  if (s.track.gator) drawGator(ctx, s, time)
  for (const k of s.karts) if (!upper(k.level)) drawKart(ctx, k, time, v, size, k.id === s.mine)
  if (layers.bridge) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(layers.bridge, 0, 0)
    ctx.restore()
    applyView(ctx, v)
  }
  for (const p of s.peels) if (upper(p.level)) drawPeel(ctx, p)
  if (night && layers.dark) {
    drawNight(ctx, layers.dark, s, v)
    applyView(ctx, v)
    // Street lamps light warm.
    ctx.fillStyle = 'rgba(255,196,110,0.07)'
    for (const [x, y] of s.track.lamps ?? []) {
      ctx.beginPath()
      ctx.arc(x, y, 130, 0, Math.PI * 2)
      ctx.fill()
    }
    // Reflectors and lamps stay visible over the dark.
    drawReflectors(ctx, s.track)
  }
  for (const b of s.boxes) drawBox(ctx, b, time, v)
  for (const m of s.missiles) drawMissile(ctx, m)
  if (night) for (const k of s.karts) if (!upper(k.level)) drawKart(ctx, k, time, v, size, k.id === s.mine)
  for (const k of s.karts) if (upper(k.level)) drawKart(ctx, k, time, v, size, k.id === s.mine)
}

function drawReflectors(ctx: CanvasRenderingContext2D, t: Track) {
  ctx.fillStyle = 'rgba(255,181,71,0.55)'
  for (let s = 0; s < t.L; s += 64) {
    for (const side of [-1, 1]) {
      const p = offsetAt(t, s, side * (t.half + 3))
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }
  }
  for (const [x, y] of t.lamps ?? []) {
    ctx.fillStyle = '#FFE7A8'
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ---------------- scenes ----------------

export function sceneKart(k: Kart): SceneKart {
  return {
    id: k.id, seat: k.seat, color: k.color, initial: k.name.slice(0, 1).toUpperCase(),
    x: k.x, y: k.y, a: k.a, level: k.level, spin: k.spin > 0, shield: k.shield > 0, boost: k.boost > 0,
    drift: k.drift !== 0, charged: k.charge >= 1.15, charge: k.charge, wet: k.wet, steer: k.steer,
  }
}

/** The host's scene: the whole Turnpike scene (a superset of the old Scene). */
export function sceneFromWorld(w: World): TurnpikeScene {
  return turnpikeScene(w)
}

/** Level for an interpolated kart, with a per-seat index hint so the bridge stays right. */
export function levelFor(t: Track, x: number, y: number, hints: Map<number, number>, seat: number): Level {
  const pr = project(t, x, y, hints.get(seat) ?? -1)
  hints.set(seat, pr.i)
  return levelAt(t, pr.i)
}

export { KART_R }
