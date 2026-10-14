import type { MgBase, Minigame } from './types'
import { botNoise, isInt, judge, obj } from './util'

/** Mash: tap as fast as you can for 8 seconds. Phones count, the host caps at 16 taps a second. */

export const MASH_MS = 8000
export const MASH_GRACE = 1500
export const MAX_RATE = 16
export const COOP_PER = 50

export interface MashState extends MgBase {
  taps: Record<string, number | null>
}

/** Most taps a phone can claim after `elapsed` ms of play. */
export function mashCap(elapsed: number): number {
  return Math.floor((MAX_RATE * Math.max(0, Math.min(MASH_MS, elapsed))) / 1000)
}

export const mash: Minigame<MashState> = {
  id: 'mash',
  name: 'Mash',
  rule: 'Tap as fast as you can for 8 seconds.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Average ${COOP_PER} taps each`,
  soloRule: 'The rest of you are scored on your average.',
  setup: (a) => ({ players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, taps: Object.fromEntries(a.players.map((id) => [id, null])) }),
  reduce(s, id, type, payload, ctx) {
    if (type !== 'taps' || !(id in s.taps) || s.taps[id] !== null) return s
    const n = obj(payload).n
    if (!isInt(n, 0, 100000)) return s
    const elapsed = ctx.now - s.startAt
    if (elapsed < 0) return s
    return { ...s, taps: { ...s.taps, [id]: Math.min(n, mashCap(elapsed)) } }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + MASH_MS + MASH_GRACE || s.players.every((id) => s.taps[id] !== null),
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, s.taps[id] ?? 0]))
    const top = [...s.players].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0]
    return judge(s, {
      scores,
      better: 'high',
      team: 'avg',
      lines: Object.fromEntries(s.players.map((id) => [id, `${scores[id]} taps`])),
      coop: (sc) => Object.values(sc).reduce<number>((a, b) => a + (b ?? 0), 0) >= COOP_PER * s.players.length,
      headline: () => `Top mash: ${scores[top]} taps`,
      moment: top && scores[top] >= 100 ? { playerId: top, label: 'Mash', text: `${scores[top]} taps in 8 seconds` } : null,
    })
  },
  bot(s, id, ctx) {
    if (s.taps[id] !== null || ctx.now < s.startAt + MASH_MS + 150 + botNoise(id, s.startAt) * 400) return null
    return { type: 'taps', payload: { n: Math.round((botMashRate(id, s.startAt) * MASH_MS) / 1000) } }
  },
}

/** A bot's taps per second this run (8 to 11). The TV uses it to fill a bot's bar live. */
export function botMashRate(id: string, startAt: number): number {
  return 8 + botNoise(id, startAt, 1) * 3
}
