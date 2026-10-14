/**
 * The sprite adapter: the ONLY place the views get art from. Today it draws placeholder sticker
 * shapes; when the garage lane lands, swap these three functions for `../garage/sprites` (same
 * signatures) and nothing else in view/ changes.
 *
 * Every canvas is transparent, cached, anchored bottom center (the drawer puts its base at the
 * bottom edge), drawn in the Party Park sticker style: ink outlines, bright fills.
 */
import { critter, INK } from '../../board/park/cast'
import type { CritterId, Prop, SceneThing } from '../contract'
import * as garage from '../garage/sprites'

/** Garage art anchor/size, for drawers that place karts by body width. */
export const KART_ART = garage.KART

/**
 * The garage numbers views clockwise as seen from above (2 = its left side, nose screen-left);
 * the camera's viewIndex runs the other way round (2 = nose screen-right). Mirror here.
 */
export function kartSprite(char: CritterId | null, color: string, view: number, pose: KartPose): HTMLCanvasElement {
  return garage.kartSprite(char, color, (8 - (((Math.round(view) % 8) + 8) % 8)) % 8, pose)
}

export function propSprite(kind: Prop['kind'], night = false, text?: string): HTMLCanvasElement {
  return garage.propSprite(kind, night, text)
}

export function thingSprite(kind: SceneThing['kind']): HTMLCanvasElement {
  return garage.thingSprite(kind)
}

export type KartPose = 'drive' | 'left' | 'right' | 'spin' | 'trick' | 'hurt'

const cache = new Map<string, HTMLCanvasElement>()

function make(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')!
  c.lineJoin = 'round'
  c.lineCap = 'round'
  draw(c)
  return cv
}

function cached(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let cv = cache.get(key)
  if (!cv) {
    cv = make(w, h, draw)
    cache.set(key, cv)
  }
  return cv
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function fillStroke(c: CanvasRenderingContext2D, fill: string, lw = 6) {
  c.fillStyle = fill
  c.fill()
  c.lineWidth = lw
  c.strokeStyle = INK
  c.stroke()
}

// ---------------- karts ----------------

const KS = 192

function wheel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(c, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.35)
  fillStroke(c, '#2B2740', 5)
  rr(c, x - w * 0.22, y - h * 0.3, w * 0.44, h * 0.6, 4)
  c.fillStyle = '#8C87A6'
  c.fill()
}

function head(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, face: 'back' | 'front' | 'right' | 'left', hurt: boolean) {
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  fillStroke(c, color, 6)
  // helmet stripe / visor
  c.beginPath()
  c.arc(x, y, r * 0.98, Math.PI * 1.08, Math.PI * 1.92)
  c.lineWidth = 7
  c.strokeStyle = '#FFFFFF'
  c.stroke()
  if (face === 'back') return
  const eye = (ex: number, ey: number) => {
    c.beginPath()
    c.ellipse(ex, ey, r * 0.17, r * 0.22, 0, 0, Math.PI * 2)
    c.fillStyle = '#FFFFFF'
    c.fill()
    c.lineWidth = 3
    c.strokeStyle = INK
    c.stroke()
    c.beginPath()
    c.arc(ex + (face === 'right' ? 3 : face === 'left' ? -3 : 0), ey + 2, r * 0.09, 0, Math.PI * 2)
    c.fillStyle = INK
    c.fill()
  }
  if (face === 'front') {
    eye(x - r * 0.35, y - r * 0.05)
    eye(x + r * 0.35, y - r * 0.05)
    c.beginPath()
    if (hurt) c.arc(x, y + r * 0.55, r * 0.22, Math.PI * 1.15, Math.PI * 1.85)
    else c.arc(x, y + r * 0.3, r * 0.25, Math.PI * 0.15, Math.PI * 0.85)
    c.lineWidth = 4
    c.strokeStyle = INK
    c.stroke()
  } else {
    const s = face === 'right' ? 1 : -1
    eye(x + s * r * 0.45, y - r * 0.08)
    c.beginPath()
    c.arc(x + s * r * 0.95, y + r * 0.2, r * 0.18, 0, Math.PI * 2)
    c.fillStyle = shade(color, -0.25)
    c.fill()
  }
  if (hurt) {
    c.fillStyle = '#FFDA3D'
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      c.beginPath()
      c.arc(x + Math.cos(a) * r * 1.2, y - r * 1.15 + Math.sin(a) * r * 0.25, 7, 0, Math.PI * 2)
      c.fill()
      c.lineWidth = 3
      c.strokeStyle = INK
      c.stroke()
    }
  }
}

function kartRear(c: CanvasRenderingContext2D, color: string, hc: string, hurt: boolean) {
  wheel(c, 40, 150, 40, 52)
  wheel(c, 152, 150, 40, 52)
  // seat back + head
  head(c, 96, 74, 36, hc, 'back', hurt)
  rr(c, 36, 104, 120, 58, 24)
  fillStroke(c, color)
  rr(c, 48, 112, 96, 14, 7)
  c.fillStyle = shade(color, 0.35)
  c.fill()
  // bumper + exhausts
  rr(c, 52, 150, 88, 22, 10)
  fillStroke(c, '#3B3657', 5)
  for (const ex of [70, 122]) {
    c.beginPath()
    c.arc(ex, 161, 7, 0, Math.PI * 2)
    fillStroke(c, '#C9C4DA', 4)
  }
}

function kartFront(c: CanvasRenderingContext2D, color: string, hc: string, hurt: boolean) {
  wheel(c, 40, 152, 38, 48)
  wheel(c, 152, 152, 38, 48)
  rr(c, 40, 118, 112, 50, 22)
  fillStroke(c, color)
  head(c, 96, 78, 36, hc, 'front', hurt)
  // nose + headlights
  rr(c, 58, 128, 76, 34, 14)
  fillStroke(c, shade(color, -0.2), 5)
  for (const hx of [70, 122]) {
    c.beginPath()
    c.arc(hx, 145, 9, 0, Math.PI * 2)
    fillStroke(c, '#FFF3B8', 4)
  }
  // steering wheel
  c.beginPath()
  c.arc(96, 118, 14, Math.PI, 0)
  c.lineWidth = 6
  c.strokeStyle = INK
  c.stroke()
}

function kartSide(c: CanvasRenderingContext2D, color: string, hc: string, hurt: boolean, dir: 1 | -1) {
  // drawn nose-right, mirrored for dir -1
  c.save()
  if (dir < 0) {
    c.translate(KS, 0)
    c.scale(-1, 1)
  }
  head(c, 82, 78, 34, hc, 'right', hurt)
  c.beginPath()
  c.moveTo(18, 150)
  c.lineTo(22, 112)
  c.quadraticCurveTo(26, 100, 44, 100)
  c.lineTo(112, 104)
  c.quadraticCurveTo(160, 108, 176, 132)
  c.lineTo(178, 150)
  c.closePath()
  fillStroke(c, color)
  rr(c, 112, 96, 10, 22, 4)
  fillStroke(c, '#3B3657', 4)
  wheel(c, 46, 158, 50, 40)
  wheel(c, 148, 158, 46, 38)
  c.beginPath()
  c.arc(170, 136, 7, 0, Math.PI * 2)
  fillStroke(c, '#FFF3B8', 4)
  c.restore()
}

/**
 * A kart seen from one of 8 views (0 = from behind, clockwise: 2 = nose to screen right,
 * 4 = facing us, 6 = nose to screen left) in a pose. ~192 px square, bottom-center anchor.
 */
export function placeholderKart(char: CritterId | null, color: string, view: number, pose: KartPose): HTMLCanvasElement {
  const v = ((Math.round(view) % 8) + 8) % 8
  const key = `k:${char}:${color}:${v}:${pose}`
  return cached(key, KS, KS, (c) => {
    const hc = critter(char)?.color ?? shade(color, 0.45)
    const hurt = pose === 'hurt'
    c.translate(KS / 2, KS)
    const tilt = pose === 'left' ? -0.09 : pose === 'right' ? 0.09 : pose === 'trick' ? 0.4 : 0
    c.rotate(tilt)
    if (pose === 'trick') c.translate(0, -18)
    if (hurt) c.scale(1.06, 0.9)
    c.translate(-KS / 2, -KS)
    // three-quarter views: squeeze and skew the nearest base view
    const base = v === 0 || v === 1 || v === 7 ? 'rear' : v === 3 || v === 4 || v === 5 ? 'front' : 'side'
    if (v === 1 || v === 3 || v === 5 || v === 7) {
      const sk = v === 1 || v === 5 ? 0.22 : -0.22
      c.translate(KS / 2, KS)
      c.transform(0.88, 0, sk, 1, 0, 0)
      c.translate(-KS / 2, -KS)
    }
    c.save()
    c.translate(0, -6)
    c.scale(1, 0.97)
    if (base === 'rear') kartRear(c, color, hc, hurt)
    else if (base === 'front') kartFront(c, color, hc, hurt)
    else kartSide(c, color, hc, hurt, v === 2 ? 1 : -1)
    c.restore()
  })
}

// ---------------- props ----------------

function palm(c: CanvasRenderingContext2D, w: number, h: number, tall: boolean) {
  const bx = w * 0.5
  const top = h * (tall ? 0.16 : 0.22)
  c.beginPath()
  c.moveTo(bx - 9, h)
  c.quadraticCurveTo(bx - 16, h * 0.55, bx + 6, top)
  c.lineTo(bx + 18, top + 4)
  c.quadraticCurveTo(bx + 2, h * 0.55, bx + 9, h)
  c.closePath()
  fillStroke(c, '#B07A45', 5)
  for (let y = h * 0.85; y > top + 20; y -= 18) {
    c.beginPath()
    c.moveTo(bx - 10 + (h - y) * 0.03, y)
    c.lineTo(bx + 8 + (h - y) * 0.03, y - 4)
    c.lineWidth = 3
    c.strokeStyle = '#7A4F26'
    c.stroke()
  }
  const fx = bx + 12
  const fy = top + 6
  const fronds = [-2.6, -2.0, -1.3, -0.6, 0.0, 0.5, 3.0]
  for (const a of fronds) {
    const len = w * 0.42
    c.beginPath()
    c.moveTo(fx, fy)
    const ex = fx + Math.cos(a) * len
    const ey = fy + Math.sin(a) * len * 0.6 + len * 0.25
    c.quadraticCurveTo(fx + Math.cos(a) * len * 0.5, fy + Math.sin(a) * len * 0.5 - 22, ex, ey)
    c.quadraticCurveTo(fx + Math.cos(a) * len * 0.45, fy + Math.sin(a) * len * 0.3 - 2, fx, fy + 6)
    fillStroke(c, a < -1 || a > 2 ? '#2FAE4A' : '#45C85A', 5)
  }
  c.beginPath()
  c.arc(fx - 4, fy + 10, 7, 0, Math.PI * 2)
  c.arc(fx + 8, fy + 12, 7, 0, Math.PI * 2)
  fillStroke(c, '#7A4F26', 3)
}

function cone(c: CanvasRenderingContext2D, w: number, h: number, col: string, stripe = '#FFFFFF') {
  c.beginPath()
  c.moveTo(w * 0.5, 6)
  c.lineTo(w * 0.82, h - 14)
  c.lineTo(w * 0.18, h - 14)
  c.closePath()
  fillStroke(c, col, 5)
  c.fillStyle = stripe
  c.fillRect(w * 0.34, h * 0.45, w * 0.32, h * 0.12)
  rr(c, w * 0.08, h - 16, w * 0.84, 12, 4)
  fillStroke(c, col, 4)
}

function drawProp(c: CanvasRenderingContext2D, kind: Prop['kind'], w: number, h: number) {
  switch (kind) {
    case 'palm': return palm(c, w, h, false)
    case 'palmTall': return palm(c, w, h, true)
    case 'cypress': {
      c.beginPath()
      c.moveTo(w * 0.5, 4)
      c.quadraticCurveTo(w * 0.95, h * 0.6, w * 0.82, h * 0.86)
      c.lineTo(w * 0.18, h * 0.86)
      c.quadraticCurveTo(w * 0.05, h * 0.6, w * 0.5, 4)
      fillStroke(c, '#2E7A43', 5)
      c.strokeStyle = '#9FB58A'
      c.lineWidth = 4
      for (let i = 0; i < 5; i++) {
        c.beginPath()
        const x = w * (0.3 + i * 0.1)
        c.moveTo(x, h * (0.3 + (i % 2) * 0.1))
        c.lineTo(x - 2, h * (0.5 + (i % 3) * 0.08))
        c.stroke()
      }
      rr(c, w * 0.42, h * 0.84, w * 0.16, h * 0.16, 4)
      fillStroke(c, '#7A5A3A', 4)
      return
    }
    case 'mangrove': {
      c.strokeStyle = INK
      c.lineWidth = 5
      for (let i = 0; i < 5; i++) {
        const x = w * (0.22 + i * 0.14)
        c.beginPath()
        c.moveTo(x, h * 0.5)
        c.quadraticCurveTo(x + (i - 2) * 8, h * 0.8, x + (i - 2) * 12, h - 3)
        c.stroke()
      }
      for (const [x, y, r] of [[0.25, 0.42, 0.2], [0.75, 0.42, 0.2], [0.5, 0.32, 0.26]] as const) {
        c.beginPath()
        c.ellipse(w * x, h * y, w * r, h * r * 1.1, 0, 0, Math.PI * 2)
        fillStroke(c, '#3E9A4A', 5)
      }
      c.fillStyle = '#5DBB5A'
      for (const [x, y] of [[0.42, 0.24], [0.7, 0.34], [0.2, 0.36]] as const) {
        c.beginPath()
        c.ellipse(w * x, h * y, w * 0.07, h * 0.05, -0.4, 0, Math.PI * 2)
        c.fill()
      }
      return
    }
    case 'reeds': {
      c.strokeStyle = '#3C7A36'
      c.lineWidth = 6
      for (let i = 0; i < 6; i++) {
        c.beginPath()
        const x = w * (0.15 + i * 0.14)
        c.moveTo(x, h)
        c.quadraticCurveTo(x - 4, h * 0.5, x + (i % 2 ? 8 : -8), h * (0.1 + (i % 3) * 0.1))
        c.stroke()
      }
      c.fillStyle = '#7A4F26'
      for (let i = 0; i < 3; i++) {
        rr(c, w * (0.22 + i * 0.25), h * (0.2 + (i % 2) * 0.1), 9, 26, 4)
        c.fill()
      }
      return
    }
    case 'mingoStatue':
    case 'flamingo': {
      const ped = kind === 'mingoStatue'
      const base = ped ? h * 0.72 : h
      if (ped) {
        rr(c, w * 0.2, base, w * 0.6, h - base - 4, 6)
        fillStroke(c, '#C9C4DA', 5)
      }
      c.strokeStyle = INK
      c.lineWidth = 9
      c.beginPath()
      c.moveTo(w * 0.5, base)
      c.lineTo(w * 0.5, base - h * 0.28)
      c.stroke()
      c.strokeStyle = '#F06E9A'
      c.lineWidth = 4
      c.stroke()
      c.beginPath()
      c.ellipse(w * 0.5, base - h * 0.34, w * 0.28, h * 0.1, -0.2, 0, Math.PI * 2)
      fillStroke(c, '#FF8FB4', 5)
      c.beginPath()
      c.moveTo(w * 0.62, base - h * 0.38)
      c.quadraticCurveTo(w * 0.85, base - h * 0.55, w * 0.62, base - h * 0.66)
      c.lineWidth = 12
      c.strokeStyle = INK
      c.stroke()
      c.lineWidth = 6
      c.strokeStyle = '#FF8FB4'
      c.stroke()
      c.beginPath()
      c.arc(w * 0.62, base - h * 0.68, w * 0.1, 0, Math.PI * 2)
      fillStroke(c, '#FF8FB4', 5)
      c.beginPath()
      c.moveTo(w * 0.68, base - h * 0.69)
      c.lineTo(w * 0.86, base - h * 0.62)
      c.lineTo(w * 0.7, base - h * 0.64)
      fillStroke(c, '#1E1838', 3)
      return
    }
    case 'gate': {
      for (const x of [0.1, 0.78]) {
        rr(c, w * x, h * 0.2, w * 0.12, h * 0.8 - 3, 6)
        fillStroke(c, '#FFFFFF', 5)
      }
      rr(c, w * 0.04, h * 0.08, w * 0.92, h * 0.22, 14)
      fillStroke(c, '#FF5D4E', 6)
      c.fillStyle = '#FFC83A'
      for (let i = 0; i < 5; i++) {
        c.beginPath()
        c.arc(w * (0.18 + i * 0.16), h * 0.19, 8, 0, Math.PI * 2)
        c.fill()
      }
      return
    }
    case 'ferris': {
      const cx = w / 2
      const cy = h * 0.42
      const r = w * 0.4
      c.strokeStyle = INK
      c.lineWidth = 8
      c.beginPath()
      c.moveTo(cx, cy)
      c.lineTo(w * 0.22, h - 3)
      c.moveTo(cx, cy)
      c.lineTo(w * 0.78, h - 3)
      c.stroke()
      c.beginPath()
      c.arc(cx, cy, r, 0, Math.PI * 2)
      c.lineWidth = 10
      c.stroke()
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 5
      c.stroke()
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        c.beginPath()
        c.moveTo(cx, cy)
        c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        c.strokeStyle = '#C9C4DA'
        c.lineWidth = 3
        c.stroke()
        c.beginPath()
        c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r + 8, 11, 0, Math.PI * 2)
        fillStroke(c, ['#FF5D4E', '#FFC83A', '#3E7BFA', '#2FBF5B', '#FF8FB4'][i % 5], 4)
      }
      return
    }
    case 'coaster': {
      c.beginPath()
      c.moveTo(0, h * 0.95)
      c.bezierCurveTo(w * 0.25, -h * 0.1, w * 0.45, -h * 0.1, w * 0.6, h * 0.55)
      c.bezierCurveTo(w * 0.7, h * 0.85, w * 0.85, h * 0.2, w, h * 0.4)
      c.lineWidth = 12
      c.strokeStyle = INK
      c.stroke()
      c.lineWidth = 6
      c.strokeStyle = '#FF5D4E'
      c.stroke()
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 4
      for (let i = 1; i < 10; i++) {
        c.beginPath()
        c.moveTo(w * i * 0.1, h)
        c.lineTo(w * i * 0.1, h * (i < 6 ? 0.3 + Math.abs(i - 3.5) * 0.12 : 0.6))
        c.stroke()
      }
      return
    }
    case 'tent':
    case 'umbrella': {
      const um = kind === 'umbrella'
      if (um) {
        c.strokeStyle = INK
        c.lineWidth = 6
        c.beginPath()
        c.moveTo(w / 2, h * 0.3)
        c.lineTo(w / 2, h)
        c.stroke()
      } else {
        rr(c, w * 0.12, h * 0.45, w * 0.76, h * 0.55 - 3, 4)
        fillStroke(c, '#FFFFFF', 5)
      }
      c.beginPath()
      c.moveTo(w * 0.5, 4)
      c.lineTo(w * 0.97, h * (um ? 0.36 : 0.5))
      c.lineTo(w * 0.03, h * (um ? 0.36 : 0.5))
      c.closePath()
      fillStroke(c, '#FFFFFF', 5)
      c.save()
      c.clip()
      c.fillStyle = um ? '#2AA8E0' : '#FF5D4E'
      for (let i = 0; i < 6; i += 2) {
        c.beginPath()
        c.moveTo(w * 0.5, 0)
        c.lineTo(w * (i / 6), h)
        c.lineTo(w * ((i + 1) / 6), h)
        c.fill()
      }
      c.restore()
      return
    }
    case 'cart': {
      rr(c, w * 0.1, h * 0.35, w * 0.8, h * 0.45, 8)
      fillStroke(c, '#FFC83A', 5)
      rr(c, w * 0.05, h * 0.12, w * 0.9, h * 0.16, 6)
      fillStroke(c, '#FF5D4E', 5)
      for (const x of [0.28, 0.72]) {
        c.beginPath()
        c.arc(w * x, h * 0.86, h * 0.11, 0, Math.PI * 2)
        fillStroke(c, '#2B2740', 4)
      }
      return
    }
    case 'lamp':
    case 'neon': {
      if (kind === 'lamp') {
        c.strokeStyle = INK
        c.lineWidth = 8
        c.beginPath()
        c.moveTo(w / 2, h)
        c.lineTo(w / 2, h * 0.1)
        c.lineTo(w * 0.78, h * 0.1)
        c.stroke()
        c.strokeStyle = '#6E6A86'
        c.lineWidth = 4
        c.stroke()
        rr(c, w * 0.66, h * 0.08, w * 0.26, h * 0.06, 4)
        fillStroke(c, '#FFF3B8', 4)
      } else {
        c.strokeStyle = INK
        c.lineWidth = 7
        c.beginPath()
        c.moveTo(w / 2, h)
        c.lineTo(w / 2, h * 0.5)
        c.stroke()
        rr(c, w * 0.06, h * 0.06, w * 0.88, h * 0.46, 12)
        fillStroke(c, '#241A4A', 6)
        c.lineWidth = 6
        c.strokeStyle = '#FF4FB8'
        rr(c, w * 0.16, h * 0.12, w * 0.68, h * 0.34, 10)
        c.stroke()
        c.strokeStyle = '#3EE6FF'
        c.beginPath()
        c.moveTo(w * 0.26, h * 0.36)
        c.lineTo(w * 0.42, h * 0.2)
        c.lineTo(w * 0.58, h * 0.36)
        c.lineTo(w * 0.74, h * 0.2)
        c.stroke()
      }
      return
    }
    case 'barrel': {
      rr(c, w * 0.14, 6, w * 0.72, h - 10, 10)
      fillStroke(c, '#FF7A1A', 5)
      c.fillStyle = '#FFFFFF'
      c.fillRect(w * 0.16, h * 0.3, w * 0.68, h * 0.13)
      c.fillRect(w * 0.16, h * 0.6, w * 0.68, h * 0.13)
      return
    }
    case 'cone': return cone(c, w, h, '#FF7A1A')
    case 'buoy': return cone(c, w, h, '#FF5D4E')
    case 'billboard':
    case 'sign': {
      const bb = kind === 'billboard'
      c.strokeStyle = INK
      c.lineWidth = 8
      for (const x of bb ? [0.25, 0.75] : [0.5]) {
        c.beginPath()
        c.moveTo(w * x, h)
        c.lineTo(w * x, h * 0.4)
        c.stroke()
      }
      rr(c, 4, 4, w - 8, h * (bb ? 0.5 : 0.45), 10)
      fillStroke(c, bb ? '#FFFFFF' : '#2FBF5B', 6)
      if (bb) {
        rr(c, w * 0.08, h * 0.08, w * 0.4, h * 0.36, 8)
        c.fillStyle = '#FF8FB4'
        c.fill()
        c.fillStyle = '#3E7BFA'
        c.fillRect(w * 0.55, h * 0.12, w * 0.36, h * 0.07)
        c.fillRect(w * 0.55, h * 0.25, w * 0.28, h * 0.07)
      } else {
        c.fillStyle = '#FFFFFF'
        c.fillRect(w * 0.18, h * 0.16, w * 0.64, h * 0.06)
        c.fillRect(w * 0.18, h * 0.28, w * 0.5, h * 0.06)
      }
      return
    }
    case 'tower': {
      c.strokeStyle = INK
      c.lineWidth = 7
      c.beginPath()
      c.moveTo(w * 0.3, h)
      c.lineTo(w * 0.4, h * 0.4)
      c.moveTo(w * 0.7, h)
      c.lineTo(w * 0.6, h * 0.4)
      c.stroke()
      c.beginPath()
      c.ellipse(w / 2, h * 0.26, w * 0.4, h * 0.18, 0, 0, Math.PI * 2)
      fillStroke(c, '#5CC8FF', 6)
      return
    }
    case 'building': {
      rr(c, w * 0.08, 4, w * 0.84, h - 6, 6)
      fillStroke(c, '#7C8CC4', 6)
      for (let y = 18; y < h - 20; y += 22) {
        for (let x = w * 0.16; x < w * 0.8; x += w * 0.17) {
          c.fillStyle = (x * 7 + y) % 3 < 1.2 ? '#FFE7A8' : '#B9C6F2'
          c.fillRect(x, y, w * 0.1, 12)
        }
      }
      return
    }
    case 'lifeguard': {
      c.strokeStyle = INK
      c.lineWidth = 6
      c.beginPath()
      c.moveTo(w * 0.2, h)
      c.lineTo(w * 0.32, h * 0.5)
      c.moveTo(w * 0.8, h)
      c.lineTo(w * 0.68, h * 0.5)
      c.stroke()
      rr(c, w * 0.18, h * 0.22, w * 0.64, h * 0.3, 6)
      fillStroke(c, '#FFFFFF', 5)
      c.beginPath()
      c.moveTo(w * 0.1, h * 0.24)
      c.lineTo(w * 0.5, 4)
      c.lineTo(w * 0.9, h * 0.24)
      c.closePath()
      fillStroke(c, '#FF5D4E', 5)
      return
    }
    case 'pierPost':
    case 'pelicanPost': {
      rr(c, w * 0.32, h * (kind === 'pelicanPost' ? 0.45 : 0.05), w * 0.36, h, 6)
      fillStroke(c, '#9A6A3E', 5)
      if (kind === 'pelicanPost') {
        c.beginPath()
        c.ellipse(w * 0.5, h * 0.34, w * 0.3, h * 0.12, 0, 0, Math.PI * 2)
        fillStroke(c, '#E8E2D6', 5)
        c.beginPath()
        c.arc(w * 0.62, h * 0.16, w * 0.12, 0, Math.PI * 2)
        fillStroke(c, '#FFFFFF', 4)
        c.beginPath()
        c.moveTo(w * 0.7, h * 0.15)
        c.lineTo(w * 0.98, h * 0.24)
        c.lineTo(w * 0.7, h * 0.22)
        fillStroke(c, '#FFA02E', 3)
      }
      return
    }
    case 'boat': {
      c.beginPath()
      c.moveTo(4, h * 0.45)
      c.lineTo(w - 4, h * 0.45)
      c.lineTo(w * 0.82, h - 4)
      c.lineTo(w * 0.16, h - 4)
      c.closePath()
      fillStroke(c, '#FFFFFF', 5)
      c.fillStyle = '#2AA8E0'
      c.fillRect(w * 0.1, h * 0.58, w * 0.8, h * 0.1)
      rr(c, w * 0.6, h * 0.08, w * 0.3, h * 0.37, 6)
      fillStroke(c, '#C9C4DA', 5)
      return
    }
    case 'rocket': {
      c.beginPath()
      c.moveTo(w / 2, 4)
      c.quadraticCurveTo(w * 0.78, h * 0.15, w * 0.72, h * 0.85)
      c.lineTo(w * 0.28, h * 0.85)
      c.quadraticCurveTo(w * 0.22, h * 0.15, w / 2, 4)
      fillStroke(c, '#FFFFFF', 6)
      c.fillStyle = '#FF5D4E'
      c.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.05)
      for (const s of [-1, 1]) {
        c.beginPath()
        c.moveTo(w / 2 + s * w * 0.22, h * 0.62)
        c.lineTo(w / 2 + s * w * 0.46, h * 0.95)
        c.lineTo(w / 2 + s * w * 0.22, h * 0.86)
        fillStroke(c, '#3E7BFA', 5)
      }
      return
    }
    case 'gantry': {
      c.strokeStyle = INK
      c.lineWidth = 9
      c.strokeRect(w * 0.2, 6, w * 0.6, h - 8)
      c.strokeStyle = '#FF5D4E'
      c.lineWidth = 5
      c.strokeRect(w * 0.2, 6, w * 0.6, h - 8)
      c.lineWidth = 3
      for (let y = 6; y < h; y += w * 0.6) {
        c.beginPath()
        c.moveTo(w * 0.2, y)
        c.lineTo(w * 0.8, y + w * 0.6)
        c.moveTo(w * 0.8, y)
        c.lineTo(w * 0.2, y + w * 0.6)
        c.stroke()
      }
      return
    }
    case 'crowd': {
      const cols = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#2FBF5B', '#FF8FB4', '#8EA6C2']
      for (let i = 0; i < 6; i++) {
        const x = w * (0.1 + i * 0.16)
        rr(c, x - 12, h * 0.5, 24, h * 0.5 - 3, 8)
        fillStroke(c, cols[i % cols.length], 4)
        c.beginPath()
        c.arc(x, h * 0.36, 11, 0, Math.PI * 2)
        fillStroke(c, '#F2C29A', 4)
      }
      return
    }
    case 'gator': {
      c.beginPath()
      c.ellipse(w / 2, h * 0.7, w * 0.45, h * 0.3, 0, Math.PI, 0)
      c.closePath()
      fillStroke(c, '#3F8F3A', 5)
      for (const x of [0.38, 0.6]) {
        c.beginPath()
        c.arc(w * x, h * 0.38, 7, 0, Math.PI * 2)
        fillStroke(c, '#FFF3B8', 3)
      }
      return
    }
  }
}

const PROP_SIZE: Partial<Record<Prop['kind'], [number, number]>> = {
  palm: [150, 190], palmTall: [130, 240], cypress: [110, 200], mangrove: [170, 100], reeds: [70, 70],
  mingoStatue: [110, 200], flamingo: [80, 120], gate: [220, 180], ferris: [240, 260], coaster: [320, 200],
  tent: [140, 120], umbrella: [100, 90], cart: [110, 90], lamp: [60, 180], neon: [130, 160], barrel: [60, 70],
  cone: [50, 56], buoy: [50, 56], billboard: [200, 150], sign: [120, 110], tower: [110, 220], building: [150, 240],
  lifeguard: [110, 120], pierPost: [44, 80], pelicanPost: [80, 120], boat: [140, 80], rocket: [90, 300],
  gantry: [110, 300], crowd: [180, 70], gator: [110, 50],
}

const GLOW = new Set<Prop['kind']>(['neon', 'lamp'])

export function placeholderProp(kind: Prop['kind'], night = false): HTMLCanvasElement {
  const [w, h] = PROP_SIZE[kind] ?? [100, 100]
  return cached(`p:${kind}:${night ? 1 : 0}`, w, h, (c) => {
    drawProp(c, kind, w, h)
    if (night && !GLOW.has(kind)) {
      c.globalCompositeOperation = 'source-atop'
      c.fillStyle = 'rgba(16,10,48,0.55)'
      c.fillRect(0, 0, w, h)
    }
  })
}

// ---------------- things ----------------

export function placeholderThing(kind: SceneThing['kind']): HTMLCanvasElement {
  return cached(`t:${kind}`, 96, 96, (c) => {
    const w = 96
    const h = 96
    switch (kind) {
      case 'box': {
        rr(c, 8, 8, w - 16, h - 16, 16)
        fillStroke(c, '#FFFFFF', 6)
        c.save()
        c.clip()
        const cols = ['#FF5D4E', '#FFC83A', '#2FBF5B', '#3E7BFA']
        for (let i = -2; i < 6; i++) {
          c.fillStyle = cols[((i % 4) + 4) % 4]
          c.globalAlpha = 0.85
          c.beginPath()
          c.moveTo(i * 26, h)
          c.lineTo(i * 26 + 13, h)
          c.lineTo(i * 26 + 13 + h, 0)
          c.lineTo(i * 26 + h, 0)
          c.fill()
        }
        c.restore()
        c.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5
          const r = i % 2 ? 11 : 24
          c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r)
        }
        c.closePath()
        fillStroke(c, '#FFDA3D', 5)
        return
      }
      case 'coin': {
        c.beginPath()
        c.arc(w / 2, h / 2 + 4, 30, 0, Math.PI * 2)
        fillStroke(c, '#E79A12', 6)
        c.beginPath()
        c.arc(w / 2, h / 2, 30, 0, Math.PI * 2)
        fillStroke(c, '#FFC83A', 6)
        rr(c, w / 2 - 6, h / 2 - 16, 12, 32, 6)
        c.fillStyle = '#E79A12'
        c.fill()
        return
      }
      case 'mango': {
        c.beginPath()
        c.ellipse(w / 2, h * 0.62, 34, 24, -0.3, 0, Math.PI * 2)
        fillStroke(c, '#FFB52E', 6)
        c.beginPath()
        c.ellipse(w * 0.4, h * 0.55, 12, 7, -0.3, 0, Math.PI * 2)
        c.fillStyle = '#FF7A3A'
        c.fill()
        c.beginPath()
        c.ellipse(w * 0.62, h * 0.32, 14, 7, 0.6, 0, Math.PI * 2)
        fillStroke(c, '#45C85A', 4)
        return
      }
      case 'coconut': {
        c.beginPath()
        c.arc(w / 2, h * 0.55, 32, 0, Math.PI * 2)
        fillStroke(c, '#8A5A32', 6)
        for (const [x, y] of [[0.42, 0.45], [0.58, 0.45], [0.5, 0.6]]) {
          c.beginPath()
          c.arc(w * x, h * y, 5, 0, Math.PI * 2)
          c.fillStyle = INK
          c.fill()
        }
        return
      }
      case 'pelican': {
        c.beginPath()
        c.ellipse(w / 2, h * 0.55, 30, 18, 0, 0, Math.PI * 2)
        fillStroke(c, '#E8E2D6', 5)
        c.beginPath()
        c.moveTo(w * 0.2, h * 0.5)
        c.lineTo(w * 0.02, h * 0.2)
        c.lineTo(w * 0.45, h * 0.45)
        c.moveTo(w * 0.8, h * 0.5)
        c.lineTo(w * 0.98, h * 0.2)
        c.lineTo(w * 0.55, h * 0.45)
        fillStroke(c, '#FFFFFF', 4)
        c.beginPath()
        c.moveTo(w * 0.5, h * 0.5)
        c.lineTo(w * 0.5, h * 0.92)
        c.lineTo(w * 0.6, h * 0.55)
        fillStroke(c, '#FFA02E', 4)
        return
      }
      case 'hurricane': {
        c.lineWidth = 9
        for (let i = 0; i < 3; i++) {
          c.beginPath()
          c.arc(w / 2, h / 2, 12 + i * 11, i, i + Math.PI * 1.3)
          c.strokeStyle = INK
          c.lineWidth = 11
          c.stroke()
          c.strokeStyle = i === 1 ? '#C9D6E8' : '#FFFFFF'
          c.lineWidth = 6
          c.stroke()
        }
        return
      }
      case 'barrel':
        rr(c, 18, 10, 60, 80, 12)
        fillStroke(c, '#FF7A1A', 6)
        c.fillStyle = '#FFFFFF'
        c.fillRect(20, 32, 56, 12)
        c.fillRect(20, 58, 56, 12)
        return
      case 'pad':
      case 'ramp':
        rr(c, 6, 30, w - 12, 40, 8)
        fillStroke(c, kind === 'pad' ? '#FF8A2E' : '#FFDA3D', 6)
        return
    }
  })
}

/** World heights for things (billboards). */
export const THING_H: Record<SceneThing['kind'], number> = {
  box: 30, coin: 18, mango: 18, coconut: 18, pelican: 34, hurricane: 150, pad: 0, ramp: 0, barrel: 34,
}
