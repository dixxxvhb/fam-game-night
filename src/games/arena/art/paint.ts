import { COLS, PILLAR, ROWS, type PowerKind } from '../sim'
import type { ThemeId } from '../themes'
import { drawPowerGlyph } from './icons'

/**
 * Kaboom's arena art, drawn with canvas paths ONCE per (theme, tile size) and kept as offscreen
 * canvases: the whole board (floor, edge dressing, frame) as one image, and one sprite per block
 * kind. Every frame then only stamps images. Call only in the browser (it makes canvases).
 *
 * Geometry, in tiles: the board sits inside an EDGE-wide band of dressing; blocks are LIFT tall
 * (a top face shifted up, a front face below it), which is what makes the arena read as 3D.
 */

export const INK = '#1E1838'
export const EDGE = 0.8
export const LIFT = 0.26

export interface Look {
  floorA: string
  floorB: string
  /** The raised rim under the board's front edge. */
  bank: string
  pillarTop: string
  pillarSide: string
  crateTop: string
  crateSide: string
  crateMark: string
}

export const LOOKS: Record<ThemeId, Look> = {
  swamp: { floorA: '#8FD46C', floorB: '#83CB61', bank: '#7A5534', pillarTop: '#C9965E', pillarSide: '#7A5534', crateTop: '#D9A766', crateSide: '#A8723E', crateMark: '#7A4E26' },
  boardwalk: { floorA: '#EDC284', floorB: '#E5B676', bank: '#9C6B3E', pillarTop: '#B98552', pillarSide: '#7D5230', crateTop: '#FFFFFF', crateSide: '#3E7BFA', crateMark: '#2453C4' },
  giftshop: { floorA: '#FFF4F7', floorB: '#FFD9E3', bank: '#C95A79', pillarTop: '#8EE0D8', pillarSide: '#2C9C8E', crateTop: '#E6B577', crateSide: '#C08A4C', crateMark: '#F2414F' },
  launch: { floorA: '#DDE2EC', floorB: '#D2D8E4', bank: '#5E6A84', pillarTop: '#C3CCDD', pillarSide: '#6E7A94', crateTop: '#FFA04A', crateSide: '#E06A1A', crateMark: '#FFFFFF' },
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + k, y)
  g.arcTo(x + w, y, x + w, y + h, k)
  g.arcTo(x + w, y + h, x, y + h, k)
  g.arcTo(x, y + h, x, y, k)
  g.arcTo(x, y, x + w, y, k)
  g.closePath()
}

/** Tiny seeded noise for scattering dressing the same way every bake. */
function scatter(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hazard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, band: number, a = '#FFC83A', b = INK) {
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  g.fillStyle = a
  g.fillRect(x, y, w, h)
  g.fillStyle = b
  for (let i = -h; i < w + h; i += band * 2) {
    g.beginPath()
    g.moveTo(x + i, y + h)
    g.lineTo(x + i + band, y + h)
    g.lineTo(x + i + band + h, y)
    g.lineTo(x + i + h, y)
    g.closePath()
    g.fill()
  }
  g.restore()
}

// ---------------- the board ----------------

/** Board image size in CSS px for tile T. */
export function boardSize(T: number) {
  return { w: (COLS + EDGE * 2) * T, h: (ROWS + EDGE * 2) * T }
}

function lilyPad(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.beginPath()
  g.moveTo(0, 0)
  g.arc(0, 0, r, 0.35, Math.PI * 2 - 0.05)
  g.closePath()
  g.fillStyle = '#4DB84A'
  g.fill()
  g.lineWidth = Math.max(1.5, r * 0.16)
  g.strokeStyle = INK
  g.stroke()
  g.beginPath()
  g.arc(0, 0, r * 0.55, 0.6, 2.2)
  g.strokeStyle = '#7ED36A'
  g.lineWidth = Math.max(1, r * 0.12)
  g.stroke()
  g.restore()
}

function gatorEyes(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  for (const dx of [-0.5, 0.5]) {
    g.beginPath()
    g.ellipse(x + dx * s, y, s * 0.42, s * 0.34, 0, Math.PI, 0)
    g.closePath()
    g.fillStyle = '#4DB84A'
    g.fill()
    g.lineWidth = Math.max(1.5, s * 0.1)
    g.strokeStyle = INK
    g.stroke()
    g.beginPath()
    g.ellipse(x + dx * s, y - s * 0.12, s * 0.16, s * 0.12, 0, 0, Math.PI * 2)
    g.fillStyle = '#FFE24A'
    g.fill()
    g.stroke()
    g.fillStyle = INK
    g.fillRect(x + dx * s - s * 0.03, y - s * 0.22, s * 0.06, s * 0.2)
  }
  g.strokeStyle = 'rgba(255,255,255,0.7)'
  g.lineWidth = Math.max(1, s * 0.08)
  g.beginPath()
  g.ellipse(x, y + s * 0.04, s * 1.2, s * 0.16, 0, 0, Math.PI)
  g.stroke()
}

function reeds(g: CanvasRenderingContext2D, x: number, y: number, s: number, rnd: () => number) {
  for (let i = 0; i < 4; i++) {
    const bx = x + (i - 1.5) * s * 0.22
    const top = y - s * (0.6 + rnd() * 0.5)
    g.strokeStyle = INK
    g.lineWidth = Math.max(2.5, s * 0.1)
    g.beginPath()
    g.moveTo(bx, y)
    g.quadraticCurveTo(bx + s * 0.06, (y + top) / 2, bx + (rnd() - 0.5) * s * 0.2, top)
    g.stroke()
    g.strokeStyle = '#5FA83E'
    g.lineWidth = Math.max(1.2, s * 0.05)
    g.stroke()
    if (i % 2 === 0) {
      rr(g, bx - s * 0.06 + (rnd() - 0.5) * 2, top - s * 0.02, s * 0.12, s * 0.26, s * 0.06)
      g.fillStyle = '#8A5A33'
      g.fill()
      g.lineWidth = Math.max(1.5, s * 0.05)
      g.strokeStyle = INK
      g.stroke()
    }
  }
}

function waves(g: CanvasRenderingContext2D, w: number, h: number, T: number, color: string, rnd: () => number) {
  g.strokeStyle = color
  g.lineCap = 'round'
  g.lineWidth = Math.max(2, T * 0.06)
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const L = T * (0.25 + rnd() * 0.3)
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + L / 4, y - T * 0.08, x + L / 2, y)
    g.quadraticCurveTo(x + (L * 3) / 4, y + T * 0.08, x + L, y)
    g.stroke()
  }
}

function edgeDressing(g: CanvasRenderingContext2D, theme: ThemeId, T: number, w: number, h: number) {
  const rnd = scatter(theme.length * 977 + 13)
  const bx = EDGE * T
  const by = EDGE * T
  const bw = COLS * T
  const bh = ROWS * T
  const inBoard = (x: number, y: number, pad: number) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad
  if (theme === 'swamp') {
    g.fillStyle = '#3FA7A0'
    g.fillRect(0, 0, w, h)
    waves(g, w, h, T, 'rgba(255,255,255,0.35)', rnd)
    for (let i = 0; i < 28; i++) {
      const x = rnd() * w
      const y = rnd() * h
      if (inBoard(x, y, T * 0.3)) continue
      lilyPad(g, x, y, T * (0.16 + rnd() * 0.12), rnd() * 6.28)
    }
    gatorEyes(g, w - T * 0.6, h * 0.62, T * 0.38)
    gatorEyes(g, T * 0.42, h * 0.24, T * 0.32)
    for (const [x, y] of [[T * 0.4, h - T * 0.15], [w - T * 0.35, T * 0.75], [w * 0.5, h - T * 0.12], [T * 0.35, h * 0.55]]) reeds(g, x, y, T * 0.8, rnd)
  } else if (theme === 'boardwalk') {
    g.fillStyle = '#2AA8E0'
    g.fillRect(0, 0, w, h)
    waves(g, w, h, T, 'rgba(230,250,255,0.7)', rnd)
    // the beach along the bottom
    g.fillStyle = '#FFE0A0'
    g.beginPath()
    g.moveTo(0, h - T * 0.42)
    for (let x = 0; x <= w; x += T * 0.5) g.lineTo(x, h - T * 0.42 + Math.sin(x / T * 1.7) * T * 0.08)
    g.lineTo(w, h)
    g.lineTo(0, h)
    g.closePath()
    g.fill()
    g.strokeStyle = '#E6FAFF'
    g.lineWidth = T * 0.08
    g.stroke()
    // pier posts in the water
    for (let i = 0; i < 12; i++) {
      const top = i < 6
      const x = bx + (i % 6 + 0.5) * (bw / 6)
      const y = top ? by - T * 0.42 : by + bh + T * 0.38
      if (!top) continue
      g.fillStyle = '#7D5230'
      rr(g, x - T * 0.12, y - T * 0.1, T * 0.24, T * 0.42, T * 0.08)
      g.fill()
      g.lineWidth = Math.max(2, T * 0.06)
      g.strokeStyle = INK
      g.stroke()
      g.beginPath()
      g.ellipse(x, y - T * 0.1, T * 0.12, T * 0.06, 0, 0, Math.PI * 2)
      g.fillStyle = '#B98552'
      g.fill()
      g.stroke()
    }
    // buoys
    for (const [x, y] of [[T * 0.4, h * 0.3], [w - T * 0.4, h * 0.45], [T * 0.38, h * 0.72]]) {
      g.beginPath()
      g.arc(x, y, T * 0.18, 0, Math.PI * 2)
      g.fillStyle = '#FF5D4E'
      g.fill()
      g.lineWidth = Math.max(2, T * 0.06)
      g.strokeStyle = INK
      g.stroke()
      g.fillStyle = '#FFFFFF'
      g.fillRect(x - T * 0.17, y - T * 0.04, T * 0.34, T * 0.08)
    }
  } else if (theme === 'giftshop') {
    g.fillStyle = '#FFB3C7'
    g.fillRect(0, 0, w, h)
    // awning stripes across the top
    for (let x = 0, i = 0; x < w; x += T * 0.5, i++) {
      g.fillStyle = i % 2 ? '#FFFFFF' : '#F0607E'
      g.fillRect(x, 0, T * 0.5, T * 0.5)
      g.beginPath()
      g.arc(x + T * 0.25, T * 0.5, T * 0.25, 0, Math.PI)
      g.fill()
    }
    g.strokeStyle = INK
    g.lineWidth = Math.max(2, T * 0.05)
    g.beginPath()
    g.moveTo(0, T * 0.5)
    g.lineTo(w, T * 0.5)
    g.stroke()
    // shelves of merch down the sides and along the bottom
    const merch = ['#3E7BFA', '#FFC83A', '#2FBF5B', '#FF8FA2', '#9B5CF6', '#FF8A2A', '#FFFFFF']
    const shelf = (x: number, y: number, len: number) => {
      g.fillStyle = '#C08A4C'
      g.fillRect(x, y, len, T * 0.08)
      for (let i = 0; i < len / (T * 0.2) - 1; i++) {
        const mw = T * (0.12 + rnd() * 0.06)
        const mh = T * (0.14 + rnd() * 0.14)
        const mx = x + T * 0.04 + i * T * 0.2
        rr(g, mx, y - mh, mw, mh, T * 0.03)
        g.fillStyle = merch[Math.floor(rnd() * merch.length)]
        g.fill()
        g.lineWidth = Math.max(1, T * 0.03)
        g.strokeStyle = INK
        g.stroke()
      }
    }
    for (let y = by + T * 0.9; y < by + bh; y += T * 1.1) {
      shelf(T * 0.05, y, EDGE * T - T * 0.12)
      shelf(bx + bw + T * 0.08, y, EDGE * T - T * 0.12)
    }
    for (let x = bx; x < bx + bw - T; x += T * 2.2) shelf(x, h - T * 0.12, T * 2)
  } else {
    g.fillStyle = '#8E98AE'
    g.fillRect(0, 0, w, h)
    // concrete joints
    g.strokeStyle = 'rgba(30,24,56,0.18)'
    g.lineWidth = Math.max(1, T * 0.03)
    for (let x = 0; x < w; x += T * 1.5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
    for (let y = 0; y < h; y += T * 1.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
    // hazard stripes around the outside
    const band = T * 0.22
    hazard(g, 0, 0, w, band, band * 0.7)
    hazard(g, 0, h - band, w, band, band * 0.7)
    hazard(g, 0, 0, band, h, band * 0.7)
    hazard(g, w - band, 0, band, h, band * 0.7)
    // a small rocket on the left, a fuel tank on the right
    const rx = T * 0.42
    const ry = h * 0.42
    g.lineWidth = Math.max(2, T * 0.06)
    g.strokeStyle = INK
    g.fillStyle = '#FFFFFF'
    g.beginPath()
    g.moveTo(rx, ry - T * 1.1)
    g.quadraticCurveTo(rx + T * 0.2, ry - T * 0.8, rx + T * 0.18, ry - T * 0.4)
    g.lineTo(rx + T * 0.18, ry + T * 0.5)
    g.lineTo(rx - T * 0.18, ry + T * 0.5)
    g.lineTo(rx - T * 0.18, ry - T * 0.4)
    g.quadraticCurveTo(rx - T * 0.2, ry - T * 0.8, rx, ry - T * 1.1)
    g.closePath()
    g.fill()
    g.stroke()
    g.fillStyle = '#FF5D4E'
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(rx + s * T * 0.18, ry + T * 0.1)
      g.lineTo(rx + s * T * 0.36, ry + T * 0.55)
      g.lineTo(rx + s * T * 0.18, ry + T * 0.5)
      g.closePath()
      g.fill()
      g.stroke()
    }
    g.beginPath()
    g.arc(rx, ry - T * 0.35, T * 0.08, 0, Math.PI * 2)
    g.fillStyle = '#5CC8FF'
    g.fill()
    g.stroke()
    const tx = w - T * 0.42
    const ty = h * 0.62
    rr(g, tx - T * 0.24, ty - T * 0.7, T * 0.48, T * 1.2, T * 0.22)
    g.fillStyle = '#FFA04A'
    g.fill()
    g.stroke()
    g.fillStyle = '#FFFFFF'
    g.fillRect(tx - T * 0.24, ty - T * 0.2, T * 0.48, T * 0.12)
  }
}

function floorTile(g: CanvasRenderingContext2D, theme: ThemeId, look: Look, c: number, r: number, x: number, y: number, T: number, rnd: () => number) {
  const alt = (c + r) % 2 === 1
  g.fillStyle = alt ? look.floorB : look.floorA
  g.fillRect(x, y, T, T)
  if (theme === 'swamp') {
    g.strokeStyle = 'rgba(46,120,40,0.45)'
    g.lineWidth = Math.max(1, T * 0.035)
    g.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const tx = x + T * (0.15 + rnd() * 0.7)
      const ty = y + T * (0.2 + rnd() * 0.65)
      g.beginPath()
      g.moveTo(tx - T * 0.05, ty)
      g.lineTo(tx - T * 0.08, ty - T * 0.08)
      g.moveTo(tx, ty)
      g.lineTo(tx, ty - T * 0.1)
      g.moveTo(tx + T * 0.05, ty)
      g.lineTo(tx + T * 0.08, ty - T * 0.08)
      g.stroke()
    }
  } else if (theme === 'boardwalk') {
    g.strokeStyle = 'rgba(122,78,38,0.55)'
    g.lineWidth = Math.max(1, T * 0.03)
    for (let i = 1; i < 3; i++) {
      g.beginPath()
      g.moveTo(x, y + (T * i) / 3)
      g.lineTo(x + T, y + (T * i) / 3)
      g.stroke()
    }
    g.fillStyle = 'rgba(122,78,38,0.6)'
    for (let i = 0; i < 3; i++) {
      const off = (r + i) % 2 ? 0.15 : 0.85
      g.beginPath()
      g.arc(x + T * off, y + T * (i / 3 + 0.17), Math.max(1, T * 0.025), 0, Math.PI * 2)
      g.fill()
    }
    // the plank seam lines up every other tile
    if ((c + (r % 2)) % 2 === 0) {
      g.beginPath()
      g.moveTo(x + T * 0.5, y + T / 3)
      g.lineTo(x + T * 0.5, y + (T * 2) / 3)
      g.strokeStyle = 'rgba(122,78,38,0.55)'
      g.stroke()
    }
  } else if (theme === 'giftshop') {
    g.strokeStyle = 'rgba(201,90,121,0.25)'
    g.lineWidth = Math.max(1, T * 0.03)
    g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1)
    if (!alt && rnd() < 0.18) {
      // a dropped price sticker
      g.save()
      g.translate(x + T * (0.3 + rnd() * 0.4), y + T * (0.3 + rnd() * 0.4))
      g.rotate(rnd() * 1.2 - 0.6)
      rr(g, -T * 0.1, -T * 0.06, T * 0.2, T * 0.12, T * 0.03)
      g.fillStyle = '#FFC83A'
      g.fill()
      g.restore()
    }
  } else {
    g.strokeStyle = 'rgba(30,24,56,0.12)'
    g.lineWidth = Math.max(1, T * 0.03)
    g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1)
    if (rnd() < 0.12) {
      g.fillStyle = 'rgba(30,24,56,0.08)'
      g.beginPath()
      g.ellipse(x + T * 0.5, y + T * 0.5, T * 0.32, T * 0.22, rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
    if (r === Math.floor(ROWS / 2)) {
      g.fillStyle = 'rgba(255,200,58,0.75)'
      g.fillRect(x + T * 0.1, y + T * 0.44, T * 0.8, T * 0.12)
    }
  }
}

/** The whole board: dressing, floor, rim and frame. Pillars are drawn on top later (they have depth). */
export function bakeBoard(theme: ThemeId, T: number, dpr: number, grid: number[]): HTMLCanvasElement {
  const { w, h } = boardSize(T)
  const c = canvas(w * dpr, h * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const look = LOOKS[theme]
  edgeDressing(g, theme, T, w, h)
  const bx = EDGE * T
  const by = EDGE * T
  const bw = COLS * T
  const bh = ROWS * T
  // the raised rim and a hard shadow under it
  g.fillStyle = 'rgba(30,24,56,0.35)'
  rr(g, bx - T * 0.06, by + T * 0.1, bw + T * 0.3, bh + T * 0.3, T * 0.22)
  g.fill()
  g.fillStyle = look.bank
  rr(g, bx - T * 0.12, by - T * 0.12, bw + T * 0.24, bh + T * 0.12 + T * 0.32, T * 0.22)
  g.fill()
  g.lineWidth = Math.max(3, T * 0.08)
  g.strokeStyle = INK
  g.stroke()
  const rnd = scatter(theme.length * 31 + 5)
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      floorTile(g, theme, look, col, r, bx + col * T, by + r * T, T, rnd)
    }
  }
  // the inner frame line
  g.lineWidth = Math.max(2.5, T * 0.06)
  g.strokeStyle = INK
  g.strokeRect(bx, by, bw, bh)
  // soft contact shadows where pillars stand (they never move)
  g.fillStyle = 'rgba(30,24,56,0.16)'
  for (let k = 0; k < grid.length; k++) {
    if (grid[k] !== PILLAR) continue
    const col = k % COLS
    const r = (k - col) / COLS
    g.fillRect(bx + col * T + T * 0.08, by + r * T + T * 0.86, T * 0.98, T * 0.3)
  }
  return c
}

// ---------------- blocks ----------------

/** Block sprite: T wide, T * (1 + LIFT) tall; drawn with its top at (tile y - LIFT * T). */
function block(T: number, dpr: number, paint: (g: CanvasRenderingContext2D, top: { x: number; y: number; w: number; h: number }, side: { x: number; y: number; w: number; h: number }) => void): HTMLCanvasElement {
  const H = T * (1 + LIFT)
  const c = canvas(T * dpr, H * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const pad = T * 0.04
  const top = { x: pad, y: pad, w: T - pad * 2, h: T - pad * 2 - T * 0.02 }
  const side = { x: pad, y: top.y + top.h - T * 0.12, w: T - pad * 2, h: T * LIFT + T * 0.1 }
  paint(g, top, side)
  return c
}

function slab(g: CanvasRenderingContext2D, top: { x: number; y: number; w: number; h: number }, side: { x: number; y: number; w: number; h: number }, topFill: string, sideFill: string, T: number, radius = 0.16) {
  const lw = Math.max(2, T * 0.065)
  rr(g, side.x, top.y + top.h * 0.4, side.w, side.y + side.h - (top.y + top.h * 0.4), T * radius)
  g.fillStyle = sideFill
  g.fill()
  g.lineWidth = lw
  g.strokeStyle = INK
  g.stroke()
  rr(g, top.x, top.y, top.w, top.h, T * radius)
  g.fillStyle = topFill
  g.fill()
  g.stroke()
}

export function bakePillar(theme: ThemeId, T: number, dpr: number): HTMLCanvasElement {
  const look = LOOKS[theme]
  return block(T, dpr, (g, top, side) => {
    if (theme === 'swamp' || theme === 'boardwalk') {
      // a stump / a pier post: round top with rings
      slab(g, top, side, look.pillarTop, look.pillarSide, T, 0.42)
      const cx = top.x + top.w / 2
      const cy = top.y + top.h / 2
      g.strokeStyle = 'rgba(122,78,38,0.65)'
      g.lineWidth = Math.max(1, T * 0.035)
      for (const k of [0.32, 0.2, 0.09]) {
        g.beginPath()
        g.ellipse(cx, cy, top.w * k, top.h * k, 0, 0, Math.PI * 2)
        g.stroke()
      }
      if (theme === 'boardwalk') {
        g.strokeStyle = '#E8D3A6'
        g.lineWidth = Math.max(2, T * 0.07)
        g.beginPath()
        g.moveTo(side.x + T * 0.04, side.y + side.h * 0.45)
        g.lineTo(side.x + side.w - T * 0.04, side.y + side.h * 0.45)
        g.stroke()
      } else {
        g.fillStyle = '#5FA83E'
        g.beginPath()
        g.ellipse(top.x + top.w * 0.78, top.y + top.h * 0.2, T * 0.1, T * 0.06, -0.5, 0, Math.PI * 2)
        g.fill()
      }
    } else if (theme === 'giftshop') {
      slab(g, top, side, look.pillarTop, look.pillarSide, T, 0.16)
      // a snow globe on the display stand
      const cx = top.x + top.w / 2
      const cy = top.y + top.h * 0.5
      g.fillStyle = '#C08A4C'
      rr(g, cx - T * 0.2, cy + T * 0.05, T * 0.4, T * 0.14, T * 0.04)
      g.fill()
      g.lineWidth = Math.max(1.5, T * 0.045)
      g.strokeStyle = INK
      g.stroke()
      g.beginPath()
      g.arc(cx, cy - T * 0.06, T * 0.2, 0, Math.PI * 2)
      g.fillStyle = 'rgba(214,240,255,0.95)'
      g.fill()
      g.stroke()
      g.fillStyle = '#FF8FA2'
      g.beginPath()
      g.arc(cx + T * 0.02, cy - T * 0.02, T * 0.07, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#FFFFFF'
      g.lineWidth = Math.max(1, T * 0.03)
      g.beginPath()
      g.arc(cx - T * 0.07, cy - T * 0.13, T * 0.06, Math.PI, Math.PI * 1.6)
      g.stroke()
    } else {
      slab(g, top, side, look.pillarTop, look.pillarSide, T, 0.18)
      g.fillStyle = '#8E98AE'
      for (const [u, v] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
        g.beginPath()
        g.arc(top.x + top.w * u, top.y + top.h * v, T * 0.045, 0, Math.PI * 2)
        g.fill()
      }
      hazard(g, side.x + T * 0.05, side.y + side.h * 0.3, side.w - T * 0.1, side.h * 0.32, T * 0.08)
    }
  })
}

export function bakeCrate(theme: ThemeId, T: number, dpr: number): HTMLCanvasElement {
  const look = LOOKS[theme]
  return block(T, dpr, (g, top, side) => {
    const lw = Math.max(1.5, T * 0.045)
    if (theme === 'boardwalk') {
      // a beach cooler: blue body, white lid, handle
      slab(g, top, side, look.crateSide, look.crateMark, T, 0.18)
      rr(g, top.x + T * 0.02, top.y, top.w - T * 0.04, top.h * 0.62, T * 0.14)
      g.fillStyle = '#FFFFFF'
      g.fill()
      g.lineWidth = lw
      g.strokeStyle = INK
      g.stroke()
      rr(g, top.x + top.w * 0.3, top.y + top.h * 0.2, top.w * 0.4, top.h * 0.14, T * 0.05)
      g.fillStyle = '#C9C4DA'
      g.fill()
      g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.5)'
      g.fillRect(top.x + T * 0.1, top.y + top.h * 0.75, top.w * 0.5, T * 0.05)
      return
    }
    if (theme === 'launch') {
      // a fuel drum: orange, white band, a hazard diamond
      slab(g, top, side, look.crateTop, look.crateSide, T, 0.38)
      const cx = top.x + top.w / 2
      const cy = top.y + top.h / 2
      g.beginPath()
      g.ellipse(cx, cy, top.w * 0.3, top.h * 0.3, 0, 0, Math.PI * 2)
      g.lineWidth = lw
      g.strokeStyle = INK
      g.stroke()
      g.fillStyle = '#FFFFFF'
      g.fillRect(top.x + T * 0.04, cy + top.h * 0.32, top.w - T * 0.08, T * 0.06)
      g.save()
      g.translate(cx, cy)
      g.rotate(Math.PI / 4)
      g.fillStyle = '#FFC83A'
      g.fillRect(-T * 0.09, -T * 0.09, T * 0.18, T * 0.18)
      g.strokeRect(-T * 0.09, -T * 0.09, T * 0.18, T * 0.18)
      g.restore()
      return
    }
    // a wooden crate (swamp) or a cardboard box (gift shop)
    slab(g, top, side, look.crateTop, look.crateSide, T, 0.1)
    g.lineWidth = lw
    g.strokeStyle = INK
    if (theme === 'swamp') {
      const inset = T * 0.12
      g.strokeRect(top.x + inset, top.y + inset, top.w - inset * 2, top.h - inset * 2)
      g.beginPath()
      g.moveTo(top.x + inset, top.y + inset)
      g.lineTo(top.x + top.w - inset, top.y + top.h - inset)
      g.moveTo(top.x + top.w - inset, top.y + inset)
      g.lineTo(top.x + inset, top.y + top.h - inset)
      g.strokeStyle = look.crateMark
      g.lineWidth = Math.max(2, T * 0.07)
      g.stroke()
      g.lineWidth = lw
      g.strokeStyle = INK
      g.strokeRect(top.x + inset, top.y + inset, top.w - inset * 2, top.h - inset * 2)
      g.strokeStyle = 'rgba(122,78,38,0.5)'
      for (let i = 1; i < 3; i++) {
        g.beginPath()
        g.moveTo(side.x + T * 0.05, side.y + (side.h * i) / 3)
        g.lineTo(side.x + side.w - T * 0.05, side.y + (side.h * i) / 3)
        g.stroke()
      }
    } else {
      // tape down the middle, a FRAGILE mark, two plush ears poking out
      g.fillStyle = '#F5D9A8'
      g.fillRect(top.x + top.w * 0.42, top.y, top.w * 0.16, top.h)
      g.strokeStyle = 'rgba(30,24,56,0.35)'
      g.beginPath()
      g.moveTo(top.x + top.w * 0.5, top.y + T * 0.04)
      g.lineTo(top.x + top.w * 0.5, top.y + top.h - T * 0.04)
      g.stroke()
      rr(g, top.x + T * 0.08, top.y + top.h * 0.62, top.w * 0.28, top.h * 0.2, T * 0.03)
      g.fillStyle = look.crateMark
      g.fill()
      for (const s of [-1, 1]) {
        g.beginPath()
        g.moveTo(top.x + top.w * (0.72 + s * 0.08), top.y + T * 0.06)
        g.lineTo(top.x + top.w * (0.72 + s * 0.12), top.y - T * 0.12)
        g.lineTo(top.x + top.w * (0.72 + s * 0.02), top.y + T * 0.04)
        g.closePath()
        g.fillStyle = '#FF8FA2'
        g.fill()
        g.lineWidth = Math.max(1.2, T * 0.035)
        g.strokeStyle = INK
        g.stroke()
      }
    }
  })
}

/** The park closing: a barrier block with hazard stripes on top and a CLOSED band on the front. */
export function bakeWall(T: number, dpr: number): HTMLCanvasElement {
  return block(T, dpr, (g, top, side) => {
    slab(g, top, side, '#FFC83A', '#FF7A2E', T, 0.12)
    g.save()
    rr(g, top.x, top.y, top.w, top.h, T * 0.12)
    g.clip()
    hazard(g, top.x, top.y, top.w, top.h, T * 0.13)
    g.restore()
    rr(g, top.x, top.y, top.w, top.h, T * 0.12)
    g.lineWidth = Math.max(2, T * 0.065)
    g.strokeStyle = INK
    g.stroke()
    g.fillStyle = '#FFFFFF'
    g.fillRect(side.x + T * 0.06, side.y + side.h * 0.5, side.w - T * 0.12, Math.max(2, side.h * 0.2))
  })
}

// ---------------- things on the floor ----------------

/** A power-up as a sticker standing up off the floor (T square). */
export function bakeItem(kind: PowerKind, T: number, dpr: number): HTMLCanvasElement {
  const c = canvas(T * dpr, T * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const s = T * 0.66
  const x = (T - s) / 2
  const y = (T - s) / 2 - T * 0.04
  rr(g, x, y + T * 0.06, s, s, s * 0.26)
  g.fillStyle = INK
  g.fill()
  rr(g, x, y, s, s, s * 0.26)
  g.fillStyle = '#FFFFFF'
  g.fill()
  g.lineWidth = Math.max(2, T * 0.06)
  g.strokeStyle = INK
  g.stroke()
  drawPowerGlyph(g, kind, x + s * 0.12, y + s * 0.12, s * 0.76)
  return c
}

/** The cherry bomb body (the fuse and its spark are drawn live). T square, center at (0.5, 0.56). */
export function bakeBomb(T: number, dpr: number): HTMLCanvasElement {
  const c = canvas(T * dpr, T * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const cx = T * 0.5
  const cy = T * 0.56
  const R = T * 0.3
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  const grad = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R)
  grad.addColorStop(0, '#FF7A70')
  grad.addColorStop(0.55, '#F2414F')
  grad.addColorStop(1, '#B8202E')
  g.fillStyle = grad
  g.fill()
  g.lineWidth = Math.max(2, T * 0.065)
  g.strokeStyle = INK
  g.stroke()
  // a paper band, like a real one
  g.save()
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.clip()
  g.fillStyle = '#FFE24A'
  g.fillRect(cx - R, cy + R * 0.18, R * 2, R * 0.26)
  g.restore()
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = '#FFFFFF'
  g.lineWidth = Math.max(1.5, T * 0.05)
  g.lineCap = 'round'
  g.beginPath()
  g.arc(cx - R * 0.05, cy - R * 0.05, R * 0.62, Math.PI * 1.08, Math.PI * 1.42)
  g.stroke()
  // the cap the fuse comes out of
  rr(g, cx - T * 0.07, cy - R - T * 0.07, T * 0.14, T * 0.1, T * 0.03)
  g.fillStyle = '#4A4566'
  g.fill()
  g.lineWidth = Math.max(1.5, T * 0.04)
  g.strokeStyle = INK
  g.stroke()
  return c
}
