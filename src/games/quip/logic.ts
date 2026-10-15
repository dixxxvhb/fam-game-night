import type { GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { freshFirst, shuffle } from '../../lib/shuffle'
import { ABOUT, PACKS, PROMPTS, PROMPT_BY_ID, SAFETY_FALLBACK, promptsForPack } from './prompts'

/**
 * Quip: everyone answers every prompt, the House (pre-written answers) answers too,
 * and everyone votes on every answer except their own. Built for three.
 *
 * Round 1 and 2: P prompts each (2 for 2-4 players, 3 for 5+). Round 3, Last Quip:
 * one prompt, three votes each (stackable). Points per vote = 100 x round.
 */

export const HOUSE = '__house'
export const MAX_ANSWER = 80
export const ANSWER_MS = 90_000
export const LAST_ANSWER_MS = 60_000
export const VOTE_MS = 20_000
export const LAST_VOTE_MS = 30_000
export const LAST_VOTES = 3
export const SCORES_MS = 8_000
export const REVEAL_LEAD_MS = 1_200
export const REVEAL_STEP_MS = 1_300
export const REVEAL_TAIL_MS = 4_500
/** After the Last Quip's verdict, the stage holds on tonight's headliner before the game ends. */
export const HEADLINER_MS = 8_000
export const LETTERS = 'ABCDEFGHIJ'

export type QuipStage = 'answer' | 'vote' | 'reveal' | 'scores' | 'done'

export interface QAnswer { text: string; safety: boolean }

export interface ResultRow {
  /** Player id, or HOUSE. */
  by: string
  /** null = no answer. */
  text: string | null
  safety: boolean
  /** Raw votes received. */
  votes: number
  /** Points from votes (a safety quip's votes count half). */
  points: number
  beatHouse: boolean
  bonusBeat: number
  sweep: boolean
  bonusSweep: number
  penalty: number
  /** What actually changed on the scoreboard (the floor at zero applied). */
  delta: number
}

export interface PromptResult {
  /** Reveal order: no-answers first, then fewest votes to most. */
  rows: ResultRow[]
  houseWins: boolean
  /** Who swept (player id or HOUSE), if anyone. */
  sweepBy: string | null
  before: Record<string, number>
  houseBefore: number
}

export interface QPrompt {
  /** Pack prompt id. */
  id: string
  /** Prompt text with {player} already swapped for a name. */
  text: string
  /** Player id the prompt names, if it is a {player} prompt. */
  about: string | null
  round: number
  house: string
  houseIdx: number
  answers: Record<string, QAnswer>
  /** Display order on the vote screen (author ids incl. HOUSE; missing answers last). Set when voting starts. */
  order: string[]
  /** voter id -> author ids they voted for (1 entry, or up to 3 in Last Quip). */
  votes: Record<string, string[]>
  result: PromptResult | null
}

export interface QuipState {
  pack: string
  players: string[]
  round: number
  perRound: number
  prompts: QPrompt[]
  stage: QuipStage
  /** Prompt index being voted on or revealed. -1 while answering. */
  current: number
  endsAt: number
  stageStartedAt: number
  stageTotal: number
  scores: Record<string, number>
  houseScore: number
}

// ---------------- helpers ----------------

export function votesPer(round: number): number {
  return round === 3 ? LAST_VOTES : 1
}

export function roundIdx(s: Pick<QuipState, 'prompts'>, round: number): number[] {
  const out: number[] = []
  s.prompts.forEach((p, i) => { if (p.round === round) out.push(i) })
  return out
}

export function revealMs(rows: number): number {
  return REVEAL_LEAD_MS + rows * REVEAL_STEP_MS + REVEAL_TAIL_MS
}

/** True once the night's headliner poster is up (the tail of the Last Quip reveal, and done). */
export function headlinerUp(s: QuipState, now: number): boolean {
  if (s.stage === 'done') return true
  if (s.stage !== 'reveal' || s.round !== 3) return false
  const n = s.prompts[s.current]?.result?.rows.length ?? 0
  return now - s.stageStartedAt >= revealMs(n)
}

/** How far the reveal has got: how many rows are shown and whether the verdict is up. */
export function revealClock(s: QuipState, now: number): { shown: number; verdict: boolean } {
  const p = s.prompts[s.current]
  const n = p?.result?.rows.length ?? 0
  if (s.stage !== 'reveal') return { shown: n, verdict: true }
  const t = now - s.stageStartedAt - REVEAL_LEAD_MS
  const shown = t < 0 ? 0 : Math.min(n, Math.floor(t / REVEAL_STEP_MS) + 1)
  const verdict = t >= n * REVEAL_STEP_MS
  return { shown, verdict }
}

export function cleanAnswer(x: unknown): string {
  if (typeof x !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER).trim()
}

function obj(p: unknown): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
}

function intOr(v: unknown, fallback = -1): number {
  return typeof v === 'number' && Number.isInteger(v) ? v : fallback
}

function stageTimes(now: number, ms: number) {
  return { endsAt: now + ms, stageStartedAt: now, stageTotal: ms }
}

function withPrompt(s: QuipState, i: number, p: QPrompt): QPrompt[] {
  return s.prompts.map((x, k) => (k === i ? p : x))
}

// ---------------- setup ----------------

export function setup(ctx: GameCtx, opts: Record<string, string | number>): QuipState {
  const ids = ctx.players.map((p) => p.id)
  const pack = PACKS[String(opts.pack ?? '')] ? String(opts.pack) : 'mixed'
  const perRound = ids.length >= 5 ? 3 : 2
  const need = perRound * 2 + 1
  let chosen = freshFirst(promptsForPack(pack), (p) => p.id, ctx.used, ctx.random).slice(0, need)
  if (chosen.length < need) {
    const extra = shuffle(PROMPTS.filter((p) => !chosen.includes(p)), ctx.random)
    chosen = [...chosen, ...extra].slice(0, need)
  }
  const mentions: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
  const prompts: QPrompt[] = chosen.map((src, i) => {
    let text = src.text
    let about: string | null = null
    if (text.includes(ABOUT) && ids.length) {
      // Spread the roasts: name whoever has been named least so far.
      const least = Math.min(...ids.map((id) => mentions[id]))
      const pool = ids.filter((id) => mentions[id] === least)
      about = pool[Math.floor(ctx.random() * pool.length)]
      mentions[about] += 1
      const name = ctx.players.find((p) => p.id === about)?.name ?? 'Someone'
      text = text.split(ABOUT).join(name)
    }
    const houseIdx = Math.floor(ctx.random() * src.house.length)
    return {
      id: src.id,
      text,
      about,
      round: i < perRound ? 1 : i < perRound * 2 ? 2 : 3,
      house: src.house[houseIdx],
      houseIdx,
      answers: {},
      order: [],
      votes: {},
      result: null,
    }
  })
  return {
    pack,
    players: ids,
    round: 1,
    perRound,
    prompts,
    stage: 'answer',
    current: -1,
    ...stageTimes(ctx.now, ANSWER_MS),
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    houseScore: 0,
  }
}

// ---------------- scoring ----------------

/** Score one prompt. Pure: returns the result and the new scores. */
export function scorePrompt(
  p: QPrompt,
  players: string[],
  round: number,
  scores: Record<string, number>,
  houseScore: number,
): { result: PromptResult; scores: Record<string, number>; houseScore: number } {
  const base = 100 * round
  const per = votesPer(round)
  const counts: Record<string, number> = {}
  for (const list of Object.values(p.votes)) for (const t of list) counts[t] = (counts[t] ?? 0) + 1
  const houseVotes = counts[HOUSE] ?? 0
  const answered = players.filter((id) => p.answers[id])
  const weighted = (id: string) => (counts[id] ?? 0) * (p.answers[id]?.safety ? 0.5 : 1)
  const topHuman = answered.length ? Math.max(...answered.map(weighted)) : 0
  const houseWins = houseVotes > 0 && houseVotes > topHuman
  const sweeps = (id: string) => {
    const eligible = id === HOUSE ? players.length : players.length - 1
    return eligible >= 2 && (counts[id] ?? 0) === eligible * per
  }

  const next = { ...scores }
  const rows: ResultRow[] = []
  let sweepBy: string | null = null
  for (const id of answered) {
    const a = p.answers[id]
    const w = weighted(id)
    const points = Math.round(base * w)
    const beatHouse = w > houseVotes
    const sweep = sweeps(id)
    if (sweep) sweepBy = id
    const bonusBeat = beatHouse ? 50 * round : 0
    const bonusSweep = sweep ? 100 * round : 0
    const penalty = houseWins ? 50 * round : 0
    const before = scores[id] ?? 0
    const after = Math.max(0, before + points + bonusBeat + bonusSweep - penalty)
    next[id] = after
    rows.push({ by: id, text: a.text, safety: a.safety, votes: counts[id] ?? 0, points, beatHouse, bonusBeat, sweep, bonusSweep, penalty, delta: after - before })
  }
  const houseSweep = sweeps(HOUSE)
  if (houseSweep) sweepBy = HOUSE
  const housePoints = base * houseVotes
  rows.push({ by: HOUSE, text: p.house, safety: false, votes: houseVotes, points: housePoints, beatHouse: false, bonusBeat: 0, sweep: houseSweep, bonusSweep: 0, penalty: 0, delta: housePoints })

  // Reveal order: no-answers first, then fewest votes to most (display order breaks ties).
  const pos = (id: string) => { const k = p.order.indexOf(id); return k < 0 ? 99 : k }
  rows.sort((a, b) => a.votes - b.votes || a.points - b.points || pos(a.by) - pos(b.by))
  const missing: ResultRow[] = players
    .filter((id) => !p.answers[id])
    .map((id) => ({ by: id, text: null, safety: false, votes: 0, points: 0, beatHouse: false, bonusBeat: 0, sweep: false, bonusSweep: 0, penalty: 0, delta: 0 }))

  return {
    result: { rows: [...missing, ...rows], houseWins, sweepBy, before: { ...scores }, houseBefore: houseScore },
    scores: next,
    houseScore: houseScore + housePoints,
  }
}

// ---------------- stage changes ----------------

function startRound(s: QuipState, round: number, now: number): QuipState {
  return { ...s, round, stage: 'answer', current: -1, ...stageTimes(now, round === 3 ? LAST_ANSWER_MS : ANSWER_MS) }
}

function startVote(s: QuipState, i: number, ctx: GameCtx): QuipState {
  const p = s.prompts[i]
  const answered = shuffle([...s.players.filter((id) => p.answers[id]), HOUSE], ctx.random)
  const missing = s.players.filter((id) => !p.answers[id])
  const order = [...answered, ...missing]
  return {
    ...s,
    prompts: withPrompt(s, i, { ...p, order, votes: {} }),
    stage: 'vote',
    current: i,
    ...stageTimes(ctx.now, s.round === 3 ? LAST_VOTE_MS : VOTE_MS),
  }
}

function toReveal(s: QuipState, now: number): QuipState {
  const p = s.prompts[s.current]
  const { result, scores, houseScore } = scorePrompt(p, s.players, s.round, s.scores, s.houseScore)
  return {
    ...s,
    prompts: withPrompt(s, s.current, { ...p, result }),
    scores,
    houseScore,
    stage: 'reveal',
    ...stageTimes(now, revealMs(result.rows.length) + (s.round === 3 ? HEADLINER_MS : 0)),
  }
}

function afterReveal(s: QuipState, ctx: GameCtx): QuipState {
  const ids = roundIdx(s, s.round)
  const at = ids.indexOf(s.current)
  if (at >= 0 && at < ids.length - 1) return startVote(s, ids[at + 1], ctx)
  if (s.round >= 3) return { ...s, stage: 'done' }
  return { ...s, stage: 'scores', ...stageTimes(ctx.now, SCORES_MS) }
}

function allAnswered(s: QuipState): boolean {
  const ids = roundIdx(s, s.round)
  return s.players.every((id) => ids.every((i) => s.prompts[i].answers[id]))
}

function allVoted(s: QuipState): boolean {
  const p = s.prompts[s.current]
  const need = votesPer(s.round)
  return s.players.every((id) => (p.votes[id]?.length ?? 0) >= need)
}

function firstOfRound(s: QuipState): number {
  return roundIdx(s, s.round)[0] ?? -1
}

function safetyFor(p: QPrompt, random: () => number): string {
  const taken = new Set([p.house, ...Object.values(p.answers).map((a) => a.text)])
  const spare = (PROMPT_BY_ID[p.id]?.house ?? []).filter((t, k) => k !== p.houseIdx && !taken.has(t))
  const pool = spare.length ? spare : SAFETY_FALLBACK.filter((t) => !taken.has(t))
  const list = pool.length ? pool : SAFETY_FALLBACK
  return list[Math.floor(random() * list.length)]
}

// ---------------- reduce / tick ----------------

export function reduce(s: QuipState, a: PlayerAction, ctx: GameCtx): QuipState {
  if (!s.players.includes(a.playerId)) return s
  const me = a.playerId
  const pl = obj(a.payload)
  switch (a.type) {
    case 'answer':
    case 'safety': {
      if (s.stage !== 'answer') return s
      const i = intOr(pl.i)
      const p = s.prompts[i]
      if (!p || p.round !== s.round || p.answers[me]) return s
      let answer: QAnswer
      if (a.type === 'answer') {
        const text = cleanAnswer(pl.text)
        if (!text) return s
        answer = { text, safety: false }
      } else {
        answer = { text: safetyFor(p, ctx.random), safety: true }
      }
      const next = { ...s, prompts: withPrompt(s, i, { ...p, answers: { ...p.answers, [me]: answer } }) }
      return allAnswered(next) ? startVote(next, firstOfRound(next), ctx) : next
    }
    case 'vote': {
      if (s.stage !== 'vote' || intOr(pl.i) !== s.current) return s
      const p = s.prompts[s.current]
      const target = typeof pl.for === 'string' ? pl.for : ''
      if (!target || target === me || !p.order.includes(target)) return s
      if (target !== HOUSE && !p.answers[target]) return s
      const mine = p.votes[me] ?? []
      if (mine.length >= votesPer(s.round)) return s
      const next = { ...s, prompts: withPrompt(s, s.current, { ...p, votes: { ...p.votes, [me]: [...mine, target] } }) }
      return allVoted(next) ? toReveal(next, ctx.now) : next
    }
    case 'clearVotes': {
      if (s.stage !== 'vote' || s.round !== 3 || intOr(pl.i) !== s.current) return s
      const p = s.prompts[s.current]
      if (!p.votes[me]?.length) return s
      const votes = { ...p.votes }
      delete votes[me]
      return { ...s, prompts: withPrompt(s, s.current, { ...p, votes }) }
    }
  }
  return s
}

export function tick(s: QuipState, ctx: GameCtx): QuipState {
  if (s.stage === 'done' || ctx.now < s.endsAt) return s
  switch (s.stage) {
    case 'answer': return startVote(s, firstOfRound(s), ctx)
    case 'vote': return toReveal(s, ctx.now)
    case 'reveal': return afterReveal(s, ctx)
    case 'scores': return startRound(s, s.round + 1, ctx.now)
  }
  return s
}

// ---------------- outcome ----------------

function topOfRound(s: QuipState, round: number): Highlight | null {
  let best: { row: ResultRow; label: string } | null = null
  for (const i of roundIdx(s, round)) {
    const p = s.prompts[i]
    for (const row of p.result?.rows ?? []) {
      if (row.by === HOUSE || row.text === null || row.safety || row.votes < 1) continue
      if (!best || row.votes > best.row.votes || (row.votes === best.row.votes && row.delta > best.row.delta)) best = { row, label: p.text }
    }
  }
  if (!best) return null
  return { playerId: best.row.by, kind: 'answer', label: best.label.slice(0, 200), content: { text: best.row.text, votes: best.row.votes } }
}

export function outcome(s: QuipState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const placements = placeByScore(s.players.map((id) => ({ playerId: id, score: s.scores[id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const top = placements.filter((p) => p.place === 1)
  const topScore = top[0]?.score ?? 0
  const lead = top.length > 1
    ? `${top.map((p) => name(p.playerId)).join(' and ')} tied at ${topScore}`
    : `${name(top[0]?.playerId ?? '')} won with ${topScore}`
  const summary = s.houseScore > topScore
    ? `${lead}. The House had ${s.houseScore}. Nobody tell it.`
    : `${lead}. The House had ${s.houseScore}.`
  const highlights = [1, 2, 3].map((r) => topOfRound(s, r)).filter((h): h is Highlight => h !== null).slice(0, 3)
  return {
    placements,
    summary,
    highlights,
    details: {
      pack: s.pack,
      prompts: s.prompts.map((p) => p.id),
      houseScore: s.houseScore,
      houseWins: s.prompts.filter((p) => p.result?.houseWins).length,
    },
    used: s.prompts.map((p) => p.id),
  }
}
