import type { MgBase, Minigame } from './types'
import { botNoise, judge, noise, obj, seedFrom } from './util'

/**
 * Hot Potato: a bomb passes along when its holder taps. It blows at a hidden time and
 * the holder is out. Free for all: rounds until one is left. 1 vs the rest: one bomb that
 * goes solo, teammate, solo, other teammate; the solo player wins if it blows on the team.
 */

export const MIN_HOLD_MS = 250
export const BOOM_SHOW_MS = 2600

export interface PotatoState extends MgBase {
  seed: number
  round: number
  holder: string
  heldAt: number
  /** Hidden from the screens. Trust-based, like everything else. */
  boomAt: number
  alive: Record<string, boolean>
  /** Out, in order (first out first). */
  out: string[]
  /** 1v2: which teammate gets it next from the solo player. */
  teamTurn: number
  passes: number
  phase: 'play' | 'boom'
  phaseAt: number
  /** Who it blew up on last. */
  blown: string | null
  over: boolean
}

function fuse(s: Pick<PotatoState, 'seed' | 'round' | 'format'>): number {
  const k = noise(s.seed, s.round)
  return s.format === '1v2' ? 10_000 + Math.floor(k * 10_000) : 6000 + Math.floor(k * 8000)
}

export function nextHolder(s: PotatoState): string {
  if (s.format === '1v2' && s.solo) {
    const team = s.players.filter((id) => id !== s.solo)
    if (s.holder === s.solo) return team[s.teamTurn % team.length]
    return s.solo
  }
  const alive = s.players.filter((id) => s.alive[id])
  const i = alive.indexOf(s.holder)
  return alive[(i + 1) % alive.length]
}

function startRound(s: PotatoState, now: number): PotatoState {
  const alive = s.players.filter((id) => s.alive[id])
  const holder = alive[Math.floor(noise(s.seed, s.round, 9) * alive.length)]
  const next = { ...s, holder, heldAt: now, phase: 'play' as const, phaseAt: now, blown: null }
  return { ...next, boomAt: now + fuse(next) }
}

export const potato: Minigame<PotatoState> = {
  id: 'potato',
  name: 'Hot Potato',
  rule: 'Got the bomb? Tap to pass it on. Whoever holds it when it blows is out.',
  formats: ['ffa', '1v2', 'duel'],
  soloRule: 'It goes back and forth between you and them. Make it blow on their side.',
  setup(a) {
    const base: PotatoState = {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, seed: seedFrom(a.random), round: 0,
      holder: a.players[0], heldAt: a.startAt, boomAt: 0,
      alive: Object.fromEntries(a.players.map((id) => [id, true])), out: [], teamTurn: 0, passes: 0,
      phase: 'play', phaseAt: a.startAt, blown: null, over: false,
    }
    if (a.format === '1v2' && a.solo) {
      const s = { ...base, holder: a.solo }
      return { ...s, boomAt: a.startAt + fuse(s) }
    }
    return startRound(base, a.startAt)
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'pass' || s.over || s.phase !== 'play' || id !== s.holder) return s
    if (obj(payload).round !== s.round || ctx.now < s.startAt || ctx.now < s.heldAt + MIN_HOLD_MS || ctx.now >= s.boomAt) return s
    const to = nextHolder(s)
    const teamTurn = s.format === '1v2' && id === s.solo ? s.teamTurn + 1 : s.teamTurn
    return { ...s, holder: to, heldAt: ctx.now, teamTurn, passes: s.passes + 1 }
  },
  tick(s, ctx) {
    if (s.over) return s
    if (s.phase === 'boom') {
      if (ctx.now < s.phaseAt + BOOM_SHOW_MS) return s
      const alive = s.players.filter((id) => s.alive[id])
      if (s.format === '1v2' || alive.length <= 1) return { ...s, over: true }
      return startRound({ ...s, round: s.round + 1 }, ctx.now)
    }
    if (ctx.now < s.boomAt || ctx.now < s.startAt) return s
    return {
      ...s,
      phase: 'boom',
      phaseAt: ctx.now,
      blown: s.holder,
      alive: { ...s.alive, [s.holder]: false },
      out: [...s.out, s.holder],
    }
  },
  done: (s) => s.over,
  result(s) {
    // Out later is better; never out is best.
    const scores = Object.fromEntries(s.players.map((id) => {
      const k = s.out.indexOf(id)
      return [id, k < 0 ? 1000 : k]
    }))
    let winner: 'solo' | 'team' | 'none' | undefined
    if (s.format === '1v2' && s.solo) winner = s.blown === s.solo ? 'team' : s.blown ? 'solo' : 'none'
    const r = judge(s, {
      scores,
      better: 'high',
      lines: Object.fromEntries(s.players.map((id) => {
        const k = s.out.indexOf(id)
        return [id, k < 0 ? 'Survived' : s.format === '1v2' || s.out.length === 1 ? 'Blew up' : `Blew up ${ordinal(k + 1)}`]
      })),
      headline: () => (s.blown ? `It blew up on @{${s.blown}}` : 'Nobody blew up'),
    })
    return winner ? { ...r, winner } : r
  },
  bot(s, id, ctx) {
    if (s.over || s.phase !== 'play' || s.holder !== id) return null
    // Holds it 0.4 to 1.6 s, sometimes a bit long.
    const hold = 400 + botNoise(id, s.heldAt, s.passes) * 1200
    return ctx.now >= s.heldAt + hold ? { type: 'pass', payload: { round: s.round } } : null
  },
}

function ordinal(n: number): string {
  return n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : `${n}th`
}
