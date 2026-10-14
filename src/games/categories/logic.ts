import type { GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'
import { CATEGORY_BANK } from './bank'

/** Letters that can come up. Q, U, V, X, Y and Z are out: nobody has fun on Q. */
export const LETTERS = 'ABCDEFGHIJKLMNOPRSTW'.split('')
export const ROUNDS = 3
export const PER_ROUND = 8
export const WRITE_MS = 120_000
/** Late answer sends still count for this long after the clock hits zero. */
export const GRACE_MS = 1_000
export const VOTE_MS = 10_000
/** A category with nothing to challenge (all blank, duplicate or wrong letter) moves on fast. */
export const QUICK_MS = 3_000
export const VERDICT_MS = 2_500
export const ROUND_END_MS = 7_000
export const MAX_LEN = 40

export type Status = 'ok' | 'blank' | 'letter' | 'dup' | 'out'

export interface Judged {
  playerId: string
  text: string
  status: Status
  allit: boolean
  points: number
  ups: number
  downs: number
}

export interface CatResult { idx: number; cat: string; answers: Judged[] }
export interface RoundResult { round: number; letter: string; cats: CatResult[] }

export interface CategoriesState {
  stage: 'write' | 'judge' | 'verdict' | 'roundEnd' | 'done'
  round: number
  rounds: number
  letter: string
  letters: string[]
  cats: string[]
  usedCats: string[]
  /** Raw answers per player, one slot per category. */
  answers: Record<string, string[]>
  /** Players who locked in their list this round. */
  done: string[]
  endsAt: number
  stageTotal: number
  /** Which category is on the TV while judging. */
  judgeIdx: number
  /** Answer owner -> voters, for the category being judged. */
  ups: Record<string, string[]>
  downs: Record<string, string[]>
  /** Players who tapped Next on this category. */
  ready: string[]
  results: RoundResult[]
  scores: Record<string, number>
}

// ---------------- text rules ----------------

/** Trim, collapse spaces, drop control characters, cap the length. Anything not a string is blank. */
export function cleanAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN)
}

/** Lowercase, no accents, leading "the / a / an" dropped. Keeps spaces between words. */
export function plain(raw: string): string {
  const s = cleanAnswer(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.replace(/^(the|an|a)\s+/, '')
}

/** Comparison key: plain() with everything but letters and digits removed. */
export function normalize(raw: string): string {
  const p = plain(raw)
  if (p === 'the' || p === 'a' || p === 'an') return ''
  return p.replace(/[^a-z0-9]/g, '')
}

/** Starts with the round's letter (after the article is dropped) and is at least two characters long. */
export function startsWithLetter(raw: string, letter: string): boolean {
  const k = normalize(raw)
  return k.length >= 2 && k[0] === letter.toLowerCase()
}

/** Two or more words, every one of them starting with the letter. "Sizzling Sausage" for S. */
export function alliterates(raw: string, letter: string): boolean {
  if (!startsWithLetter(raw, letter)) return false
  const words = plain(raw).split(/[\s-]+/).map((w) => w.replace(/[^a-z0-9]/g, '')).filter(Boolean)
  return words.length >= 2 && words.every((w) => w[0] === letter.toLowerCase())
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Same answer for scoring: equal keys, a plural, or a typo apart on longer words. */
export function similar(a: string, b: string): boolean {
  const x = normalize(a)
  const y = normalize(b)
  if (!x || !y) return false
  if (x === y) return true
  if (x + 's' === y || y + 's' === x || x + 'es' === y || y + 'es' === x) return true
  const short = Math.min(x.length, y.length)
  const d = levenshtein(x, y)
  if (short >= 5 && d <= 1) return true
  if (short >= 10 && d <= 2) return true
  return false
}

/** Votes needed to throw an answer out: a majority of everyone except its owner. */
export function outThreshold(playerCount: number): number {
  const others = Math.max(1, playerCount - 1)
  return Math.floor(others / 2) + 1
}

/**
 * Score one category. Works mid-vote too (the TV shows it live).
 * Order of rules: blank, wrong letter, duplicate (cancels everyone sharing it), thrown out by vote.
 */
export function judgeCategory(
  playerIds: string[],
  texts: Record<string, string>,
  letter: string,
  ups: Record<string, string[]> = {},
  downs: Record<string, string[]> = {},
): Judged[] {
  const base = playerIds.map((id) => {
    const text = cleanAnswer(texts[id] ?? '')
    const status: Status = !normalize(text) ? 'blank' : !startsWithLetter(text, letter) ? 'letter' : 'ok'
    return { playerId: id, text, status } as { playerId: string; text: string; status: Status }
  })
  // Union duplicates among letter-valid answers.
  const valid = base.filter((b) => b.status === 'ok')
  const dup = new Set<string>()
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (similar(valid[i].text, valid[j].text)) { dup.add(valid[i].playerId); dup.add(valid[j].playerId) }
    }
  }
  const need = outThreshold(playerIds.length)
  return base.map((b) => {
    const u = (ups[b.playerId] ?? []).filter((v) => v !== b.playerId && playerIds.includes(v)).length
    const d = (downs[b.playerId] ?? []).filter((v) => v !== b.playerId && playerIds.includes(v)).length
    let status: Status = b.status
    if (status === 'ok' && dup.has(b.playerId)) status = 'dup'
    if (status === 'ok' && d >= need) status = 'out'
    const allit = status === 'ok' && alliterates(b.text, letter)
    const points = status === 'ok' ? (allit ? 2 : 1) : 0
    return { playerId: b.playerId, text: b.text, status, allit, points, ups: u, downs: d }
  })
}

/** Texts for one category index, from the answers map. */
export function textsFor(s: CategoriesState, idx: number): Record<string, string> {
  return Object.fromEntries(Object.entries(s.answers).map(([id, list]) => [id, list[idx] ?? '']))
}

/** True when nobody has an answer that could be voted down (so the window can be short). */
function nothingToChallenge(s: CategoriesState, ids: string[], idx: number): boolean {
  return judgeCategory(ids, textsFor(s, idx), s.letter).every((j) => j.status !== 'ok')
}

// ---------------- flow ----------------

function pickLetter(used: string[], random: () => number): string {
  const fresh = LETTERS.filter((l) => !used.includes(l))
  const pool = fresh.length ? fresh : LETTERS
  return pool[Math.floor(random() * pool.length)] ?? 'S'
}

function pickCats(used: string[], random: () => number): string[] {
  const fresh = CATEGORY_BANK.filter((c) => !used.includes(c))
  return shuffle(fresh.length >= PER_ROUND ? fresh : CATEGORY_BANK, random).slice(0, PER_ROUND)
}

function blankAnswers(ids: string[]): Record<string, string[]> {
  return Object.fromEntries(ids.map((id) => [id, Array(PER_ROUND).fill('')]))
}

function startRound(s: CategoriesState, ids: string[], round: number, ctx: GameCtx): CategoriesState {
  const letter = pickLetter(s.letters, ctx.random)
  const cats = pickCats(s.usedCats, ctx.random)
  return {
    ...s,
    stage: 'write',
    round,
    letter,
    letters: [...s.letters, letter],
    cats,
    usedCats: [...s.usedCats, ...cats],
    answers: blankAnswers(ids),
    done: [],
    endsAt: ctx.now + WRITE_MS,
    stageTotal: WRITE_MS,
    judgeIdx: 0,
    ups: {},
    downs: {},
    ready: [],
  }
}

export function setup(ctx: GameCtx, opts: Record<string, string | number> = {}): CategoriesState {
  const ids = ctx.players.map((p) => p.id)
  const rounds = Math.max(1, Math.min(5, Number(opts.rounds ?? ROUNDS) || ROUNDS))
  const empty: CategoriesState = {
    stage: 'write',
    round: 0,
    rounds,
    letter: '',
    letters: [],
    cats: [],
    usedCats: [],
    answers: {},
    done: [],
    endsAt: 0,
    stageTotal: WRITE_MS,
    judgeIdx: 0,
    ups: {},
    downs: {},
    ready: [],
    results: [],
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
  }
  return startRound(empty, ids, 0, ctx)
}

function startJudge(s: CategoriesState, ids: string[], idx: number, now: number): CategoriesState {
  const ms = nothingToChallenge(s, ids, idx) ? QUICK_MS : VOTE_MS
  return { ...s, stage: 'judge', judgeIdx: idx, ups: {}, downs: {}, ready: [], endsAt: now + ms, stageTotal: ms }
}

function toVerdict(s: CategoriesState, ids: string[], now: number): CategoriesState {
  const answers = judgeCategory(ids, textsFor(s, s.judgeIdx), s.letter, s.ups, s.downs)
  const scores = { ...s.scores }
  for (const a of answers) scores[a.playerId] = (scores[a.playerId] ?? 0) + a.points
  const cat: CatResult = { idx: s.judgeIdx, cat: s.cats[s.judgeIdx], answers }
  const results = [...s.results]
  const cur = results.find((r) => r.round === s.round)
  if (cur) results[results.length - 1] = { ...cur, cats: [...cur.cats, cat] }
  else results.push({ round: s.round, letter: s.letter, cats: [cat] })
  return { ...s, stage: 'verdict', results, scores, endsAt: now + VERDICT_MS, stageTotal: VERDICT_MS }
}

function afterVerdict(s: CategoriesState, ids: string[], ctx: GameCtx): CategoriesState {
  if (s.judgeIdx + 1 < s.cats.length) return startJudge(s, ids, s.judgeIdx + 1, ctx.now)
  return { ...s, stage: 'roundEnd', endsAt: ctx.now + ROUND_END_MS, stageTotal: ROUND_END_MS }
}

function afterRound(s: CategoriesState, ids: string[], ctx: GameCtx): CategoriesState {
  if (s.round + 1 >= s.rounds) return { ...s, stage: 'done', endsAt: ctx.now, stageTotal: 0 }
  return startRound(s, ids, s.round + 1, ctx)
}

function cleanList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const list = raw.slice(0, PER_ROUND).map(cleanAnswer)
  while (list.length < PER_ROUND) list.push('')
  return list
}

export function reduce(s: CategoriesState, a: PlayerAction, ctx: GameCtx): CategoriesState {
  const ids = ctx.players.map((p) => p.id)
  if (!ids.includes(a.playerId)) return s
  const p = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>

  switch (a.type) {
    case 'answers':
    case 'done': {
      if (s.stage !== 'write' || ctx.now > s.endsAt + GRACE_MS) return s
      const list = p.list === undefined && a.type === 'done' ? s.answers[a.playerId] : cleanList(p.list)
      if (!list) return s
      const same = (s.answers[a.playerId] ?? []).every((x, i) => x === list[i])
      if (a.type === 'answers') {
        if (same || s.done.includes(a.playerId)) return s
        return { ...s, answers: { ...s.answers, [a.playerId]: list } }
      }
      const done = s.done.includes(a.playerId) ? s.done : [...s.done, a.playerId]
      if (same && done === s.done) return s
      const next = { ...s, answers: { ...s.answers, [a.playerId]: list }, done }
      if (ids.every((id) => done.includes(id))) return startJudge(next, ids, 0, ctx.now)
      return next
    }
    case 'undone': {
      if (s.stage !== 'write' || !s.done.includes(a.playerId) || ctx.now > s.endsAt) return s
      return { ...s, done: s.done.filter((x) => x !== a.playerId) }
    }
    case 'vote': {
      if (s.stage !== 'judge' || Number(p.idx) !== s.judgeIdx) return s
      const owner = String(p.owner ?? '')
      const kind = p.kind === 'up' ? 'up' : p.kind === 'down' ? 'down' : null
      if (!kind || !ids.includes(owner) || owner === a.playerId) return s
      const pre = judgeCategory(ids, textsFor(s, s.judgeIdx), s.letter).find((j) => j.playerId === owner)
      if (!pre || pre.status === 'blank') return s
      if (kind === 'down' && pre.status !== 'ok') return s
      const mine = kind === 'up' ? s.ups : s.downs
      const theirs = kind === 'up' ? s.downs : s.ups
      const had = (mine[owner] ?? []).includes(a.playerId)
      const nextMine = { ...mine, [owner]: had ? mine[owner].filter((v) => v !== a.playerId) : [...(mine[owner] ?? []), a.playerId] }
      // Up and down are exclusive per voter.
      const nextTheirs = (theirs[owner] ?? []).includes(a.playerId)
        ? { ...theirs, [owner]: theirs[owner].filter((v) => v !== a.playerId) }
        : theirs
      return kind === 'up' ? { ...s, ups: nextMine, downs: nextTheirs } : { ...s, downs: nextMine, ups: nextTheirs }
    }
    case 'next': {
      if (s.stage !== 'judge' || Number(p.idx) !== s.judgeIdx || s.ready.includes(a.playerId)) return s
      const ready = [...s.ready, a.playerId]
      const next = { ...s, ready }
      if (ids.every((id) => ready.includes(id))) return toVerdict(next, ids, ctx.now)
      return next
    }
  }
  return s
}

export function tick(s: CategoriesState, ctx: GameCtx): CategoriesState {
  if (s.stage === 'done') return s
  const ids = ctx.players.map((p) => p.id)
  if (s.stage === 'write') return ctx.now >= s.endsAt + GRACE_MS ? startJudge(s, ids, 0, ctx.now) : s
  if (ctx.now < s.endsAt) return s
  if (s.stage === 'judge') return toVerdict(s, ids, ctx.now)
  if (s.stage === 'verdict') return afterVerdict(s, ids, ctx)
  if (s.stage === 'roundEnd') return afterRound(s, ids, ctx)
  return s
}

/** Points each player made in one round. */
export function roundPoints(s: CategoriesState, round: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of s.results.find((r) => r.round === round)?.cats ?? []) {
    for (const a of c.answers) out[a.playerId] = (out[a.playerId] ?? 0) + a.points
  }
  return out
}

/** The answer with the most thumbs up (first one wins a tie). Null if nobody gave any. */
export function bestAnswer(s: CategoriesState): { round: RoundResult; cat: CatResult; answer: Judged } | null {
  let best: { round: RoundResult; cat: CatResult; answer: Judged } | null = null
  for (const r of s.results) {
    for (const c of r.cats) {
      for (const a of c.answers) {
        if (a.ups > 0 && a.text && (!best || a.ups > best.answer.ups)) best = { round: r, cat: c, answer: a }
      }
    }
  }
  return best
}

export function outcome(s: CategoriesState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: s.scores[p.id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const top = placements.filter((p) => p.place === 1)
  const summary = top.length > 1
    ? `${top.map((t) => name(t.playerId)).join(' and ')} tied at ${top[0].score}`
    : `${name(top[0]?.playerId ?? '')} took it with ${top[0]?.score ?? 0}`
  const best = bestAnswer(s)
  return {
    placements,
    summary,
    highlights: best
      ? [{
          playerId: best.answer.playerId,
          kind: 'answer',
          label: `${best.cat.cat} (${best.round.letter})`.slice(0, 200),
          content: { text: best.answer.text, letter: best.round.letter, category: best.cat.cat, ups: best.answer.ups },
        }]
      : [],
    details: { letters: s.letters, rounds: s.rounds },
  }
}
