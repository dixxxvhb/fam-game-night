import { fruit } from './fruits'

/**
 * Melon's fruit art: eleven sticker-style fruit with faces, drawn in canvas once per
 * (tier, mood, pixel size) and cached, so a jar full of fruit is just drawImage calls.
 * Everything here draws around (0, 0) in pixels; blitFruit maps a sprite into world units.
 */

export type Mood = 'calm' | 'pop' | 'worried' | 'dizzy' | 'happy'

/** The one outline ink for every fruit, stem and leaf (warm, so it reads as a sticker). */
export const FRUIT_INK = '#3B2216'
const FACE = '#2A1408'
const LEAF = '#4FB548'
const LEAF_DARK = '#2F8A34'
const STEM = '#8A5A2B'

interface Look { base: string; shade: string; accent: string }

/** Brighter, sunnier versions of the ladder colors, plus a shade and an accent each. */
export const LOOKS: Look[] = [
  { base: '#F2304F', shade: '#B9173A', accent: '#FF8FA0' }, // cherry
  { base: '#FF5468', shade: '#D52845', accent: '#FFE27A' }, // strawberry
  { base: '#9B6BFF', shade: '#6C3FD6', accent: '#C9AEFF' }, // grape
  { base: '#FFA41F', shade: '#E37A0B', accent: '#FFC861' }, // dekopon
  { base: '#FF7A2E', shade: '#D9501A', accent: '#FFB070' }, // persimmon
  { base: '#F23B3B', shade: '#BF1F2A', accent: '#FF8B7E' }, // apple
  { base: '#D9E35A', shade: '#AFBD32', accent: '#B7893F' }, // pear
  { base: '#FFB7A0', shade: '#F48A79', accent: '#FF7F88' }, // peach
  { base: '#FFD23A', shade: '#E7A314', accent: '#C9821A' }, // pineapple
  { base: '#B6EB86', shade: '#86C95C', accent: '#F4FFE6' }, // melon
  { base: '#35B45A', shade: '#1F8540', accent: '#16592C' }, // watermelon
]

export function look(tier: number): Look {
  return LOOKS[Math.max(1, Math.min(11, Math.round(tier))) - 1]
}

/** Little deterministic random so the melon's net and the seeds never shimmer between sizes. */
function rnd(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------- shapes ----------------

function bodyPath(ctx: CanvasRenderingContext2D, tier: number, r: number) {
  ctx.beginPath()
  if (tier === 2) {
    // strawberry: round shoulders, soft point at the bottom
    ctx.moveTo(0, -r * 0.92)
    ctx.bezierCurveTo(r * 0.75, -r * 1.02, r * 1.08, -r * 0.45, r * 0.95, r * 0.12)
    ctx.bezierCurveTo(r * 0.82, r * 0.62, r * 0.32, r * 1.02, 0, r * 1.04)
    ctx.bezierCurveTo(-r * 0.32, r * 1.02, -r * 0.82, r * 0.62, -r * 0.95, r * 0.12)
    ctx.bezierCurveTo(-r * 1.08, -r * 0.45, -r * 0.75, -r * 1.02, 0, -r * 0.92)
    ctx.closePath()
  } else if (tier === 7) {
    // pear: a round base with a narrower top
    ctx.moveTo(0, -r * 1.02)
    ctx.bezierCurveTo(r * 0.45, -r * 1.02, r * 0.5, -r * 0.55, r * 0.72, -r * 0.3)
    ctx.bezierCurveTo(r * 1.05, r * 0.02, r * 1.02, r * 0.98, 0, r * 1.0)
    ctx.bezierCurveTo(-r * 1.02, r * 0.98, -r * 1.05, r * 0.02, -r * 0.72, -r * 0.3)
    ctx.bezierCurveTo(-r * 0.5, -r * 0.55, -r * 0.45, -r * 1.02, 0, -r * 1.02)
    ctx.closePath()
  } else if (tier === 5) {
    // persimmon: a little squat
    ctx.ellipse(0, r * 0.04, r * 1.0, r * 0.94, 0, 0, Math.PI * 2)
  } else if (tier === 6) {
    // apple: a notch at the top
    ctx.moveTo(0, -r * 0.78)
    ctx.bezierCurveTo(r * 0.3, -r * 1.08, r * 1.02, -r * 0.98, r * 1.0, -r * 0.05)
    ctx.bezierCurveTo(r * 0.98, r * 0.7, r * 0.55, r * 1.02, 0, r * 0.94)
    ctx.bezierCurveTo(-r * 0.55, r * 1.02, -r * 0.98, r * 0.7, -r * 1.0, -r * 0.05)
    ctx.bezierCurveTo(-r * 1.02, -r * 0.98, -r * 0.3, -r * 1.08, 0, -r * 0.78)
    ctx.closePath()
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2)
  }
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, lw: number, fill = LEAF) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0)
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = lw
  ctx.strokeStyle = FRUIT_INK
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(len * 0.12, 0)
  ctx.lineTo(len * 0.75, 0)
  ctx.strokeStyle = LEAF_DARK
  ctx.lineWidth = lw * 0.6
  ctx.stroke()
  ctx.restore()
}

/** A stem: ink stroke under a colored stroke, so it is outlined like everything else. */
function stem(ctx: CanvasRenderingContext2D, pts: [number, number, number, number, number, number], w: number, lw: number, color = STEM) {
  const [x0, y0, cx, cy, x1, y1] = pts
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(cx, cy, x1, y1)
  ctx.strokeStyle = FRUIT_INK
  ctx.lineWidth = w + lw * 2
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.stroke()
}

/** Things that sit behind the body (crowns, stems that grow out of it). */
function drawBehind(ctx: CanvasRenderingContext2D, tier: number, r: number, lw: number) {
  switch (tier) {
    case 1:
      stem(ctx, [0, -r * 0.6, r * 0.1, -r * 1.3, r * 0.62, -r * 1.48], Math.max(1.5, r * 0.13), lw * 0.7, '#3E8E2C')
      leaf(ctx, r * 0.5, -r * 1.4, r * 0.7, -0.25, lw * 0.7)
      break
    case 4: {
      // dekopon's knob, part of the silhouette
      const l = look(4)
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.88, r * 0.3, r * 0.24, 0, 0, Math.PI * 2)
      ctx.fillStyle = l.base
      ctx.fill()
      ctx.lineWidth = lw
      ctx.strokeStyle = FRUIT_INK
      ctx.stroke()
      break
    }
    case 9: {
      // pineapple crown
      const blades: [number, number][] = [[-0.62, -1.2], [0.62, -1.2], [-0.3, -1.48], [0.3, -1.48], [0, -1.62]]
      for (const [bx, by] of blades) {
        ctx.beginPath()
        ctx.moveTo(bx * r * 0.4 - r * 0.24, -r * 0.72)
        ctx.quadraticCurveTo(bx * r * 0.5 - r * 0.2, (by + 0.45) * r, bx * r, by * r)
        ctx.quadraticCurveTo(bx * r * 0.5 + r * 0.2, (by + 0.45) * r, bx * r * 0.4 + r * 0.24, -r * 0.72)
        ctx.closePath()
        ctx.fillStyle = bx === 0 ? LEAF : '#3FA63F'
        ctx.fill()
        ctx.lineWidth = lw
        ctx.strokeStyle = FRUIT_INK
        ctx.stroke()
      }
      break
    }
  }
}

/** Pattern inside the body (clipped to it). */
function drawSkin(ctx: CanvasRenderingContext2D, tier: number, r: number, lw: number) {
  const l = look(tier)
  switch (tier) {
    case 2: {
      ctx.fillStyle = l.accent
      const seeds = [[-0.45, -0.25], [0.0, -0.42], [0.45, -0.25], [-0.62, 0.15], [0.62, 0.15], [-0.25, 0.55], [0.25, 0.55], [0, 0.82]]
      for (const [sx, sy] of seeds) {
        ctx.beginPath()
        ctx.ellipse(sx * r, sy * r, r * 0.06, r * 0.09, sx * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 3: {
      ctx.fillStyle = l.accent
      ctx.globalAlpha = 0.45
      for (const [bx, by, br] of [[-0.42, -0.4, 0.3], [0.2, -0.55, 0.28], [0.55, -0.05, 0.28], [-0.62, 0.22, 0.26], [0.38, 0.55, 0.26], [-0.18, 0.66, 0.26]]) {
        ctx.beginPath()
        ctx.arc(bx * r, by * r, br * r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      break
    }
    case 4:
    case 5: {
      ctx.fillStyle = l.shade
      ctx.globalAlpha = 0.35
      const R = rnd(tier * 97)
      for (let k = 0; k < 16; k++) {
        const a = R() * Math.PI * 2
        const d = Math.sqrt(R()) * r * 0.85
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.6, r * 0.03), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      break
    }
    case 7: {
      ctx.fillStyle = l.accent
      ctx.globalAlpha = 0.5
      const R = rnd(71)
      for (let k = 0; k < 14; k++) {
        const a = R() * Math.PI * 2
        const d = Math.sqrt(R()) * r * 0.85
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d + r * 0.1, Math.max(0.6, r * 0.028), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      break
    }
    case 8: {
      // peach blush on one side and the crease
      const g = ctx.createRadialGradient(r * 0.45, r * 0.15, 0, r * 0.45, r * 0.15, r * 0.95)
      g.addColorStop(0, 'rgba(255, 95, 120, 0.55)')
      g.addColorStop(1, 'rgba(255, 95, 120, 0)')
      ctx.fillStyle = g
      ctx.fillRect(-r, -r, r * 2, r * 2)
      ctx.strokeStyle = l.shade
      ctx.lineWidth = Math.max(1.2, r * 0.06)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-r * 0.05, -r * 0.92)
      ctx.quadraticCurveTo(-r * 0.42, -r * 0.1, -r * 0.18, r * 0.72)
      ctx.stroke()
      break
    }
    case 9: {
      ctx.strokeStyle = l.accent
      ctx.lineWidth = Math.max(1, r * 0.04)
      const g = r * 0.4
      ctx.beginPath()
      for (let k = -4; k <= 4; k++) {
        ctx.moveTo(k * g - r, -r)
        ctx.lineTo(k * g + r, r)
        ctx.moveTo(k * g + r, -r)
        ctx.lineTo(k * g - r, r)
      }
      ctx.stroke()
      ctx.fillStyle = l.accent
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          const x = (i + j) * g * 0.5
          const y = (j - i) * g * 0.5
          if (x * x + y * y > r * r) continue
          ctx.beginPath()
          ctx.arc(x, y + g * 0.0, Math.max(0.7, r * 0.03), 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 10: {
      // netted rind
      ctx.strokeStyle = l.accent
      ctx.globalAlpha = 0.85
      ctx.lineWidth = Math.max(1, r * 0.028)
      ctx.lineCap = 'round'
      const R = rnd(1010)
      ctx.beginPath()
      for (let k = 0; k < 26; k++) {
        let x = (R() * 2 - 1) * r
        let y = (R() * 2 - 1) * r
        ctx.moveTo(x, y)
        for (let s = 0; s < 3; s++) {
          x += (R() * 2 - 1) * r * 0.3
          y += (R() * 2 - 1) * r * 0.3
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
    case 11: {
      // zigzag stripes
      ctx.fillStyle = l.accent
      for (const k of [-0.8, -0.4, 0, 0.4, 0.8]) {
        ctx.beginPath()
        const w = r * 0.09
        const steps = 8
        ctx.moveTo(k * r - w, -r * 1.05)
        for (let i = 1; i <= steps; i++) {
          const y = -r * 1.05 + (i * r * 2.1) / steps
          const bend = k * r * (1 - ((y / r) ** 2) * 0.25) * 0.15
          ctx.lineTo(k * r + bend + (i % 2 ? -w * 1.6 : -w * 0.6), y)
        }
        for (let i = steps; i >= 0; i--) {
          const y = -r * 1.05 + (i * r * 2.1) / steps
          const bend = k * r * (1 - ((y / r) ** 2) * 0.25) * 0.15
          ctx.lineTo(k * r + bend + (i % 2 ? w * 0.6 : w * 1.6), y)
        }
        ctx.closePath()
        ctx.fill()
      }
      break
    }
  }
  void lw
}

/** Things that sit on top of the body (calyx, stems, leaves). */
function drawTop(ctx: CanvasRenderingContext2D, tier: number, r: number, lw: number) {
  switch (tier) {
    case 2: {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.62
        leaf(ctx, 0, -r * 0.82, r * 0.42, a + Math.PI, lw * 0.8)
      }
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.88, r * 0.12, r * 0.1, 0, 0, Math.PI * 2)
      ctx.fillStyle = LEAF
      ctx.fill()
      ctx.strokeStyle = FRUIT_INK
      ctx.lineWidth = lw * 0.8
      ctx.stroke()
      break
    }
    case 3:
      stem(ctx, [0, -r * 0.8, -r * 0.05, -r * 1.05, r * 0.15, -r * 1.2], Math.max(1.5, r * 0.12), lw * 0.7)
      leaf(ctx, r * 0.08, -r * 0.98, r * 0.55, -0.5, lw * 0.7)
      break
    case 4:
      leaf(ctx, r * 0.05, -r * 1.02, r * 0.5, -0.4, lw * 0.8)
      break
    case 5: {
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2
        ctx.save()
        ctx.translate(0, -r * 0.78)
        ctx.scale(1, 0.55)
        leaf(ctx, 0, 0, r * 0.42, a, lw * 0.9, '#5E9E35')
        ctx.restore()
      }
      ctx.beginPath()
      ctx.arc(0, -r * 0.8, r * 0.09, 0, Math.PI * 2)
      ctx.fillStyle = STEM
      ctx.fill()
      ctx.strokeStyle = FRUIT_INK
      ctx.lineWidth = lw * 0.7
      ctx.stroke()
      break
    }
    case 6:
      stem(ctx, [0, -r * 0.72, r * 0.02, -r * 1.0, r * 0.14, -r * 1.18], Math.max(1.5, r * 0.09), lw * 0.7)
      leaf(ctx, r * 0.1, -r * 0.94, r * 0.55, -0.35, lw * 0.8)
      break
    case 7:
      stem(ctx, [0, -r * 0.95, r * 0.04, -r * 1.18, r * 0.2, -r * 1.3], Math.max(1.5, r * 0.08), lw * 0.7)
      leaf(ctx, r * 0.06, -r * 1.12, r * 0.45, -2.6, lw * 0.8)
      break
    case 8:
      leaf(ctx, -r * 0.05, -r * 0.92, r * 0.5, -0.6, lw * 0.8)
      leaf(ctx, -r * 0.05, -r * 0.92, r * 0.38, -2.3, lw * 0.8)
      break
    case 10:
      stem(ctx, [-r * 0.16, -r * 1.02, 0, -r * 0.94, r * 0.16, -r * 1.02], Math.max(1.5, r * 0.06), lw * 0.6, '#7FB24A')
      stem(ctx, [0, -r * 0.98, 0, -r * 1.06, 0, -r * 1.12], Math.max(1.5, r * 0.06), lw * 0.6, '#7FB24A')
      break
    case 11: {
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.98)
      ctx.bezierCurveTo(r * 0.05, -r * 1.15, r * 0.22, -r * 1.12, r * 0.18, -r * 1.02)
      ctx.bezierCurveTo(r * 0.14, -r * 0.94, r * 0.05, -r * 1.02, r * 0.12, -r * 1.12)
      ctx.strokeStyle = FRUIT_INK
      ctx.lineWidth = Math.max(2, r * 0.05) + lw
      ctx.stroke()
      ctx.strokeStyle = '#6DB24B'
      ctx.lineWidth = Math.max(1.4, r * 0.05)
      ctx.stroke()
      break
    }
  }
}

function drawFace(ctx: CanvasRenderingContext2D, tier: number, r: number, mood: Mood) {
  const fr = tier === 9 ? r * 0.92 : r
  const ey = tier === 2 ? -r * 0.05 : r * 0.04
  const ex = fr * 0.3
  const er = Math.max(1.1, fr * 0.085)
  const my = ey + fr * 0.24
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // a soft light patch behind the face on dark or busy skins so it reads
  if (tier === 11 || tier === 9 || tier === 3) {
    ctx.beginPath()
    ctx.ellipse(0, ey + fr * 0.1, fr * 0.5, fr * 0.34, 0, 0, Math.PI * 2)
    ctx.fillStyle = tier === 11 ? 'rgba(170, 240, 170, 0.55)' : tier === 3 ? 'rgba(220, 200, 255, 0.4)' : 'rgba(255, 240, 160, 0.75)'
    ctx.fill()
  }

  // cheeks
  if (r >= 9 && mood !== 'dizzy') {
    ctx.fillStyle = tier === 1 || tier === 6 || tier === 2 ? 'rgba(255, 190, 200, 0.6)' : 'rgba(255, 105, 125, 0.45)'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(s * fr * 0.5, ey + fr * 0.2, fr * 0.13, fr * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.fillStyle = FACE
  ctx.strokeStyle = FACE
  const ink = Math.max(1, fr * 0.055)
  ctx.lineWidth = ink

  // eyes
  for (const s of [-1, 1]) {
    const x = s * ex
    if (mood === 'dizzy') {
      const d = er * 1.1
      ctx.beginPath()
      ctx.moveTo(x - d, ey - d); ctx.lineTo(x + d, ey + d)
      ctx.moveTo(x + d, ey - d); ctx.lineTo(x - d, ey + d)
      ctx.stroke()
    } else if (mood === 'happy') {
      ctx.beginPath()
      ctx.arc(x, ey + er * 0.5, er * 1.1, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    } else {
      const big = mood === 'pop' ? 1.35 : 1
      ctx.beginPath()
      ctx.ellipse(x, ey, er * big, er * big * 1.18, 0, 0, Math.PI * 2)
      ctx.fill()
      if (r >= 12) {
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(x - er * 0.35 * big, ey - er * 0.45 * big, er * 0.38 * big, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = FACE
      }
      if (mood === 'worried') {
        ctx.beginPath()
        ctx.moveTo(x + s * er * 1.5, ey - er * 1.8)
        ctx.lineTo(x - s * er * 0.9, ey - er * 2.7)
        ctx.stroke()
      }
    }
  }

  // mouth
  ctx.beginPath()
  if (mood === 'pop') {
    ctx.ellipse(0, my + fr * 0.02, fr * 0.09, fr * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    if (r >= 14) {
      ctx.fillStyle = '#FF6F7E'
      ctx.beginPath()
      ctx.ellipse(0, my + fr * 0.08, fr * 0.055, fr * 0.04, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (mood === 'happy') {
    ctx.moveTo(-fr * 0.13, my - fr * 0.03)
    ctx.quadraticCurveTo(0, my + fr * 0.2, fr * 0.13, my - fr * 0.03)
    ctx.closePath()
    ctx.fill()
  } else if (mood === 'worried') {
    const w = fr * 0.16
    ctx.moveTo(-w, my + fr * 0.03)
    ctx.quadraticCurveTo(-w / 2, my - fr * 0.05, 0, my + fr * 0.03)
    ctx.quadraticCurveTo(w / 2, my + fr * 0.1, w, my + fr * 0.02)
    ctx.stroke()
  } else if (mood === 'dizzy') {
    ctx.ellipse(0, my + fr * 0.02, fr * 0.06, fr * 0.07, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    ctx.arc(0, my - fr * 0.06, fr * 0.1, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()
  }
}

/** One whole fruit at (0, 0), radius r pixels. */
export function paintFruit(ctx: CanvasRenderingContext2D, tier: number, r: number, mood: Mood = 'calm') {
  const l = look(tier)
  const lw = Math.max(1.2, r * 0.075)
  ctx.save()
  ctx.lineJoin = 'round'
  drawBehind(ctx, tier, r, lw)

  // body: shade first, the lit side on top of it, leaving a crescent of shade bottom right
  bodyPath(ctx, tier, r)
  ctx.fillStyle = l.shade
  ctx.fill()
  ctx.save()
  bodyPath(ctx, tier, r)
  ctx.clip()
  ctx.beginPath()
  ctx.arc(-r * 0.1, -r * 0.12, r * 0.94, 0, Math.PI * 2)
  ctx.fillStyle = l.base
  ctx.fill()
  drawSkin(ctx, tier, r, lw)
  // gloss
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.46, -r * 0.46, r * 0.2, r * 0.11, -0.75, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-r * 0.7, -r * 0.18, r * 0.06, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  bodyPath(ctx, tier, r)
  ctx.strokeStyle = FRUIT_INK
  ctx.lineWidth = lw
  ctx.stroke()

  drawTop(ctx, tier, r, lw)
  drawFace(ctx, tier, r, mood)
  ctx.restore()
}

// ---------------- sprite cache ----------------

interface Sprite { c: HTMLCanvasElement; cx: number; cy: number; r: number }
const sprites = new Map<string, Sprite>()

function bucket(px: number): number {
  if (px < 24) return Math.max(4, Math.round(px))
  if (px < 80) return Math.round(px / 2) * 2
  return Math.round(px / 4) * 4
}

/** The cached sprite for a fruit at about `px` pixels of radius. */
export function fruitSprite(tier: number, mood: Mood, px: number): Sprite | null {
  if (typeof document === 'undefined') return null
  const r = bucket(px)
  const key = `${tier}|${mood}|${r}`
  const hit = sprites.get(key)
  if (hit) return hit
  const side = Math.ceil(r * 2 * 1.8) + 4
  const c = document.createElement('canvas')
  c.width = side
  c.height = side
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const cx = side / 2
  const cy = side / 2 + r * 0.25
  ctx.translate(cx, cy)
  paintFruit(ctx, tier, r, mood)
  if (sprites.size > 600) sprites.clear()
  const s = { c, cx, cy, r }
  sprites.set(key, s)
  return s
}

/**
 * Draw a fruit into a context whose transform maps world units to pixels.
 * `ppu` = device pixels per world unit, so the sprite is picked at the right size.
 * sx / sy squash and stretch around the fruit's center.
 */
export function blitFruit(
  ctx: CanvasRenderingContext2D,
  tier: number,
  mood: Mood,
  x: number,
  y: number,
  r: number,
  angle: number,
  ppu: number,
  sx = 1,
  sy = 1,
  alpha = 1,
) {
  const sp = fruitSprite(tier, mood, r * ppu)
  if (!sp) return
  const k = sp.r / r // sprite pixels per world unit
  ctx.save()
  if (alpha !== 1) ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  if (angle) ctx.rotate(angle)
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy)
  ctx.drawImage(sp.c, -sp.cx / k, -sp.cy / k, sp.c.width / k, sp.c.height / k)
  ctx.restore()
}

/** The fruit's main color (juice, rings, banners). */
export function juice(tier: number): string {
  return look(tier).base
}

/** Fruit radius in world units (re-exported for callers that only import art). */
export function radius(tier: number): number {
  return fruit(tier).r
}
