import { AIM_MAX_DEG, ARROWS_Y, BALL_R, HEAD, KICK, LANE_HALF, PIN_R, PIT_Y, START_HALF, pinSpot } from './sim'
import { NIGHT } from './look'

/**
 * The phone's lane, looking down it from above the foul line: the lane as a flat trapezoid
 * (a true plane perspective, so straight lines stay straight), and the pin deck blown up in
 * a box at the top so you can see what's standing and where you're pointed.
 * Pure mapping + drawing, no React.
 */

/** Lane y (inches) where the trapezoid ends and the blown-up deck begins. */
const DECK_FROM = HEAD - 14
const DECK_TO = PIT_Y + 3

export interface PadMap {
  w: number
  h: number
  /** Screen y of the foul line and of the top of the lane trapezoid. */
  bottom: number
  top: number
  /** Pixels per inch across, at the foul line. */
  sx0: number
  k: number
  /** The blown-up deck. */
  deck: { x: number; y: number; w: number; h: number; ix: number; iy: number }
  /** Lane y (inches) of the aim handle, and the screen y above which a drag aims instead of moves. */
  handleY: number
  aimZone: number
}

export function padMap(w: number, h: number): PadMap {
  const dw = Math.min(w - 24, 340)
  const dh = Math.round(Math.max(110, h * 0.27))
  const deck = { x: (w - dw) / 2, y: 10, w: dw, h: dh, ix: dw / (2 * KICK), iy: dh / (DECK_TO - DECK_FROM) }
  const bottom = h - Math.max(58, h * 0.12)
  const top = deck.y + deck.h + 18
  const wb = Math.min(w * 0.8, (bottom - top) * 0.75)
  const m: PadMap = { w, h, bottom, top, sx0: wb / (2 * KICK), k: 0.95, deck, handleY: 470, aimZone: 0 }
  m.aimZone = toScreen(m, 0, 300).y
  return m
}

/** Lane inches to screen px. Past DECK_FROM it lands in the blown-up deck box. */
export function toScreen(m: PadMap, x: number, y: number): { x: number; y: number; s: number } {
  if (y > DECK_FROM) {
    const d = m.deck
    return { x: d.x + d.w / 2 + x * d.ix, y: d.y + d.h - (y - DECK_FROM) * d.iy, s: d.ix }
  }
  const t = y / DECK_FROM
  const q = 1 + m.k * t
  return { x: m.w / 2 + (x * m.sx0) / q, y: m.bottom - ((m.bottom - m.top) * ((1 + m.k) * t)) / q, s: m.sx0 / q }
}

/** Screen pixels to lane inches across, at lane depth y (lane part only). */
export function pxToIn(m: PadMap, px: number, y: number) {
  return (px * (1 + (m.k * y) / DECK_FROM)) / m.sx0
}

export const BALL_Y = -16

export function ballScreen(m: PadMap, x: number) {
  return toScreen(m, x * START_HALF, BALL_Y)
}

export function handleScreen(m: PadMap, x: number, aim: number) {
  const ang = (aim * AIM_MAX_DEG * Math.PI) / 180
  return toScreen(m, x * START_HALF + Math.tan(ang) * m.handleY, m.handleY)
}

/** New aim after dragging the handle by dx screen pixels. */
export function aimAfterDrag(m: PadMap, aim0: number, dx: number) {
  const ang = (aim0 * AIM_MAX_DEG * Math.PI) / 180
  const tan = Math.tan(ang) + pxToIn(m, dx, m.handleY) / m.handleY
  return Math.max(-1, Math.min(1, (Math.atan(tan) * 180) / Math.PI / AIM_MAX_DEG))
}

/** New start position after dragging the ball by dx screen pixels. */
export function xAfterDrag(m: PadMap, x0: number, dx: number) {
  return Math.max(-1, Math.min(1, x0 + pxToIn(m, dx, BALL_Y) / START_HALF))
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string | CanvasGradient) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.closePath()
  ctx.fill()
}

export interface PadScene {
  standing: number[]
  x: number
  aim: number
  color: string
  /** Finger trail while swiping, screen px. */
  trail?: { x: number; y: number }[]
  /** Ball lifted to follow the finger (screen px). */
  held?: { x: number; y: number } | null
  active?: 'move' | 'aim' | null
  /** The bowler from behind (lane sprite, 240 x 280, feet at 272), standing by the ball. */
  critter?: HTMLCanvasElement | null
  /** ms clock for the glow pulse. */
  t?: number
}

const PAD = {
  bg: NIGHT.bg0,
  approach: '#3A2350',
  gutter: '#140A30',
  lane: '#A8704E',
  laneFar: '#C48A5C',
  deck: '#E3AE74',
  pit: '#05020F',
  board: 'rgba(60, 18, 40, 0.18)',
  boardMajor: 'rgba(60, 18, 40, 0.32)',
}

/** A neon line: wide soft glow, then a hot core. */
function neonLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, width: number) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.25
  ctx.lineWidth = width * 4
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  ctx.globalAlpha = 0.9
  ctx.lineWidth = width
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  ctx.globalAlpha = 0.8
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = Math.max(1, width * 0.35)
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  ctx.restore()
}

export function drawPad(ctx: CanvasRenderingContext2D, m: PadMap, sc: PadScene) {
  const S = (x: number, y: number) => toScreen(m, x, y)
  const t = sc.t ?? 0
  const bg = ctx.createLinearGradient(0, 0, 0, m.h)
  bg.addColorStop(0, '#160838')
  bg.addColorStop(1, PAD.bg)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, m.w, m.h)

  // Lane: approach, gutters, wood, boards, foul line, arrows.
  poly(ctx, [S(-KICK - 4, -70), S(KICK + 4, -70), S(KICK + 4, 0), S(-KICK - 4, 0)], PAD.approach)
  poly(ctx, [S(-KICK, 0), S(KICK, 0), S(KICK, DECK_FROM), S(-KICK, DECK_FROM)], PAD.gutter)
  const near = S(0, 0)
  const far = S(0, DECK_FROM)
  const wood = ctx.createLinearGradient(0, near.y, 0, far.y)
  wood.addColorStop(0, PAD.lane)
  wood.addColorStop(1, PAD.laneFar)
  poly(ctx, [S(-LANE_HALF, 0), S(LANE_HALF, 0), S(LANE_HALF, DECK_FROM), S(-LANE_HALF, DECK_FROM)], wood)
  ctx.lineWidth = 1
  for (let b = 1; b < 39; b++) {
    const bx = -LANE_HALF + (b * 2 * LANE_HALF) / 39
    const a = S(bx, 0)
    const z = S(bx, DECK_FROM)
    ctx.strokeStyle = b % 5 === 0 ? PAD.boardMajor : PAD.board
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(z.x, z.y)
    ctx.stroke()
  }
  for (const sx of [-1, 1]) neonLine(ctx, S(sx * KICK, -40), S(sx * KICK, DECK_FROM), NIGHT.cyan, 2.5)
  neonLine(ctx, S(-LANE_HALF, 0.8), S(LANE_HALF, 0.8), NIGHT.red, 2.5)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let k = 1; k <= 7; k++) {
    const bx = -LANE_HALF + ((k * 5 - 0.5) * 2 * LANE_HALF) / 39
    const ay = ARROWS_Y + Math.abs(4 - k) * 3
    ctx.globalAlpha = 0.35
    poly(ctx, [S(bx, ay + 18), S(bx + 2.2, ay - 2), S(bx - 2.2, ay - 2)], NIGHT.pink)
    ctx.globalAlpha = 1
    poly(ctx, [S(bx, ay + 14), S(bx + 1.1, ay), S(bx - 1.1, ay)], NIGHT.pink)
  }
  ctx.restore()

  // The blown-up deck, tied to the end of the lane with two neon lines.
  const d = m.deck
  const endL = S(-KICK, DECK_FROM)
  const endR = S(KICK, DECK_FROM)
  ctx.save()
  ctx.strokeStyle = NIGHT.violet
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(endL.x, endL.y)
  ctx.lineTo(d.x, d.y + d.h)
  ctx.moveTo(endR.x, endR.y)
  ctx.lineTo(d.x + d.w, d.y + d.h)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = PAD.gutter
  ctx.fillRect(d.x, d.y, d.w, d.h)
  const dl = S(-LANE_HALF, DECK_FROM + 0.01)
  const pit = S(LANE_HALF, PIT_Y)
  ctx.fillStyle = PAD.deck
  ctx.fillRect(dl.x, pit.y, pit.x - dl.x, dl.y - pit.y)
  ctx.fillStyle = PAD.pit
  ctx.fillRect(d.x, d.y, d.w, pit.y - d.y)
  ctx.save()
  ctx.shadowColor = NIGHT.pink
  ctx.shadowBlur = 12
  ctx.strokeStyle = NIGHT.pink
  ctx.lineWidth = 3
  ctx.strokeRect(d.x + 1.5, d.y + 1.5, d.w - 3, d.h - 3)
  ctx.restore()

  // Pins: top-down, white with the red band, glowing. Down ones as faint rings.
  const rowGap = 12 * Math.sin(Math.PI / 3) * d.iy
  const pr = Math.max(5, Math.min(PIN_R * d.ix * 1.15, rowGap * 0.46))
  for (let id = 1; id <= 10; id++) {
    const sp = pinSpot(id)
    const p = S(sp.x, sp.y)
    if (!sc.standing.includes(id)) {
      ctx.strokeStyle = 'rgba(90, 40, 30, 0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, pr * 0.45, 0, Math.PI * 2)
      ctx.stroke()
      continue
    }
    ctx.fillStyle = 'rgba(120, 220, 255, 0.35)'
    ctx.beginPath()
    ctx.arc(p.x, p.y, pr * 1.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FBFAFF'
    ctx.beginPath()
    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = NIGHT.ink
    ctx.stroke()
    ctx.strokeStyle = '#FF3D5A'
    ctx.lineWidth = Math.max(2, pr * 0.28)
    ctx.beginPath()
    ctx.arc(p.x, p.y, pr * 0.52, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Aim line: where a straight ball goes, glowing dots down the lane, dashed through the deck.
  const bx = sc.x * START_HALF
  const tan = Math.tan((sc.aim * AIM_MAX_DEG * Math.PI) / 180)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = sc.color
  let k = 0
  for (let yy = 30; yy < DECK_FROM - 6; yy += 34, k++) {
    const p = S(bx + tan * yy, yy)
    const pulse = 0.55 + 0.45 * Math.sin(t / 150 - k * 0.6)
    ctx.globalAlpha = (0.95 - (yy / HEAD) * 0.4) * pulse
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(2, p.s * 1.3), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  const a0 = S(bx + tan * (DECK_FROM + 1), DECK_FROM + 1)
  const a1 = S(bx + tan * PIT_Y, PIT_Y)
  ctx.strokeStyle = sc.color
  ctx.lineWidth = 3
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(a0.x, a0.y)
  ctx.lineTo(a1.x, a1.y)
  ctx.stroke()
  ctx.setLineDash([])
  const hp1 = S(bx + tan * HEAD, HEAD)
  ctx.fillStyle = sc.color
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.arc(hp1.x, hp1.y, BALL_R * d.ix, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Aim handle: a neon puck with arrows.
  const hp = handleScreen(m, sc.x, sc.aim)
  const hr = 24
  ctx.save()
  ctx.shadowColor = sc.color
  ctx.shadowBlur = sc.active === 'aim' ? 22 : 12
  ctx.fillStyle = sc.active === 'aim' ? sc.color : 'rgba(23, 11, 61, 0.92)'
  ctx.beginPath()
  ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.lineWidth = 3.5
  ctx.strokeStyle = NIGHT.ink
  ctx.beginPath()
  ctx.arc(hp.x, hp.y, hr + 1.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.strokeStyle = sc.color
  ctx.beginPath()
  ctx.arc(hp.x, hp.y, hr - 2, 0, Math.PI * 2)
  ctx.stroke()
  const ink = sc.active === 'aim' ? NIGHT.ink : '#FFFFFF'
  poly(ctx, [{ x: hp.x - 16, y: hp.y }, { x: hp.x - 6, y: hp.y - 8 }, { x: hp.x - 6, y: hp.y + 8 }], ink)
  poly(ctx, [{ x: hp.x + 16, y: hp.y }, { x: hp.x + 6, y: hp.y - 8 }, { x: hp.x + 6, y: hp.y + 8 }], ink)

  // Swipe trail.
  if (sc.trail && sc.trail.length > 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = sc.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const [w, a] of [[18, 0.2], [7, 0.85]] as const) {
      ctx.lineWidth = w
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.moveTo(sc.trail[0].x, sc.trail[0].y)
      for (const p of sc.trail) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // The bowler, from behind, just left of the ball's home spot.
  const home = ballScreen(m, sc.x)
  const br = Math.max(16, BALL_R * home.s * 1.25)
  if (sc.critter) {
    const ch = Math.min(m.h * 0.2, 110)
    const cw = ch * (240 / 280)
    const feet = m.h - 2
    const cx = home.x - br - cw * 0.28
    ctx.globalAlpha = sc.held ? 0.8 : 1
    ctx.drawImage(sc.critter, cx - cw / 2, feet - ch * (272 / 280), cw, ch)
    ctx.globalAlpha = 1
  }

  // Ball.
  const b = sc.held ?? home
  const halo = ctx.createRadialGradient(b.x, b.y, br * 0.8, b.x, b.y, br * 2.1)
  halo.addColorStop(0, sc.color + 'AA')
  halo.addColorStop(1, sc.color + '00')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(b.x, b.y, br * 2.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = sc.color
  ctx.beginPath()
  ctx.arc(b.x, b.y, br, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = sc.active === 'move' ? 4.5 : 3
  ctx.strokeStyle = sc.active === 'move' ? '#FFFFFF' : NIGHT.ink
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(b.x - br * 0.4, b.y - br * 0.42, br * 0.2, br * 0.12, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = NIGHT.ink
  for (const [dx, dy, rr] of [[-0.24, -0.18, 0.13], [0.24, -0.18, 0.13], [0, 0.22, 0.15]] as const) {
    ctx.beginPath()
    ctx.arc(b.x + dx * br, b.y + dy * br, rr * br, 0, Math.PI * 2)
    ctx.fill()
  }
}
