import { ARROWS_Y, AIM_MAX_DEG, BALL_R, GUTTER_W, HEAD, KICK, LANE_HALF, PIN_H, PIN_R, PIT_Y, START_HALF, pinAt, pinDownAt, pinSpot, type Replay } from './sim'
import { NIGHT } from './look'

/**
 * Gator Lanes on a 2D canvas: Party Park's cosmic bowling alley after dark. A camera with no yaw
 * (world units are inches: x across, y down the lane, z up), so every plane facing the camera
 * (the masking unit, the critter) projects to a plain rectangle and can be a baked image.
 *
 * Shots: AIM (behind the bowler, sign and pins up top), CHASE (rides behind the ball), PIN CAM
 * (a hard cut to a low close-up on the deck just before impact, held through the result).
 * Static art (the room, the signs, the sparkle dots, the vignette, the whole aim view without
 * the bowler) is baked to offscreen canvases; only what moves is drawn per frame.
 */

export const COLORS = {
  bg: NIGHT.bg0,
  lane: '#A8704E',
  laneFar: '#C48A5C',
  laneDim: '#3A2448',
  approach: '#4A2E58',
  approachDim: '#22123A',
  deck: '#E3AE74',
  board: 'rgba(60, 18, 40, 0.22)',
  foul: NIGHT.red,
  gutter: '#140A30',
  gutterDim: '#100826',
  kick: '#1E1046',
  pit: '#05020F',
  mask: '#1A0C40',
  wall: '#0E0628',
  arrow: NIGHT.pink,
  pin: '#FBFAFF',
  pinBand: '#FF3D5A',
  pinLine: 'rgba(30, 24, 56, 0.65)',
  hole: '#1E1838',
  shadow: 'rgba(5, 2, 15, 0.45)',
}

export interface Cam { x: number; y: number; z: number; pitch: number; f: number; cy: number }

// ---------------- cameras ----------------

/** Aim: well back, low, a long lens. Pins sit at PIN_LINE of the height, the sign above them. */
const AIM = { d: 430, z: 64, lens: 6.4, pinLine: 0.5 }
/** Chase: behind the ball. */
const CHASE = { d: 150, z: 30, lens: 3.4, ground: 0.8 }
/** Pin cam: low on the deck. Cut to it when the ball gets this close to the head pin. */
const PINCAM = { y: HEAD - 165, z: 24, lens: 3.0, ground: 0.8, push: 34 }
export const CUT_Y = HEAD - 108

export function aimCam(h: number): Cam {
  const f = h * AIM.lens
  const y = -AIM.d
  const cy = h * AIM.pinLine - (AIM.z * f) / (HEAD - y)
  return { x: 0, y, z: AIM.z, pitch: 0, f, cy }
}

export function chaseCam(h: number, bx: number, by: number): Cam {
  const f = h * CHASE.lens
  const y = by - CHASE.d
  const cy = h * CHASE.ground - (CHASE.z * f) / CHASE.d
  return { x: bx * 0.6, y, z: CHASE.z, pitch: 0, f, cy }
}

/** push 0..1 eases the pin cam in a little while the pins fly. */
export function pinCam(h: number, push = 0): Cam {
  const f = h * PINCAM.lens
  const y = PINCAM.y + PINCAM.push * push
  const d = HEAD + 30 - y
  const cy = h * 0.8 - (PINCAM.z * f) / d
  return { x: 0, y, z: PINCAM.z, pitch: 0, f, cy }
}

export function blendCam(a: Cam, b: Cam, t: number): Cam {
  const k = Math.max(0, Math.min(1, t))
  const l = (p: number, q: number) => p + (q - p) * k
  return { x: l(a.x, b.x), y: l(a.y, b.y), z: l(a.z, b.z), pitch: l(a.pitch, b.pitch), f: l(a.f, b.f), cy: l(a.cy, b.cy) }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k) }

interface P { x: number; y: number; d: number; s: number }
type Proj = (x: number, y: number, z: number) => P

function projector(cam: Cam, w: number): Proj {
  const cos = Math.cos(cam.pitch)
  const sin = Math.sin(cam.pitch)
  return (x, y, z) => {
    const dy = y - cam.y
    const dz = z - cam.z
    const d = dy * cos - dz * sin
    const up = dy * sin + dz * cos
    const k = cam.f / Math.max(d, 1)
    return { x: w / 2 + (x - cam.x) * k, y: cam.cy - up * k, d, s: k }
  }
}

function nearY(cam: Cam) {
  return cam.y + 10
}

function quad(ctx: CanvasRenderingContext2D, pts: P[], fill: string | CanvasGradient) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.fill()
}

// ---------------- baked art ----------------

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

let fontReady = false
let fontAsked = false
const fontWaiters = new Set<() => void>()
/** Lilita One for the signs. Signs baked before it loads get rebaked once it does. */
function partyFont(): boolean {
  if (fontReady || typeof document === 'undefined' || !document.fonts) return true
  if (!fontAsked) {
    fontAsked = true
    document.fonts.load('80px "Lilita One"').then(() => {
      fontReady = true
      signCache.clear()
      fontWaiters.forEach((f) => f())
    }, () => { fontReady = true })
  }
  return false
}
export function onLaneArt(fn: () => void) { fontWaiters.add(fn); return () => { fontWaiters.delete(fn) } }

function neonText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, edge: string) {
  g.font = `${size}px "Lilita One", "Arial Rounded MT Bold", "Arial Black", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.save()
  g.shadowColor = color
  g.shadowBlur = size * 0.5
  g.lineWidth = size * 0.16
  g.strokeStyle = edge
  g.strokeText(text, x, y)
  g.restore()
  g.lineWidth = size * 0.12
  g.strokeStyle = NIGHT.ink
  g.strokeText(text, x, y + size * 0.06)
  g.fillStyle = color
  g.fillText(text, x, y)
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.fillText(text, x, y - size * 0.03)
  g.fillStyle = color
  g.globalAlpha = 0.6
  g.fillText(text, x, y)
  g.globalAlpha = 1
}

function tube(g: CanvasRenderingContext2D, color: string, width: number, draw: () => void) {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.shadowColor = color
  g.shadowBlur = width * 3
  g.strokeStyle = color
  g.lineWidth = width
  g.beginPath()
  draw()
  g.stroke()
  g.shadowBlur = 0
  g.strokeStyle = 'rgba(255,255,255,0.75)'
  g.lineWidth = width * 0.35
  g.stroke()
  g.restore()
}

const signCache = new Map<string, HTMLCanvasElement>()

/** The masking unit panel over a lane: ours says GATOR LANES; the neighbors get neon doodles. */
function signArt(kind: number): HTMLCanvasElement {
  const key = `sign:${kind}:${fontReady ? 1 : 0}`
  const hit = signCache.get(key)
  if (hit) return hit
  partyFont()
  const W = 680
  const H = 500
  const c = canvas(W, H)
  const g = c.getContext('2d')!
  // Panel: deep violet, a dark inner field, a neon frame.
  g.fillStyle = COLORS.mask
  g.fillRect(0, 0, W, H)
  const grd = g.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, '#2A1468')
  grd.addColorStop(1, '#12082E')
  g.fillStyle = grd
  g.fillRect(14, 14, W - 28, H - 28)
  const frame = kind === 0 ? NIGHT.cyan : kind % 2 ? NIGHT.violet : NIGHT.pink
  tube(g, frame, 9, () => { g.roundRect(30, 30, W - 60, H - 60, 40) })
  if (kind === 0) {
    // Our lane: the sign.
    neonText(g, 'GATOR', W / 2, 168, 168, NIGHT.lime, '#5BFF6A')
    neonText(g, 'LANES', W / 2, 318, 150, NIGHT.pink, '#FF5FC0')
    tube(g, NIGHT.yellow, 7, () => {
      for (let i = 0; i < 5; i++) {
        const x = W / 2 - 140 + i * 70
        g.moveTo(x - 14, 410); g.lineTo(x, 396); g.lineTo(x + 14, 410)
      }
    })
  } else {
    const n = kind % 4
    if (n === 1) {
      // A palm tree.
      tube(g, NIGHT.lime, 8, () => {
        g.moveTo(W / 2, 400); g.quadraticCurveTo(W / 2 + 30, 280, W / 2 - 10, 190)
        for (const a of [-2.6, -2.1, -1.0, -0.5, 0.1]) {
          g.moveTo(W / 2 - 10, 190)
          g.quadraticCurveTo(W / 2 - 10 + Math.cos(a) * 90, 190 + Math.sin(a) * 90 - 30, W / 2 - 10 + Math.cos(a) * 150, 190 + Math.sin(a) * 60 + 50)
        }
      })
    } else if (n === 2) {
      // A bowling pin and ball.
      tube(g, NIGHT.yellow, 8, () => {
        g.moveTo(W / 2 - 60, 400)
        g.bezierCurveTo(W / 2 - 120, 300, W / 2 - 40, 260, W / 2 - 50, 200)
        g.bezierCurveTo(W / 2 - 60, 140, W / 2 + 40, 140, W / 2 + 30, 200)
        g.bezierCurveTo(W / 2 + 20, 260, W / 2 + 100, 300, W / 2 + 40, 400)
        g.closePath()
      })
      tube(g, NIGHT.pink, 8, () => { g.arc(W / 2 + 140, 340, 60, 0, Math.PI * 2) })
    } else if (n === 3) {
      // Waves.
      tube(g, NIGHT.cyan, 8, () => {
        for (let r = 0; r < 3; r++) {
          const y = 190 + r * 80
          g.moveTo(110, y)
          for (let x = 110; x <= W - 110; x += 10) g.lineTo(x, y + Math.sin((x - 110) / 38) * 22)
        }
      })
    } else {
      // A big star.
      tube(g, NIGHT.yellow, 8, () => {
        for (let i = 0; i <= 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5
          const r = i % 2 ? 60 : 150
          const x = W / 2 + Math.cos(a) * r
          const y = 270 + Math.sin(a) * r
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
        }
      })
    }
  }
  signCache.set(key, c)
  return c
}

const SPARK_COLORS = ['#FFFFFF', NIGHT.cyan, NIGHT.pink, NIGHT.yellow, NIGHT.lime]
const sparkCache = new Map<string, HTMLCanvasElement>()
function sparkSprite(color: string): HTMLCanvasElement {
  let c = sparkCache.get(color)
  if (c) return c
  c = canvas(48, 48)
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(24, 24, 0, 24, 24, 24)
  grd.addColorStop(0, '#FFFFFF')
  grd.addColorStop(0.18, color)
  grd.addColorStop(0.5, color + '55')
  grd.addColorStop(1, color + '00')
  g.fillStyle = grd
  g.fillRect(0, 0, 48, 48)
  sparkCache.set(color, c)
  return c
}

/** Screen-space overlay: dark edges so the lane reads as lit and the room as a room. */
let vignette: { w: number; h: number; c: HTMLCanvasElement } | null = null
function vignetteFor(w: number, h: number): HTMLCanvasElement {
  if (vignette && vignette.w === w && vignette.h === h) return vignette.c
  const c = canvas(w, h)
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75)
  grd.addColorStop(0, 'rgba(8, 3, 26, 0)')
  grd.addColorStop(1, 'rgba(8, 3, 26, 0.7)')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  vignette = { w, h, c }
  return c
}

// ---------------- pins ----------------

/** Pin profile: radius (inches) at height h (inches), base to crown. */
const PROFILE: [number, number][] = [
  [0, 1.0], [1, 1.6], [2.5, 2.15], [4.5, 2.38], [6.5, 2.15], [8.5, 1.45], [9.8, 0.95], [10.6, 0.88], [11.6, 1.0], [12.8, 1.26], [14, 1.18], [14.7, 0.85], [15, 0.2],
]
const BAND: [number, number] = [9.7, 10.7]
const BAND2: [number, number] = [11.3, 11.9]

export interface PinPose { x: number; y: number; z?: number; /** 0 upright .. 1 lying */ tip: number; /** direction it leans or lies, radians in the lane plane */ ang: number; wob: number }

function drawPin(ctx: CanvasRenderingContext2D, proj: Proj, p: PinPose, alpha = 1, glowOn = true) {
  const phi = p.tip * (Math.PI / 2)
  const ax = Math.sin(phi) * Math.cos(p.ang)
  const ay = Math.sin(phi) * Math.sin(p.ang)
  const az = Math.cos(phi)
  const lift = Math.sin(phi) * PIN_R * 0.92 + (p.z ?? 0)
  const lean = p.tip < 0.01 ? p.wob : 0
  const pts = PROFILE.map(([h, r]) => {
    const base = proj(p.x + ax * h + lean * h, p.y + ay * h, lift + az * h)
    return { ...base, r }
  })
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const tl = Math.hypot(tx, ty)
    if (tl < 1e-3) { tx = 0; ty = -1 } else { tx /= tl; ty /= tl }
    const r = pts[i].r * pts[i].s
    left.push([pts[i].x - ty * r, pts[i].y + tx * r])
    right.push([pts[i].x + ty * r, pts[i].y - tx * r])
  }
  const s = pts[3].s
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(left[0][0], left[0][1])
  for (const q of left) ctx.lineTo(q[0], q[1])
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
  ctx.closePath()
  if (glowOn && s > 0.6) {
    // Blacklight: the pins glow a little.
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, s * 2.2)
    ctx.strokeStyle = 'rgba(190, 240, 255, 0.28)'
    ctx.stroke()
  }
  ctx.fillStyle = COLORS.pin
  ctx.fill()
  ctx.lineWidth = Math.max(1, s * 0.3)
  ctx.strokeStyle = COLORS.pinLine
  ctx.stroke()
  const band = (h: number) => {
    let i = 0
    while (i < PROFILE.length - 2 && PROFILE[i + 1][0] < h) i++
    const [h0] = PROFILE[i]
    const [h1] = PROFILE[i + 1]
    const t = (h - h0) / (h1 - h0)
    return [lerp(left[i][0], left[i + 1][0], t), lerp(left[i][1], left[i + 1][1], t), lerp(right[i][0], right[i + 1][0], t), lerp(right[i][1], right[i + 1][1], t)]
  }
  for (const [lo, hi] of [BAND, BAND2]) {
    const b0 = band(lo)
    const b1 = band(hi)
    ctx.beginPath()
    ctx.moveTo(b0[0], b0[1])
    ctx.lineTo(b1[0], b1[1])
    ctx.lineTo(b1[2], b1[3])
    ctx.lineTo(b0[2], b0[3])
    ctx.closePath()
    ctx.fillStyle = COLORS.pinBand
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawBall(ctx: CanvasRenderingContext2D, proj: Proj, x: number, y: number, color: string, roll: number, z = BALL_R, glowOn = true) {
  const c = proj(x, y, z)
  const r = BALL_R * c.s
  if (r < 0.5) return
  const g = proj(x, y, 0)
  ctx.fillStyle = COLORS.shadow
  ctx.beginPath()
  ctx.ellipse(g.x, g.y, r * 1.05, r * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  if (glowOn) {
    const grd = ctx.createRadialGradient(c.x, c.y, r * 0.8, c.x, c.y, r * 2.2)
    grd.addColorStop(0, color + 'AA')
    grd.addColorStop(1, color + '00')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(c.x, c.y, r * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.fill()
  // A swirl, so you can see it roll.
  ctx.save()
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = Math.max(1, r * 0.16)
  ctx.beginPath()
  const sw = Math.sin(roll) * r * 0.6
  ctx.moveTo(c.x - r, c.y + sw * 0.4)
  ctx.bezierCurveTo(c.x - r * 0.3, c.y - r * 0.5 + sw, c.x + r * 0.3, c.y + r * 0.5 + sw, c.x + r, c.y - sw * 0.4)
  ctx.stroke()
  ctx.restore()
  ctx.lineWidth = Math.max(1.2, r * 0.1)
  ctx.strokeStyle = NIGHT.ink
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.stroke()
  // Shine.
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(c.x - r * 0.38, c.y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2)
  ctx.fill()
  const lat = Math.sin(roll)
  const front = Math.cos(roll)
  if (front > -0.2) {
    ctx.fillStyle = COLORS.hole
    const hy = c.y - lat * r * 0.55
    const sc = Math.max(0.25, front)
    for (const [dx, dy, rr] of [[-0.22, 0, 0.11], [0.22, 0, 0.11], [0, 0.32, 0.13]] as const) {
      ctx.beginPath()
      ctx.ellipse(c.x + dx * r, hy + dy * r * sc, rr * r, rr * r * sc, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ---------------- the alley ----------------

const PITCH = 2 * KICK + 7
const FAR = PIT_Y + 60
const MASK_Y = PIT_Y - 6
const MASK_Z0 = 32
const MASK_Z1 = 84
const LANE_GLOW = [NIGHT.cyan, NIGHT.pink, NIGHT.violet, NIGHT.lime, NIGHT.pink]

/** A strip on the floor (or at height z), clipped to what's in front of the camera. */
function strip(ctx: CanvasRenderingContext2D, proj: Proj, x0: number, x1: number, ya: number, yb: number, fill: string | CanvasGradient, z = 0) {
  if (yb <= ya) return
  quad(ctx, [proj(x0, ya, z), proj(x1, ya, z), proj(x1, yb, z), proj(x0, yb, z)], fill)
}

/** A neon tube lying along the lane at x: a soft glow strip and a hot core. */
function floorTube(ctx: CanvasRenderingContext2D, proj: Proj, x: number, ya: number, yb: number, color: string, z = 0.6, dim = 1) {
  if (yb <= ya) return
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.22 * dim
  strip(ctx, proj, x - 3.2, x + 3.2, ya, yb, color, z)
  ctx.globalAlpha = 0.45 * dim
  strip(ctx, proj, x - 1.1, x + 1.1, ya, yb, color, z)
  ctx.globalAlpha = 0.9 * dim
  strip(ctx, proj, x - 0.35, x + 0.35, ya, yb, '#FFFFFF', z)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

function lanesFor(cam: Cam, w: number): number[] {
  // Which neighbor lanes can be on screen: enough to fill the width at the far end.
  const far = FAR - cam.y
  const half = ((w / 2) / cam.f) * far + Math.abs(cam.x)
  const n = Math.min(5, Math.ceil(half / PITCH))
  const out: number[] = []
  for (let k = -n; k <= n; k++) if (k !== 0) out.push(k)
  return out.sort((a, b) => Math.abs(b) - Math.abs(a))
}

function drawRoom(ctx: CanvasRenderingContext2D, proj: Proj, cam: Cam, w: number, h: number, neighbors: boolean) {
  // Night room.
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#120634')
  sky.addColorStop(0.5, NIGHT.bg0)
  sky.addColorStop(1, '#080318')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const offs = neighbors ? lanesFor(cam, w) : []
  const all = [...offs, 0]
  // Back wall and the pits behind every deck.
  const wl = proj(-PITCH * 6, FAR, -6)
  const wr = proj(PITCH * 6, FAR, 140)
  ctx.fillStyle = COLORS.wall
  ctx.fillRect(wl.x, wr.y, wr.x - wl.x, wl.y - wr.y)
  for (const off of all) {
    const cx = off * PITCH
    strip(ctx, proj, cx - KICK, cx + KICK, PIT_Y, FAR, COLORS.pit, -6)
  }
  // Masking units: one panel per lane, a neon tube along the bottom.
  for (const off of all) {
    const cx = off * PITCH
    const a = proj(cx - PITCH / 2, MASK_Y, MASK_Z1)
    const b = proj(cx + PITCH / 2, MASK_Y, MASK_Z0)
    if (a.d <= 1) continue
    const img = signArt(off === 0 ? 0 : Math.abs(off * 3 + (off < 0 ? 1 : 0)) % 4 + 1)
    ctx.globalAlpha = off === 0 ? 1 : 0.62
    ctx.drawImage(img, a.x, a.y, b.x - a.x, b.y - a.y)
    ctx.globalAlpha = 1
  }
  const ml = proj(-PITCH * 6, MASK_Y, MASK_Z0)
  const mr = proj(PITCH * 6, MASK_Y, MASK_Z0)
  const th = Math.max(2, ml.s * 2)
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = NIGHT.pink
  ctx.globalAlpha = 0.35
  ctx.fillRect(ml.x, ml.y - th * 2.5, mr.x - ml.x, th * 5)
  ctx.globalAlpha = 1
  ctx.fillRect(ml.x, ml.y - th / 2, mr.x - ml.x, th)
  ctx.globalCompositeOperation = 'source-over'
  return offs
}

function drawOneLane(ctx: CanvasRenderingContext2D, proj: Proj, cam: Cam, off: number, dim: boolean) {
  const cx = off * PITCH
  const y0 = Math.max(nearY(cam), -260)
  const ya = Math.max(y0, 0)
  const glow = LANE_GLOW[Math.abs(off) % LANE_GLOW.length]
  // Approach, gutters, lane, deck.
  strip(ctx, proj, cx - PITCH / 2, cx + PITCH / 2, y0, 0, dim ? COLORS.approachDim : COLORS.approach)
  strip(ctx, proj, cx - KICK, cx + KICK, ya, PIT_Y, dim ? COLORS.gutterDim : COLORS.gutter)
  if (dim) {
    strip(ctx, proj, cx - LANE_HALF, cx + LANE_HALF, ya, PIT_Y, COLORS.laneDim)
  } else {
    const near = proj(0, ya, 0)
    const far = proj(0, HEAD - 8, 0)
    const grd = ctx.createLinearGradient(0, near.y, 0, far.y)
    grd.addColorStop(0, COLORS.lane)
    grd.addColorStop(1, COLORS.laneFar)
    strip(ctx, proj, cx - LANE_HALF, cx + LANE_HALF, ya, HEAD - 8, grd)
    strip(ctx, proj, cx - LANE_HALF, cx + LANE_HALF, Math.max(ya, HEAD - 8), PIT_Y, COLORS.deck)
    // Boards.
    ctx.strokeStyle = COLORS.board
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let b = 1; b < 39; b++) {
      const bx = cx - LANE_HALF + (b * 2 * LANE_HALF) / 39
      const p = proj(bx, ya, 0)
      const q = proj(bx, PIT_Y, 0)
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(q.x, q.y)
    }
    ctx.stroke()
    // The deck under the pin lights.
    const dk = proj(0, HEAD - 60, 0)
    const pk = proj(0, PIT_Y, 0)
    const pool = ctx.createLinearGradient(0, dk.y, 0, pk.y)
    pool.addColorStop(0, 'rgba(255, 220, 160, 0)')
    pool.addColorStop(1, 'rgba(255, 230, 180, 0.35)')
    strip(ctx, proj, cx - LANE_HALF, cx + LANE_HALF, Math.max(ya, HEAD - 60), PIT_Y, pool)
  }
  // Neon: gutter edges and the lane dividers.
  const tubeY0 = Math.max(y0, -40)
  for (const sx of [-1, 1]) {
    floorTube(ctx, proj, cx + sx * (KICK + 0.6), tubeY0, PIT_Y, glow, 1.2, dim ? 0.45 : 1)
  }
  if (!dim) {
    for (const sx of [-1, 1]) floorTube(ctx, proj, cx + sx * (LANE_HALF + GUTTER_W * 0.5), ya, PIT_Y, NIGHT.violet, -1, 0.35)
  }
  // Foul line.
  if (y0 < 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = dim ? 0.3 : 0.5
    strip(ctx, proj, cx - LANE_HALF, cx + LANE_HALF, -2, 3, COLORS.foul, 0.1)
    ctx.globalAlpha = dim ? 0.5 : 1
    strip(ctx, proj, cx - LANE_HALF, cx + LANE_HALF, 0, 0.9, COLORS.foul, 0.1)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  if (dim) return
  // Dots and arrows, glowing.
  ctx.globalCompositeOperation = 'lighter'
  if (ya < 84) {
    for (const b of [3, 5, 8, 11, 14]) {
      for (const sx of [-1, 1]) {
        const bx = cx + sx * (LANE_HALF - (b * 2 * LANE_HALF) / 39 + LANE_HALF / 39)
        const p = proj(bx, 84, 0)
        ctx.fillStyle = NIGHT.cyan
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, Math.max(1, 0.7 * p.s), Math.max(0.6, 0.7 * p.s * 0.3), 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  if (ya < ARROWS_Y + 14) {
    for (let k = 1; k <= 7; k++) {
      const board = k * 5
      const bx = cx - LANE_HALF + ((board - 0.5) * 2 * LANE_HALF) / 39
      const ay = ARROWS_Y + Math.abs(4 - k) * 3
      ctx.globalAlpha = 0.35
      quad(ctx, [proj(bx, ay + 12, 0), proj(bx + 1.6, ay - 2, 0), proj(bx - 1.6, ay - 2, 0)], COLORS.arrow)
      ctx.globalAlpha = 1
      quad(ctx, [proj(bx, ay + 9, 0), proj(bx + 0.8, ay, 0), proj(bx - 0.8, ay, 0)], COLORS.arrow)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  // Pin spots.
  ctx.fillStyle = 'rgba(90, 40, 30, 0.35)'
  for (let id = 1; id <= 10; id++) {
    const s = pinSpot(id)
    const p = proj(cx + s.x, s.y, 0)
    if (p.d < 1) continue
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, 0.9 * p.s, 0.9 * p.s * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // Kickbacks with a neon stripe.
  for (const sx of [-1, 1]) {
    const x = cx + sx * KICK
    if (HEAD - 40 < nearY(cam)) continue
    quad(ctx, [proj(x, HEAD - 40, 0), proj(x, FAR, 0), proj(x, FAR, 30), proj(x, HEAD - 40, 30)], COLORS.kick)
    ctx.globalCompositeOperation = 'lighter'
    quad(ctx, [proj(x, HEAD - 40, 13), proj(x, FAR, 13), proj(x, FAR, 15), proj(x, HEAD - 40, 15)], glow)
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawNeighborRacks(ctx: CanvasRenderingContext2D, proj: Proj, offs: number[]) {
  for (const off of offs) {
    if (Math.abs(off) > 3) continue
    for (const id of [7, 8, 9, 10, 4, 5, 6, 2, 3, 1]) {
      const sp = pinSpot(id)
      drawPin(ctx, proj, { x: off * PITCH + sp.x, y: sp.y, tip: 0, ang: 0, wob: 0 }, 0.4, false)
    }
  }
}

/** Mirror ball light: slow drifting dots over everything (screen space, additive). */
function drawSparkles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, n = 34, strength = 1) {
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < n; i++) {
    const seed = (i * 7919) % 1000 / 1000
    const seed2 = (i * 104729) % 997 / 997
    const sp = 0.012 + seed * 0.02
    const x = ((seed2 * (w + 120) + t * sp * (i % 2 ? 1 : 0.7)) % (w + 120)) - 60
    const y = h * (0.04 + seed * 0.92) + Math.sin(t / 900 + i) * h * 0.02
    const tw = 0.5 + 0.5 * Math.sin(t / (260 + seed2 * 400) + i * 1.7)
    const r = (5 + seed2 * 9) * (0.6 + tw * 0.6) * Math.max(0.6, h / 500)
    ctx.globalAlpha = (0.25 + tw * 0.55) * strength
    ctx.drawImage(sparkSprite(SPARK_COLORS[i % SPARK_COLORS.length]), x - r, y - r, r * 2, r * 2)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

// ---------------- the bowler ----------------

export interface Bowler {
  /** Back view sprite (240 x 280, feet at 272), or null before the art is in. */
  sprite: HTMLCanvasElement | null
  color: string
}

/** Where the critter stands relative to the ball's start, and how tall it is (inches). */
const CRITTER = { dx: -17, y: -26, h: 42 }

function drawCritter(ctx: CanvasRenderingContext2D, proj: Proj, b: Bowler, x: number, y: number, sx: number, sy: number, lean: number) {
  if (!b.sprite) return
  const feet = proj(x, y, 0)
  if (feet.d < 30) return
  const fade = Math.max(0, Math.min(1, (feet.d - 30) / 70))
  const hh = CRITTER.h * feet.s * sy
  const ww = hh * (240 / 280) * (sx / sy)
  // The feet are at 272 of 280.
  const top = feet.y - hh * (272 / 280)
  ctx.globalAlpha = fade
  // Shadow.
  ctx.fillStyle = COLORS.shadow
  ctx.beginPath()
  ctx.ellipse(feet.x, feet.y, ww * 0.4, ww * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(feet.x, feet.y)
  ctx.rotate(lean)
  ctx.drawImage(b.sprite, -ww / 2, top - feet.y, ww, hh)
  ctx.restore()
  ctx.globalAlpha = 1
}

// ---------------- scenes ----------------

export interface AimView { x: number; aim: number }

export const startX = (x: number) => x * START_HALF

interface Layer { key: string; c: HTMLCanvasElement }
let aimLayer: Layer | null = null

/** The whole aim view without the bowler, cached until the size or the pins change. */
function bakedAim(w: number, h: number, dpr: number, standing: number[], neighbors: boolean): HTMLCanvasElement {
  const key = `${w}x${h}@${dpr}:${standing.join(',')}:${neighbors ? 1 : 0}:${fontReady ? 1 : 0}`
  if (aimLayer && aimLayer.key === key) return aimLayer.c
  const c = canvas(w * dpr, h * dpr)
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cam = aimCam(h)
  const proj = projector(cam, w)
  const offs = drawRoom(ctx, proj, cam, w, h, neighbors)
  for (const off of offs) drawOneLane(ctx, proj, cam, off, true)
  drawNeighborRacks(ctx, proj, offs)
  drawOneLane(ctx, proj, cam, 0, false)
  for (const id of [7, 8, 9, 10, 4, 5, 6, 2, 3, 1]) {
    if (!standing.includes(id)) continue
    const sp = pinSpot(id)
    drawPin(ctx, proj, { x: sp.x, y: sp.y, tip: 0, ang: 0, wob: 0 })
  }
  ctx.drawImage(vignetteFor(w, h), 0, 0, w, h)
  aimLayer = { key, c }
  return c
}

/** Aim: the bowler at the line holding the ball, the aim line glowing down the lane. */
export function drawAimScene(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, standing: number[], aim: AimView, bowler: Bowler, t: number, opts: { neighbors?: boolean } = {}) {
  const layer = bakedAim(w, h, dpr, standing, opts.neighbors ?? true)
  ctx.drawImage(layer, 0, 0, w, h)
  const cam = aimCam(h)
  const proj = projector(cam, w)
  const bx = startX(aim.x)
  const ang = (aim.aim * AIM_MAX_DEG * Math.PI) / 180
  // Aim chevrons, pulsing down the lane.
  ctx.globalCompositeOperation = 'lighter'
  for (let k = 1; k <= 9; k++) {
    const yy = 50 + k * 66
    const xx = bx + Math.tan(ang) * yy
    const pulse = 0.5 + 0.5 * Math.sin(t / 160 - k * 0.7)
    ctx.globalAlpha = (0.35 + pulse * 0.6) * (1 - k * 0.05)
    quad(ctx, [proj(xx - 4, yy - 5, 0.2), proj(xx + Math.sin(ang) * 10, yy + 10, 0.2), proj(xx + 4, yy - 5, 0.2), proj(xx, yy + 1, 0.2)], bowler.color)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  // The critter, breathing, ball at the hip.
  const bob = Math.sin(t / 420)
  drawCritter(ctx, proj, bowler, bx + CRITTER.dx, CRITTER.y, 1 + bob * 0.012, 1 - bob * 0.018, 0)
  drawBall(ctx, proj, bx, CRITTER.y + 4, bowler.color, 0.4, 15 + bob * 0.4)
  drawSparkles(ctx, w, h, t)
}

/** Windup, ms 0..WINDUP: the backswing and the release, from the aim camera. */
export function drawWindupScene(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, standing: number[], x: number, p: number, bowler: Bowler, t: number, opts: { neighbors?: boolean } = {}) {
  const layer = bakedAim(w, h, dpr, standing, opts.neighbors ?? true)
  ctx.drawImage(layer, 0, 0, w, h)
  const cam = aimCam(h)
  const proj = projector(cam, w)
  const bx = startX(x)
  // Ball path: hip -> back and up -> forward and down to the line.
  let by: number
  let bz: number
  if (p < 0.45) {
    const k = ease(p / 0.45)
    by = lerp(CRITTER.y + 4, CRITTER.y - 16, k)
    bz = lerp(13, 30, k)
  } else {
    const k = ease((p - 0.45) / 0.55)
    by = lerp(CRITTER.y - 16, 0, k)
    bz = lerp(30, BALL_R, Math.min(1, k * 1.25))
  }
  const slide = ease((p - 0.3) / 0.7)
  const cy = CRITTER.y + slide * 12
  const sx = p < 0.45 ? 1 - p * 0.05 : 1 + slide * 0.06
  const sy = p < 0.45 ? 1 + p * 0.08 : 1 - slide * 0.1
  const lean = p < 0.45 ? 0 : -0.06 * slide
  // Ball behind the critter on the backswing (closer to us = drawn after).
  const ballFirst = by > cy
  if (ballFirst) drawBall(ctx, proj, bx, by, bowler.color, p * 4, bz)
  drawCritter(ctx, proj, bowler, bx + CRITTER.dx, cy, sx, sy, lean)
  if (!ballFirst) drawBall(ctx, proj, bx, by, bowler.color, p * 4, bz)
  drawSparkles(ctx, w, h, t)
}

export interface ReplayView {
  replay: Replay
  /** Fractional replay sample. */
  f: number
  hit: number
  color: string
  /** How long since the ball left the hand, ms (drives the camera move off the aim shot). */
  ms: number
  /** Start x of the ball (setup), for the critter in the follow-through. */
  x: number
  bowler: Bowler
  /** Knocked all ten off a full rack. */
  strike: boolean
  /** Held after the roll (result): stay on the pin cam, no flash. */
  hold?: boolean
  neighbors?: boolean
  t: number
}

/** First sample where the ball crosses CUT_Y, or -1. */
export function cutSample(rp: Replay): number {
  const n = rp.ball.length / 2
  for (let i = 0; i < n; i++) if (rp.ball[i * 2 + 1] / 10 >= CUT_Y) return i
  return -1
}

/** Which shot a replay sample is on. */
export function shotAt(rp: Replay, f: number): 'chase' | 'pins' {
  const c = cutSample(rp)
  return c >= 0 && f >= c ? 'pins' : 'chase'
}

const BURST_COLORS = [NIGHT.pink, NIGHT.cyan, NIGHT.yellow, NIGHT.lime, '#FFFFFF']

/** One frame of a replay at sample f. */
export function drawReplayScene(ctx: CanvasRenderingContext2D, w: number, h: number, v: ReplayView) {
  const rp = v.replay
  const f = v.f
  const n = rp.ball.length / 2
  const i0 = Math.max(0, Math.floor(f))
  const t = f - i0
  const ballAt = (i: number) => [rp.ball[i * 2] / 10, rp.ball[i * 2 + 1] / 10]
  let ball: [number, number] | null = null
  if (n > 0 && f <= n - 1) {
    const [x0, y0] = ballAt(Math.min(n - 1, i0))
    const [x1, y1] = ballAt(Math.min(n - 1, i0 + 1))
    ball = [lerp(x0, x1, t), lerp(y0, y1, t)]
  }
  const cut = cutSample(rp)
  const onPins = v.hold || (cut >= 0 && f >= cut) || (!ball && n > 0)
  let cam: Cam
  if (onPins) {
    const from = cut >= 0 ? cut : 0
    const span = Math.max(1, rp.n - 1 - from)
    cam = pinCam(h, v.hold ? 1 : ease((f - from) / span))
  } else {
    const [bx, by] = ball ?? [0, 0]
    cam = blendCam(aimCam(h), chaseCam(h, bx, Math.max(0, by)), ease(v.ms / 1100))
  }

  // Strike: shake for a moment after impact.
  const since = v.hit >= 0 ? f - v.hit : -1
  ctx.save()
  if (v.strike && since >= 0 && since < 10 && !v.hold) {
    const amp = (1 - since / 10) * h * 0.012
    ctx.translate(Math.sin(f * 9.1) * amp, Math.cos(f * 7.3) * amp)
  }

  const proj = projector(cam, w)
  const neighbors = v.neighbors ?? true
  const offs = drawRoom(ctx, proj, cam, w, h, neighbors)
  for (const off of offs) drawOneLane(ctx, proj, cam, off, true)
  drawNeighborRacks(ctx, proj, offs)
  drawOneLane(ctx, proj, cam, 0, false)

  const items: { d: number; draw: () => void }[] = []
  for (const tr of rp.pins) {
    const a = pinAt(tr, i0)
    const b = pinAt(tr, i0 + 1)
    if (a[2] === 99) continue
    const x = lerp(a[0], b[0], b[2] === 99 ? 0 : t)
    const y = lerp(a[1], b[1], b[2] === 99 ? 0 : t)
    const downAt = pinDownAt(tr)
    let tip = 0
    let ang = 0
    let wob = 0
    let z = 0
    if (downAt >= 0 && f >= downAt - 1) {
      tip = Math.min(1, Math.max(0, (f - (downAt - 1)) / 4))
      const s0 = pinAt(tr, tip < 1 ? downAt : Math.max(downAt, i0))[2]
      ang = s0 >= 10 && s0 < 99 ? ((s0 - 10) * 10 * Math.PI) / 180 : 0
      // A hop for pins that got hit hard: they fly a little, just for show.
      const p0 = pinAt(tr, i0 - 1)
      const p1 = pinAt(tr, i0 + 1)
      const sp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / (2 * rp.dt / 1000)
      z = Math.max(0, Math.min(16, (sp - 70) * 0.05)) * (v.strike ? 1.3 : 1)
    } else {
      const amp = a[2] / 9
      wob = amp * 0.12 * Math.sin(f * 2.4 + tr.id)
    }
    const pose: PinPose = { x, y, z, tip: tip * tip * (3 - 2 * tip), ang, wob }
    const mid = proj(x + Math.cos(ang) * 5 * tip, y + Math.sin(ang) * 5 * tip, 0)
    if (mid.d < 4) continue
    items.push({ d: mid.d, draw: () => drawPin(ctx, proj, pose) })
  }
  if (ball) {
    const [bx, by] = ball
    const inGutter = Math.abs(bx) > LANE_HALF + 0.5
    const z = inGutter ? BALL_R - 1.6 : BALL_R
    const p = proj(bx, by, 0)
    if (p.d > 6) items.push({ d: p.d, draw: () => drawBall(ctx, proj, bx, by, v.color, by / BALL_R, z) })
  }
  // The bowler, left behind in the follow-through, until the camera passes.
  if (!onPins) {
    const cxw = startX(v.x) + CRITTER.dx
    const p = proj(cxw, CRITTER.y + 12, 0)
    items.push({ d: p.d, draw: () => drawCritter(ctx, proj, v.bowler, cxw, CRITTER.y + 12, 1.06, 0.9, -0.06) })
  }
  items.sort((a, b) => b.d - a.d).forEach((it) => it.draw())

  // Impact: a burst of neon bits off the head pin, bigger on a strike.
  if (!v.hold && since >= 0 && since < 26 && v.hit < rp.ball.length / 2) {
    const [hx, hy] = ballAt(Math.min(n - 1, v.hit))
    const count = v.strike ? 64 : 22
    const tt = (since * rp.dt) / 1000
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < count; i++) {
      const r1 = ((i * 9301 + 49297) % 233280) / 233280
      const r2 = ((i * 4096 + 150889) % 714025) / 714025
      const a = r1 * Math.PI * 2
      const spd = (v.strike ? 90 : 55) * (0.4 + r2)
      const px = hx + Math.cos(a) * spd * tt
      const py = hy + 6 + Math.abs(Math.sin(a)) * spd * tt * 0.8
      const pz = 4 + (40 + r2 * 60) * tt - 120 * tt * tt
      if (pz < 0) continue
      const q = proj(px, py, pz)
      if (q.d < 4) continue
      const sz = Math.max(1.5, q.s * (0.8 + r1 * 0.9))
      ctx.globalAlpha = Math.max(0, 1 - since / 26)
      ctx.fillStyle = BURST_COLORS[i % BURST_COLORS.length]
      ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.drawImage(vignetteFor(w, h), 0, 0, w, h)
  drawSparkles(ctx, w, h, v.t, 34, onPins ? 0.8 : 1)
  ctx.restore()

  // The cut: a white flash as the camera jumps to the pins. A strike flashes again at impact.
  if (!v.hold) {
    let flash = 0
    if (cut >= 0 && f >= cut && f < cut + 2.5) flash = Math.max(flash, 0.55 * (1 - (f - cut) / 2.5))
    if (v.strike && since >= 0 && since < 4) flash = Math.max(flash, 0.6 * (1 - since / 4))
    if (flash > 0) {
      ctx.globalAlpha = flash
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }
  }
}

/** Height of a pin on screen at the aim camera, for sanity checks. */
export function pinPixelHeight(h: number) {
  const proj = projector(aimCam(h), 100)
  const a = proj(0, HEAD, 0)
  const b = proj(0, HEAD, PIN_H)
  return a.y - b.y
}
