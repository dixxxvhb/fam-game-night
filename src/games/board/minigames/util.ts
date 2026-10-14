import type { MgBase, MgFormat, MgResult } from './types'

/** Deterministic noise in [0, 1) from integers. Host and phones get the same answer. */
export function noise(a: number, b = 0, c = 0): number {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b1) ^ Math.imul(c | 0, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** A stable number from a string (for bot quirks keyed on their id). */
export function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h | 0
}

/** Same as noise, keyed on a bot id. */
export function botNoise(id: string, a = 0, b = 0): number {
  return noise(strHash(id), a, b)
}

export function seedFrom(random: () => number): number {
  return Math.floor(random() * 2 ** 31)
}

export function isInt(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
}

export function isNum(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
}

export function obj(p: unknown): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Places from scores (null = did not finish, ranks last together). Ties share. */
export function rank(scores: Record<string, number | null>, better: 'high' | 'low'): Record<string, number> {
  const ids = Object.keys(scores)
  const key = (id: string) => {
    const v = scores[id]
    if (v === null) return better === 'high' ? -Infinity : Infinity
    return v
  }
  const sorted = [...ids].sort((a, b) => (better === 'high' ? key(b) - key(a) : key(a) - key(b)))
  const out: Record<string, number> = {}
  sorted.forEach((id, i) => {
    const prev = sorted[i - 1]
    out[id] = prev !== undefined && key(prev) === key(id) ? out[prev] : i + 1
  })
  return out
}

export interface JudgeOpts {
  scores: Record<string, number | null>
  better: 'high' | 'low'
  lines: Record<string, string>
  /** How the team's number is made in 1 vs 2. Default: the team's best. */
  team?: 'best' | 'avg'
  /** Co-op success. */
  coop?: (scores: Record<string, number | null>) => boolean
  headline: (r: Omit<MgResult, 'headline' | 'lines'>) => string
  moment?: MgResult['moment']
}

function teamValue(vals: (number | null)[], better: 'high' | 'low', how: 'best' | 'avg'): number | null {
  const real = vals.filter((v): v is number => v !== null)
  if (how === 'avg') {
    // A teammate who did nothing counts as the worst number on the team.
    if (!real.length) return null
    const worst = better === 'high' ? 0 : Math.max(...real)
    const all = vals.map((v) => (v === null ? worst : v))
    return all.reduce((a, b) => a + b, 0) / all.length
  }
  if (!real.length) return null
  return better === 'high' ? Math.max(...real) : Math.min(...real)
}

/** Turn per-player scores into a result for any format. */
export function judge(base: MgBase, o: JudgeOpts): MgResult {
  const places = rank(o.scores, o.better)
  const r: Omit<MgResult, 'headline' | 'lines'> = { places, moment: o.moment ?? null }
  if (base.format === '1v2' && base.solo) {
    const solo = o.scores[base.solo] ?? null
    const team = teamValue(base.players.filter((id) => id !== base.solo).map((id) => o.scores[id] ?? null), o.better, o.team ?? 'best')
    let winner: 'solo' | 'team' | 'none' = 'none'
    if (solo === null && team !== null) winner = 'team'
    else if (team === null && solo !== null) winner = 'solo'
    else if (solo !== null && team !== null && solo !== team) winner = (o.better === 'high' ? solo > team : solo < team) ? 'solo' : 'team'
    r.winner = winner
  }
  if (base.format === 'coop') r.success = o.coop ? o.coop(o.scores) : false
  return { ...r, lines: o.lines, headline: o.headline(r) }
}

export function formatName(f: MgFormat): string {
  return f === 'ffa' ? 'Free for all' : f === '1v2' ? '1 vs the rest' : f === 'coop' ? 'Team vs the House' : 'Duel'
}

/** Seconds with two decimals: 10.03 s */
export function secs(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`
}

/** Seconds with one decimal: 8.4 s */
export function secs1(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
