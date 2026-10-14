/**
 * The horizon band: a 360-degree panorama strip per TrackLook.horizon (park rides, a city
 * skyline, a cypress line, open ocean, the Space Coast), painted once and scrolled with the
 * camera's yaw. Its bottom fades into the haze so it meets the fogged floor without a seam.
 */
import { INK } from '../../board/park/cast'
import type { TrackLook } from '../contract'
import { seeded } from './look'

export const STRIP_W = 2048
export const STRIP_H = 256

const cache = new Map<string, HTMLCanvasElement>()

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, night: boolean) {
  c.fillStyle = night ? 'rgba(120,100,180,0.35)' : 'rgba(255,255,255,0.95)'
  c.beginPath()
  c.arc(x, y, 18 * s, Math.PI * 0.5, Math.PI * 1.5)
  c.arc(x + 22 * s, y - 14 * s, 20 * s, Math.PI, Math.PI * 2)
  c.arc(x + 50 * s, y - 8 * s, 16 * s, Math.PI * 1.2, Math.PI * 2.2)
  c.arc(x + 66 * s, y + 2 * s, 16 * s, Math.PI * 1.5, Math.PI * 0.5)
  c.closePath()
  c.fill()
}

export function horizonStrip(look: TrackLook): HTMLCanvasElement {
  const key = `${look.horizon}:${look.skyBottom}:${look.night ? 1 : 0}`
  let cv = cache.get(key)
  if (cv) return cv
  cv = document.createElement('canvas')
  cv.width = STRIP_W
  cv.height = STRIP_H
  const c = cv.getContext('2d')!
  const W = STRIP_W
  const H = STRIP_H
  const rnd = seeded(look.horizon.length * 977 + (look.night ? 5 : 0))
  const night = Boolean(look.night)
  // clouds or stars high up
  if (night) {
    c.fillStyle = '#FFFFFF'
    for (let i = 0; i < 120; i++) c.fillRect(rnd() * W, rnd() * H * 0.55, 2, 2)
  } else {
    for (let i = 0; i < 9; i++) cloud(c, (i / 9) * W + rnd() * 120, 40 + rnd() * 70, 0.8 + rnd() * 0.9, false)
  }
  const base = H - 6
  const tone = (day: string, nite: string) => (night ? nite : day)
  // far layer
  c.fillStyle = tone('#9CC9DE', '#2C1F5A')
  c.beginPath()
  c.moveTo(0, base)
  for (let x = 0; x <= W; x += 32) c.lineTo(x, base - 26 - Math.sin(x * 0.01) * 10 - rnd() * 6)
  c.lineTo(W, base)
  c.fill()
  const near = tone('#5E9AB8', '#1B1240')
  c.fillStyle = near
  c.strokeStyle = INK
  c.lineWidth = 3
  switch (look.horizon) {
    case 'park': {
      // ferris wheel, coaster hill, tents, palms
      for (let rep = 0; rep < 2; rep++) {
        const ox = rep * W / 2
        c.beginPath()
        c.arc(ox + 260, base - 92, 70, 0, Math.PI * 2)
        c.lineWidth = 7
        c.strokeStyle = tone('#4A84A6', '#3A2A78')
        c.stroke()
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          c.beginPath()
          c.moveTo(ox + 260, base - 92)
          c.lineTo(ox + 260 + Math.cos(a) * 70, base - 92 + Math.sin(a) * 70)
          c.lineWidth = 2
          c.stroke()
        }
        c.beginPath()
        c.moveTo(ox + 520, base)
        c.bezierCurveTo(ox + 580, base - 170, ox + 640, base - 170, ox + 680, base - 40)
        c.bezierCurveTo(ox + 720, base - 120, ox + 760, base - 110, ox + 800, base)
        c.lineWidth = 6
        c.stroke()
        for (let i = 0; i < 5; i++) {
          c.fillStyle = [tone('#E57B8C', '#6A2B7A'), tone('#E8C46A', '#4A3A8A')][i % 2]
          c.beginPath()
          const x = ox + 120 + i * 190 + rnd() * 40
          c.moveTo(x, base - 44)
          c.lineTo(x + 30, base)
          c.lineTo(x - 30, base)
          c.fill()
        }
      }
      break
    }
    case 'city': {
      for (let x = 0; x < W; ) {
        const bw = 30 + rnd() * 60
        const bh = 40 + rnd() * (night ? 150 : 120)
        c.fillStyle = near
        c.fillRect(x, base - bh, bw, bh)
        c.fillStyle = tone('rgba(255,255,255,0.35)', 'rgba(255,214,120,0.85)')
        for (let y = base - bh + 8; y < base - 8; y += 14) {
          for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (rnd() < (night ? 0.45 : 0.3)) c.fillRect(wx, y, 5, 7)
        }
        if (night && rnd() < 0.25) {
          c.fillStyle = rnd() < 0.5 ? '#FF4FB8' : '#3EE6FF'
          c.fillRect(x + 4, base - bh - 6, bw - 8, 4)
        }
        x += bw + 4 + rnd() * 10
      }
      break
    }
    case 'swamp': {
      c.fillStyle = tone('#3E7A50', '#1A2A3A')
      for (let x = 0; x < W; x += 18 + rnd() * 22) {
        const h = 50 + rnd() * 70
        c.beginPath()
        c.moveTo(x - 14, base)
        c.quadraticCurveTo(x - 10, base - h * 0.7, x, base - h)
        c.quadraticCurveTo(x + 10, base - h * 0.7, x + 14, base)
        c.fill()
      }
      break
    }
    case 'ocean': {
      c.clearRect(0, base - 40, W, 46)
      c.fillStyle = tone('#2AA8E0', '#14305A')
      c.fillRect(0, base - 18, W, 24)
      c.fillStyle = 'rgba(255,255,255,0.6)'
      for (let i = 0; i < 60; i++) c.fillRect(rnd() * W, base - 16 + rnd() * 18, 14, 2)
      // a far sail or two
      for (let i = 0; i < 3; i++) {
        const x = rnd() * W
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.moveTo(x, base - 18)
        c.lineTo(x + 8, base - 42)
        c.lineTo(x + 16, base - 18)
        c.fill()
      }
      break
    }
    case 'space': {
      c.fillStyle = tone('#C9B48A', '#2A2050')
      c.fillRect(0, base - 18, W, 24)
      for (let rep = 0; rep < 2; rep++) {
        const ox = rep * W / 2 + 300
        c.fillStyle = tone('#7E8AA6', '#2C2A5A')
        c.fillRect(ox, base - 190, 26, 190)
        c.fillStyle = tone('#F4F4F8', '#8A86B0')
        c.beginPath()
        c.moveTo(ox + 50, base - 210)
        c.lineTo(ox + 62, base - 160)
        c.lineTo(ox + 62, base - 18)
        c.lineTo(ox + 38, base - 18)
        c.lineTo(ox + 38, base - 160)
        c.fill()
        c.fillStyle = tone('#8E9AB6', '#2C2A5A')
        c.fillRect(ox + 380, base - 80, 120, 80)
      }
      break
    }
  }
  // fade to haze at the bottom
  const g = c.createLinearGradient(0, base - 60, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, look.skyBottom)
  c.fillStyle = g
  c.fillRect(0, base - 60, W, H - base + 60)
  cache.set(key, cv)
  return cv
}
