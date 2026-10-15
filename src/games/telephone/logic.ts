import type { GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { freshFirst, pick, shuffle } from '../../lib/shuffle'
import { cleanStroke, cleanText, inkUsed, MAX_STROKES, type Stroke } from '../_draw/strokes'
import { doodle, hashOf } from '../_draw/doodles'
import { BOT_CAPTIONS, BOT_SWAPS, PROMPTS } from './prompts'

/**
 * TELEPHONE
 * Everyone starts a chain with a line. Each step every chain moves one seat: draw the line
 * you got, write what the drawing you got looks like, and so on. Everyone acts at once and
 * only ever sees the one step they are answering. Then the TV replays every chain.
 * Favorites during the replay are the score.
 */

export type StepKind = 'write' | 'draw'

export interface TStep {
  by: string
  kind: StepKind
  /** Write steps. */
  text: string
  /** Draw steps. */
  strokes: Stroke[]
  done: boolean
  /** The House filled in a blank line. Not favoritable. */
  auto: boolean
  favs: string[]
}

export interface TChain {
  owner: string
  steps: TStep[]
}

/** Replay position. step === steps is the chain recap; chain === chains.length is the tally. */
export interface Cursor {
  chain: number
  step: number
  at: number
}

export interface TelephoneState {
  order: string[]
  steps: number
  /** Current step while playing. */
  step: number
  phase: 'play' | 'replay' | 'done'
  /** Play: the countdown hits zero here (late submissions get a short grace). Replay: this beat ends. */
  endsAt: number
  stageTotal: number
  chains: TChain[]
  /** Ink budget per drawing (see inkUsed). Keeps the whole room state small enough to broadcast. */
  cap: number
  cursor: Cursor
  /** Starting lines for "Give me one", the House and bots: the ones this group hasn't seen first. */
  deck: string[]
}

export const WRITE_MS = 40_000
export const DRAW_MS = 75_000
export const GRACE_MS = 1_500
export const BEAT_TEXT_MS = 5_500
export const BEAT_DRAW_MS = 7_500
export const BEAT_RECAP_MS = 10_000
export const BEAT_TALLY_MS = 9_000
export const MIN_BEAT_MS = 1_200
export const MAX_TEXT = 80
export const STEP_CHOICES = [4, 6, 8]

export const kindOf = (step: number): StepKind => (step % 2 === 0 ? 'write' : 'draw')

/** Who holds chain `chain` at step `step`. Chain c starts with seat c and moves one seat a step. */
export function holderOf(order: string[], chain: number, step: number): string {
  return order[(chain + step) % order.length]
}

/** Which chain this player holds at `step`, or -1 if they are not in the game. */
export function chainOf(s: Pick<TelephoneState, 'order'>, playerId: string, step: number): number {
  const i = s.order.indexOf(playerId)
  if (i < 0) return -1
  const n = s.order.length
  return (((i - step) % n) + n) % n
}

/** This player's entry for the current step. */
export function mineNow(s: TelephoneState, playerId: string): TStep | null {
  const c = chainOf(s, playerId, s.step)
  return c < 0 ? null : s.chains[c]?.steps[s.step] ?? null
}

/** The one step this player is answering right now (null on the first step). Nothing else of the chain. */
export function incoming(s: TelephoneState, playerId: string): TStep | null {
  if (s.phase !== 'play' || s.step === 0) return null
  const c = chainOf(s, playerId, s.step)
  return c < 0 ? null : s.chains[c]?.steps[s.step - 1] ?? null
}

/** Ink for the whole game, shared by every drawing: about 180 KB of strokes at most. */
export const TOTAL_INK = 22_000

export function capFor(players: number, steps: number): number {
  const drawings = Math.max(1, players * Math.floor(steps / 2))
  return Math.max(500, Math.min(2500, Math.floor(TOTAL_INK / drawings)))
}

function blank(by: string, kind: StepKind): TStep {
  return { by, kind, text: '', strokes: [], done: false, auto: false, favs: [] }
}

function patchStep(s: TelephoneState, chain: number, step: number, patch: Partial<TStep>): TelephoneState {
  return {
    ...s,
    chains: s.chains.map((ch, i) => (i !== chain ? ch : { ...ch, steps: ch.steps.map((st, j) => (j !== step ? st : { ...st, ...patch })) })),
  }
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): TelephoneState {
  const order = shuffle(ctx.players.map((p) => p.id), ctx.random)
  const steps = STEP_CHOICES.includes(Number(opts.steps)) ? Number(opts.steps) : 6
  return {
    order,
    steps,
    step: 0,
    phase: 'play',
    endsAt: ctx.now + WRITE_MS,
    stageTotal: WRITE_MS,
    chains: order.map((owner) => ({ owner, steps: [blank(owner, 'write')] })),
    cap: capFor(order.length, steps),
    cursor: { chain: 0, step: 0, at: 0 },
    deck: freshFirst(PROMPTS, (p) => p, ctx.used, ctx.random).slice(0, 40),
  }
}

/** A "Give me one" line for this player: everyone gets a different run through the deck. */
export function suggestion(s: TelephoneState, playerId: string, n: number): string {
  const deck = s.deck?.length ? s.deck : PROMPTS
  const seat = Math.max(0, s.order.indexOf(playerId))
  return deck[(seat * 7 + n) % deck.length]
}

export function beatMs(s: TelephoneState, cur: Cursor): number {
  if (cur.chain >= s.chains.length) return BEAT_TALLY_MS
  if (cur.step >= s.steps) return BEAT_RECAP_MS
  const st = s.chains[cur.chain]?.steps[cur.step]
  return st?.kind === 'draw' && st.strokes.length ? BEAT_DRAW_MS : BEAT_TEXT_MS
}

function startReplay(s: TelephoneState, now: number): TelephoneState {
  const cursor = { chain: 0, step: 0, at: now }
  const d = beatMs(s, cursor)
  return { ...s, phase: 'replay', cursor, endsAt: now + d, stageTotal: d }
}

/** Close the current step: blank lines get a House line, then pass every chain one seat. */
function finishStep(s: TelephoneState, ctx: GameCtx): TelephoneState {
  const k = s.step
  let chains = s.chains.map((ch) => {
    const st = ch.steps[k]
    if (!st) return ch
    let next = st
    if (st.kind === 'write' && !st.text) next = { ...st, text: pick(s.deck?.length ? s.deck : PROMPTS, ctx.random), auto: true, done: true }
    else if (!st.done) next = { ...st, done: true }
    return next === st ? ch : { ...ch, steps: ch.steps.map((x, j) => (j === k ? next : x)) }
  })
  const step = k + 1
  if (step >= s.steps) return startReplay({ ...s, chains }, ctx.now)
  chains = chains.map((ch, c) => ({ ...ch, steps: [...ch.steps, blank(holderOf(s.order, c, step), kindOf(step))] }))
  const d = kindOf(step) === 'write' ? WRITE_MS : DRAW_MS
  return { ...s, chains, step, endsAt: ctx.now + d, stageTotal: d }
}

function advanceIfAllDone(s: TelephoneState, ctx: GameCtx): TelephoneState {
  return s.chains.every((ch) => ch.steps[s.step]?.done) ? finishStep(s, ctx) : s
}

function advanceReplay(s: TelephoneState, now: number): TelephoneState {
  let { chain, step } = s.cursor
  if (chain >= s.chains.length) return { ...s, phase: 'done' }
  if (step < s.steps) step += 1
  else { chain += 1; step = 0 }
  const cursor = { chain, step, at: now }
  const d = beatMs(s, cursor)
  return { ...s, cursor, endsAt: now + d, stageTotal: d }
}

/** True once the replay has shown this step. */
export function revealed(s: TelephoneState, chain: number, step: number): boolean {
  if (s.phase !== 'replay') return false
  return chain < s.cursor.chain || (chain === s.cursor.chain && step <= s.cursor.step)
}

export function reduce(s: TelephoneState, a: PlayerAction, ctx: GameCtx): TelephoneState {
  const p = a.payload && typeof a.payload === 'object' ? (a.payload as Record<string, unknown>) : {}
  if (a.type === 'next') {
    if (s.phase !== 'replay') return s
    if (a.playerId !== '__host' && !s.order.includes(a.playerId)) return s
    if (ctx.now - s.cursor.at < MIN_BEAT_MS) return s
    return advanceReplay(s, ctx.now)
  }
  if (!s.order.includes(a.playerId)) return s

  if (a.type === 'fav') {
    if (s.phase !== 'replay') return s
    const chain = Number(p.chain)
    const step = Number(p.step)
    if (!Number.isInteger(chain) || !Number.isInteger(step)) return s
    const st = s.chains[chain]?.steps[step]
    if (!st || st.auto || st.by === a.playerId || !revealed(s, chain, step)) return s
    const favs = st.favs.includes(a.playerId) ? st.favs.filter((x) => x !== a.playerId) : [...st.favs, a.playerId]
    return patchStep(s, chain, step, { favs })
  }

  if (s.phase !== 'play') return s
  const k = s.step
  const c = chainOf(s, a.playerId, k)
  const st = s.chains[c]?.steps[k]
  if (!st) return s

  switch (a.type) {
    case 'write': {
      if (st.kind !== 'write' || st.done) return s
      const text = cleanText(p.text, MAX_TEXT)
      if (!text) return s
      return advanceIfAllDone(patchStep(s, c, k, { text, done: true }), ctx)
    }
    case 'stroke': {
      if (st.kind !== 'draw' || st.done || st.strokes.length >= MAX_STROKES) return s
      const stroke = cleanStroke(p.s, s.cap - inkUsed(st.strokes))
      if (!stroke) return s
      return patchStep(s, c, k, { strokes: [...st.strokes, stroke] })
    }
    case 'undo': {
      if (st.kind !== 'draw' || st.done || !st.strokes.length) return s
      return patchStep(s, c, k, { strokes: st.strokes.slice(0, -1) })
    }
    case 'clear': {
      if (st.kind !== 'draw' || st.done || !st.strokes.length) return s
      return patchStep(s, c, k, { strokes: [] })
    }
    case 'done': {
      if (st.kind !== 'draw' || st.done || !st.strokes.length) return s
      return advanceIfAllDone(patchStep(s, c, k, { done: true }), ctx)
    }
    case 'edit': {
      if (!st.done || ctx.now >= s.endsAt) return s
      return patchStep(s, c, k, { done: false })
    }
  }
  return s
}

export function tick(s: TelephoneState, ctx: GameCtx): TelephoneState {
  if (s.phase === 'play') return ctx.now >= s.endsAt + GRACE_MS ? finishStep(s, ctx) : s
  if (s.phase === 'replay') return ctx.now >= s.endsAt ? advanceReplay(s, ctx.now) : s
  return s
}

// ---------------- scoring ----------------

export function favScores(s: TelephoneState): Record<string, number> {
  const scores: Record<string, number> = Object.fromEntries(s.order.map((id) => [id, 0]))
  for (const ch of s.chains) for (const st of ch.steps) if (!st.auto) scores[st.by] = (scores[st.by] ?? 0) + st.favs.length
  return scores
}

export interface TopPick { chain: number; step: number; st: TStep }

/** Most-favorited step of a kind (or any kind). Earliest wins a tie. Needs at least one favorite. */
export function topStep(s: TelephoneState, kind?: StepKind): TopPick | null {
  let best: TopPick | null = null
  for (let chain = 0; chain < s.chains.length; chain++) {
    const steps = s.chains[chain].steps
    for (let step = 0; step < steps.length; step++) {
      const st = steps[step]
      if (kind && st.kind !== kind) continue
      if (st.auto || !st.favs.length) continue
      if (st.kind === 'draw' && !st.strokes.length) continue
      if (!best || st.favs.length > best.st.favs.length) best = { chain, step, st }
    }
  }
  return best
}

/** The line a drawing was drawing. */
export function sourceText(s: TelephoneState, chain: number, step: number): string {
  return s.chains[chain]?.steps[step - 1]?.text ?? ''
}

function clip(t: string, n: number) {
  return t.length > n ? `${t.slice(0, n - 3).trimEnd()}...` : t
}

export function outcome(s: TelephoneState, ctx: GameCtx): GameOutcome | null {
  if (s.phase !== 'done') return null
  const scores = favScores(s)
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: scores[p.id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'

  const top = topStep(s)
  let summary = 'No favorites. Tough crowd.'
  if (top) {
    summary = top.st.kind === 'write'
      ? `${name(top.st.by)}'s '${clip(top.st.text, 60)}' won the night.`
      : `${name(top.st.by)}'s drawing of '${clip(sourceText(s, top.chain, top.step), 50)}' won the night.`
  }

  const highlights: Highlight[] = []
  const draw = topStep(s, 'draw')
  if (draw) {
    highlights.push({ playerId: draw.st.by, kind: 'drawing', label: clip(sourceText(s, draw.chain, draw.step), 200), content: { strokes: draw.st.strokes } })
  }
  const line = topStep(s, 'write')
  if (line) highlights.push({ playerId: line.st.by, kind: 'answer', label: 'Most loved line', content: { text: line.st.text } })

  const favorites = Object.values(scores).reduce((a, b) => a + b, 0)
  // Lines from the prompt list that got played (taken from "Give me one", the House, or bots).
  const known = new Set(PROMPTS)
  const used = [...new Set(s.chains.flatMap((ch) => ch.steps.filter((st) => st.kind === 'write' && known.has(st.text)).map((st) => st.text)))]
  return { placements, summary, highlights, details: { steps: s.steps, chains: s.chains.length, favorites }, used }
}

// ---------------- bots ----------------

/** What a bot calls a drawing: half the time it riffs on the line the drawing came from. */
function botCaption(s: TelephoneState, chain: number, step: number, random: () => number): string {
  const source = s.chains[chain]?.steps[step - 2]?.text ?? ''
  const words = source.split(' ')
  const spots = words.map((w, i) => (i > 0 && w.length > 3 ? i : -1)).filter((i) => i >= 0)
  if (spots.length && random() < 0.5) {
    const i = spots[Math.floor(random() * spots.length)]
    const out = [...words]
    out[i] = pick(BOT_SWAPS, random)
    return out.join(' ').slice(0, MAX_TEXT)
  }
  return pick(BOT_CAPTIONS, random)
}

/**
 * Bots: write a starting line from the deck after a few seconds, draw three to six simple
 * shapes and call it done, describe drawings with a silly caption (or a riff on the line the
 * drawing came from; bots peek), and star other people's steps now and then in the replay.
 */
export function bot(s: TelephoneState, id: string, ctx: GameCtx): { type: string; payload?: unknown } | null {
  if (s.phase === 'replay') {
    const { chain, step } = s.cursor
    const st = s.chains[chain]?.steps[step]
    if (!st || st.by === id || st.auto || st.favs.includes(id)) return null
    if (st.kind === 'draw' && !st.strokes.length) return null
    return ctx.random() < 0.015 ? { type: 'fav', payload: { chain, step } } : null
  }
  if (s.phase !== 'play') return null
  const c = chainOf(s, id, s.step)
  const mine = s.chains[c]?.steps[s.step]
  if (!mine || mine.done) return null
  const elapsed = ctx.now - (s.endsAt - s.stageTotal)
  if (mine.kind === 'write') {
    if (elapsed < 3000 || ctx.random() > 0.08) return null
    const text = s.step === 0 ? suggestion(s, id, 3) : botCaption(s, c, s.step, ctx.random)
    return { type: 'write', payload: { text } }
  }
  const target = 3 + (hashOf(`${id}:${s.step}`) % 4)
  if (elapsed < 2000) return null
  if (mine.strokes.length < target) return ctx.random() < 0.12 ? { type: 'stroke', payload: { s: doodle(ctx.random) } } : null
  return ctx.random() < 0.1 ? { type: 'done' } : null
}
