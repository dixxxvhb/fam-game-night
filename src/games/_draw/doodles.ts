// Bot "drawings": a few simple shapes in the 0..1000 square. Pure, uses the given random.
import { densify, type Stroke } from './strokes'

const BOT_INKS = ['#0C1130', '#0C1130', '#0C1130', '#E5484D', '#3B6FE0', '#2FA65A', '#8E4EC6', '#FF6B3D']

const clamp = (v: number) => Math.max(20, Math.min(980, Math.round(v)))

/** One shape: a circle, box, triangle, zigzag, squiggle or line, somewhere on the page. */
export function doodle(random: () => number): Stroke {
  const cx = 220 + random() * 560
  const cy = 220 + random() * 560
  const r = 70 + random() * 190
  const kind = Math.floor(random() * 6)
  const pts: [number, number][] = []
  if (kind === 0) {
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2
      pts.push([cx + r * Math.cos(a), cy + r * 0.85 * Math.sin(a)])
    }
  } else if (kind === 1) {
    pts.push([cx - r, cy - r * 0.7], [cx + r, cy - r * 0.7], [cx + r, cy + r * 0.7], [cx - r, cy + r * 0.7], [cx - r, cy - r * 0.7])
  } else if (kind === 2) {
    pts.push([cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8], [cx, cy - r])
  } else if (kind === 3) {
    const n = 5 + Math.floor(random() * 4)
    for (let i = 0; i <= n; i++) pts.push([cx - r + (2 * r * i) / n, cy + (i % 2 ? -r : r) * 0.4])
  } else if (kind === 4) {
    let x = cx
    let y = cy
    for (let i = 0; i < 10; i++) {
      pts.push([x, y])
      x += (random() - 0.5) * 220
      y += (random() - 0.5) * 220
    }
  } else {
    pts.push([cx - r, cy - r * (random() - 0.5)], [cx + r, cy + r * (random() - 0.5)])
  }
  const flat = pts.flatMap(([x, y]) => [clamp(x), clamp(y)])
  return { c: BOT_INKS[Math.floor(random() * BOT_INKS.length)], w: random() < 0.75 ? 8 : 20, p: densify(flat, 24) }
}

/** A small stable number from a string, for things a bot should decide once (how many strokes). */
export function hashOf(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
