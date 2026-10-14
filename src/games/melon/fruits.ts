/**
 * Melon's pure helpers: the fruit ladder, scoring, junk sizes, and the jar snapshot
 * the phones stream to the TV. No DOM, no physics, no randomness here.
 */

export interface Fruit {
  tier: number
  name: string
  /** Radius in world units (the jar is WORLD_W x WORLD_H). */
  r: number
  color: string
  /** Outline and detail ink. */
  dark: string
  detail: string
}

/** The jar every phone plays, whatever its screen size. */
export const WORLD_W = 600
export const WORLD_H = 860
/** Where the held fruit hangs before it drops. */
export const DROP_Y = 72
/** A settled fruit above this line for 2 seconds tops you out. */
export const DANGER_Y = 150
export const OVER_MS = 2000

export const TIERS = 11
/** Fruit the drop queue deals: tiers 1 to 5. */
export const DROP_MAX_TIER = 5

export const FRUITS: Fruit[] = [
  { tier: 1, name: 'cherry', r: 22, color: '#C8193F', dark: '#7A0C25', detail: '#3E7D2C' },
  { tier: 2, name: 'strawberry', r: 30, color: '#FF5C83', dark: '#B42A4C', detail: '#FFE7A3' },
  { tier: 3, name: 'grape', r: 38, color: '#9061F9', dark: '#5531A8', detail: '#B795FF' },
  { tier: 4, name: 'orange', r: 50, color: '#FFA62B', dark: '#B86A0A', detail: '#D97F0E' },
  { tier: 5, name: 'persimmon', r: 60, color: '#EE5A28', dark: '#9C3010', detail: '#4F8A2E' },
  { tier: 6, name: 'apple', r: 70, color: '#E23434', dark: '#951919', detail: '#46A84F' },
  { tier: 7, name: 'pear', r: 80, color: '#E2D86A', dark: '#9A9030', detail: '#7A5230' },
  { tier: 8, name: 'peach', r: 92, color: '#FFB4A2', dark: '#C9705C', detail: '#E8836E' },
  { tier: 9, name: 'pineapple', r: 118, color: '#FFCB2E', dark: '#B5800C', detail: '#C68A10' },
  { tier: 10, name: 'melon', r: 146, color: '#A9E37A', dark: '#5E9A38', detail: '#6DB24B' },
  { tier: 11, name: 'watermelon', r: 176, color: '#2E9E4F', dark: '#14502A', detail: '#165E2E' },
]

export function fruit(tier: number): Fruit {
  return FRUITS[Math.max(1, Math.min(TIERS, Math.round(tier))) - 1]
}

export function isTier(t: unknown): t is number {
  return typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= TIERS
}

/** Points for a merge that makes `tier`: triangular numbers 1, 3, 6, ... 66. */
export function mergeScore(tier: number): number {
  const t = Math.max(1, Math.min(TIERS, Math.round(tier)))
  return (t * (t + 1)) / 2
}

/** Two watermelons meeting: both vanish for this. */
export const WATERMELON_BONUS = 100

/** Points for two fruits of `tier` merging (watermelons pop for the bonus). */
export function pointsForPair(tier: number): number {
  return tier >= TIERS ? WATERMELON_BONUS : mergeScore(tier + 1)
}

/** Attack mode: making tier 5 or bigger throws this many junk fruit at a rival. */
export const ATTACK_MIN_TIER = 5
export const MAX_JUNK = 6
export function junkFor(madeTier: number): number {
  if (madeTier < ATTACK_MIN_TIER) return 0
  return Math.min(MAX_JUNK, madeTier - 3)
}
/** Junk is small stuff: tiers 1 to 3. */
export const JUNK_MAX_TIER = 3

/** "a grape", "an orange", "a watermelon". */
export function withArticle(name: string): string {
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** 125000 -> "2:05" (rounds up, never negative). */
export function clock(ms: number): string {
  const secs = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

// ---------------- live jar snapshot (stream 'melon:jar') ----------------

export const SNAP_KIND = 'melon:jar'
export const MAX_SNAP_FRUIT = 120

export interface SnapFruit { t: number; x: number; y: number }
/** s = score, f = every fruit in world units (rounded ints). */
export interface JarSnap { s: number; f: SnapFruit[] }

export function encodeSnap(score: number, fruits: { tier: number; x: number; y: number }[]): JarSnap {
  const f: SnapFruit[] = []
  for (const b of fruits) {
    if (f.length >= MAX_SNAP_FRUIT) break
    f.push({ t: b.tier, x: Math.round(b.x), y: Math.round(b.y) })
  }
  return { s: Math.max(0, Math.round(score)), f }
}

function clampInt(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.max(lo, Math.min(hi, Math.round(v)))
}

/** Read a snapshot off the wire. Junk is dropped, numbers are clamped. Null if unusable. */
export function decodeSnap(raw: unknown): JarSnap | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { s?: unknown; f?: unknown }
  const s = clampInt(r.s, 0, 99_999_999)
  if (s === null || !Array.isArray(r.f)) return null
  const f: SnapFruit[] = []
  for (const item of r.f.slice(0, MAX_SNAP_FRUIT)) {
    if (!item || typeof item !== 'object') continue
    const it = item as { t?: unknown; x?: unknown; y?: unknown }
    if (!isTier(it.t)) continue
    const x = clampInt(it.x, -200, WORLD_W + 200)
    const y = clampInt(it.y, -400, WORLD_H + 200)
    if (x === null || y === null) continue
    f.push({ t: it.t, x, y })
  }
  return { s, f }
}
