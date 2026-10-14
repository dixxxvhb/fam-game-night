import type { BotMove, GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'
import { CAT_KEYS, isCat, type CatKey } from '../_quiz/categories'
import { allIn, catsWith, drawQuestion, readPick, type Answer, type LiveQ } from '../_quiz/bank'
import { botPick, thinkMs } from '../_quiz/botkit'

export type TriviaPhase =
  | 'roundIntro' | 'pick' | 'spin' | 'question' | 'reveal'
  | 'finalSpin' | 'wager' | 'finalQ' | 'finalReveal' | 'done'

export interface Reveal {
  correct: number
  /** What each player picked (null = no answer). */
  picks: Record<string, number | null>
  /** Points this question (negative in the final when a wager is lost). */
  gained: Record<string, number>
  /** Steal round: who got it right first. */
  first: string | null
  steal: boolean
}

export interface TriviaState {
  phase: TriviaPhase
  /** 1..rounds, then rounds + 1 for the final. */
  round: number
  rounds: number
  /** Question within the round, 0-based. */
  q: number
  perRound: number
  endsAt: number
  phaseAt: number
  phaseTotal: number
  /** Last place picks the category. */
  picker: string | null
  offered: CatKey[]
  cat: CatKey | null
  catsThisRound: CatKey[]
  pickCount: Record<string, number>
  current: LiveQ | null
  answers: Record<string, Answer>
  scores: Record<string, number>
  streak: Record<string, number>
  best: { playerId: string; n: number } | null
  last: Reveal | null
  wagers: Record<string, number>
  used: string[]
  asked: number
}

export const ROUNDS = 3
export const PER_ROUND = 5
export const STEAL_ROUND = 2
export const ROUND_INTRO_MS = 4_500
export const PICK_MS = 12_000
export const SPIN_MS = 5_000
export const QUESTION_MS = 15_000
export const REVEAL_MS = 6_000
export const FINAL_SPIN_MS = 5_500
export const WAGER_MS = 20_000
export const FINAL_Q_MS = 20_000
export const FINAL_REVEAL_MS = 8_000
export const WAGER_FLOOR = 500

/** Difficulty range by round: easy start, harder later, the final is hard only. */
export function rangeFor(round: number, rounds = ROUNDS): [number, number] {
  if (round > rounds) return [3, 3]
  if (round === 1) return [1, 2]
  if (round === rounds) return [2, 3]
  return [1, 3]
}

/** 100 for being right plus up to 100 for speed (linear on time left), times the round. */
export function pointsFor(at: number, endsAt: number, round: number, total = QUESTION_MS): number {
  const left = Math.max(0, Math.min(1, (endsAt - at) / total))
  return (100 + Math.round(100 * left)) * round
}

export function maxWager(score: number): number {
  return Math.max(WAGER_FLOOR, Math.floor(score))
}

function ids(ctx: GameCtx) {
  return ctx.players.map((p) => p.id)
}

function phase(s: TriviaState, p: TriviaPhase, now: number, ms: number): TriviaState {
  return { ...s, phase: p, phaseAt: now, endsAt: now + ms, phaseTotal: ms }
}

/** Lowest score picks. Ties: whoever has picked least, then a coin flip. */
export function underdog(s: Pick<TriviaState, 'scores' | 'pickCount'>, players: string[], random: () => number): string {
  const low = Math.min(...players.map((id) => s.scores[id] ?? 0))
  const tied = players.filter((id) => (s.scores[id] ?? 0) === low)
  const fewest = Math.min(...tied.map((id) => s.pickCount[id] ?? 0))
  const pool = tied.filter((id) => (s.pickCount[id] ?? 0) === fewest)
  return pool[Math.floor(random() * pool.length)] ?? players[0]
}

function offerCats(s: TriviaState, random: () => number): CatKey[] {
  const [min, max] = rangeFor(s.round, s.rounds)
  const open = catsWith(s.used, min, max)
  const fresh = open.filter((k) => !s.catsThisRound.includes(k))
  const pool = shuffle(fresh, random)
  if (pool.length < 3) pool.push(...shuffle(open.filter((k) => !pool.includes(k)), random))
  if (pool.length < 3) pool.push(...shuffle(CAT_KEYS.filter((k) => !pool.includes(k)), random))
  return pool.slice(0, 3)
}

function startPick(s: TriviaState, ctx: GameCtx): TriviaState {
  const picker = underdog(s, ids(ctx), ctx.random)
  return {
    ...phase(s, 'pick', ctx.now, PICK_MS),
    picker,
    offered: offerCats(s, ctx.random),
    cat: null,
    current: null,
    answers: {},
    last: null,
  }
}

function startSpin(s: TriviaState, cat: CatKey, ctx: GameCtx): TriviaState {
  const [min, max] = rangeFor(s.round, s.rounds)
  const current = drawQuestion({ used: s.used, cat, min, max, seen: ctx.used }, ctx.random)
  const picker = s.picker
  return {
    ...phase(s, 'spin', ctx.now, SPIN_MS),
    cat,
    current,
    used: [...s.used, current.id],
    catsThisRound: [...s.catsThisRound, cat],
    pickCount: picker ? { ...s.pickCount, [picker]: (s.pickCount[picker] ?? 0) + 1 } : s.pickCount,
  }
}

function startFinal(s: TriviaState, ctx: GameCtx): TriviaState {
  const open = catsWith(s.used, 3, 3)
  const pool = open.length ? open : CAT_KEYS
  const cat = pool[Math.floor(ctx.random() * pool.length)]
  const current = drawQuestion({ used: s.used, cat, min: 3, max: 3, seen: ctx.used }, ctx.random)
  return {
    ...phase(s, 'finalSpin', ctx.now, FINAL_SPIN_MS),
    round: s.rounds + 1,
    q: 0,
    picker: null,
    offered: [],
    cat,
    current,
    used: [...s.used, current.id],
    answers: {},
    wagers: {},
    last: null,
  }
}

function scoreStreaks(s: TriviaState, right: string[], players: string[]) {
  const streak = { ...s.streak }
  let best = s.best
  for (const id of players) {
    streak[id] = right.includes(id) ? (streak[id] ?? 0) + 1 : 0
    if (streak[id] >= 2 && (!best || streak[id] > best.n)) best = { playerId: id, n: streak[id] }
  }
  return { streak, best }
}

function toReveal(s: TriviaState, ctx: GameCtx): TriviaState {
  const q = s.current!
  const players = ids(ctx)
  const steal = s.round === STEAL_ROUND
  const right = players
    .filter((id) => s.answers[id]?.pick === q.answer)
    .sort((a, b) => s.answers[a].at - s.answers[b].at)
  const first = steal ? (right[0] ?? null) : null
  const gained: Record<string, number> = {}
  const picks: Record<string, number | null> = {}
  for (const id of players) {
    picks[id] = s.answers[id]?.pick ?? null
    if (!right.includes(id)) { gained[id] = 0; continue }
    const full = pointsFor(s.answers[id].at, s.endsAt, s.round)
    gained[id] = steal && id !== first ? Math.round(full / 2) : full
  }
  const scores = { ...s.scores }
  for (const id of players) scores[id] = (scores[id] ?? 0) + gained[id]
  return {
    ...phase(s, 'reveal', ctx.now, REVEAL_MS),
    ...scoreStreaks(s, right, players),
    scores,
    asked: s.asked + 1,
    last: { correct: q.answer, picks, gained, first, steal },
  }
}

function toFinalQ(s: TriviaState, ctx: GameCtx): TriviaState {
  const wagers: Record<string, number> = {}
  for (const id of ids(ctx)) wagers[id] = s.wagers[id] ?? 0
  return { ...phase(s, 'finalQ', ctx.now, FINAL_Q_MS), wagers, answers: {} }
}

function toFinalReveal(s: TriviaState, ctx: GameCtx): TriviaState {
  const q = s.current!
  const players = ids(ctx)
  const right = players.filter((id) => s.answers[id]?.pick === q.answer)
  const gained: Record<string, number> = {}
  const picks: Record<string, number | null> = {}
  const scores = { ...s.scores }
  for (const id of players) {
    picks[id] = s.answers[id]?.pick ?? null
    const w = s.wagers[id] ?? 0
    gained[id] = right.includes(id) ? w : -w
    scores[id] = (scores[id] ?? 0) + gained[id]
  }
  return {
    ...phase(s, 'finalReveal', ctx.now, FINAL_REVEAL_MS),
    ...scoreStreaks(s, right, players),
    scores,
    asked: s.asked + 1,
    last: { correct: q.answer, picks, gained, first: null, steal: false },
  }
}

function afterReveal(s: TriviaState, ctx: GameCtx): TriviaState {
  if (s.q + 1 < s.perRound) return startPick({ ...s, q: s.q + 1 }, ctx)
  if (s.round < s.rounds) {
    return { ...phase(s, 'roundIntro', ctx.now, ROUND_INTRO_MS), round: s.round + 1, q: 0, catsThisRound: [], current: null, answers: {}, last: null }
  }
  return startFinal(s, ctx)
}

export function setup(ctx: GameCtx, opts: Record<string, string | number> = {}): TriviaState {
  const players = ids(ctx)
  const zero = Object.fromEntries(players.map((id) => [id, 0]))
  const rounds = Math.max(1, Math.min(5, Number(opts.rounds ?? ROUNDS) || ROUNDS))
  const perRound = Math.max(1, Math.min(10, Number(opts.perRound ?? PER_ROUND) || PER_ROUND))
  return {
    phase: 'roundIntro',
    round: 1,
    rounds,
    q: 0,
    perRound,
    endsAt: ctx.now + ROUND_INTRO_MS,
    phaseAt: ctx.now,
    phaseTotal: ROUND_INTRO_MS,
    picker: null,
    offered: [],
    cat: null,
    catsThisRound: [],
    pickCount: { ...zero },
    current: null,
    answers: {},
    scores: { ...zero },
    streak: { ...zero },
    best: null,
    last: null,
    wagers: {},
    used: [],
    asked: 0,
  }
}

export function reduce(s: TriviaState, a: PlayerAction, ctx: GameCtx): TriviaState {
  if (!ctx.players.some((p) => p.id === a.playerId)) return s
  switch (a.type) {
    case 'pick': {
      if (s.phase !== 'pick' || a.playerId !== s.picker) return s
      const cat = (a.payload as { cat?: unknown } | null)?.cat
      if (!isCat(cat) || !s.offered.includes(cat)) return s
      return startSpin(s, cat, ctx)
    }
    case 'answer': {
      if (s.phase !== 'question' && s.phase !== 'finalQ') return s
      if (ctx.now >= s.endsAt) return s
      if (s.answers[a.playerId]) return s
      const pick = readPick(a.payload)
      if (pick === null) return s
      const next = { ...s, answers: { ...s.answers, [a.playerId]: { pick, at: ctx.now } } }
      if (allIn(ids(ctx), next.answers)) return s.phase === 'question' ? toReveal(next, ctx) : toFinalReveal(next, ctx)
      return next
    }
    case 'wager': {
      if (s.phase !== 'wager' || s.wagers[a.playerId] !== undefined) return s
      const raw = (a.payload as { amount?: unknown } | null)?.amount
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return s
      const amount = Math.max(0, Math.min(maxWager(s.scores[a.playerId] ?? 0), Math.round(raw)))
      const next = { ...s, wagers: { ...s.wagers, [a.playerId]: amount } }
      if (allIn(ids(ctx), next.wagers)) return toFinalQ(next, ctx)
      return next
    }
  }
  return s
}

export function tick(s: TriviaState, ctx: GameCtx): TriviaState {
  if (s.phase === 'done' || ctx.now < s.endsAt) return s
  switch (s.phase) {
    case 'roundIntro': return startPick(s, ctx)
    case 'pick': return startSpin(s, s.offered[Math.floor(ctx.random() * s.offered.length)] ?? 'random', ctx)
    case 'spin': return { ...phase(s, 'question', ctx.now, QUESTION_MS), answers: {} }
    case 'question': return toReveal(s, ctx)
    case 'reveal': return afterReveal(s, ctx)
    case 'finalSpin': return { ...phase(s, 'wager', ctx.now, WAGER_MS), wagers: {} }
    case 'wager': return toFinalQ(s, ctx)
    case 'finalQ': return toFinalReveal(s, ctx)
    case 'finalReveal': return { ...s, phase: 'done' }
  }
  return s
}

export function outcome(s: TriviaState, ctx: GameCtx): GameOutcome | null {
  if (s.phase !== 'done') return null
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: s.scores[p.id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const top = placements.filter((p) => p.place === 1)
  const summary = top.length > 1
    ? `${top.map((p) => name(p.playerId)).join(' and ')} tied at ${top[0].score}`
    : `${name(top[0]?.playerId ?? '')} won with ${top[0]?.score ?? 0}`
  const highlights: Highlight[] = []
  if (s.best && s.best.n >= 2) {
    highlights.push({ playerId: s.best.playerId, kind: 'moment', label: `${name(s.best.playerId)} got ${s.best.n} right in a row`, content: { streak: s.best.n } })
  }
  return { placements, summary, highlights, details: { asked: s.asked, finalCat: s.cat }, used: s.used }
}

// ---------------- bots ----------------

/** A bot's final wager: protect a lead with a small bet, chase the leader with a big one. */
export function botWager(s: TriviaState, id: string, ctx: GameCtx): number {
  const mine = s.scores[id] ?? 0
  const max = maxWager(mine)
  const others = ctx.players.map((p) => p.id).filter((x) => x !== id).map((x) => s.scores[x] ?? 0)
  const best = others.length ? Math.max(...others) : 0
  const r = ctx.random()
  const raw = mine > best
    ? mine * (0.1 + 0.3 * r)
    : best - mine + 10 + r * 300
  return Math.max(0, Math.min(max, Math.round(raw / 10) * 10))
}

/**
 * Bots: they pick a category when they are the underdog, answer after 3 to 10 seconds and get it
 * right about 70 / 55 / 40% of the time by difficulty, and wager to protect a lead or chase one.
 */
export function bot(s: TriviaState, id: string, ctx: GameCtx): BotMove | null {
  const elapsed = ctx.now - s.phaseAt
  if (s.phase === 'pick') {
    if (s.picker !== id || elapsed < 2_000 || ctx.random() > 0.25) return null
    return { type: 'pick', payload: { cat: s.offered[Math.floor(ctx.random() * s.offered.length)] } }
  }
  if ((s.phase === 'question' || s.phase === 'finalQ') && s.current) {
    if (s.answers[id] || elapsed < thinkMs(id, s.current.id)) return null
    return { type: 'answer', payload: { pick: botPick(s.current, ctx.random) } }
  }
  if (s.phase === 'wager') {
    if (s.wagers[id] !== undefined || elapsed < thinkMs(id, `wager-${s.asked}`, 2_000, 7_000)) return null
    return { type: 'wager', payload: { amount: botWager(s, id, ctx) } }
  }
  return null
}
