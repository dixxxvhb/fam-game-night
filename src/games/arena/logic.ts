import type { BotMove, GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { applyPower, MAX_BOMBS, MAX_RANGE, MAX_SPEED, START_BOMBS, START_RANGE, type PowerKind } from './sim'

/**
 * Arena match state. The real-time arena itself (grid, bombs, positions) is simulated on the
 * host inside the TV Stage (see sim.ts); this state only keeps what the match needs to
 * remember, fed by the Stage through hostAction at a low rate:
 *   'kill'     { round, by, victim }   by = null when the walls got them
 *   'power'    { round, who, kind }    so phones can show what you've picked up
 *   'roundEnd' { round, winner }       winner = null when nobody made it
 * Those are only accepted from the host (anyone who isn't a player in this game).
 */

export interface Powers {
  bombs: number
  range: number
  speed: number
  kick: boolean
}

export interface KillNote {
  by: string | null
  victim: string
  at: number
}

export interface ArenaState {
  stage: 'intro' | 'play' | 'over' | 'done'
  round: number
  bestOf: number
  /** Rounds needed to win the match. */
  target: number
  /** Hard stop on rounds (draws can drag on); the most wins then takes it. */
  maxRounds: number
  order: string[]
  /** Layout seed for this round. */
  seed: number
  /** When this round's play starts (end of the intro card). */
  startsAt: number
  /** 'play': safety cap if the host sim never reports. 'over': when the card goes away. */
  endsAt: number
  wins: Record<string, number>
  kills: Record<string, number>
  /** Out this round, first out first. */
  out: string[]
  /** Who got each knocked-out player this round (null = the walls). */
  outBy: Record<string, string | null>
  powers: Record<string, Powers>
  lastKill: KillNote | null
  /** Finished rounds. */
  rounds: { winner: string | null; at: number }[]
  /** Kills by one player landing together (one blast). */
  streak: { by: string; n: number; at: number } | null
  multi: { playerId: string; n: number } | null
}

export const INTRO_MS = 3500
export const OVER_MS = 4000
/** 90 s, then about 40 s of walls, plus slack. */
export const ROUND_CAP_MS = 170_000
/** Kills by one player within this window count as one blast. */
export const MULTI_MS = 400
export const BEST_OF = [3, 5]

const KINDS = new Set<PowerKind>(['bomb', 'range', 'speed', 'kick'])

export function freshPowers(): Powers {
  return { bombs: START_BOMBS, range: START_RANGE, speed: 0, kick: false }
}

function newSeed(random: () => number): number {
  return 1 + Math.floor(random() * 2_000_000_000)
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): ArenaState {
  const bestOf = BEST_OF.includes(Number(opts.rounds)) ? Number(opts.rounds) : 3
  const target = Math.ceil(bestOf / 2)
  const order = ctx.players.map((p) => p.id)
  return {
    stage: 'intro',
    round: 1,
    bestOf,
    target,
    maxRounds: (target - 1) * order.length + 3,
    order,
    seed: newSeed(ctx.random),
    startsAt: ctx.now + INTRO_MS,
    endsAt: ctx.now + INTRO_MS + ROUND_CAP_MS,
    wins: Object.fromEntries(order.map((id) => [id, 0])),
    kills: Object.fromEntries(order.map((id) => [id, 0])),
    out: [],
    outBy: {},
    powers: Object.fromEntries(order.map((id) => [id, freshPowers()])),
    lastKill: null,
    rounds: [],
    streak: null,
    multi: null,
  }
}

/** Host actions come from the TV (its client id) or '__host'; never from a player in the game. */
function fromHost(a: PlayerAction, ctx: GameCtx): boolean {
  return a.playerId === '__host' || !ctx.players.some((p) => p.id === a.playerId)
}

function payloadOf(a: PlayerAction): Record<string, unknown> | null {
  return a.payload && typeof a.payload === 'object' ? (a.payload as Record<string, unknown>) : null
}

function endRound(s: ArenaState, winner: string | null, now: number): ArenaState {
  const wins = winner ? { ...s.wins, [winner]: (s.wins[winner] ?? 0) + 1 } : s.wins
  return { ...s, stage: 'over', wins, rounds: [...s.rounds, { winner, at: now }], endsAt: now + OVER_MS, streak: null }
}

/** Someone has the rounds, or we've hit the cap. */
export function decided(s: Pick<ArenaState, 'order' | 'wins' | 'target' | 'rounds' | 'maxRounds'>): boolean {
  return s.order.some((id) => (s.wins[id] ?? 0) >= s.target) || s.rounds.length >= s.maxRounds
}

export function reduce(s: ArenaState, a: PlayerAction, ctx: GameCtx): ArenaState {
  if (!fromHost(a, ctx) || s.stage !== 'play') return s
  const p = payloadOf(a)
  if (!p || p.round !== s.round) return s
  switch (a.type) {
    case 'kill': {
      const victim = p.victim
      const by = p.by
      if (typeof victim !== 'string' || !s.order.includes(victim) || s.out.includes(victim)) return s
      if (by !== null && (typeof by !== 'string' || !s.order.includes(by))) return s
      const scored = by !== null && by !== victim
      const kills = scored ? { ...s.kills, [by]: (s.kills[by] ?? 0) + 1 } : s.kills
      let streak = s.streak
      let multi = s.multi
      if (scored) {
        streak = streak && streak.by === by && ctx.now - streak.at <= MULTI_MS ? { by, n: streak.n + 1, at: streak.at } : { by, n: 1, at: ctx.now }
        if (streak.n >= 2 && (!multi || streak.n > multi.n)) multi = { playerId: by, n: streak.n }
      }
      return { ...s, out: [...s.out, victim], outBy: { ...s.outBy, [victim]: by }, kills, streak, multi, lastKill: { by, victim, at: ctx.now } }
    }
    case 'power': {
      const who = p.who
      const kind = p.kind
      if (typeof who !== 'string' || !s.order.includes(who) || s.out.includes(who)) return s
      if (typeof kind !== 'string' || !KINDS.has(kind as PowerKind)) return s
      const cur = s.powers[who] ?? freshPowers()
      const next = { ...cur }
      applyPower(next, kind as PowerKind)
      if (next.bombs === cur.bombs && next.range === cur.range && next.speed === cur.speed && next.kick === cur.kick) return s
      return { ...s, powers: { ...s.powers, [who]: next } }
    }
    case 'roundEnd': {
      const winner = p.winner
      if (winner !== null && (typeof winner !== 'string' || !s.order.includes(winner) || s.out.includes(winner))) return s
      return endRound(s, winner, ctx.now)
    }
  }
  return s
}

function nextRound(s: ArenaState, ctx: GameCtx): ArenaState {
  return {
    ...s,
    stage: 'intro',
    round: s.round + 1,
    seed: newSeed(ctx.random),
    startsAt: ctx.now + INTRO_MS,
    endsAt: ctx.now + INTRO_MS + ROUND_CAP_MS,
    out: [],
    outBy: {},
    powers: Object.fromEntries(s.order.map((id) => [id, freshPowers()])),
    lastKill: null,
    streak: null,
  }
}

export function tick(s: ArenaState, ctx: GameCtx): ArenaState {
  if (s.stage === 'intro') return ctx.now >= s.startsAt ? { ...s, stage: 'play', endsAt: ctx.now + ROUND_CAP_MS } : s
  if (s.stage === 'play') return ctx.now >= s.endsAt ? endRound(s, null, ctx.now) : s
  if (s.stage === 'over' && ctx.now >= s.endsAt) return decided(s) ? { ...s, stage: 'done' } : nextRound(s, ctx)
  return s
}

/** Most rounds won, then most kills. Equal on both share a place. */
export function placements(s: ArenaState): GameOutcome['placements'] {
  const rows = s.order.map((id) => ({ playerId: id, wins: s.wins[id] ?? 0, kills: s.kills[id] ?? 0 }))
  rows.sort((a, b) => b.wins - a.wins || b.kills - a.kills)
  let place = 0
  return rows.map((r, i) => {
    const prev = rows[i - 1]
    if (i === 0 || prev.wins !== r.wins || prev.kills !== r.kills) place = i + 1
    return { playerId: r.playerId, place, score: r.wins }
  })
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function outcome(s: ArenaState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const places = placements(s)
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const top = places[0]
  const tied = places.filter((p) => p.place === 1).length > 1
  const w = s.wins[top.playerId] ?? 0
  const k = s.kills[top.playerId] ?? 0
  const summary = tied
    ? `Dead even after ${plural(s.rounds.length, 'round')}`
    : k > 0
      ? `${name(top.playerId)} won ${plural(w, 'round')} with ${plural(k, 'kill')}`
      : `${name(top.playerId)} won ${plural(w, 'round')} by outliving everyone`
  const highlights: NonNullable<GameOutcome['highlights']> = []
  const killer = [...s.order].sort((a, b) => (s.kills[b] ?? 0) - (s.kills[a] ?? 0))[0]
  if (killer && (s.kills[killer] ?? 0) > 0) {
    highlights.push({ playerId: killer, kind: 'moment', label: 'Most kills', content: { text: `${name(killer)}: ${plural(s.kills[killer], 'kill')}` } })
  }
  if (s.multi) {
    highlights.push({ playerId: s.multi.playerId, kind: 'moment', label: 'One blast', content: { text: `${name(s.multi.playerId)} got ${s.multi.n} with one blast` } })
  }
  return {
    placements: places,
    summary,
    highlights,
    details: { bestOf: s.bestOf, rounds: s.rounds, kills: s.kills, wins: s.wins },
  }
}

/**
 * Arena's bots play inside the host simulation (bots.ts, driven by the TV Stage every step),
 * so there is nothing to send from here. Defined so the platform seats bots in Arena.
 */
export function bot(): BotMove | null {
  return null
}

export const CAPS = { bombs: MAX_BOMBS, range: MAX_RANGE, speed: MAX_SPEED }
