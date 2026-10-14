import type { GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'

/**
 * The lie engine shared by Bluff (fill the blank in a real fact) and Fake Word
 * (fake definition for a real word). One question per round:
 *   lie    everyone writes a fake answer (the truth is rejected)
 *   pick   all lies + one House lie + the truth, shuffled; pick what you think is true
 *   reveal walk the picked lies one at a time, then the truth, then the round tally
 * Three players only make two lies to sort through, so the House always adds one more.
 */

export interface LieItem {
  id: string
  /** Bluff: the sentence with ____ in it. Fake Word: the word. */
  prompt: string
  /** Fake Word: part of speech. */
  pos?: string
  truth: string
  /** Other ways a player might type the truth. */
  alt?: string[]
  /** Three House lies. One is the House's decoy, the other two feed "Lie for me". */
  house: string[]
  /** Short credit shown with the truth. */
  source?: string
}

export interface LieConfig {
  /** 'blank' answers are 1 to 4 words; 'word' answers are definitions (looser truth match). */
  kind: 'blank' | 'word'
  maxLen: number
}

export interface Answer {
  id: string
  text: string
  /** Player authors (two players who wrote the same lie share it). */
  by: string[]
  /** Authors who used "Lie for me": half points. */
  copout: string[]
  house: boolean
  truth: boolean
}

export interface RevealStep {
  kind: 'lie' | 'truth' | 'tally'
  answerId?: string
  ms: number
}

export interface Gain {
  truth: number
  fooled: number
  /** Number of players this player fooled. */
  fooledCount: number
  house: number
  likes: number
  /** Score change this round after the floor (likes included). */
  net: number
}

export interface PlayerLie {
  text: string
  copout: boolean
  /** True when the clock ran out and the House lied for them. */
  auto?: boolean
}

export interface LieRound {
  item: LieItem
  factor: number
  /** The House's own lie for this round. */
  decoy: string
  /** House lies handed out by "Lie for me". */
  spares: string[]
  lies: Record<string, PlayerLie>
  /** Last text a player tried that was actually the truth. */
  rejected: Record<string, string>
  answers: Answer[]
  picks: Record<string, string>
  /** answerId -> ids of players who liked it. */
  likes: Record<string, string[]>
  steps: RevealStep[]
  step: number
  gains: Record<string, Gain>
}

export type LieStage = 'lie' | 'pick' | 'reveal' | 'final' | 'done'

export interface LieStats {
  truths: number
  fooled: number
  likes: number
  house: number
}

export interface LieState {
  stage: LieStage
  length: 'short' | 'normal'
  items: LieItem[]
  factors: number[]
  round: number
  cur: LieRound
  endsAt: number
  stageStartedAt: number
  stageTotal: number
  maxLen: number
  scores: Record<string, number>
  /** Scores when this round's reveal started (the TV shows these until the tally). */
  before: Record<string, number>
  stats: Record<string, LieStats>
  /** Most-liked lie of the game so far. */
  best: { playerId: string; text: string; likes: number; prompt: string } | null
}

export const LIE_MS = 60_000
export const PICK_MS = 25_000
export const STEP_LIE_MS = 5_000
export const STEP_TRUTH_MS = 5_500
export const STEP_TALLY_MS = 6_500
export const FINAL_MS = 8_000
/** Inside a lie step: when the pickers show, and when the card flips to its author. */
export const BEAT_PICKERS_MS = 1_100
export const BEAT_FLIP_MS = 2_500

export const TRUTH_POINTS = 1000
export const FOOL_POINTS = 500
export const HOUSE_PENALTY = 250
export const LIKE_POINTS = 100

export const LENGTHS = {
  short: [1, 1, 2, 2, 3],
  normal: [1, 1, 1, 2, 2, 2, 3],
} as const

// ---------------- text matching ----------------

const STOP = new Set(['a', 'an', 'the', 'his', 'her', 'their', 'its', 'my', 'your', 'some', 'of', 'and', 'to'])
const DEF_STOP = new Set([
  ...STOP, 'or', 'that', 'which', 'who', 'for', 'in', 'on', 'with', 'by', 'as', 'is', 'be', 'at', 'from', 'into', 'very', 'especially', 'usually', 'often',
])

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(s: string, stop = STOP): string[] {
  return norm(s).split(' ').filter((w) => w && !stop.has(w))
}

/** Letters and digits only, filler words dropped. */
export function squash(s: string): string {
  return words(s).join('')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

function plural(a: string, b: string): boolean {
  return a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`
}

/** Two lies close enough that showing both would look silly (and give them away). */
export function sameAnswer(a: string, b: string): boolean {
  const x = squash(a)
  const y = squash(b)
  if (!x || !y) return norm(a) === norm(b)
  if (x === y || plural(x, y)) return true
  return Math.min(x.length, y.length) >= 6 && levenshtein(x, y) <= 1
}

function wordMatch(a: string, b: string): boolean {
  return a === b || plural(a, b) || (Math.min(a.length, b.length) >= 6 && levenshtein(a, b) <= 1)
}

/** Is this "lie" really the truth (or so close it would be)? */
export function isTruth(text: string, item: Pick<LieItem, 'truth' | 'alt'>, kind: LieConfig['kind']): boolean {
  const t = squash(text)
  if (!t) return false
  for (const cand of [item.truth, ...(item.alt ?? [])]) {
    const c = squash(cand)
    if (!c) continue
    if (t === c || plural(t, c)) return true
    const d = levenshtein(t, c)
    if (c.length >= 5 && d <= 1) return true
    if (c.length >= 9 && d <= 2) return true
    if (kind === 'blank') {
      // "riding lawn mower" when the truth is "lawn mower": every truth word is there, plus at most one more.
      // (One-word truths skip this: "an Earth year" is a fair lie when the truth is "year".)
      const tw = words(text)
      const cw = words(cand)
      if (cw.length >= 2) {
        const left = [...tw]
        let all = true
        for (const w of cw) {
          const i = left.findIndex((x) => wordMatch(x, w))
          if (i < 0) { all = false; break }
          left.splice(i, 1)
        }
        if (all && left.length <= 1) return true
      }
    } else {
      if (d <= Math.floor(c.length * 0.15)) return true
      // Same content words, give or take: a reworded copy of the real definition.
      const tw = new Set(words(text, DEF_STOP))
      const cw = new Set(words(cand, DEF_STOP))
      if (cw.size >= 3 && tw.size) {
        let both = 0
        for (const w of cw) if ([...tw].some((x) => wordMatch(x, w))) both++
        const union = tw.size + cw.size - both
        if (both / union >= 0.75) return true
      }
    }
  }
  return false
}

/** A player's lie that is (nearly) one of the House lies: a cop-out. */
export function isCopout(text: string, item: Pick<LieItem, 'house'>): boolean {
  const t = squash(text)
  if (!t) return false
  return item.house.some((h) => {
    const c = squash(h)
    return t === c || (c.length >= 6 && levenshtein(t, c) <= 2)
  })
}

export function cleanText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return ''
  // Control characters become spaces (built without a regex literal to keep the linter calm).
  const plain = [...raw].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('')
  return plain.replace(/\s+/g, ' ').trim().slice(0, maxLen).trim()
}

// ---------------- rounds ----------------

function blankGain(): Gain {
  return { truth: 0, fooled: 0, fooledCount: 0, house: 0, likes: 0, net: 0 }
}

function newRound(item: LieItem, factor: number, random: () => number): LieRound {
  const house = shuffle(item.house, random)
  return {
    item,
    factor,
    decoy: house[0],
    spares: house.slice(1),
    lies: {},
    rejected: {},
    answers: [],
    picks: {},
    likes: {},
    steps: [],
    step: 0,
    gains: {},
  }
}

function slim(item: LieItem): LieItem {
  const out: LieItem = { id: item.id, prompt: item.prompt, truth: item.truth, house: [...item.house] }
  if (item.pos) out.pos = item.pos
  if (item.alt?.length) out.alt = [...item.alt]
  if (item.source) out.source = item.source
  return out
}

function ids(ctx: GameCtx) {
  return ctx.players.map((p) => p.id)
}

function toPick(s: LieState, ctx: GameCtx): LieState {
  const cur = s.cur
  const lies: Record<string, PlayerLie> = { ...cur.lies }
  // Out of time: the House lies for you (a cop-out).
  // Spares nobody has used yet go first, so two sleepy players don't share one.
  const spares = cur.spares.length ? cur.spares : [cur.decoy]
  const pool = [
    ...spares.filter((h) => !Object.values(lies).some((l) => sameAnswer(l.text, h))),
    ...spares,
  ]
  let k = 0
  for (const id of ids(ctx)) {
    if (lies[id]) continue
    lies[id] = { text: pool[k % pool.length], copout: true, auto: true }
    k++
  }

  const groups: Answer[] = []
  for (const id of ids(ctx)) {
    const l = lies[id]
    const g = groups.find((x) => sameAnswer(x.text, l.text))
    if (g) {
      g.by.push(id)
      if (l.copout) g.copout.push(id)
    } else {
      groups.push({ id: '', text: l.text, by: [id], copout: l.copout ? [id] : [], house: false, truth: false })
    }
  }
  // The House's lie: its decoy, unless a player already wrote that, then a spare.
  const houseText = [cur.decoy, ...cur.spares].find((h) => !groups.some((g) => sameAnswer(g.text, h)))
  if (houseText) groups.push({ id: '', text: houseText, by: [], copout: [], house: true, truth: false })
  else {
    const g = groups.find((x) => sameAnswer(x.text, cur.decoy))
    if (g) g.house = true
  }
  groups.push({ id: '', text: cur.item.truth, by: [], copout: [], house: false, truth: true })

  const answers = shuffle(groups, ctx.random).map((a, i) => ({ ...a, id: `a${i + 1}` }))
  return {
    ...s,
    stage: 'pick',
    cur: { ...cur, lies, answers, picks: {} },
    endsAt: ctx.now + PICK_MS,
    stageStartedAt: ctx.now,
    stageTotal: PICK_MS,
  }
}

/** Score the picks and lay out the reveal. */
function toReveal(s: LieState, ctx: GameCtx): LieState {
  const cur = s.cur
  const f = cur.factor
  const gains: Record<string, Gain> = Object.fromEntries(ids(ctx).map((id) => [id, blankGain()]))
  for (const id of ids(ctx)) {
    const a = cur.answers.find((x) => x.id === cur.picks[id])
    if (!a) continue
    if (a.truth) gains[id].truth += TRUTH_POINTS * f
    if (a.house) gains[id].house -= HOUSE_PENALTY
    for (const author of a.by) {
      if (author === id || !gains[author]) continue
      const full = FOOL_POINTS * f
      gains[author].fooled += a.copout.includes(author) ? full / 2 : full
      gains[author].fooledCount += 1
    }
  }
  const before = { ...s.scores }
  const scores = { ...s.scores }
  const stats = { ...s.stats }
  for (const id of ids(ctx)) {
    const g = gains[id]
    const after = Math.max(0, (before[id] ?? 0) + g.truth + g.fooled + g.house)
    g.net = after - (before[id] ?? 0)
    scores[id] = after
    const st = stats[id] ?? { truths: 0, fooled: 0, likes: 0, house: 0 }
    stats[id] = {
      ...st,
      truths: st.truths + (g.truth ? 1 : 0),
      fooled: st.fooled + g.fooledCount,
      house: st.house + (g.house ? 1 : 0),
    }
  }

  const pickers = (aid: string) => Object.values(cur.picks).filter((x) => x === aid).length
  const picked = cur.answers
    .filter((a) => !a.truth && pickers(a.id) > 0)
    .sort((x, y) => pickers(x.id) - pickers(y.id))
  const steps: RevealStep[] = [
    ...picked.map((a) => ({ kind: 'lie' as const, answerId: a.id, ms: STEP_LIE_MS })),
    { kind: 'truth', answerId: cur.answers.find((a) => a.truth)?.id, ms: STEP_TRUTH_MS },
    { kind: 'tally', ms: STEP_TALLY_MS },
  ]
  return {
    ...s,
    stage: 'reveal',
    before,
    scores,
    stats,
    cur: { ...cur, gains, steps, step: 0, likes: {} },
    endsAt: ctx.now + steps[0].ms,
    stageStartedAt: ctx.now,
    stageTotal: steps[0].ms,
  }
}

function bestAfterRound(s: LieState): LieState['best'] {
  let best = s.best
  for (const a of s.cur.answers) {
    const n = s.cur.likes[a.id]?.length ?? 0
    if (!n || a.truth || !a.by.length) continue
    if (!best || n > best.likes) best = { playerId: a.by[0], text: a.text, likes: n, prompt: s.cur.item.prompt }
  }
  return best
}

function finishRound(s: LieState, ctx: GameCtx): LieState {
  const best = bestAfterRound(s)
  const round = s.round + 1
  if (round >= s.items.length) {
    return { ...s, best, stage: 'final', endsAt: ctx.now + FINAL_MS, stageStartedAt: ctx.now, stageTotal: FINAL_MS }
  }
  return {
    ...s,
    best,
    round,
    stage: 'lie',
    cur: newRound(s.items[round], s.factors[round], ctx.random),
    before: { ...s.scores },
    endsAt: ctx.now + LIE_MS,
    stageStartedAt: ctx.now,
    stageTotal: LIE_MS,
  }
}

// ---------------- the game ----------------

export function createLieGame(bank: readonly LieItem[], cfg: LieConfig) {
  function setup(ctx: GameCtx, opts: Record<string, string | number>): LieState {
    const length = opts.length === 'short' ? 'short' : 'normal'
    const factors = [...LENGTHS[length]]
    const deck = shuffle(bank, ctx.random)
    const items = factors.map((_, i) => slim(deck[i % deck.length]))
    const zero = Object.fromEntries(ids(ctx).map((id) => [id, 0]))
    return {
      stage: 'lie',
      length,
      items,
      factors,
      round: 0,
      cur: newRound(items[0], factors[0], ctx.random),
      endsAt: ctx.now + LIE_MS,
      stageStartedAt: ctx.now,
      stageTotal: LIE_MS,
      maxLen: cfg.maxLen,
      scores: { ...zero },
      before: { ...zero },
      stats: Object.fromEntries(ids(ctx).map((id) => [id, { truths: 0, fooled: 0, likes: 0, house: 0 }])),
      best: null,
    }
  }

  function reduce(s: LieState, a: PlayerAction, ctx: GameCtx): LieState {
    if (!ctx.players.some((p) => p.id === a.playerId)) return s
    const me = a.playerId
    const payload = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>
    const cur = s.cur
    switch (a.type) {
      case 'lie': {
        if (s.stage !== 'lie' || cur.lies[me]) return s
        const text = cleanText(payload.text, cfg.maxLen)
        if (!text) return s
        if (isTruth(text, cur.item, cfg.kind)) {
          if (cur.rejected[me] === text) return s
          return { ...s, cur: { ...cur, rejected: { ...cur.rejected, [me]: text } } }
        }
        const rejected = { ...cur.rejected }
        delete rejected[me]
        const lies = { ...cur.lies, [me]: { text, copout: isCopout(text, cur.item) } }
        const next = { ...s, cur: { ...cur, lies, rejected } }
        return ids(ctx).every((id) => lies[id]) ? toPick(next, ctx) : next
      }
      case 'pick': {
        if (s.stage !== 'pick' || cur.picks[me]) return s
        const ans = cur.answers.find((x) => x.id === payload.answerId)
        if (!ans || ans.by.includes(me)) return s
        const picks = { ...cur.picks, [me]: ans.id }
        const next = { ...s, cur: { ...cur, picks } }
        return ids(ctx).every((id) => picks[id]) ? toReveal(next, ctx) : next
      }
      case 'like': {
        if (s.stage !== 'reveal') return s
        const ans = cur.answers.find((x) => x.id === payload.answerId)
        if (!ans || ans.truth || !ans.by.length || ans.by.includes(me)) return s
        const had = cur.likes[ans.id] ?? []
        const on = !had.includes(me)
        const likes = { ...cur.likes, [ans.id]: on ? [...had, me] : had.filter((x) => x !== me) }
        const delta = on ? LIKE_POINTS : -LIKE_POINTS
        const scores = { ...s.scores }
        const gains = { ...cur.gains }
        const stats = { ...s.stats }
        for (const author of ans.by) {
          scores[author] = Math.max(0, (scores[author] ?? 0) + delta)
          const g = gains[author] ?? blankGain()
          gains[author] = { ...g, likes: g.likes + delta, net: g.net + delta }
          const st = stats[author] ?? { truths: 0, fooled: 0, likes: 0, house: 0 }
          stats[author] = { ...st, likes: st.likes + (on ? 1 : -1) }
        }
        return { ...s, scores, stats, cur: { ...cur, likes, gains } }
      }
    }
    return s
  }

  function tick(s: LieState, ctx: GameCtx): LieState {
    if (s.stage === 'done' || ctx.now < s.endsAt) return s
    if (s.stage === 'lie') return toPick(s, ctx)
    if (s.stage === 'pick') return toReveal(s, ctx)
    if (s.stage === 'reveal') {
      const step = s.cur.step + 1
      if (step >= s.cur.steps.length) return finishRound(s, ctx)
      const ms = s.cur.steps[step].ms
      return { ...s, cur: { ...s.cur, step }, endsAt: ctx.now + ms, stageStartedAt: ctx.now, stageTotal: ms }
    }
    if (s.stage === 'final') return { ...s, stage: 'done' }
    return s
  }

  function outcome(s: LieState, ctx: GameCtx): GameOutcome | null {
    if (s.stage !== 'done') return null
    const placements = placeByScore(ids(ctx).map((id) => ({ playerId: id, score: s.scores[id] ?? 0 })))
    const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
    const top = placements[0]
    const tied = placements.filter((p) => p.place === 1)
    const liar = ids(ctx).reduce((m, id) => ((s.stats[id]?.fooled ?? 0) > (s.stats[m]?.fooled ?? 0) ? id : m), ids(ctx)[0])
    const fooled = s.stats[liar]?.fooled ?? 0
    const lead = tied.length > 1
      ? `${tied.map((p) => name(p.playerId)).join(' and ')} tied at ${top.score ?? 0}`
      : `${name(top.playerId)} won with ${top.score ?? 0}`
    const summary = top
      ? `${lead}${!fooled ? '' : tied.length === 1 && liar === top.playerId ? ` and fooled people ${fooled} ${fooled === 1 ? 'time' : 'times'}` : `. ${name(liar)} fooled people ${fooled} ${fooled === 1 ? 'time' : 'times'}`}`
      : undefined
    const best = s.best
    return {
      placements,
      summary,
      highlights: best
        ? [{ playerId: best.playerId, kind: 'answer', label: best.prompt.slice(0, 200), content: { text: best.text, likes: best.likes } }]
        : [],
      details: { length: s.length, questions: s.items.map((i) => i.id), stats: s.stats },
    }
  }

  return { setup, reduce, tick, outcome }
}

// ---------------- view helpers ----------------

/** Points shown on screen for a step's card. */
export function pickersOf(cur: LieRound, answerId: string): string[] {
  return Object.entries(cur.picks).filter(([, a]) => a === answerId).map(([id]) => id)
}

export function factorLabel(f: number, last: boolean): string {
  if (last) return 'Final question. Triple points'
  if (f === 2) return 'Double points'
  if (f === 3) return 'Triple points'
  return ''
}
