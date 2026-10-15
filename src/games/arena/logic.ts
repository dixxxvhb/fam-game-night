import type { BotMove, GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { isCritterId, type CritterId } from '../board/park/cast'
import { applyPower, MAX_BOMBS, MAX_RANGE, MAX_SPEED, START_BOMBS, START_RANGE, type PowerKind } from './sim'

/**
 * Kaboom (id 'arena') match state. Flow: pick (everyone picks a critter) -> [intro (VS card,
 * 3-2-1) -> play -> over] per round -> podium -> done.
 *
 * Arena match state. The real-time arena itself (grid, bombs, positions) is simulated on the
 * host inside the TV Stage (see sim.ts); this state only keeps what the match needs to
 * remember, fed by the Stage through hostAction at a low rate:
 *   'kill'     { round, by, victim }   by = null when the walls got them
 *   'power'    { round, who, kind }    so phones can show what you've picked up
 *   'roundEnd' { round, winner }       winner = null when nobody made it
 * Those are only accepted from the host (anyone who isn't a player in this game).
 * Players send one action of their own: 'pick' { char } during the pick stage.
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

export type ArenaPhase = 'pick' | 'intro' | 'play' | 'over' | 'podium' | 'done'

export interface ArenaState {
  stage: ArenaPhase
  /** The critter each player is (null until picked). */
  chars: Record<string, CritterId | null>
  /** When the current stage began (bots pick a beat after the pick screen opens). */
  stageAt: number
  /** pick: when picking closes. podium: when the podium ends. */
  stageEnds: number
  /** Which arena round 1 is in; it rotates by one every round (see THEMES in themes.ts). */
  theme0: number
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

/** Pick a critter: everyone gets 45 s, then the park picks for you. */
export const PICK_MS = 45_000
/** All picked: hold the pick screen this long so the last name tag lands. */
export const PICK_DONE_MS = 1600
/** VS card (VS_MS), then 3, 2, 1. */
export const INTRO_MS = 5000
export const VS_MS = 2000
export const OVER_MS = 4500
/** The podium at the end of the match, before the outcome is reported. */
export const PODIUM_MS = 8000
export const THEME_COUNT = 4
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
    stage: 'pick',
    chars: Object.fromEntries(order.map((id) => [id, null])),
    stageAt: ctx.now,
    stageEnds: ctx.now + PICK_MS,
    theme0: Math.floor(ctx.random() * THEME_COUNT) % THEME_COUNT,
    round: 1,
    bestOf,
    target,
    maxRounds: (target - 1) * order.length + 3,
    order,
    seed: newSeed(ctx.random),
    startsAt: 0,
    endsAt: 0,
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
  return { ...s, stage: 'over', stageAt: now, wins, rounds: [...s.rounds, { winner, at: now }], endsAt: now + OVER_MS, streak: null }
}

/** Someone has the rounds, or we've hit the cap. */
export function decided(s: Pick<ArenaState, 'order' | 'wins' | 'target' | 'rounds' | 'maxRounds'>): boolean {
  return s.order.some((id) => (s.wins[id] ?? 0) >= s.target) || s.rounds.length >= s.maxRounds
}

export const CRITTERS: CritterId[] = ['chomp', 'mattie', 'pete', 'pickles', 'dillo', 'ibby', 'shelly', 'zippy']

export function charOf(s: Pick<ArenaState, 'chars'>, id: string): CritterId | null {
  return s.chars?.[id] ?? null
}

function allPicked(s: ArenaState): boolean {
  return s.order.every((id) => !!s.chars[id])
}

/** Everyone without a critter gets a free one at random. */
function fillChars(s: ArenaState, random: () => number): Record<string, CritterId | null> {
  const chars = { ...s.chars }
  for (const id of s.order) {
    if (chars[id]) continue
    const free = CRITTERS.filter((c) => !Object.values(chars).includes(c))
    chars[id] = free.length ? free[Math.floor(random() * free.length) % free.length] : CRITTERS[s.order.indexOf(id) % CRITTERS.length]
  }
  return chars
}

function startRound1(s: ArenaState, ctx: GameCtx): ArenaState {
  return {
    ...s,
    chars: fillChars(s, ctx.random),
    stage: 'intro',
    stageAt: ctx.now,
    stageEnds: 0,
    startsAt: ctx.now + INTRO_MS,
    endsAt: ctx.now + INTRO_MS + ROUND_CAP_MS,
  }
}

export function reduce(s: ArenaState, a: PlayerAction, ctx: GameCtx): ArenaState {
  if (a.type === 'pick') {
    const p = payloadOf(a)
    if (s.stage !== 'pick' || !p || !s.order.includes(a.playerId) || s.chars[a.playerId]) return s
    const c = p.char
    if (!isCritterId(c) || Object.values(s.chars).includes(c)) return s
    const next = { ...s, chars: { ...s.chars, [a.playerId]: c } }
    return allPicked(next) ? { ...next, stageEnds: Math.min(next.stageEnds, ctx.now + PICK_DONE_MS) } : next
  }
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
    stageAt: ctx.now,
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
  if (s.stage === 'pick') return ctx.now >= s.stageEnds ? startRound1(s, ctx) : s
  if (s.stage === 'intro') return ctx.now >= s.startsAt ? { ...s, stage: 'play', stageAt: ctx.now, endsAt: ctx.now + ROUND_CAP_MS } : s
  if (s.stage === 'play') return ctx.now >= s.endsAt ? endRound(s, null, ctx.now) : s
  if (s.stage === 'over' && ctx.now >= s.endsAt) {
    return decided(s) ? { ...s, stage: 'podium', stageAt: ctx.now, stageEnds: ctx.now + PODIUM_MS } : nextRound(s, ctx)
  }
  if (s.stage === 'podium' && ctx.now >= s.stageEnds) return { ...s, stage: 'done' }
  return s
}

/** The arena theme a round is played in. */
export function themeOf(s: Pick<ArenaState, 'theme0' | 'round'>): number {
  return (((s.theme0 ?? 0) + s.round - 1) % THEME_COUNT + THEME_COUNT) % THEME_COUNT
}

/** The match leader (most wins, then kills), for the round card and the podium. */
export function leader(s: ArenaState): string {
  return placements(s)[0].playerId
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
 * Bots pick a free critter a beat after the pick screen opens. In the arena they play inside
 * the host simulation (bots.ts, driven by the host Stage every step), so there is nothing to
 * send from here then.
 */
export function bot(s?: ArenaState, id?: string, ctx?: GameCtx): BotMove | null {
  if (!s || !id || !ctx || s.stage !== 'pick') return null
  if (s.chars[id] || ctx.now - s.stageAt < 1200 || ctx.random() > 0.25) return null
  const free = CRITTERS.filter((c) => !Object.values(s.chars).includes(c))
  return free.length ? { type: 'pick', payload: { char: free[Math.floor(ctx.random() * free.length) % free.length] } } : null
}

export const CAPS = { bombs: MAX_BOMBS, range: MAX_RANGE, speed: MAX_SPEED }
