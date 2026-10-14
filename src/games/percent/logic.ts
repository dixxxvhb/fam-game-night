import type { GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'
import { QUESTIONS, type Question } from './questions'

export type Bet = 'muchLower' | 'lower' | 'higher' | 'muchHigher'
export const BETS: Bet[] = ['muchLower', 'lower', 'higher', 'muchHigher']
export const BET_LABEL: Record<Bet, string> = {
  muchLower: 'Much lower',
  lower: 'Lower',
  higher: 'Higher',
  muchHigher: 'Much higher',
}

export type Stage = 'spy' | 'bet' | 'reveal' | 'final' | 'finalReveal' | 'done'

/** One finished Spy round, kept for the reveal screen, the summary and the Hall of Fame. */
export interface RoundResult {
  round: number
  spy: string
  q: Question
  /** False when the Spy never locked in (scored as 50). */
  locked: boolean
  guess: number
  answer: number
  spyPoints: number
  bets: Record<string, Bet>
  /** Points each bettor won this round (0 included). */
  points: Record<string, number>
}

export interface FinalResult {
  q: Question
  answer: number
  guesses: Record<string, number>
  points: Record<string, number>
}

export interface PercentState {
  /** Spy order, one entry per Spy round. */
  order: string[]
  /** Index into order. Equals order.length during the final round. */
  round: number
  stage: Stage
  spy: string
  /** Questions for every round, the final one last. */
  questions: Question[]
  /** The Spy's locked guess this round. */
  guess: number | null
  /** True when the Spy ran out of time and got 50 by default. */
  spyTimedOut: boolean
  bets: Record<string, Bet>
  finalGuesses: Record<string, number>
  endsAt: number
  stageStartedAt: number
  stageTotal: number
  scores: Record<string, number>
  history: RoundResult[]
  final: FinalResult | null
}

export const SPY_MS = 30_000
export const BET_MS = 15_000
export const REVEAL_MS = 9_000
export const FINAL_MS = 30_000
export const FINAL_REVEAL_MS = 11_000
/** What a Spy who never locks in gets scored on. */
export const DEFAULT_GUESS = 50
export const MUCH = 15

// ---------------- scoring ----------------

/** Spy: 1000 minus 40 per point off, floored at 0, rounded to 10. Exactly right adds 500. */
export function spyPoints(guess: number, answer: number): number {
  const diff = Math.abs(answer - guess)
  const base = Math.round(Math.max(0, 1000 - 40 * diff) / 10) * 10
  return base + (diff === 0 ? 500 : 0)
}

/**
 * A bet on where the truth is relative to the Spy's guess.
 * Higher/Lower right = 400. Much right and 15+ away = 800. Much with the right direction
 * but under 15 away = 200. Wrong = 0. Truth equal to the guess: every bet loses.
 */
export function betPoints(bet: Bet, guess: number, answer: number): number {
  if (answer === guess) return 0
  const up = answer > guess
  const far = Math.abs(answer - guess) >= MUCH
  switch (bet) {
    case 'higher': return up ? 400 : 0
    case 'lower': return up ? 0 : 400
    case 'muchHigher': return up ? (far ? 800 : 200) : 0
    case 'muchLower': return up ? 0 : (far ? 800 : 200)
  }
}

/** Final round: closest 1500, second closest 750 (ties share), exactly right +500 more. */
export function finalPoints(guesses: Record<string, number>, answer: number): Record<string, number> {
  const rows = Object.entries(guesses).map(([id, g]) => ({ id, d: Math.abs(answer - g) }))
  rows.sort((a, b) => a.d - b.d)
  const out: Record<string, number> = {}
  let rank = 0
  let prev: number | null = null
  rows.forEach((r, i) => {
    if (prev === null || r.d !== prev) rank = i + 1
    prev = r.d
    out[r.id] = (rank === 1 ? 1500 : rank === 2 ? 750 : 0) + (r.d === 0 ? 500 : 0)
  })
  return out
}

/** Which way the truth went, for labels. */
export function truthSide(guess: number, answer: number): Bet | 'exact' {
  if (answer === guess) return 'exact'
  const far = Math.abs(answer - guess) >= MUCH
  if (answer > guess) return far ? 'muchHigher' : 'higher'
  return far ? 'muchLower' : 'lower'
}

// ---------------- input checks ----------------

export function validPercent(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0 || v > 100) return null
  return Math.round(v)
}

function isBet(v: unknown): v is Bet {
  return typeof v === 'string' && (BETS as string[]).includes(v)
}

// ---------------- flow ----------------

export function setup(ctx: GameCtx, opts: Record<string, string | number>): PercentState {
  return setupWith(ctx, opts, QUESTIONS)
}

/** setup with an explicit question bank (tests use a tiny one). */
export function setupWith(ctx: GameCtx, opts: Record<string, string | number>, bank: readonly Question[]): PercentState {
  const ids = ctx.players.map((p) => p.id)
  const rounds = Math.max(1, Math.min(3, Number(opts.rounds ?? 2) || 2))
  // One shuffled seat order, repeated: everyone takes a turn before anyone goes again.
  const seat = shuffle(ids, ctx.random)
  const order: string[] = []
  for (let r = 0; r < rounds; r++) order.push(...seat)
  const picked = shuffle(bank, ctx.random).slice(0, order.length + 1).map((q) => ({ ...q }))
  return {
    order,
    round: 0,
    stage: 'spy',
    spy: order[0],
    questions: picked,
    guess: null,
    spyTimedOut: false,
    bets: {},
    finalGuesses: {},
    endsAt: ctx.now + SPY_MS,
    stageStartedAt: ctx.now,
    stageTotal: SPY_MS,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    history: [],
    final: null,
  }
}

/** The question on screen right now. */
export function currentQuestion(s: PercentState): Question | undefined {
  return s.questions[Math.min(s.round, s.questions.length - 1)]
}

function stageAt(s: PercentState, stage: Stage, ms: number, now: number): PercentState {
  return { ...s, stage, endsAt: now + ms, stageStartedAt: now, stageTotal: ms }
}

function toBet(s: PercentState, guess: number, now: number, timedOut = false): PercentState {
  return stageAt({ ...s, guess, spyTimedOut: timedOut }, 'bet', BET_MS, now)
}

function toReveal(s: PercentState, ctx: GameCtx): PercentState {
  const q = currentQuestion(s)!
  const locked = s.guess !== null && !s.spyTimedOut
  const guess = s.guess ?? DEFAULT_GUESS
  const sp = spyPoints(guess, q.answer)
  const points: Record<string, number> = {}
  for (const p of ctx.players) {
    if (p.id === s.spy) continue
    const b = s.bets[p.id]
    points[p.id] = b ? betPoints(b, guess, q.answer) : 0
  }
  const scores = { ...s.scores, [s.spy]: (s.scores[s.spy] ?? 0) + sp }
  for (const [id, pts] of Object.entries(points)) scores[id] = (scores[id] ?? 0) + pts
  const result: RoundResult = { round: s.round, spy: s.spy, q, locked, guess, answer: q.answer, spyPoints: sp, bets: { ...s.bets }, points }
  return stageAt({ ...s, guess, scores, history: [...s.history, result] }, 'reveal', REVEAL_MS, ctx.now)
}

function nextRound(s: PercentState, ctx: GameCtx): PercentState {
  const round = s.round + 1
  if (round >= s.order.length) {
    return stageAt({ ...s, round: s.order.length, spy: '', guess: null, spyTimedOut: false, bets: {}, finalGuesses: {} }, 'final', FINAL_MS, ctx.now)
  }
  return stageAt({ ...s, round, spy: s.order[round], guess: null, spyTimedOut: false, bets: {} }, 'spy', SPY_MS, ctx.now)
}

function toFinalReveal(s: PercentState, ctx: GameCtx): PercentState {
  const q = currentQuestion(s)!
  const guesses = Object.fromEntries(Object.entries(s.finalGuesses).filter(([id]) => ctx.players.some((p) => p.id === id)))
  const won = finalPoints(guesses, q.answer)
  const points: Record<string, number> = {}
  for (const p of ctx.players) points[p.id] = won[p.id] ?? 0
  const scores = { ...s.scores }
  for (const [id, pts] of Object.entries(points)) scores[id] = (scores[id] ?? 0) + pts
  return stageAt({ ...s, scores, final: { q, answer: q.answer, guesses, points } }, 'finalReveal', FINAL_REVEAL_MS, ctx.now)
}

export function reduce(s: PercentState, a: PlayerAction, ctx: GameCtx): PercentState {
  if (!ctx.players.some((p) => p.id === a.playerId)) return s
  const payload = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>
  switch (a.type) {
    case 'lock': {
      if (s.stage !== 'spy' || a.playerId !== s.spy) return s
      const v = validPercent(payload.value)
      if (v === null) return s
      return toBet(s, v, ctx.now)
    }
    case 'bet': {
      if (s.stage !== 'bet' || a.playerId === s.spy) return s
      if (s.bets[a.playerId] || !isBet(payload.bet)) return s
      const bets = { ...s.bets, [a.playerId]: payload.bet }
      const next = { ...s, bets }
      const bettors = ctx.players.filter((p) => p.id !== s.spy)
      if (bettors.every((p) => bets[p.id])) return toReveal(next, ctx)
      return next
    }
    case 'final': {
      if (s.stage !== 'final' || a.playerId in s.finalGuesses) return s
      const v = validPercent(payload.value)
      if (v === null) return s
      const finalGuesses = { ...s.finalGuesses, [a.playerId]: v }
      const next = { ...s, finalGuesses }
      if (ctx.players.every((p) => p.id in finalGuesses)) return toFinalReveal(next, ctx)
      return next
    }
  }
  return s
}

export function tick(s: PercentState, ctx: GameCtx): PercentState {
  if (s.stage === 'done' || ctx.now < s.endsAt) return s
  switch (s.stage) {
    case 'spy': return toBet(s, DEFAULT_GUESS, ctx.now, true) // never locked: 50 it is
    case 'bet': return toReveal(s, ctx)
    case 'reveal': return nextRound(s, ctx)
    case 'final': return toFinalReveal(s, ctx)
    case 'finalReveal': return { ...s, stage: 'done' }
  }
  return s
}

/** The closest Spy guess of the game (earliest wins a tie). */
export function closestSpy(s: PercentState): RoundResult | null {
  let best: RoundResult | null = null
  for (const r of s.history) {
    if (!r.locked) continue
    if (!best || Math.abs(r.answer - r.guess) < Math.abs(best.answer - best.guess)) best = r
  }
  return best
}

export function outcome(s: PercentState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: s.scores[p.id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const best = closestSpy(s)
  let summary: string
  if (best) {
    const off = Math.abs(best.answer - best.guess)
    summary = off === 0
      ? `${name(best.spy)} nailed the ${best.q.tag} one exactly`
      : `${name(best.spy)} was off by ${off} on the ${best.q.tag} one`
  } else {
    const top = placements[0]
    summary = `${name(top?.playerId ?? '')} scored ${top?.score ?? 0}`
  }
  const highlights: Highlight[] = best
    ? [{ playerId: best.spy, kind: 'moment', label: best.q.q.slice(0, 200), content: { text: `Guessed ${best.guess}, it was ${best.answer}` } }]
    : []
  return {
    placements,
    summary,
    highlights,
    details: {
      rounds: s.order.length,
      questions: s.questions.map((q) => q.tag),
      spy: s.history.map((r) => ({ spy: r.spy, guess: r.guess, answer: r.answer })),
    },
  }
}
