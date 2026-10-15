import { DANGER_Y, fruit, WORLD_H, WORLD_W } from './fruits'
import { FRUIT_INK } from './art'

/**
 * The glass jar, drawn in world units (callers set world -> pixels with fitWorld first).
 * The canvas holds the world box plus a little room on the sides for the glass and above
 * it for the rim and the dropper's claw.
 */

export const GLASS_INK = '#2C3A4A'
const WALL = 12
const SIDE = WALL + 16
const TOP = 70
const BOTTOM = WALL + 6
const CORNER = 70
/** The jar's neck band (in the player's color) and the glass lip above it. */
const BAND_Y0 = -34
const BAND_Y1 = -4
const LIP_Y0 = -50

/** Width / height of a canvas that holds the whole jar. */
export const JAR_ASPECT = (WORLD_W + SIDE * 2) / (TOP + WORLD_H + BOTTOM)

/** World -> pixel mapping for a box of w x h: jar centered, floor on the bottom edge. */
export function worldMap(w: number, h: number) {
  const s = Math.min(w / (WORLD_W + SIDE * 2), h / (TOP + WORLD_H + BOTTOM))
  return { s, ox: (w - WORLD_W * s) / 2, oy: h - (WORLD_H + BOTTOM) * s }
}

export function fitWorld(ctx: CanvasRenderingContext2D, pxW: number, pxH: number) {
  const m = worldMap(pxW, pxH)
  ctx.setTransform(m.s, 0, 0, m.s, m.ox, m.oy)
  return m
}

function bodyPath(ctx: CanvasRenderingContext2D, inset = 0) {
  const l = -WALL / 2 + inset
  const r = WORLD_W + WALL / 2 - inset
  const b = WORLD_H + WALL / 2 - inset
  const t = BAND_Y1
  ctx.beginPath()
  ctx.moveTo(l, t)
  ctx.lineTo(l, b - CORNER)
  ctx.quadraticCurveTo(l, b, l + CORNER, b)
  ctx.lineTo(r - CORNER, b)
  ctx.quadraticCurveTo(r, b, r, b - CORNER)
  ctx.lineTo(r, t)
}

/** Glass interior: a pale tint so the jar reads against the stand. */
export function drawJarBack(ctx: CanvasRenderingContext2D) {
  bodyPath(ctx)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 0, WORLD_W, 0)
  g.addColorStop(0, 'rgba(214, 244, 255, 0.78)')
  g.addColorStop(0.5, 'rgba(236, 251, 255, 0.62)')
  g.addColorStop(1, 'rgba(196, 232, 248, 0.8)')
  ctx.fillStyle = g
  ctx.fill()
  // floor shadow inside the glass
  ctx.save()
  bodyPath(ctx)
  ctx.closePath()
  ctx.clip()
  const f = ctx.createLinearGradient(0, WORLD_H - 90, 0, WORLD_H)
  f.addColorStop(0, 'rgba(120, 170, 200, 0)')
  f.addColorStop(1, 'rgba(120, 170, 200, 0.35)')
  ctx.fillStyle = f
  ctx.fillRect(-WALL, WORLD_H - 90, WORLD_W + WALL * 2, 100)
  ctx.restore()
}

export interface JarLook {
  /** The player's color for the neck band. */
  color: string
  /** 0..1 how close this jar is to spilling. */
  danger?: number
  /** 0..1 pulse phase for the danger glow. */
  pulse?: number
  /** Draw cracks (the jar spilled). */
  cracked?: boolean
  /** White flash over the glass (big fruit moments), 0..1. */
  flash?: number
}

function crack(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y)
}

export function drawJarFront(ctx: CanvasRenderingContext2D, look: JarLook) {
  const danger = look.danger ?? 0
  const pulse = look.pulse ?? 0
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Danger line: calm dashes, or a red glow that pulses when fruit sits above it.
  if (danger > 0) {
    ctx.strokeStyle = '#FF2D3D'
    ctx.globalAlpha = (0.25 + 0.35 * pulse) * Math.min(1, 0.4 + danger)
    ctx.lineWidth = 26 + 14 * pulse
    ctx.beginPath()
    ctx.moveTo(4, DANGER_Y)
    ctx.lineTo(WORLD_W - 4, DANGER_Y)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = 8
    ctx.strokeStyle = pulse > 0.5 ? '#FFFFFF' : '#FF2D3D'
    ctx.setLineDash([26, 14])
  } else {
    ctx.globalAlpha = 0.75
    ctx.lineWidth = 5
    ctx.strokeStyle = '#FF5A5F'
    ctx.setLineDash([18, 16])
  }
  ctx.beginPath()
  ctx.moveTo(10, DANGER_Y)
  ctx.lineTo(WORLD_W - 10, DANGER_Y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // Glass streaks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  roundRect(ctx, 16, 70, 18, WORLD_H - 230, 9)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  roundRect(ctx, 44, 90, 9, 240, 5)
  ctx.fill()
  roundRect(ctx, 44, 350, 9, 40, 5)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  roundRect(ctx, WORLD_W - 36, 140, 12, WORLD_H - 360, 6)
  ctx.fill()
  // a curved shine along the bottom
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(60, WORLD_H - 22)
  ctx.quadraticCurveTo(WORLD_W / 2, WORLD_H - 10, WORLD_W - 140, WORLD_H - 22)
  ctx.stroke()

  if (look.flash && look.flash > 0) {
    bodyPath(ctx)
    ctx.closePath()
    ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * look.flash})`
    ctx.fill()
  }

  if (look.cracked) {
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 7
    const a = [[WORLD_W * 0.62, WORLD_H * 0.4], [WORLD_W * 0.7, WORLD_H * 0.5], [WORLD_W * 0.64, WORLD_H * 0.58], [WORLD_W * 0.78, WORLD_H * 0.72]]
    const b = [[WORLD_W * 0.7, WORLD_H * 0.5], [WORLD_W * 0.86, WORLD_H * 0.47], [WORLD_W + 4, WORLD_H * 0.52]]
    const c = [[WORLD_W * 0.64, WORLD_H * 0.58], [WORLD_W * 0.5, WORLD_H * 0.64], [WORLD_W * 0.42, WORLD_H * 0.6]]
    const d = [[WORLD_W * 0.62, WORLD_H * 0.4], [WORLD_W * 0.55, WORLD_H * 0.3], [WORLD_W * 0.58, WORLD_H * 0.2]]
    for (const p of [a, b, c, d]) { crack(ctx, p); ctx.strokeStyle = GLASS_INK; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.stroke() }
  }

  // The glass outline
  bodyPath(ctx)
  ctx.strokeStyle = GLASS_INK
  ctx.lineWidth = 9
  ctx.stroke()
  bodyPath(ctx, 9)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.lineWidth = 3
  ctx.stroke()

  // Neck band in the player's color, with thread lines
  const bl = -WALL / 2 - 10
  const br = WORLD_W + WALL / 2 + 10
  roundRect(ctx, bl, BAND_Y0, br - bl, BAND_Y1 - BAND_Y0, 8)
  ctx.fillStyle = look.color
  ctx.fill()
  ctx.strokeStyle = GLASS_INK
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
  ctx.lineWidth = 4
  ctx.beginPath()
  for (const y of [BAND_Y0 + 11, BAND_Y0 + 21]) {
    ctx.moveTo(bl + 10, y)
    ctx.lineTo(br - 10, y)
  }
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  roundRect(ctx, bl + 14, BAND_Y0 + 4, 60, 6, 3)
  ctx.fill()
  // Glass lip above the band
  roundRect(ctx, bl - 4, LIP_Y0, br - bl + 8, BAND_Y0 - LIP_Y0 + 4, 8)
  ctx.fillStyle = 'rgba(225, 248, 255, 0.95)'
  ctx.fill()
  ctx.strokeStyle = GLASS_INK
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Where a fruit of radius r dropped at x first touches: the floor or the top of a fruit under it. */
export function landingY(x: number, r: number, fruits: readonly { x: number; y: number; r: number }[]): number {
  let y = WORLD_H - r
  for (const f of fruits) {
    const dx = Math.abs(x - f.x)
    const rr = r + f.r
    if (dx >= rr) continue
    const top = f.y - Math.sqrt(rr * rr - dx * dx)
    if (top < y) y = top
  }
  return y
}

/** The aim guide: a dashed line from the held fruit to where it lands, and a ghost ring there. */
export function drawGuide(ctx: CanvasRenderingContext2D, x: number, fromY: number, toY: number, r: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.setLineDash([2, 16])
  ctx.beginPath()
  ctx.moveTo(x, fromY)
  ctx.lineTo(x, Math.max(fromY, toY - r))
  ctx.stroke()
  ctx.setLineDash([12, 10])
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(x, toY, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/**
 * The dropper: a claw on a rope from the top of the canvas. `open` 0 grips a fruit of
 * radius r at (x, y); 1 is wide open (just let go).
 */
export function drawClaw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, open: number, color: string) {
  const top = -TOP - 10
  const head = y - r - 26
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // rope
  ctx.strokeStyle = GLASS_INK
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.lineTo(x, head)
  ctx.stroke()
  ctx.strokeStyle = '#F4E3C1'
  ctx.lineWidth = 5
  ctx.stroke()
  // arms
  const spread = r * (0.82 + 0.4 * open) + 8
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + s * 14, head + 10)
    ctx.quadraticCurveTo(x + s * (spread + 14), head + 8, x + s * spread, y - r * 0.15 + open * -r * 0.4)
    ctx.strokeStyle = FRUIT_INK
    ctx.lineWidth = 15
    ctx.stroke()
    ctx.strokeStyle = '#C9D3DE'
    ctx.lineWidth = 8
    ctx.stroke()
  }
  // head
  ctx.beginPath()
  ctx.roundRect(x - 28, head - 14, 56, 30, 12)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = FRUIT_INK
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.beginPath()
  ctx.roundRect(x - 20, head - 9, 22, 6, 3)
  ctx.fill()
  ctx.restore()
}

/** Danger from a jar picture alone (bots send no danger): 0 below the line, 1 well above it. */
export function dangerOf(fruits: readonly { t: number; y: number }[]): number {
  let top = Infinity
  for (const f of fruits) top = Math.min(top, f.y - fruit(f.t).r)
  if (!Number.isFinite(top)) return 0
  return Math.max(0, Math.min(1, (DANGER_Y + 30 - top) / 90))
}
