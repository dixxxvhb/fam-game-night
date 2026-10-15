import type { GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { fmt, fruit, isTier, MAX_JUNK, TIERS, withArticle } from './fruits'
import type { JunkIn } from './botjar'

/**
 * Melon: every phone runs its own physics jar (see physics.ts). The host only keeps
 * the scoreboard: score, alive, best fruit, and in Attack the junk headed your way.
 */

export type MelonMode = 'race' | 'attack'

export interface Incoming { id: number; n: number; from: string }

export interface MelonPlayer {
  score: number
  alive: boolean
  /** Biggest tier made by merging (0 = nothing yet). */
  best: number
  bestAt: number
  /** Host time this jar topped out. */
  outAt: number | null
  /** Attack only: junk to drop into this jar, cleared by 'absorb'. */
  incoming: Incoming[]
  /** Bots only (their jar is a model, see botjar.ts): attacks thrown so far. */
  sent?: number
  /** Bots only: junk taken in, so every screen can rebuild the bot's jar. */
  junkIn?: JunkIn[]
}

export interface MelonState {
  mode: MelonMode
  /** ready (3, 2, 1) -> play -> end (the jars line up, scores count, a winner is crowned) -> done. */
  stage: 'ready' | 'play' | 'end' | 'done'
  startsAt: number
  endsAt: number
  /** Play length in ms (for the clock bar). */
  total: number
  /** Race length in minutes (attack ignores it). */
  minutes: number
  order: string[]
  players: Record<string, MelonPlayer>
  nextId: number
  lastHit: { from: string; to: string; n: number; at: number } | null
  endedBy: 'clock' | 'out' | null
  /** Host time the end scene finishes and the game is done (set when play stops). */
  finishAt?: number
}

export const READY_MS = 3000
/** The end scene on the TV: time's up, scores count up, the winner's jar gets the crown. */
export const END_MS = 7500
export const ATTACK_CAP_MS = 5 * 60_000
export const RACE_LENGTHS = [2, 3, 5]
export const MAX_SCORE = 9_999_999
export const MAX_INCOMING = 12

export function setup(ctx: GameCtx, opts: Record<string, string | number>): MelonState {
  const mode: MelonMode = opts.mode === 'attack' ? 'attack' : 'race'
  const minutes = RACE_LENGTHS.includes(Number(opts.length)) ? Number(opts.length) : 3
  const total = mode === 'attack' ? ATTACK_CAP_MS : minutes * 60_000
  const order = ctx.players.map((p) => p.id)
  const startsAt = ctx.now + READY_MS
  return {
    mode,
    stage: 'ready',
    startsAt,
    endsAt: startsAt + total,
    total,
    minutes,
    order,
    players: Object.fromEntries(order.map((id) => [id, { score: 0, alive: true, best: 0, bestAt: 0, outAt: null, incoming: [] }])),
    nextId: 1,
    lastHit: null,
    endedBy: null,
  }
}

function withPlayer(s: MelonState, id: string, p: MelonPlayer): MelonState {
  return { ...s, players: { ...s.players, [id]: p } }
}

/** Leader among alive opponents (unique top score), else a random alive opponent. */
export function pickTarget(s: MelonState, from: string, random: () => number): string | null {
  const alive = s.order.filter((id) => id !== from && s.players[id]?.alive)
  if (!alive.length) return null
  const top = Math.max(...alive.map((id) => s.players[id].score))
  const leaders = alive.filter((id) => s.players[id].score === top)
  if (leaders.length === 1) return leaders[0]
  return alive[Math.min(alive.length - 1, Math.floor(random() * alive.length))]
}

function isBot(ctx: GameCtx, id: string): boolean {
  return Boolean(ctx.players.find((p) => p.id === id)?.bot)
}

function readScore(payload: unknown): number | null {
  const v = (payload as { score?: unknown } | null)?.score
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_SCORE) return null
  return v
}

export function reduce(s: MelonState, a: PlayerAction, ctx: GameCtx): MelonState {
  const me = s.players[a.playerId]
  if (!me || s.stage !== 'play') return s
  switch (a.type) {
    case 'score': {
      if (!me.alive) return s
      const score = readScore(a.payload)
      if (score === null || score <= me.score) return s
      return withPlayer(s, a.playerId, { ...me, score })
    }
    case 'over': {
      if (!me.alive) return s
      const score = readScore(a.payload)
      return withPlayer(s, a.playerId, {
        ...me,
        alive: false,
        outAt: ctx.now,
        incoming: [],
        score: score !== null && score > me.score ? score : me.score,
      })
    }
    case 'best': {
      const tier = (a.payload as { tier?: unknown } | null)?.tier
      if (!isTier(tier) || tier <= me.best) return s
      return withPlayer(s, a.playerId, { ...me, best: tier, bestAt: ctx.now })
    }
    case 'attack': {
      if (s.mode !== 'attack' || !me.alive) return s
      const n = (a.payload as { n?: unknown } | null)?.n
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_JUNK) return s
      const to = pickTarget(s, a.playerId, ctx.random)
      if (!to) return s
      const target = s.players[to]
      if (target.incoming.length >= MAX_INCOMING) return s
      let next = withPlayer(s, to, { ...target, incoming: [...target.incoming, { id: s.nextId, n, from: a.playerId }] })
      if (isBot(ctx, a.playerId)) next = withPlayer(next, a.playerId, { ...me, sent: (me.sent ?? 0) + 1 })
      return { ...next, nextId: s.nextId + 1, lastHit: { from: a.playerId, to, n, at: ctx.now } }
    }
    case 'absorb': {
      const id = (a.payload as { id?: unknown } | null)?.id
      const got = typeof id === 'number' ? me.incoming.find((x) => x.id === id) : undefined
      if (!got) return s
      const incoming = me.incoming.filter((x) => x.id !== id)
      if (isBot(ctx, a.playerId)) return withPlayer(s, a.playerId, { ...me, incoming, junkIn: [...(me.junkIn ?? []), { at: ctx.now, n: got.n }] })
      return withPlayer(s, a.playerId, { ...me, incoming })
    }
  }
  return s
}

function aliveCount(s: MelonState): number {
  return s.order.filter((id) => s.players[id]?.alive).length
}

function finish(s: MelonState, ctx: GameCtx, endedBy: 'clock' | 'out'): MelonState {
  return { ...s, stage: 'end', endedBy, finishAt: ctx.now + END_MS }
}

export function tick(s: MelonState, ctx: GameCtx): MelonState {
  if (s.stage === 'done') return s
  if (s.stage === 'ready') return ctx.now >= s.startsAt ? { ...s, stage: 'play' } : s
  if (s.stage === 'end') return ctx.now >= (s.finishAt ?? 0) ? { ...s, stage: 'done' } : s
  if (ctx.now >= s.endsAt) return finish(s, ctx, 'clock')
  const alive = aliveCount(s)
  if (s.mode === 'race' && alive === 0) return finish(s, ctx, 'out')
  if (s.mode === 'attack' && (s.order.length > 1 ? alive <= 1 : alive === 0)) return finish(s, ctx, 'out')
  return s
}

/**
 * Race: by score. Attack: survivors first (by score), then later-out beats earlier-out,
 * then score. Equal keys share a place.
 */
export function placements(s: MelonState): GameOutcome['placements'] {
  if (s.mode === 'race') return placeByScore(s.order.map((id) => ({ playerId: id, score: s.players[id]?.score ?? 0 })))
  const rows = s.order.map((id) => {
    const p = s.players[id]
    return { playerId: id, score: p?.score ?? 0, alive: Boolean(p?.alive), outAt: p?.outAt ?? 0 }
  })
  const cmp = (a: typeof rows[number], b: typeof rows[number]) =>
    Number(b.alive) - Number(a.alive) || (a.alive ? 0 : b.outAt - a.outAt) || b.score - a.score
  rows.sort(cmp)
  let place = 0
  return rows.map((r, i) => {
    if (i === 0 || cmp(rows[i - 1], r) !== 0) place = i + 1
    return { playerId: r.playerId, place, score: r.score }
  })
}

/** Who made the biggest fruit (first to make it wins ties). */
export function biggest(s: MelonState): { playerId: string; tier: number } | null {
  let best: { playerId: string; tier: number; at: number } | null = null
  for (const id of s.order) {
    const p = s.players[id]
    if (!p || p.best < 2) continue
    if (!best || p.best > best.tier || (p.best === best.tier && p.bestAt < best.at)) best = { playerId: id, tier: p.best, at: p.bestAt }
  }
  return best ? { playerId: best.playerId, tier: best.tier } : null
}

export function outcome(s: MelonState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const places = placements(s)
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const top = places[0]
  const topName = top ? name(top.playerId) : 'Someone'
  const survivors = s.order.filter((id) => s.players[id]?.alive)
  const summary =
    s.mode === 'attack'
      ? survivors.length === 1 && s.order.length > 1
        ? `${topName} was the last jar standing`
        : `${topName} led at the buzzer with ${fmt(top?.score ?? 0)}`
      : `${topName} won the race with ${fmt(top?.score ?? 0)}`
  const big = biggest(s)
  const bigText = big ? `${name(big.playerId)} made ${withArticle(fruit(big.tier).name)}` : null
  const line = !big || !bigText
    ? summary
    : big.playerId === top?.playerId
      ? `${summary} and made ${withArticle(fruit(big.tier).name)}`
      : `${summary}. ${bigText}.`
  return {
    placements: places,
    summary: line,
    highlights: big && bigText
      ? [{ playerId: big.playerId, kind: 'moment', label: 'Biggest fruit', content: { text: bigText, tier: big.tier } }]
      : [],
    details: {
      mode: s.mode,
      minutes: s.mode === 'race' ? s.minutes : ATTACK_CAP_MS / 60_000,
      endedBy: s.endedBy,
      best: Object.fromEntries(s.order.map((id) => [id, s.players[id]?.best ?? 0])),
    },
  }
}

/** Highest tier any player has made, for the TV. */
export function topTier(s: MelonState): number {
  return Math.min(TIERS, Math.max(0, ...s.order.map((id) => s.players[id]?.best ?? 0)))
}
