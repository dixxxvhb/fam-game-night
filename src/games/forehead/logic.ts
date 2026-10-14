import type { BotMove, GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { freshFirst, shuffle } from '../../lib/shuffle'
import { DECKS } from './decks'

/** The Guesser has this long to tap Ready before the turn starts anyway. */
export const READY_MS = 45_000
/** Phone up, 3, 2, 1. */
export const SET_MS = 3_000
export const TURN_MS = 60_000
export const TURN_END_MS = 6_000
/** Two calls closer together than this are one shaky tilt. */
export const DEBOUNCE_MS = 600

export interface Call { word: string; got: boolean; at: number; ms: number }

export interface TurnLog { guesser: string; calls: Call[] }

export interface ForeheadState {
  stage: 'ready' | 'set' | 'play' | 'turnEnd' | 'done'
  order: string[]
  turn: number
  guesser: string
  deck: string
  word: string
  queue: string[]
  /** When the current word went up (host clock), for the fastest-guess moment. */
  wordAt: number
  /** Last accepted got/pass (host clock). The debounce on the host. */
  lastCallAt: number
  endsAt: number
  stageTotal: number
  calls: Call[]
  turns: TurnLog[]
  /** Words got as the Guesser. */
  guessed: Record<string, number>
  /** Words the Guesser got while you were acting. */
  acted: Record<string, number>
  scores: Record<string, number>
  fastest: { guesser: string; word: string; ms: number } | null
}

function deckWords(deck: string): string[] {
  return (DECKS[deck] ?? DECKS.mixed).words
}

/** Pull the next word, reshuffling the deck (minus what's showing) if it runs dry. */
function draw(s: Pick<ForeheadState, 'queue' | 'deck' | 'word'>, random: () => number): { word: string; queue: string[] } {
  const queue = s.queue.length ? s.queue : shuffle(deckWords(s.deck).filter((w) => w !== s.word), random)
  const [word, ...rest] = queue
  return { word, queue: rest }
}

export function setup(ctx: GameCtx, opts: Record<string, string | number> = {}): ForeheadState {
  const ids = ctx.players.map((p) => p.id)
  const turns = Math.max(1, Math.min(3, Number(opts.turns ?? 2) || 2))
  const deck = DECKS[String(opts.deck)] ? String(opts.deck) : 'mixed'
  const seats = shuffle(ids, ctx.random)
  const order: string[] = []
  for (let r = 0; r < turns; r++) order.push(...seats)
  const zero = Object.fromEntries(ids.map((id) => [id, 0]))
  // Words this group hasn't had on other nights come up first.
  const first = draw({ queue: freshFirst(deckWords(deck), (w) => w, ctx.used ?? [], ctx.random), deck, word: '' }, ctx.random)
  return {
    stage: 'ready',
    order,
    turn: 0,
    guesser: order[0],
    deck,
    word: first.word,
    queue: first.queue,
    wordAt: 0,
    lastCallAt: 0,
    endsAt: ctx.now + READY_MS,
    stageTotal: READY_MS,
    calls: [],
    turns: [],
    guessed: { ...zero },
    acted: { ...zero },
    scores: { ...zero },
    fastest: null,
  }
}

function startSet(s: ForeheadState, now: number): ForeheadState {
  return { ...s, stage: 'set', endsAt: now + SET_MS, stageTotal: SET_MS }
}

function startPlay(s: ForeheadState, now: number): ForeheadState {
  return { ...s, stage: 'play', endsAt: now + TURN_MS, stageTotal: TURN_MS, wordAt: now, lastCallAt: now, calls: [] }
}

function endTurn(s: ForeheadState, now: number): ForeheadState {
  return {
    ...s,
    stage: 'turnEnd',
    endsAt: now + TURN_END_MS,
    stageTotal: TURN_END_MS,
    turns: [...s.turns, { guesser: s.guesser, calls: s.calls }],
  }
}

function nextTurn(s: ForeheadState, ctx: GameCtx): ForeheadState {
  const turn = s.turn + 1
  if (turn >= s.order.length) return { ...s, stage: 'done', turn, endsAt: ctx.now, stageTotal: 0 }
  // The word on screen when time ran out is skipped; the next Guesser starts on a fresh one.
  const next = draw(s, ctx.random)
  return {
    ...s,
    stage: 'ready',
    turn,
    guesser: s.order[turn],
    word: next.word,
    queue: next.queue,
    calls: [],
    endsAt: ctx.now + READY_MS,
    stageTotal: READY_MS,
  }
}

/** Points for one word got: the Guesser and every actor in the room each get one. */
function award(s: ForeheadState, ids: string[]): Pick<ForeheadState, 'guessed' | 'acted' | 'scores'> {
  const guessed = { ...s.guessed, [s.guesser]: (s.guessed[s.guesser] ?? 0) + 1 }
  const acted = { ...s.acted }
  for (const id of ids) if (id !== s.guesser) acted[id] = (acted[id] ?? 0) + 1
  const scores = Object.fromEntries(ids.map((id) => [id, (guessed[id] ?? 0) + (acted[id] ?? 0)]))
  return { guessed, acted, scores }
}

export function reduce(s: ForeheadState, a: PlayerAction, ctx: GameCtx): ForeheadState {
  const ids = ctx.players.map((p) => p.id)
  if (!ids.includes(a.playerId)) return s
  const p = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>
  switch (a.type) {
    case 'ready': {
      if (s.stage !== 'ready' || a.playerId !== s.guesser) return s
      return startSet(s, ctx.now)
    }
    case 'got':
    case 'pass': {
      if (s.stage !== 'play' || a.playerId !== s.guesser) return s
      if (ctx.now >= s.endsAt) return s
      // The phone says which word it saw; a late repeat of the last word is ignored.
      if (typeof p.word !== 'string' || p.word !== s.word) return s
      if (ctx.now - s.lastCallAt < DEBOUNCE_MS) return s
      const got = a.type === 'got'
      const ms = ctx.now - s.wordAt
      const calls = [...s.calls, { word: s.word, got, at: ctx.now, ms }]
      const next = draw(s, ctx.random)
      let out: ForeheadState = { ...s, calls, word: next.word, queue: next.queue, wordAt: ctx.now, lastCallAt: ctx.now }
      if (got) {
        out = { ...out, ...award(s, ids) }
        if (!s.fastest || ms < s.fastest.ms) out.fastest = { guesser: s.guesser, word: s.word, ms }
      }
      return out
    }
  }
  return s
}

export function tick(s: ForeheadState, ctx: GameCtx): ForeheadState {
  if (s.stage === 'done' || ctx.now < s.endsAt) return s
  if (s.stage === 'ready') return startSet(s, ctx.now)
  if (s.stage === 'set') return startPlay(s, ctx.now)
  if (s.stage === 'play') return endTurn(s, ctx.now)
  if (s.stage === 'turnEnd') return nextTurn(s, ctx)
  return s
}

export function outcome(s: ForeheadState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: s.scores[p.id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const total = s.turns.reduce((n, t) => n + t.calls.filter((c) => c.got).length, 0)
  const bestGuesser = [...ctx.players].sort((a, b) => (s.guessed[b.id] ?? 0) - (s.guessed[a.id] ?? 0))[0]
  const summary = total
    ? `The room got ${total} ${total === 1 ? 'word' : 'words'}. ${name(bestGuesser.id)} guessed ${s.guessed[bestGuesser.id] ?? 0}.`
    : 'Nobody got a single word. Impressive, in a way.'
  return {
    placements,
    summary,
    highlights: s.fastest
      ? [{
          playerId: s.fastest.guesser,
          kind: 'moment',
          label: `${name(s.fastest.guesser)} got "${s.fastest.word}" in ${(s.fastest.ms / 1000).toFixed(1)}s`.slice(0, 200),
          content: { word: s.fastest.word, ms: s.fastest.ms, guesser: s.fastest.guesser },
        }]
      : [],
    details: { deck: s.deck, turns: s.order.length, guessed: s.guessed, acted: s.acted },
    used: [...new Set(s.turns.flatMap((t) => t.calls.map((c) => c.word)))],
  }
}

// ---------------- bots ----------------

/**
 * Bots can't act anything out, so they sit in: as actors they earn actor points like
 * everyone else in the room (that is the rule), and on their own turn as Guesser the
 * humans act for them and the bot "gets" words at a steady random rate: about one call
 * every five or six seconds, three in four of them a got.
 */
export function bot(s: ForeheadState, id: string, ctx: GameCtx): BotMove | null {
  if (s.guesser !== id) return null
  if (s.stage === 'ready') {
    const waited = ctx.now - (s.endsAt - s.stageTotal)
    return waited > 2500 && ctx.random() < 0.2 ? { type: 'ready' } : null
  }
  if (s.stage === 'play' && ctx.now - s.lastCallAt >= 2500) {
    const r = ctx.random()
    if (r < 0.04) return { type: 'got', payload: { word: s.word } }
    if (r < 0.055) return { type: 'pass', payload: { word: s.word } }
  }
  return null
}
