import { AIM_MAX_DEG, ARROWS_Y, BALL_R, HEAD, KICK, LANE_HALF, PIN_R, PIT_Y, START_HALF, pinSpot } from './sim'
import { COLORS } from './lane3d'

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

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string) {
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
}

export function drawPad(ctx: CanvasRenderingContext2D, m: PadMap, sc: PadScene) {
  const S = (x: number, y: number) => toScreen(m, x, y)
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, m.w, m.h)

  // Lane: approach, gutters, boards, foul line, arrows.
  poly(ctx, [S(-KICK - 4, -70), S(KICK + 4, -70), S(KICK + 4, 0), S(-KICK - 4, 0)], COLORS.approach)
  poly(ctx, [S(-KICK, 0), S(KICK, 0), S(KICK, DECK_FROM), S(-KICK, DECK_FROM)], COLORS.gutter)
  poly(ctx, [S(-LANE_HALF, 0), S(LANE_HALF, 0), S(LANE_HALF, DECK_FROM), S(-LANE_HALF, DECK_FROM)], COLORS.lane)
  ctx.lineWidth = 1
  for (let b = 1; b < 39; b++) {
    const bx = -LANE_HALF + (b * 2 * LANE_HALF) / 39
    const a = S(bx, 0)
    const z = S(bx, DECK_FROM)
    ctx.strokeStyle = b % 5 === 0 ? 'rgba(120, 72, 30, 0.32)' : 'rgba(120, 72, 30, 0.14)'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(z.x, z.y)
    ctx.stroke()
  }
  poly(ctx, [S(-LANE_HALF, 0), S(LANE_HALF, 0), S(LANE_HALF, 1.6), S(-LANE_HALF, 1.6)], COLORS.foul)
  for (let k = 1; k <= 7; k++) {
    const bx = -LANE_HALF + ((k * 5 - 0.5) * 2 * LANE_HALF) / 39
    const ay = ARROWS_Y + Math.abs(4 - k) * 3
    poly(ctx, [S(bx, ay + 14), S(bx + 1.1, ay), S(bx - 1.1, ay)], COLORS.arrow)
  }

  // The blown-up deck, tied to the end of the lane with two thin lines.
  const d = m.deck
  const endL = S(-KICK, DECK_FROM)
  const endR = S(KICK, DECK_FROM)
  ctx.strokeStyle = '#3A4380'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(endL.x, endL.y)
  ctx.lineTo(d.x, d.y + d.h)
  ctx.moveTo(endR.x, endR.y)
  ctx.lineTo(d.x + d.w, d.y + d.h)
  ctx.stroke()
  ctx.fillStyle = COLORS.gutter
  ctx.fillRect(d.x, d.y, d.w, d.h)
  const dl = S(-LANE_HALF, DECK_FROM + 0.01)
  const pit = S(LANE_HALF, PIT_Y)
  ctx.fillStyle = COLORS.deck
  ctx.fillRect(dl.x, pit.y, pit.x - dl.x, dl.y - pit.y)
  ctx.fillStyle = COLORS.pit
  ctx.fillRect(d.x, d.y, d.w, pit.y - d.y)
  ctx.strokeStyle = '#3A4380'
  ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1)

  // Pins: top-down, white with the red band as a ring. Down ones as faint spots.
  const rowGap = 12 * Math.sin(Math.PI / 3) * d.iy
  const pr = Math.max(5, Math.min(PIN_R * d.ix * 1.15, rowGap * 0.46))
  for (let id = 1; id <= 10; id++) {
    const sp = pinSpot(id)
    const p = S(sp.x, sp.y)
    if (!sc.standing.includes(id)) {
      ctx.strokeStyle = 'rgba(120, 72, 30, 0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, pr * 0.45, 0, Math.PI * 2)
      ctx.stroke()
      continue
    }
    ctx.fillStyle = COLORS.pin
    ctx.beginPath()
    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = COLORS.pinBand
    ctx.lineWidth = Math.max(2, pr * 0.28)
    ctx.beginPath()
    ctx.arc(p.x, p.y, pr * 0.52, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Aim line: where a straight ball goes, down the lane and on through the deck.
  const bx = sc.x * START_HALF
  const tan = Math.tan((sc.aim * AIM_MAX_DEG * Math.PI) / 180)
  ctx.fillStyle = sc.color
  for (let yy = 30; yy < DECK_FROM - 6; yy += 34) {
    const p = S(bx + tan * yy, yy)
    ctx.globalAlpha = 0.9 - (yy / HEAD) * 0.4
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.8, p.s * 1.1), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
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
  // The ball's width where it meets the head pin.
  const hp1 = S(bx + tan * HEAD, HEAD)
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.arc(hp1.x, hp1.y, BALL_R * d.ix, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Aim handle.
  const hp = handleScreen(m, sc.x, sc.aim)
  const hr = 22
  ctx.fillStyle = sc.active === 'aim' ? sc.color : 'rgba(12, 17, 48, 0.85)'
  ctx.beginPath()
  ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = sc.color
  ctx.stroke()
  const ink = sc.active === 'aim' ? COLORS.bg : '#E8ECFF'
  poly(ctx, [{ x: hp.x - 15, y: hp.y }, { x: hp.x - 6, y: hp.y - 7 }, { x: hp.x - 6, y: hp.y + 7 }], ink)
  poly(ctx, [{ x: hp.x + 15, y: hp.y }, { x: hp.x + 6, y: hp.y - 7 }, { x: hp.x + 6, y: hp.y + 7 }], ink)

  // Swipe trail.
  if (sc.trail && sc.trail.length > 1) {
    ctx.strokeStyle = sc.color
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.moveTo(sc.trail[0].x, sc.trail[0].y)
    for (const p of sc.trail) ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Ball.
  const home = ballScreen(m, sc.x)
  const b = sc.held ?? home
  const br = Math.max(14, BALL_R * home.s * 1.2)
  ctx.fillStyle = sc.color
  ctx.beginPath()
  ctx.arc(b.x, b.y, br, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = sc.active === 'move' ? 4 : 2
  ctx.strokeStyle = sc.active === 'move' ? '#E8ECFF' : 'rgba(12, 17, 48, 0.6)'
  ctx.stroke()
  ctx.fillStyle = COLORS.hole
  for (const [dx, dy, rr] of [[-0.24, -0.18, 0.13], [0.24, -0.18, 0.13], [0, 0.22, 0.15]] as const) {
    ctx.beginPath()
    ctx.arc(b.x + dx * br, b.y + dy * br, rr * br, 0, Math.PI * 2)
    ctx.fill()
  }
}
