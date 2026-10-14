import type { MgBase, Minigame } from './types'
import { shuffle } from '../../../lib/shuffle'
import { botNoise, clamp, isInt, isNum, judge, obj } from './util'

/**
 * Eight Count: three eights, each with a pattern of counts to hit (1, 3, 5, 7 and friends).
 * A lead-in "5, 6, 7, 8", then the count. Tap on the pattern counts only. Scored on timing:
 * dead on is 100, half a beat off is 0, and every extra tap costs a quarter of a hit.
 */

export const PATTERNS: number[][] = [
  [1, 3, 5, 7],
  [1, 2, 3, 5, 7],
  [1, 4, 5, 8],
  [2, 4, 6, 8],
  [1, 2, 5, 6],
  [1, 3, 4, 7, 8],
  [1, 5, 6, 7],
  [1, 2, 3, 4, 7],
  [3, 4, 7, 8],
]
export const BPMS = [100, 112, 124]
export const PRE_MS = 1400
export const GAP_MS = 1700
export const LATE_MS = 2500
export const MAX_TAPS = 16
export const EXTRA_COST = 0.25
export const COOP_PCT = 70

export interface EightRound {
  bpm: number
  beat: number
  pattern: number[]
  /** Host time of count 1. */
  oneAt: number
  /** Host time the window closes (half a beat after 8). */
  endAt: number
}

export interface EightTap { c: number; off: number }

export interface EightState extends MgBase {
  rounds: EightRound[]
  /** Accuracy 0..100 per round per player, null = not in yet. */
  scores: Record<string, (number | null)[]>
}

export function countTime(r: EightRound, c: number): number {
  return r.oneAt + (c - 1) * r.beat
}

/** Where the music is at host time t. */
export function beatAt(s: EightState, t: number): { r: number; phase: 'show' | 'lead' | 'count' | 'gap' | 'end'; count: number; beatStart: number } {
  for (let i = 0; i < s.rounds.length; i++) {
    const r = s.rounds[i]
    const leadAt = r.oneAt - 4 * r.beat
    const showAt = leadAt - PRE_MS
    if (t < showAt) return { r: i, phase: 'gap', count: 0, beatStart: 0 }
    if (t < leadAt) return { r: i, phase: 'show', count: 0, beatStart: 0 }
    if (t < r.oneAt) {
      const k = Math.floor((t - leadAt) / r.beat)
      return { r: i, phase: 'lead', count: 5 + k, beatStart: leadAt + k * r.beat }
    }
    if (t < r.endAt) {
      const k = Math.min(7, Math.floor((t - r.oneAt + r.beat / 2) / r.beat))
      return { r: i, phase: 'count', count: k + 1, beatStart: r.oneAt + k * r.beat }
    }
  }
  return { r: s.rounds.length - 1, phase: 'end', count: 0, beatStart: 0 }
}

/** Accuracy 0..100 for one eight. */
export function scoreEight(r: EightRound, taps: EightTap[]): number {
  const tol = r.beat * 0.5
  let hits = 0
  let extras = 0
  // Best tap per pattern count; everything else is extra.
  const byCount = new Map<number, EightTap[]>()
  for (const t of taps) byCount.set(t.c, [...(byCount.get(t.c) ?? []), t])
  for (const [c, list] of byCount) {
    if (!r.pattern.includes(c)) { extras += list.length; continue }
    const best = list.reduce((a, b) => (Math.abs(b.off) < Math.abs(a.off) ? b : a))
    hits += Math.max(0, 1 - Math.abs(best.off) / tol)
    extras += list.length - 1
  }
  return Math.round(Math.max(0, (hits - extras * EXTRA_COST) / r.pattern.length) * 100)
}

export function eightTotal(s: EightState, id: string): number {
  const list = s.scores[id] ?? []
  return Math.round(s.rounds.reduce((a, _, i) => a + (list[i] ?? 0), 0) / s.rounds.length)
}

/** Nearest count (1..8) to host time t in round r, with the offset in ms. */
export function nearestCount(r: EightRound, t: number): EightTap | null {
  const c = Math.round((t - r.oneAt) / r.beat) + 1
  if (c < 1 || c > 8) return null
  return { c, off: Math.round(t - countTime(r, c)) }
}

export const eight: Minigame<EightState> = {
  id: 'eight',
  name: 'Eight Count',
  rule: 'Five, six, seven, eight. Tap only on the lit counts, right on the beat.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Team average ${COOP_PCT}% or better`,
  soloRule: 'Beat the best of the rest.',
  setup(a) {
    const picks = shuffle(PATTERNS, a.random)
    const fours = picks.filter((p) => p.length === 4)
    const fives = picks.filter((p) => p.length === 5)
    const chosen = [fours[0], fours[1], fives[0]]
    const rounds: EightRound[] = []
    let t = a.startAt
    BPMS.forEach((bpm, i) => {
      const beat = Math.round(60000 / bpm)
      const oneAt = t + PRE_MS + 4 * beat
      const endAt = oneAt + 7 * beat + Math.round(beat / 2)
      rounds.push({ bpm, beat, pattern: chosen[i], oneAt, endAt })
      t = endAt + GAP_MS
    })
    return { players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, rounds, scores: Object.fromEntries(a.players.map((id) => [id, rounds.map(() => null)])) }
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'taps' || !s.scores[id]) return s
    const p = obj(payload)
    if (!isInt(p.r, 0, s.rounds.length - 1)) return s
    const round = s.rounds[p.r]
    if (s.scores[id][p.r] !== null || ctx.now < round.oneAt || ctx.now > round.endAt + LATE_MS || !Array.isArray(p.taps)) return s
    const taps: EightTap[] = []
    for (const raw of p.taps.slice(0, MAX_TAPS)) {
      const t = obj(raw)
      if (!isInt(t.c, 1, 8) || !isNum(t.off, -60000, 60000)) return s
      taps.push({ c: t.c, off: clamp(t.off, -round.beat / 2, round.beat / 2) })
    }
    const list = [...s.scores[id]]
    list[p.r] = scoreEight(round, taps)
    return { ...s, scores: { ...s.scores, [id]: list } }
  },
  tick: (s) => s,
  done(s, now) {
    const last = s.rounds[s.rounds.length - 1]
    if (now >= last.endAt + LATE_MS + 200) return true
    return now >= last.endAt && s.players.every((id) => s.scores[id][s.rounds.length - 1] !== null)
  },
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, eightTotal(s, id)]))
    const best = [...s.players].sort((a, b) => scores[b] - scores[a])[0]
    return judge(s, {
      scores,
      better: 'high',
      lines: Object.fromEntries(s.players.map((id) => [id, `${scores[id]}% on the beat`])),
      coop: () => s.players.reduce((a, id) => a + scores[id], 0) / s.players.length >= COOP_PCT,
      headline: () => `Cleanest count: ${scores[best]}%`,
      moment: scores[best] >= 92 ? { playerId: best, label: 'Eight Count', text: `${scores[best]}% on the beat` } : null,
    })
  },
  bot(s, id, ctx) {
    const list = s.scores[id]
    if (!list) return null
    for (let i = 0; i < s.rounds.length; i++) {
      const r = s.rounds[i]
      if (list[i] !== null || ctx.now < r.endAt + 200 + botNoise(id, r.oneAt) * 600) continue
      if (ctx.now > r.endAt + LATE_MS) continue
      // A decent dancer: 30 to 110 ms off, the odd extra tap.
      const sloppy = 30 + botNoise(id, s.startAt) * 80
      const taps: EightTap[] = r.pattern.map((c, k) => ({ c, off: Math.round((botNoise(id, r.oneAt, k) * 2 - 1) * sloppy) }))
      if (botNoise(id, r.oneAt, 99) < 0.3) {
        const miss = [1, 2, 3, 4, 5, 6, 7, 8].find((c) => !r.pattern.includes(c)) ?? 8
        taps.push({ c: miss, off: 40 })
      }
      return { type: 'taps', payload: { r: i, taps } }
    }
    return null
  },
}
