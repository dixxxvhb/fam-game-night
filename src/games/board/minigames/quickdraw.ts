import type { MgBase, Minigame } from './types'
import { botNoise, isInt, judge, noise, obj, seedFrom } from './util'

/**
 * Quick Draw: three rounds. Wait for NOW, tap first. Tapping early, or a reaction under
 * 100 ms (nobody is that fast), knocks you out of that round. Round wins first, then best time.
 */

export const QD_ROUNDS = 3
export const FALSE_START_MS = 100
export const QD_WINDOW = 2500
export const QD_PAUSE = 2200
const MAX_MS = QD_WINDOW

export type QdTap = { ms: number } | 'early'

export interface QdRound {
  /** Host time NOW shows. */
  goAt: number
  /** Host time the round closed (results showing), or null while open. */
  closedAt: number | null
  taps: Record<string, QdTap | null>
}

export interface QdState extends MgBase {
  seed: number
  r: number
  rounds: QdRound[]
}

function goTime(seed: number, r: number, from: number): number {
  return from + 1400 + Math.floor(noise(seed, r) * 3600)
}

function newRound(s: QdState, from: number): QdRound {
  return { goAt: goTime(s.seed, s.rounds.length, from), closedAt: null, taps: Object.fromEntries(s.players.map((id) => [id, null])) }
}

export function qdWinners(s: QdState, round: QdRound): string[] {
  const valid = s.players.filter((id) => { const t = round.taps[id]; return t && t !== 'early' }) as string[]
  if (!valid.length) return []
  const ms = (id: string) => (round.taps[id] as { ms: number }).ms
  const best = Math.min(...valid.map(ms))
  return valid.filter((id) => ms(id) === best)
}

export function qdStats(s: QdState, id: string): { wins: number; best: number | null; early: number } {
  let wins = 0
  let best: number | null = null
  let early = 0
  for (const round of s.rounds) {
    if (round.closedAt === null) continue
    const t = round.taps[id]
    if (t === 'early') early += 1
    else if (t) best = best === null ? t.ms : Math.min(best, t.ms)
    if (qdWinners(s, round).includes(id)) wins += 1
  }
  return { wins, best, early }
}

function close(s: QdState, now: number): QdState {
  const rounds = s.rounds.map((x, i) => (i === s.r ? { ...x, closedAt: now } : x))
  return { ...s, rounds }
}

export const quickdraw: Minigame<QdState> = {
  id: 'quickdraw',
  name: 'Quick Draw',
  rule: 'Wait for NOW, then tap. Tap early and you are out of that round.',
  formats: ['ffa', '1v2', 'duel'],
  soloRule: 'Beat the fastest of the rest to take a round.',
  setup(a) {
    const s: QdState = { players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, seed: seedFrom(a.random), r: 0, rounds: [] }
    return { ...s, rounds: [newRound(s, a.startAt)] }
  },
  reduce(s, id, type, payload, ctx) {
    const round = s.rounds[s.r]
    if (!round || round.closedAt !== null || !(id in round.taps) || round.taps[id] !== null) return s
    const p = obj(payload)
    if (p.r !== s.r || ctx.now < s.startAt) return s
    let tap: QdTap
    if (type === 'early') {
      tap = 'early'
    } else if (type === 'tap') {
      if (!isInt(p.ms, 0, 60000)) return s
      // Claimed to see NOW before it happened, or faster than a human: false start.
      if (ctx.now < round.goAt - 250 || p.ms < FALSE_START_MS) tap = 'early'
      else tap = { ms: Math.min(p.ms, MAX_MS) }
    } else {
      return s
    }
    const next = { ...s, rounds: s.rounds.map((x, i) => (i === s.r ? { ...x, taps: { ...x.taps, [id]: tap } } : x)) }
    const r2 = next.rounds[s.r]
    if (s.players.every((pid) => r2.taps[pid] !== null)) return close(next, ctx.now)
    return next
  },
  tick(s, ctx) {
    const round = s.rounds[s.r]
    if (!round) return s
    if (round.closedAt === null) return ctx.now >= round.goAt + QD_WINDOW ? close(s, ctx.now) : s
    if (ctx.now < round.closedAt + QD_PAUSE || s.r >= QD_ROUNDS - 1) return s
    const next = { ...s, r: s.r + 1 }
    return { ...next, rounds: [...s.rounds, newRound(next, ctx.now)] }
  },
  done: (s, now) => {
    const last = s.rounds[QD_ROUNDS - 1]
    return Boolean(last && last.closedAt !== null && now >= last.closedAt + QD_PAUSE)
  },
  result(s) {
    const stats = Object.fromEntries(s.players.map((id) => [id, qdStats(s, id)]))
    // Round wins first, then the best reaction (lower is better).
    const scores = Object.fromEntries(s.players.map((id) => [id, stats[id].wins * 100000 - (stats[id].best ?? 99999)]))
    const lines = Object.fromEntries(s.players.map((id) => {
      const st = stats[id]
      if (st.best === null) return [id, st.early ? 'Jumped the gun' : 'No taps']
      return [id, `${st.wins} ${st.wins === 1 ? 'win' : 'wins'} · best ${st.best} ms`]
    }))
    const fastest = s.players.filter((id) => stats[id].best !== null).sort((a, b) => stats[a].best! - stats[b].best!)[0]
    return judge(s, {
      scores,
      better: 'high',
      lines,
      headline: () => (fastest ? `Fastest draw: ${stats[fastest].best} ms` : 'Everyone jumped the gun'),
      moment: fastest && stats[fastest].best! < 240 ? { playerId: fastest, label: 'Quick Draw', text: `Reacted in ${stats[fastest].best} ms` } : null,
    })
  },
  bot(s, id, ctx) {
    const round = s.rounds[s.r]
    if (!round || round.closedAt !== null || round.taps[id] !== null) return null
    const k = noise(strSeed(id), s.seed, s.r)
    // About one round in twelve the bot flinches.
    if (k < 0.08) {
      const at = round.goAt - 300 - Math.floor(botNoise(id, s.seed, s.r) * 900)
      return ctx.now >= at ? { type: 'early', payload: { r: s.r } } : null
    }
    const ms = 250 + Math.floor(botNoise(id, s.seed + 1, s.r) * 200)
    return ctx.now >= round.goAt + ms ? { type: 'tap', payload: { r: s.r, ms } } : null
  },
}

function strSeed(id: string): number {
  return Math.floor(botNoise(id) * 2 ** 31)
}
