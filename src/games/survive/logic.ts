import type { BotMove, GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { freshFirst, shuffle } from '../../lib/shuffle'
import type { CatKey } from '../_quiz/categories'
import { allIn, catsWith, drawQuestion, readPick, type Answer, type LiveQ } from '../_quiz/bank'
import { botTrap, makeRun, trapDone, trapInput, trapTimeout, TRAP_KINDS, type TrapKind, type TrapRun } from './traps'
import { botPick, thinkMs } from '../_quiz/botkit'
import { SORTS } from './sorts'
import * as L from './lines'

export type SurvivePhase =
  | 'intro' | 'question' | 'reveal' | 'trap' | 'trapResult'
  | 'finaleIntro' | 'finaleQ' | 'finaleReveal' | 'done'

export interface LiveSort { id: string; prompt: string; left: string; right: string; items: string[]; key: number[] }

export interface Finale {
  exit: number
  /** Spaces moved so far. Can run past the exit; the furthest wins a photo finish. */
  pos: Record<string, number>
  round: number
  sort: LiveSort | null
  /** Per player, per item: 0 = left side, 1 = right side. */
  answers: Record<string, number[]>
  usedSorts: string[]
  last: { moves: Record<string, number>; picks: Record<string, number[] | null>; revived: string[] } | null
  revived: string[]
}

export interface SurviveState {
  phase: SurvivePhase
  endsAt: number
  phaseAt: number
  phaseTotal: number
  /** Questions asked so far (1-based once the first one is up). */
  qNum: number
  qTotal: number
  current: LiveQ | null
  answers: Record<string, Answer>
  used: string[]
  lastCat: CatKey | null
  alive: Record<string, boolean>
  /** Question number each ghost died on, and the trap that did it. */
  diedOn: Record<string, number>
  diedBy: Record<string, TrapKind>
  scores: Record<string, number>
  last: { correct: number; picks: Record<string, number | null>; gained: Record<string, number>; trapped: string[] } | null
  trap: TrapRun | null
  trapOrder: TrapKind[]
  trapsRun: number
  lastTrap: { kind: TrapKind; results: { id: string; survived: boolean; why: string }[] } | null
  /** The host's voice for this phase. */
  line: string
  lines: string[]
  finale: Finale | null
  winner: string | null
}

export const QUESTIONS = 9
export const INTRO_MS = 7_000
export const QUESTION_MS = 15_000
export const REVEAL_MS = 6_000
export const TRAP_RESULT_MS = 6_500
export const FINALE_INTRO_MS = 8_000
export const FINALE_Q_MS = 15_000
export const FINALE_REVEAL_MS = 6_500
export const CORRECT_PTS = 1_000
export const GHOST_PTS = 250
export const EXIT = 10
export const LIVING_START = 3
export const GHOST_START = 0
export const MAX_FINALE_ROUNDS = 10
export const SORT_ITEMS = 3

function ids(ctx: GameCtx) {
  return ctx.players.map((p) => p.id)
}

function nameOf(ctx: GameCtx, id: string) {
  return ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
}

function phase(s: SurviveState, p: SurvivePhase, now: number, ms: number): SurviveState {
  return { ...s, phase: p, phaseAt: now, endsAt: now + ms, phaseTotal: ms }
}

export function rangeFor(qNum: number): [number, number] {
  if (qNum <= 3) return [1, 2]
  if (qNum <= 6) return [2, 2]
  return [2, 3]
}

export function livingOf(s: Pick<SurviveState, 'alive'>, players: string[]) {
  return players.filter((id) => s.alive[id])
}

function nextQuestion(s: SurviveState, ctx: GameCtx): SurviveState {
  const qNum = s.qNum + 1
  const [min, max] = rangeFor(qNum)
  const open = catsWith(s.used, min, max).filter((k) => k !== s.lastCat)
  const cat = open.length ? open[Math.floor(ctx.random() * open.length)] : null
  const current = drawQuestion({ used: s.used, cat, min, max, avoid: s.lastCat, seen: ctx.used }, ctx.random)
  return {
    ...phase(s, 'question', ctx.now, QUESTION_MS),
    qNum,
    current,
    used: [...s.used, current.id],
    lastCat: current.cat,
    answers: {},
    last: null,
    trap: null,
    lastTrap: null,
    line: '',
    lines: [],
  }
}

function toReveal(s: SurviveState, ctx: GameCtx): SurviveState {
  const q = s.current!
  const players = ids(ctx)
  const picks: Record<string, number | null> = {}
  const gained: Record<string, number> = {}
  const trapped: string[] = []
  let ghostRight = false
  for (const id of players) {
    picks[id] = s.answers[id]?.pick ?? null
    const right = picks[id] === q.answer
    if (s.alive[id]) {
      gained[id] = right ? CORRECT_PTS : 0
      if (!right) trapped.push(id)
    } else {
      gained[id] = right ? GHOST_PTS : 0
      if (right) ghostRight = true
    }
  }
  const scores = { ...s.scores }
  for (const id of players) scores[id] = (scores[id] ?? 0) + gained[id]
  const living = livingOf(s, players)
  let line: string
  if (!living.length) line = L.ONLY_GHOSTS
  else if (!trapped.length) line = L.pickLine(L.ALL_RIGHT, ctx.random)
  else if (trapped.length === living.length && living.length > 1) line = L.pickLine(L.ALL_WRONG, ctx.random)
  else line = L.fill(L.pickLine(L.SOME_WRONG, ctx.random), { names: L.names(trapped.map((id) => nameOf(ctx, id))) })
  return {
    ...phase(s, 'reveal', ctx.now, REVEAL_MS),
    scores,
    last: { correct: q.answer, picks, gained, trapped },
    line,
    lines: ghostRight ? [L.GHOSTS_KNOW] : [],
  }
}

function startTrap(s: SurviveState, ctx: GameCtx): SurviveState {
  let order = s.trapOrder
  const slot = s.trapsRun % TRAP_KINDS.length
  if (slot === 0 && s.trapsRun > 0) {
    // New cycle: reshuffle, but never the same trap twice in a row.
    const prev = order[order.length - 1]
    order = shuffle(TRAP_KINDS, ctx.random)
    if (order[0] === prev) order = [...order.slice(1), order[0]]
  }
  const kind = order[slot]
  const run = makeRun(kind, s.last?.trapped ?? [], ctx.now, ctx.random)
  return {
    ...s,
    phase: 'trap',
    phaseAt: ctx.now,
    endsAt: run.endsAt,
    phaseTotal: run.endsAt - ctx.now,
    trap: run,
    trapOrder: order,
    trapsRun: s.trapsRun + 1,
  }
}

function toTrapResult(s: SurviveState, ctx: GameCtx): SurviveState {
  const run = trapTimeout(s.trap!)
  const alive = { ...s.alive }
  const diedOn = { ...s.diedOn }
  const diedBy = { ...s.diedBy }
  const results: { id: string; survived: boolean; why: string }[] = []
  const lines: string[] = []
  for (const [id, seat] of Object.entries(run.seats)) {
    const survived = seat.status === 'survived'
    results.push({ id, survived, why: seat.why })
    if (!survived) {
      alive[id] = false
      diedOn[id] = s.qNum
      diedBy[id] = run.kind
    }
    const list = survived ? L.SURVIVE : L.DEATH
    lines.push(L.fill(L.pickLine(list, ctx.random), { n: nameOf(ctx, id) }))
  }
  return {
    ...phase(s, 'trapResult', ctx.now, TRAP_RESULT_MS),
    trap: run,
    alive,
    diedOn,
    diedBy,
    lastTrap: { kind: run.kind, results },
    line: lines[0] ?? '',
    lines: lines.slice(1),
  }
}

/** Sort sets are remembered across nights as 'sort:<id>' in ctx.used. */
export const sortKey = (id: string) => `sort:${id}`

function drawSort(used: string[], random: () => number, seen: readonly string[] = []): LiveSort {
  const fresh = SORTS.filter((x) => !used.includes(x.id))
  const pool = fresh.length ? fresh : SORTS
  const set = freshFirst(pool, (x) => sortKey(x.id), seen, random)[0]
  // Three things, at least one from each side.
  const a = shuffle(set.a, random)
  const b = shuffle(set.b, random)
  const fromA = 1 + Math.floor(random() * (SORT_ITEMS - 1))
  const picked = [...a.slice(0, fromA).map((t) => ({ t, k: 0 })), ...b.slice(0, SORT_ITEMS - fromA).map((t) => ({ t, k: 1 }))]
  const mixed = shuffle(picked, random)
  return { id: set.id, prompt: set.prompt, left: set.left, right: set.right, items: mixed.map((x) => x.t), key: mixed.map((x) => x.k) }
}

function startFinale(s: SurviveState, ctx: GameCtx): SurviveState {
  const pos: Record<string, number> = {}
  for (const id of ids(ctx)) pos[id] = s.alive[id] ? LIVING_START : GHOST_START
  return {
    ...phase(s, 'finaleIntro', ctx.now, FINALE_INTRO_MS),
    current: null,
    answers: {},
    trap: null,
    line: L.FINALE,
    lines: [],
    finale: { exit: EXIT, pos, round: 0, sort: null, answers: {}, usedSorts: [], last: null, revived: [] },
  }
}

function startFinaleQ(s: SurviveState, ctx: GameCtx): SurviveState {
  const f = s.finale!
  const sort = drawSort(f.usedSorts, ctx.random, ctx.used)
  return {
    ...phase(s, 'finaleQ', ctx.now, FINALE_Q_MS),
    line: '',
    lines: [],
    finale: { ...f, round: f.round + 1, sort, answers: {}, usedSorts: [...f.usedSorts, sort.id], last: null },
  }
}

/** Everyone tied for first: same spaces and same score. */
export function winnersOf(s: Pick<SurviveState, 'scores'> & { finale: Pick<Finale, 'pos'> | null }, players: string[]): string[] {
  const order = rank(s, players)
  const pos = (id: string) => s.finale?.pos[id] ?? 0
  const first = order[0]
  return order.filter((id) => pos(id) === pos(first) && (s.scores[id] ?? 0) === (s.scores[first] ?? 0))
}

/** Rank by spaces (past the exit counts), then quiz score. */
export function rank(s: Pick<SurviveState, 'scores'> & { finale: Pick<Finale, 'pos'> | null }, players: string[]): string[] {
  const pos = (id: string) => s.finale?.pos[id] ?? 0
  return [...players].sort((x, y) => pos(y) - pos(x) || (s.scores[y] ?? 0) - (s.scores[x] ?? 0))
}

function toFinaleReveal(s: SurviveState, ctx: GameCtx): SurviveState {
  const f = s.finale!
  const sort = f.sort!
  const players = ids(ctx)
  const moves: Record<string, number> = {}
  const picks: Record<string, number[] | null> = {}
  const pos = { ...f.pos }
  for (const id of players) {
    const ans = f.answers[id]
    picks[id] = ans ?? null
    moves[id] = ans ? ans.filter((v, i) => v === sort.key[i]).length : 0
    pos[id] = (pos[id] ?? 0) + moves[id]
  }
  // A ghost who catches the slowest living player comes back to life.
  const alive = { ...s.alive }
  const living = players.filter((id) => alive[id])
  const revived: string[] = []
  if (living.length) {
    const slowest = Math.min(...living.map((id) => pos[id]))
    for (const id of players) {
      if (!alive[id] && pos[id] >= slowest) { alive[id] = true; revived.push(id) }
    }
  }
  const lines = revived.map((id) => L.fill(L.pickLine(L.REVIVE, ctx.random), { n: nameOf(ctx, id) }))
  const next: SurviveState = {
    ...phase(s, 'finaleReveal', ctx.now, FINALE_REVEAL_MS),
    alive,
    finale: { ...f, pos, last: { moves, picks, revived }, revived: [...f.revived, ...revived] },
  }
  const out = players.some((id) => pos[id] >= f.exit) || f.round >= MAX_FINALE_ROUNDS
  if (out) {
    const top = winnersOf(next, players)
    const winner = top[0]
    const died = s.diedOn[winner]
    next.winner = winner
    next.line = top.length > 1
      ? L.fill(L.TIE_ESCAPE, { names: L.names(top.map((id) => nameOf(ctx, id))) })
      : died !== undefined
        ? L.fill(L.GHOST_ESCAPE, { n: nameOf(ctx, winner), q: died })
        : L.fill(L.ESCAPE, { n: nameOf(ctx, winner) })
    const crossed = players.filter((id) => pos[id] >= f.exit)
    next.lines = top.length === 1 && crossed.length > 1 ? [L.fill(L.PHOTO_FINISH, { n: nameOf(ctx, winner) }), ...lines] : lines
  } else {
    next.line = lines[0] ?? ''
    next.lines = lines.slice(1)
  }
  return next
}

function afterRound(s: SurviveState, ctx: GameCtx): SurviveState {
  const living = livingOf(s, ids(ctx))
  if (s.qNum >= s.qTotal || living.length <= 1) return startFinale(s, ctx)
  return nextQuestion(s, ctx)
}

export function setup(ctx: GameCtx, opts: Record<string, string | number> = {}): SurviveState {
  const players = ids(ctx)
  const qTotal = Math.max(1, Math.min(15, Number(opts.questions ?? QUESTIONS) || QUESTIONS))
  return {
    phase: 'intro',
    endsAt: ctx.now + INTRO_MS,
    phaseAt: ctx.now,
    phaseTotal: INTRO_MS,
    qNum: 0,
    qTotal,
    current: null,
    answers: {},
    used: [],
    lastCat: null,
    alive: Object.fromEntries(players.map((id) => [id, true])),
    diedOn: {},
    diedBy: {},
    scores: Object.fromEntries(players.map((id) => [id, 0])),
    last: null,
    trap: null,
    trapOrder: shuffle(TRAP_KINDS, ctx.random),
    trapsRun: 0,
    lastTrap: null,
    line: L.INTRO,
    lines: [],
    finale: null,
    winner: null,
  }
}

function readSort(payload: unknown): number[] | null {
  const v = (payload as { picks?: unknown } | null)?.picks
  if (!Array.isArray(v) || v.length !== SORT_ITEMS) return null
  if (!v.every((x) => x === 0 || x === 1)) return null
  return v as number[]
}

export function reduce(s: SurviveState, a: PlayerAction, ctx: GameCtx): SurviveState {
  if (!ctx.players.some((p) => p.id === a.playerId)) return s
  switch (a.type) {
    case 'answer': {
      if (s.phase !== 'question' || ctx.now >= s.endsAt || s.answers[a.playerId]) return s
      const pick = readPick(a.payload)
      if (pick === null) return s
      const next = { ...s, answers: { ...s.answers, [a.playerId]: { pick, at: ctx.now } } }
      return allIn(ids(ctx), next.answers) ? toReveal(next, ctx) : next
    }
    case 'trap': {
      if (s.phase !== 'trap' || !s.trap) return s
      const run = trapInput(s.trap, a.playerId, a.payload, ctx.now)
      if (run === s.trap) return s
      const next = { ...s, trap: run }
      return trapDone(run) ? toTrapResult(next, ctx) : next
    }
    case 'sort': {
      const f = s.finale
      if (s.phase !== 'finaleQ' || !f || ctx.now >= s.endsAt || f.answers[a.playerId]) return s
      const picks = readSort(a.payload)
      if (!picks) return s
      const next = { ...s, finale: { ...f, answers: { ...f.answers, [a.playerId]: picks } } }
      return allIn(ids(ctx), next.finale.answers) ? toFinaleReveal(next, ctx) : next
    }
  }
  return s
}

export function tick(s: SurviveState, ctx: GameCtx): SurviveState {
  if (s.phase === 'done' || ctx.now < s.endsAt) return s
  switch (s.phase) {
    case 'intro': return nextQuestion(s, ctx)
    case 'question': return toReveal(s, ctx)
    case 'reveal': return s.last?.trapped.length ? startTrap(s, ctx) : afterRound(s, ctx)
    case 'trap': return toTrapResult(s, ctx)
    case 'trapResult': return afterRound(s, ctx)
    case 'finaleIntro': return startFinaleQ(s, ctx)
    case 'finaleQ': return toFinaleReveal(s, ctx)
    case 'finaleReveal': return s.winner ? { ...s, phase: 'done' } : startFinaleQ(s, ctx)
  }
  return s
}

export function outcome(s: SurviveState, ctx: GameCtx): GameOutcome | null {
  if (s.phase !== 'done') return null
  const players = ids(ctx)
  const order = rank(s, players)
  const pos = (id: string) => s.finale?.pos[id] ?? 0
  const placements: GameOutcome['placements'] = []
  order.forEach((id, i) => {
    const prev = order[i - 1]
    const tied = prev !== undefined && pos(prev) === pos(id) && (s.scores[prev] ?? 0) === (s.scores[id] ?? 0)
    placements.push({ playerId: id, place: tied ? placements[i - 1].place : i + 1, score: s.scores[id] ?? 0 })
  })
  const top = winnersOf(s, players)
  const highlights: Highlight[] = []
  for (const id of top) {
    const died = s.diedOn[id]
    if (died === undefined) continue
    highlights.push({
      playerId: id,
      kind: 'moment',
      label: `${nameOf(ctx, id)} died on question ${died} and still escaped first`,
      content: { diedOn: died, trap: s.diedBy[id] ?? null, spaces: pos(id) },
    })
  }
  const deaths = Object.keys(s.diedOn).length
  const ghostWin = top.length === 1 && s.diedOn[top[0]] !== undefined
  const who = L.names(top.map((id) => nameOf(ctx, id)))
  return {
    placements,
    summary: top.length > 1
      ? `${who} escaped together. ${deaths} ${deaths === 1 ? 'death' : 'deaths'} along the way`
      : ghostWin
        ? `${who} escaped first, as a ghost`
        : `${who} escaped first. ${deaths} ${deaths === 1 ? 'death' : 'deaths'} along the way`,
    highlights,
    details: { questions: s.qNum, deaths, finaleRounds: s.finale?.round ?? 0 },
    used: [...s.used, ...(s.finale?.usedSorts ?? []).map(sortKey)],
  }
}

// ---------------- bots ----------------

/** How often a bot sorts a finale item to the right side. */
export const BOT_SORT_ACCURACY = 0.7

/**
 * Bots: answer after 3 to 10 seconds (right about 70 / 55 / 40% by difficulty), alive or dead;
 * play traps by sending the same inputs a phone would (the host judges them, see botTrap);
 * sort finale items after a few seconds, right about 70% of the time.
 */
export function bot(s: SurviveState, id: string, ctx: GameCtx): BotMove | null {
  const elapsed = ctx.now - s.phaseAt
  if (s.phase === 'question' && s.current) {
    if (s.answers[id] || elapsed < thinkMs(id, s.current.id)) return null
    return { type: 'answer', payload: { pick: botPick(s.current, ctx.random) } }
  }
  if (s.phase === 'trap' && s.trap) return botTrap(s.trap, id, ctx)
  if (s.phase === 'finaleQ' && s.finale?.sort) {
    const f = s.finale
    const sort = f.sort!
    if (f.answers[id] || elapsed < thinkMs(id, `${sort.id}-${f.round}`, 3_000, 9_000)) return null
    return { type: 'sort', payload: { picks: sort.key.map((k) => (ctx.random() < BOT_SORT_ACCURACY ? k : 1 - k)) } }
  }
  return null
}
