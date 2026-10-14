import type { GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { fmt, fruit, isTier, MAX_JUNK, TIERS, withArticle } from './fruits'

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
}

export interface MelonState {
  mode: MelonMode
  stage: 'ready' | 'play' | 'done'
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
}

export const READY_MS = 3000
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
      const next = withPlayer(s, to, { ...target, incoming: [...target.incoming, { id: s.nextId, n, from: a.playerId }] })
      return { ...next, nextId: s.nextId + 1, lastHit: { from: a.playerId, to, n, at: ctx.now } }
    }
    case 'absorb': {
      const id = (a.payload as { id?: unknown } | null)?.id
      if (typeof id !== 'number' || !me.incoming.some((x) => x.id === id)) return s
      return withPlayer(s, a.playerId, { ...me, incoming: me.incoming.filter((x) => x.id !== id) })
    }
  }
  return s
}

function aliveCount(s: MelonState): number {
  return s.order.filter((id) => s.players[id]?.alive).length
}

export function tick(s: MelonState, ctx: GameCtx): MelonState {
  if (s.stage === 'done') return s
  if (s.stage === 'ready') return ctx.now >= s.startsAt ? { ...s, stage: 'play' } : s
  if (ctx.now >= s.endsAt) return { ...s, stage: 'done', endedBy: 'clock' }
  const alive = aliveCount(s)
  if (s.mode === 'race' && alive === 0) return { ...s, stage: 'done', endedBy: 'out' }
  if (s.mode === 'attack' && (s.order.length > 1 ? alive <= 1 : alive === 0)) return { ...s, stage: 'done', endedBy: 'out' }
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
