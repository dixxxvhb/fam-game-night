import type { MgBase, Minigame } from './types'
import { botNoise, clamp, isNum, judge, secs } from './util'

/**
 * Stop the Clock: a timer runs, goes dark after 3 seconds, and you stop it as close to
 * 10.00 s as you can. The phone measures; the host keeps the claim within reach of its
 * own clock (network lag allowed, time travel not).
 */

export const TARGET_MS = 10_000
export const VISIBLE_MS = 3000
export const CLOCK_LIMIT = 20_000
export const COOP_ERR = 600

export interface ClockState extends MgBase {
  stops: Record<string, number | null>
}

/** Keep a phone's claimed time near what the host saw: up to 1.5 s of lag, 0.3 s of clock drift. */
export function clampStop(ms: number, hostElapsed: number): number {
  return Math.round(clamp(ms, Math.max(0, hostElapsed - 1500), Math.min(CLOCK_LIMIT, hostElapsed + 300)))
}

export function clockError(ms: number | null): number {
  return ms === null ? TARGET_MS : Math.abs(ms - TARGET_MS)
}

export const clock: Minigame<ClockState> = {
  id: 'clock',
  name: 'Stop the Clock',
  rule: 'Stop the timer at exactly 10.00 seconds. It goes dark after 3.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Team average within ${(COOP_ERR / 1000).toFixed(1)} s of 10`,
  soloRule: 'Beat the closest of the rest.',
  setup: (a) => ({ players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, stops: Object.fromEntries(a.players.map((id) => [id, null])) }),
  reduce(s, id, type, payload, ctx) {
    if (type !== 'stop' || !(id in s.stops) || s.stops[id] !== null) return s
    const hostElapsed = ctx.now - s.startAt
    if (hostElapsed < 0) return s
    const ms = (payload as { ms?: unknown } | null)?.ms
    if (!isNum(ms, 0, 600_000)) return s
    return { ...s, stops: { ...s.stops, [id]: clampStop(ms, hostElapsed) } }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + CLOCK_LIMIT + 500 || s.players.every((id) => s.stops[id] !== null),
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, s.stops[id] === null ? null : clockError(s.stops[id])]))
    const best = s.players.filter((id) => s.stops[id] !== null).sort((a, b) => clockError(s.stops[a]) - clockError(s.stops[b]))[0]
    return judge(s, {
      scores,
      better: 'low',
      lines: Object.fromEntries(s.players.map((id) => {
        const ms = s.stops[id]
        return [id, ms === null ? 'Never stopped' : `${secs(ms)} (${(clockError(ms) / 1000).toFixed(2)} off)`]
      })),
      coop: () => s.players.reduce((a, id) => a + clockError(s.stops[id]), 0) / s.players.length <= COOP_ERR,
      headline: () => (best ? `Closest: ${secs(s.stops[best]!)}` : 'Nobody stopped it'),
      moment: best && clockError(s.stops[best]) <= 20 ? { playerId: best, label: 'Stop the Clock', text: `Stopped it at ${secs(s.stops[best]!)}` } : null,
    })
  },
  bot(s, id, ctx) {
    if (s.stops[id] !== null) return null
    // Within about 0.6 s of 10, either side.
    const ms = Math.round(TARGET_MS + (botNoise(id, s.startAt) * 2 - 1) * 600)
    return ctx.now >= s.startAt + ms ? { type: 'stop', payload: { ms } } : null
  },
}
