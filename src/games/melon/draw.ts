import { DANGER_Y, fruit, WORLD_H, WORLD_W } from './fruits'

/**
 * Canvas drawing shared by the phone jar and the TV jars. Everything is in world units;
 * callers set the transform (world -> pixels) first.
 */

export const JAR = {
  ground: '#131A42',
  inside: '#0F1538',
  line: '#3A4580',
  accent: '#FF6B3D',
}

const LIP = 36
const WALL = 10
const CORNER = 34

/** Rounded vessel: open top, walls hugging the world box. */
export function drawJarBack(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = JAR.inside
  ctx.beginPath()
  ctx.moveTo(0, LIP)
  ctx.lineTo(0, WORLD_H - CORNER)
  ctx.quadraticCurveTo(0, WORLD_H, CORNER, WORLD_H)
  ctx.lineTo(WORLD_W - CORNER, WORLD_H)
  ctx.quadraticCurveTo(WORLD_W, WORLD_H, WORLD_W, WORLD_H - CORNER)
  ctx.lineTo(WORLD_W, LIP)
  ctx.closePath()
  ctx.fill()
}

export function drawJarFront(ctx: CanvasRenderingContext2D, danger = 0, pulse = 0) {
  // Walls
  ctx.strokeStyle = JAR.line
  ctx.lineWidth = WALL
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-WALL / 2, LIP)
  ctx.lineTo(-WALL / 2, WORLD_H - CORNER)
  ctx.quadraticCurveTo(-WALL / 2, WORLD_H + WALL / 2, CORNER, WORLD_H + WALL / 2)
  ctx.lineTo(WORLD_W - CORNER, WORLD_H + WALL / 2)
  ctx.quadraticCurveTo(WORLD_W + WALL / 2, WORLD_H + WALL / 2, WORLD_W + WALL / 2, WORLD_H - CORNER)
  ctx.lineTo(WORLD_W + WALL / 2, LIP)
  ctx.stroke()
  // Lip
  ctx.beginPath()
  ctx.moveTo(-WALL * 1.6, LIP)
  ctx.lineTo(WALL * 0.6, LIP)
  ctx.moveTo(WORLD_W - WALL * 0.6, LIP)
  ctx.lineTo(WORLD_W + WALL * 1.6, LIP)
  ctx.stroke()
  // Danger line
  ctx.save()
  ctx.strokeStyle = JAR.accent
  ctx.globalAlpha = danger > 0 ? 0.55 + 0.45 * pulse : 0.7
  ctx.lineWidth = danger > 0 ? 6 : 4
  ctx.setLineDash([18, 14])
  ctx.beginPath()
  ctx.moveTo(8, DANGER_Y)
  ctx.lineTo(WORLD_W - 8, DANGER_Y)
  ctx.stroke()
  ctx.restore()
}

const PAD = WALL * 1.6
/** Width / height of a canvas that holds the whole jar. */
export const JAR_ASPECT = (WORLD_W + PAD * 2) / (WORLD_H + PAD)

/** World -> pixel mapping for a box of w x h: jar centered, floor on the bottom edge. */
export function worldMap(w: number, h: number) {
  const s = Math.min(w / (WORLD_W + PAD * 2), h / (WORLD_H + PAD))
  return { s, ox: (w - WORLD_W * s) / 2, oy: h - (WORLD_H + WALL) * s }
}

export function fitWorld(ctx: CanvasRenderingContext2D, pxW: number, pxH: number) {
  const m = worldMap(pxW, pxH)
  ctx.setTransform(m.s, 0, 0, m.s, m.ox, m.oy)
  return m
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

/** A flat fruit: color disc, one detail, darker outline. (x, y) center, r radius. */
export function drawFruit(ctx: CanvasRenderingContext2D, tier: number, x: number, y: number, r: number, angle = 0, alpha = 1) {
  const f = fruit(tier)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(angle)
  const lw = Math.max(2, r * 0.07)

  if (tier === 1) {
    // cherry stem (drawn first so the fruit overlaps its base)
    ctx.strokeStyle = f.detail
    ctx.lineWidth = Math.max(2.5, r * 0.16)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.7)
    ctx.quadraticCurveTo(r * 0.15, -r * 1.25, r * 0.6, -r * 1.35)
    ctx.stroke()
  }

  circle(ctx, 0, 0, r - lw / 2)
  ctx.fillStyle = f.color
  ctx.fill()

  ctx.save()
  circle(ctx, 0, 0, r - lw / 2)
  ctx.clip()
  switch (tier) {
    case 2: {
      // strawberry seeds
      ctx.fillStyle = f.detail
      const seeds = [[-0.4, -0.25], [0.05, -0.4], [0.45, -0.15], [-0.15, 0.1], [0.3, 0.3], [-0.45, 0.35], [0.0, 0.55]]
      for (const [sx, sy] of seeds) {
        ctx.beginPath()
        ctx.ellipse(sx * r, sy * r, r * 0.07, r * 0.1, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 3: {
      // grape cluster bumps
      ctx.strokeStyle = f.dark
      ctx.fillStyle = f.detail
      ctx.lineWidth = Math.max(1.5, r * 0.05)
      const bumps = [[-0.38, -0.32], [0.22, -0.42], [0.45, 0.12], [-0.05, 0.08], [-0.45, 0.32], [0.12, 0.5]]
      for (const [bx, by] of bumps) {
        circle(ctx, bx * r, by * r, r * 0.3)
        ctx.globalAlpha = alpha * 0.55
        ctx.fill()
        ctx.globalAlpha = alpha * 0.6
        ctx.stroke()
      }
      ctx.globalAlpha = alpha
      break
    }
    case 4: {
      // orange dimple
      ctx.fillStyle = f.detail
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.62, r * 0.13, r * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 8: {
      // peach crease
      ctx.strokeStyle = f.detail
      ctx.lineWidth = Math.max(2, r * 0.06)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-r * 0.1, -r * 0.95)
      ctx.quadraticCurveTo(-r * 0.5, 0, -r * 0.1, r * 0.95)
      ctx.stroke()
      break
    }
    case 9: {
      // pineapple crosshatch
      ctx.strokeStyle = f.detail
      ctx.lineWidth = Math.max(2, r * 0.035)
      const g = r * 0.42
      ctx.beginPath()
      for (let k = -3; k <= 3; k++) {
        ctx.moveTo(k * g - r, -r)
        ctx.lineTo(k * g + r, r)
        ctx.moveTo(k * g + r, -r)
        ctx.lineTo(k * g - r, r)
      }
      ctx.stroke()
      break
    }
    case 10: {
      // melon stripes
      ctx.strokeStyle = f.detail
      ctx.lineWidth = Math.max(2, r * 0.05)
      ctx.beginPath()
      for (const k of [-0.6, -0.2, 0.2, 0.6]) {
        ctx.moveTo(k * r, -r)
        ctx.quadraticCurveTo(k * r * 1.7, 0, k * r, r)
      }
      ctx.stroke()
      break
    }
    case 11: {
      // watermelon stripes
      ctx.fillStyle = f.detail
      for (const k of [-0.66, -0.22, 0.22, 0.66]) {
        ctx.beginPath()
        ctx.moveTo(k * r - r * 0.07, -r)
        ctx.quadraticCurveTo(k * r * 1.6 - r * 0.12, 0, k * r - r * 0.07, r)
        ctx.lineTo(k * r + r * 0.07, r)
        ctx.quadraticCurveTo(k * r * 1.6 + r * 0.12, 0, k * r + r * 0.07, -r)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
  }
  ctx.restore()

  // details that sit on top, outside the clip
  if (tier === 5) {
    // persimmon calyx
    ctx.fillStyle = f.detail
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4
      ctx.beginPath()
      ctx.ellipse(Math.cos(a) * r * 0.15, -r * 0.7 + Math.sin(a) * r * 0.09, r * 0.17, r * 0.075, a, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (tier === 6) {
    // apple leaf
    ctx.fillStyle = f.detail
    ctx.beginPath()
    ctx.ellipse(r * 0.22, -r * 0.86, r * 0.26, r * 0.12, -0.5, 0, Math.PI * 2)
    ctx.fill()
  } else if (tier === 7) {
    // pear stem
    ctx.strokeStyle = f.detail
    ctx.lineWidth = Math.max(3, r * 0.08)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.8)
    ctx.quadraticCurveTo(r * 0.05, -r * 1.05, r * 0.2, -r * 1.15)
    ctx.stroke()
  }

  // outline
  circle(ctx, 0, 0, r - lw / 2)
  ctx.strokeStyle = f.dark
  ctx.lineWidth = lw
  ctx.globalAlpha = alpha * 0.75
  ctx.stroke()
  ctx.restore()
}

/** Faint guide from the held fruit down to the floor. */
export function drawGuide(ctx: CanvasRenderingContext2D, x: number, fromY: number) {
  ctx.save()
  ctx.strokeStyle = '#E8ECFF'
  ctx.globalAlpha = 0.14
  ctx.lineWidth = 3
  ctx.setLineDash([6, 10])
  ctx.beginPath()
  ctx.moveTo(x, fromY)
  ctx.lineTo(x, WORLD_H - 4)
  ctx.stroke()
  ctx.restore()
}
