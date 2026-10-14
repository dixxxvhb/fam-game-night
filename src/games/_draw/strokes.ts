// Shared, pure helpers for the drawing games (Telephone, Draw Bluff).
// Strokes use the Sketch format: { c: '#rrggbb', w: width, p: [x, y, x, y, ...] } in 0..1000 units.
import type { Stroke } from '../sketch/logic'

export type { Stroke }

/** Most strokes one drawing may hold. */
export const MAX_STROKES = 300

/** Points (x, y pairs) across a drawing. */
export function pointCount(strokes: Stroke[]): number {
  let n = 0
  for (const s of strokes) n += s.p.length / 2
  return n
}

/** What a stroke costs on top of its points (its color and width in the JSON, about 30 bytes). */
export const STROKE_COST = 4

/**
 * Ink used, in points: every point plus STROKE_COST per stroke. One unit is about 8 bytes of
 * JSON, so an ink cap bounds the size of a drawing in the broadcast state.
 */
export function inkUsed(strokes: Stroke[]): number {
  let n = 0
  for (const s of strokes) n += s.p.length / 2 + STROKE_COST
  return n
}

/**
 * Ramer-Douglas-Peucker on a flat [x, y, ...] list. Keeps both ends, drops points that sit
 * within `eps` of the line between their neighbours. Keeps drawings small enough to broadcast.
 */
export function simplify(p: number[], eps = 2.5): number[] {
  const n = p.length / 2
  if (n <= 2) return p.slice()
  const keep = new Array<boolean>(n).fill(false)
  keep[0] = true
  keep[n - 1] = true
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const ax = p[a * 2]
    const ay = p[a * 2 + 1]
    const bx = p[b * 2]
    const by = p[b * 2 + 1]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    let far = -1
    let farD = eps
    for (let i = a + 1; i < b; i++) {
      const x = p[i * 2]
      const y = p[i * 2 + 1]
      const d = len === 0 ? Math.hypot(x - ax, y - ay) : Math.abs(dy * x - dx * y + bx * ay - by * ax) / len
      if (d > farD) { farD = d; far = i }
    }
    if (far > 0) {
      keep[far] = true
      stack.push([a, far], [far, b])
    }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1])
  return out
}

/**
 * Put points back along long straight runs (no gap over `maxSeg`). The renderer curves through
 * midpoints, so a simplified stroke with long gaps would round every corner into a blob.
 */
export function densify(p: number[], maxSeg = 24): number[] {
  if (p.length < 4) return p.slice()
  const out = [p[0], p[1]]
  for (let i = 2; i < p.length; i += 2) {
    const x0 = p[i - 2]
    const y0 = p[i - 1]
    const x1 = p[i]
    const y1 = p[i + 1]
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxSeg)
    for (let k = 1; k < n; k++) out.push(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n))
    out.push(x1, y1)
  }
  return out
}

/** What the pad sends: simplified, then filled back in on long runs. */
export function tidy(p: number[]): number[] {
  return densify(simplify(p))
}

/**
 * Validate a stroke from a phone. Clamps coordinates, rounds, and trims it to the ink `budget`
 * left (its points plus STROKE_COST). Returns null for junk or when there is no ink left.
 */
export function cleanStroke(x: unknown, budget: number): Stroke | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Partial<Stroke>
  if (typeof s.c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.c)) return null
  const w = Number(s.w)
  if (!Number.isFinite(w) || w < 1 || w > 80) return null
  if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2 !== 0) return null
  const room = Math.floor(budget) - STROKE_COST
  if (room < 1) return null
  const p = s.p.slice(0, room * 2).map((v) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0))))
  return { c: s.c, w: Math.round(w), p }
}

// ---------------- text helpers ----------------

/** Lowercase, no accents, letters and digits only. */
export function squash(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

/** Lowercase words without the little ones, for "is this the same title" checks. */
export function titleKey(s: string): string {
  const words = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
  return words.filter((w) => !['a', 'an', 'the'].includes(w)).join('')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** True when two titles are basically the same words (case, punctuation, articles, a typo). */
export function sameTitle(a: string, b: string): boolean {
  const x = titleKey(a)
  const y = titleKey(b)
  if (!x || !y) return false
  if (x === y) return true
  // Short titles must match exactly ("a cat in a hat" vs "a bat in a hat" is a real lie).
  // Longer ones forgive a typo, very long ones two.
  const long = Math.max(x.length, y.length)
  if (long < 12) return false
  return levenshtein(x, y) <= (long >= 20 ? 2 : 1)
}

/** Clean a typed line: trim, collapse spaces, drop control characters, cap the length. */
export function cleanText(x: unknown, max: number): string {
  if (typeof x !== 'string') return ''
  let out = ''
  for (const ch of x.slice(0, max * 4)) {
    const c = ch.charCodeAt(0)
    out += c < 32 || c === 127 ? ' ' : ch
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max).trim()
}
