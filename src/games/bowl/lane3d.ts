import { ARROWS_Y, AIM_MAX_DEG, BALL_R, GUTTER_W, HEAD, KICK, LANE_HALF, PIN_H, PIN_R, PIT_Y, START_HALF, pinAt, pinDownAt, pinSpot, type Replay } from './sim'

/**
 * The TV lane: a low camera behind the foul line, a gentle perspective, and a camera
 * that follows the ball down to the pins. World units are inches (x across, y down the
 * lane, z up). Flat riso fills, no gradients.
 */

export const COLORS = {
  bg: '#0C1130',
  lane: '#D9A35E',
  laneDim: '#3A3445',
  gutterDim: '#141A3D',
  board: 'rgba(120, 72, 30, 0.22)',
  deck: '#E6B877',
  approach: '#8C6440',
  approachDim: '#221F33',
  foul: '#0C1130',
  gutter: '#1B2356',
  gutterEdge: '#3A4380',
  kick: '#262F62',
  pit: '#060918',
  mask: '#131A42',
  maskStripe: '#FF6B3D',
  arrow: '#FF6B3D',
  pin: '#F4F5FA',
  pinShade: '#C9CCDD',
  pinBand: '#E5484D',
  pinLine: 'rgba(12, 17, 48, 0.55)',
  hole: '#0C1130',
  shadow: 'rgba(12, 17, 48, 0.35)',
}

export interface Cam { y: number; z: number; pitch: number; f: number; cy: number }

/** Camera height (inches), and how far behind the ball it rides: at release, and once the ball meets the pins. */
const CAM_Z = 66
const CAM_Z_PIN = 84
const D_AIM = 421
const D_PIN = 320
const LENS = 7.0
/** Where the ground under the ball sits on screen, as a share of the height. */
const GROUND = 0.86

/**
 * A long lens a good way back: the whole lane in a gentle trapezoid while you aim, then the
 * camera rides behind the ball and stops about 24 feet short of the pins, so the pin action is big.
 */
export function followCam(h: number, ballY: number): Cam {
  const t = Math.max(0, Math.min(1, ballY / HEAD))
  const e = t * t * (3 - 2 * t)
  const d = D_AIM + (D_PIN - D_AIM) * e
  const z = CAM_Z + (CAM_Z_PIN - CAM_Z) * e
  const f = h * LENS
  const y = Math.max(-D_AIM, ballY - d)
  let cy = h * GROUND - (z * f) / d
  // Keep the back row in the picture while the camera rides in.
  const backTop = cy + ((z - PIN_H) * f) / (HEAD + 32 - y)
  if (backTop < h * 0.05) cy += Math.min(h * 0.05 - backTop, h * 0.14)
  return { y, z, pitch: 0, f, cy }
}

export function aimCam(h: number): Cam {
  return followCam(h, 0)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

interface P { x: number; y: number; d: number; s: number }

function projector(cam: Cam, w: number) {
  const cos = Math.cos(cam.pitch)
  const sin = Math.sin(cam.pitch)
  return (x: number, y: number, z: number): P => {
    const dy = y - cam.y
    const dz = z - cam.z
    const d = dy * cos - dz * sin
    const up = dy * sin + dz * cos
    const k = cam.f / Math.max(d, 1)
    return { x: w / 2 + x * k, y: cam.cy - up * k, d, s: k }
  }
}

/** Nearest lane y in front of the camera that's safe to draw. */
function nearY(cam: Cam) {
  return cam.y + Math.max(8, (16 - cam.z * Math.sin(cam.pitch)) / Math.cos(cam.pitch))
}

function quad(ctx: CanvasRenderingContext2D, pts: P[], fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.fill()
}

/** Pin profile: radius (inches) at height h (inches), base to crown. */
const PROFILE: [number, number][] = [
  [0, 1.0], [1, 1.6], [2.5, 2.15], [4.5, 2.38], [6.5, 2.15], [8.5, 1.45], [9.8, 0.95], [10.6, 0.88], [11.6, 1.0], [12.8, 1.26], [14, 1.18], [14.7, 0.85], [15, 0.2],
]
const BAND: [number, number] = [9.7, 10.7]

const BACK_TO_FRONT = [7, 8, 9, 10, 4, 5, 6, 2, 3, 1]

export interface PinPose { x: number; y: number; /** 0 upright .. 1 lying */ tip: number; /** direction it leans or lies, radians in the lane plane */ ang: number; wob: number }

/** Draw one pin: its axis from the base, tipped toward `ang`. Works upright, mid-fall and lying. */
function drawPin(ctx: CanvasRenderingContext2D, proj: ReturnType<typeof projector>, p: PinPose, alpha = 1) {
  const phi = p.tip * (Math.PI / 2)
  const ax = Math.sin(phi) * Math.cos(p.ang)
  const ay = Math.sin(phi) * Math.sin(p.ang)
  const az = Math.cos(phi)
  const lift = Math.sin(phi) * PIN_R * 0.92
  // Upright wobble: lean sideways a few degrees.
  const lean = p.tip < 0.01 ? p.wob : 0
  const pts = PROFILE.map(([h, r]) => {
    const base = proj(p.x + ax * h + lean * h, p.y + ay * h, lift + az * h)
    return { ...base, r }
  })
  // Screen-space normal to the axis at each point.
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const tl = Math.hypot(tx, ty)
    if (tl < 1e-3) { tx = 0; ty = -1 } else { tx /= tl; ty /= tl }
    const nx = -ty
    const ny = tx
    const r = pts[i].r * pts[i].s
    left.push([pts[i].x + nx * r, pts[i].y + ny * r])
    right.push([pts[i].x - nx * r, pts[i].y - ny * r])
  }
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(left[0][0], left[0][1])
  for (const q of left) ctx.lineTo(q[0], q[1])
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
  ctx.closePath()
  ctx.fillStyle = COLORS.pin
  ctx.fill()
  ctx.lineWidth = Math.max(1, pts[3].s * 0.22)
  ctx.strokeStyle = COLORS.pinLine
  ctx.stroke()
  // The red neck band.
  const band = (h: number) => {
    let i = 0
    while (i < PROFILE.length - 2 && PROFILE[i + 1][0] < h) i++
    const [h0] = PROFILE[i]
    const [h1] = PROFILE[i + 1]
    const t = (h - h0) / (h1 - h0)
    return [lerp(left[i][0], left[i + 1][0], t), lerp(left[i][1], left[i + 1][1], t), lerp(right[i][0], right[i + 1][0], t), lerp(right[i][1], right[i + 1][1], t)]
  }
  const b0 = band(BAND[0])
  const b1 = band(BAND[1])
  ctx.beginPath()
  ctx.moveTo(b0[0], b0[1])
  ctx.lineTo(b1[0], b1[1])
  ctx.lineTo(b1[2], b1[3])
  ctx.lineTo(b0[2], b0[3])
  ctx.closePath()
  ctx.fillStyle = COLORS.pinBand
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawBall(ctx: CanvasRenderingContext2D, proj: ReturnType<typeof projector>, x: number, y: number, color: string, roll: number, z = BALL_R) {
  const c = proj(x, y, z)
  const r = BALL_R * c.s
  const g = proj(x, y, 0)
  ctx.fillStyle = COLORS.shadow
  ctx.beginPath()
  ctx.ellipse(g.x, g.y, r * 1.05, r * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(1, r * 0.06)
  ctx.strokeStyle = 'rgba(12, 17, 48, 0.5)'
  ctx.stroke()
  // Finger holes ride around as it rolls.
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

/** Lane, gutters, kickbacks, pit, masking, and dim neighbors. */
function drawLane(ctx: CanvasRenderingContext2D, proj: ReturnType<typeof projector>, cam: Cam, w: number, h: number, dimNeighbors: boolean) {
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, w, h)
  const y0 = Math.max(nearY(cam), -220)
  const far = PIT_Y + 60
  const pitch = 2 * KICK + 7
  const strip = (x0: number, x1: number, ya: number, yb: number, fill: string, z = 0) => {
    if (yb <= ya) return
    quad(ctx, [proj(x0, ya, z), proj(x1, ya, z), proj(x1, yb, z), proj(x0, yb, z)], fill)
  }
  const offs = dimNeighbors ? [-2, -1, 0, 1, 2] : [0]
  // Farthest first: the pits and their back cushions, below and behind every deck.
  for (const off of offs) {
    const cx = off * pitch
    strip(cx - KICK, cx + KICK, PIT_Y, far, COLORS.pit, -6)
    quad(ctx, [proj(cx - KICK, far, -6), proj(cx + KICK, far, -6), proj(cx + KICK, far, 44), proj(cx - KICK, far, 44)], COLORS.pit)
  }
  // Neighbor lanes, dim, so it reads as a bowling alley.
  if (dimNeighbors) {
    for (const off of [-2, -1, 1, 2]) {
      const cx = off * pitch
      strip(cx - KICK, cx + KICK, Math.max(y0, 0), PIT_Y, COLORS.gutterDim)
      strip(cx - LANE_HALF, cx + LANE_HALF, Math.max(y0, 0), PIT_Y, COLORS.laneDim)
      strip(cx - KICK - 3.5, cx + KICK + 3.5, y0, 0, COLORS.approachDim)
    }
    // Their racks, faint, while the camera is back at the line.
    const back = [...BACK_TO_FRONT]
    for (const off of cam.y < -200 ? [-1, 1] : []) {
      for (const id of back) {
        const sp = pinSpot(id)
        drawPin(ctx, proj, { x: off * pitch + sp.x, y: sp.y, tip: 0, ang: 0, wob: 0 }, 0.3)
      }
    }
  }
  // This lane.
  strip(-KICK - 3.5, KICK + 3.5, y0, 0, COLORS.approach)
  strip(-KICK, KICK, Math.max(y0, 0), PIT_Y, COLORS.gutter)
  // Gutter channel edges.
  ctx.lineWidth = 1
  for (const sx of [-1, 1]) {
    const e0 = proj(sx * (LANE_HALF + GUTTER_W * 0.5), Math.max(y0, 0), -1)
    const e1 = proj(sx * (LANE_HALF + GUTTER_W * 0.5), PIT_Y, -1)
    ctx.strokeStyle = COLORS.gutterEdge
    ctx.beginPath()
    ctx.moveTo(e0.x, e0.y)
    ctx.lineTo(e1.x, e1.y)
    ctx.stroke()
  }
  strip(-LANE_HALF, LANE_HALF, Math.max(y0, 0), HEAD - 8, COLORS.lane)
  strip(-LANE_HALF, LANE_HALF, Math.max(y0, HEAD - 8), PIT_Y, COLORS.deck)
  // Boards.
  ctx.strokeStyle = COLORS.board
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let b = 1; b < 39; b++) {
    const bx = -LANE_HALF + (b * 2 * LANE_HALF) / 39
    const a = proj(bx, Math.max(y0, 0), 0)
    const z = proj(bx, HEAD - 8, 0)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(z.x, z.y)
  }
  ctx.stroke()
  // Foul line.
  if (y0 < 0) strip(-LANE_HALF, LANE_HALF, 0, 0.9, COLORS.foul)
  // Dots and arrows.
  ctx.fillStyle = COLORS.arrow
  if (y0 < 84) {
    for (const b of [3, 5, 8, 11, 14]) {
      for (const sx of [-1, 1]) {
        const bx = sx * (LANE_HALF - (b * 2 * LANE_HALF) / 39 + LANE_HALF / 39)
        const p = proj(bx, 84, 0)
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, Math.max(0.8, 0.5 * p.s), Math.max(0.5, 0.5 * p.s * 0.3), 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  if (y0 < ARROWS_Y + 12) {
    for (let k = 1; k <= 7; k++) {
      const board = k * 5
      const bx = -LANE_HALF + ((board - 0.5) * 2 * LANE_HALF) / 39
      const ay = ARROWS_Y + Math.abs(4 - k) * 3
      const tip = proj(bx, ay + 9, 0)
      const l = proj(bx - 0.7, ay, 0)
      const r = proj(bx + 0.7, ay, 0)
      quad(ctx, [tip, r, l], COLORS.arrow)
    }
  }
  // Pin spots.
  ctx.fillStyle = 'rgba(120, 72, 30, 0.35)'
  for (let id = 1; id <= 10; id++) {
    const s = pinSpot(id)
    const p = proj(s.x, s.y, 0)
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, 0.9 * p.s, 0.9 * p.s * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // Kickbacks (side walls along the pin deck).
  for (const sx of [-1, 1]) {
    const x = sx * KICK
    quad(ctx, [proj(x, HEAD - 40, 0), proj(x, far, 0), proj(x, far, 30), proj(x, HEAD - 40, 30)], COLORS.kick)
  }
  // Masking unit hanging over the pit.
  const my = PIT_Y - 6
  quad(ctx, [proj(-KICK - 4, my, 30), proj(KICK + 4, my, 30), proj(KICK + 4, my, 64), proj(-KICK - 4, my, 64)], COLORS.mask)
  quad(ctx, [proj(-KICK - 4, my, 30), proj(KICK + 4, my, 30), proj(KICK + 4, my, 34), proj(-KICK - 4, my, 34)], COLORS.maskStripe)
}

export interface AimView { x: number; aim: number; color: string }

/** Lane x (inches) of the ball's start for a setup x in -1..1. */
export const startX = (x: number) => x * START_HALF

function poseFromSpot(id: number): PinPose {
  const s = pinSpot(id)
  return { x: s.x, y: s.y, tip: 0, ang: 0, wob: 0 }
}

/** Upright pins (respotted) plus an optional ball held at the foul line with its aim line. */
export function drawAimScene(ctx: CanvasRenderingContext2D, w: number, h: number, standing: number[], aim: AimView | null, opts: { neighbors?: boolean } = {}) {
  const cam = aimCam(h)
  const proj = projector(cam, w)
  drawLane(ctx, proj, cam, w, h, opts.neighbors ?? true)
  const items: { d: number; draw: () => void }[] = []
  for (const id of standing) {
    const pose = poseFromSpot(id)
    items.push({ d: proj(pose.x, pose.y, 0).d, draw: () => drawPin(ctx, proj, pose) })
  }
  if (aim) {
    const bx = startX(aim.x)
    const ang = (aim.aim * AIM_MAX_DEG * Math.PI) / 180
    // The aim line: chevrons along the lane where a straight ball would go.
    ctx.fillStyle = aim.color
    for (let k = 1; k <= 7; k++) {
      const yy = 60 + k * 70
      const xx = bx + Math.tan(ang) * yy
      const tip = proj(xx + Math.sin(ang) * 10, yy + 10, 0.2)
      const l = proj(xx - 4, yy - 5, 0.2)
      const m = proj(xx, yy + 1, 0.2)
      const r = proj(xx + 4, yy - 5, 0.2)
      ctx.globalAlpha = 1 - k * 0.08
      quad(ctx, [l, tip, r, m], aim.color)
    }
    ctx.globalAlpha = 1
    items.push({ d: proj(bx, -8, 0).d, draw: () => drawBall(ctx, proj, bx, -8, aim.color, 0.3) })
  }
  items.sort((a, b) => b.d - a.d).forEach((it) => it.draw())
}

/** One frame of a replay at sample position f (fractional). */
export function drawReplayScene(ctx: CanvasRenderingContext2D, w: number, h: number, rp: Replay, f: number, color: string, opts: { neighbors?: boolean } = {}) {
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
  const lastBall = n > 0 ? ballAt(n - 1) : [0, HEAD]
  const cam = followCam(h, ball ? Math.max(0, ball[1]) : Math.max(lastBall[1], HEAD))
  const proj = projector(cam, w)
  drawLane(ctx, proj, cam, w, h, opts.neighbors ?? true)

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
    if (downAt >= 0 && f >= downAt - 1) {
      // Falls over across about 200 ms, starting just before the sample that saw it down.
      tip = Math.min(1, Math.max(0, (f - (downAt - 1)) / 4))
      const s = pinAt(tr, Math.max(downAt, i0))[2]
      ang = s >= 10 && s < 99 ? ((s - 10) * 10 * Math.PI) / 180 : 0
      if (tip < 1) {
        const s0 = pinAt(tr, downAt)[2]
        ang = s0 >= 10 && s0 < 99 ? ((s0 - 10) * 10 * Math.PI) / 180 : 0
      }
    } else {
      const amp = a[2] / 9
      wob = amp * 0.12 * Math.sin(f * 2.4 + tr.id)
    }
    const pose: PinPose = { x, y, tip: tip * tip * (3 - 2 * tip), ang, wob }
    const mid = proj(x + Math.cos(ang) * 5 * tip, y + Math.sin(ang) * 5 * tip, 0)
    items.push({ d: mid.d, draw: () => drawPin(ctx, proj, pose) })
  }
  if (ball) {
    const [bx, by] = ball
    const inGutter = Math.abs(bx) > LANE_HALF + 0.5
    const z = inGutter ? BALL_R - 1.6 : BALL_R
    items.push({ d: proj(bx, by, 0).d, draw: () => drawBall(ctx, proj, bx, by, color, by / BALL_R, z) })
  }
  items.sort((a, b) => b.d - a.d).forEach((it) => it.draw())
}

/** Height of a pin on screen at the aim camera, for sanity checks. */
export function pinPixelHeight(h: number) {
  const proj = projector(aimCam(h), 100)
  const a = proj(0, HEAD, 0)
  const b = proj(0, HEAD, PIN_H)
  return a.y - b.y
}
