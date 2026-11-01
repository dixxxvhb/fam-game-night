import type { BotMove, GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { freshFirst, shuffle } from '../../lib/shuffle'

/**
 * The lie engine shared by Bluff (fill the blank in a real fact) and Fake Word
 * (fake definition for a real word). One question per round:
 *   lie    everyone writes a fake answer (the truth is rejected)
 *   pick   all lies + one House lie + the truth, shuffled; pick what you think is true
 *   reveal walk the picked lies one at a time, then the truth, then the round tally
 * Three players only make two lies to sort through, so the House always adds one more.
 *
 * Two optional extras (Bluff turns them on, Fake Word leaves them off):
 *   category  before each fact, one player (rotating) picks from three categories
 *   about     "About Us": a closing run of rounds, one per player, where the question is about
 *             that player. They type the truth while everyone else lies about them, and they
 *             score for every friend who spots it.
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
  /** Category id (category pick). */
  cat?: string
  /** About Us: the player the question is about. They write the truth during the lie phase. */
  subject?: string
}

/** An About Us question. `{name}` in the prompt becomes the subject's name. */
export interface AboutItem {
  id: string
  prompt: string
  /** Three House lies, generic enough to fit anyone. */
  house: string[]
}

export interface LieConfig {
  /** 'blank' answers are 1 to 4 words; 'word' answers are definitions (looser truth match). */
  kind: 'blank' | 'word'
  maxLen: number
  /** Category pick before each fact: category id -> label. Items need `cat`. */
  cats?: Record<string, string>
  /** About Us rounds at the end, one per player (up to ABOUT_MAX). */
  about?: readonly AboutItem[]
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
  /** About Us: points the subject earned for friends who found their truth. */
  told: number
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
  /** About Us: the subject never answered, so the round is skipped. */
  skipped?: boolean
}

export type LieStage = 'category' | 'lie' | 'pick' | 'reveal' | 'final' | 'done'

export interface LieStats {
  truths: number
  fooled: number
  likes: number
  house: number
  /** Times this player picked another player's lie. */
  fell: number
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
  /** Category pick: who is choosing this round and from what. */
  choose?: { by: string; cats: string[] } | null
  /** Category pick: fact ids in the order to draw them (fresh first). */
  pool?: string[]
  /** Category labels, so screens can show them. */
  catNames?: Record<string, string>
  /** Index of the first About Us round (items.length when there are none). */
  aboutFrom?: number
}

export const LIE_MS = 60_000
export const PICK_MS = 25_000
export const STEP_LIE_MS = 5_000
export const STEP_TRUTH_MS = 5_500
export const STEP_TALLY_MS = 6_500
export const FINAL_MS = 8_000
export const CATEGORY_MS = 12_000
/** About Us: a beat longer to write, since the subject is thinking about their real life. */
export const ABOUT_LIE_MS = 70_000
export const SKIP_MS = 4_000
export const ABOUT_MAX = 4
/** Inside a lie step: when the pickers show, and when the card flips to its author. */
export const BEAT_PICKERS_MS = 1_100
export const BEAT_FLIP_MS = 2_500

export const TRUTH_POINTS = 1000
export const FOOL_POINTS = 500
export const HOUSE_PENALTY = 250
export const LIKE_POINTS = 100
/** About Us: the subject earns this (times the factor) for each friend who finds their truth. */
export const TOLD_POINTS = 500

export const LENGTHS = {
  short: [1, 1, 2, 2, 3],
  normal: [1, 1, 1, 2, 2, 2, 3],
} as const

/** With About Us on, the facts run shorter and the About Us rounds carry the big points. */
export const ABOUT_LENGTHS = {
  short: [1, 2, 2],
  normal: [1, 1, 2, 2, 2],
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
  return { truth: 0, fooled: 0, fooledCount: 0, house: 0, likes: 0, told: 0, net: 0 }
}

function blankStats(): LieStats {
  return { truths: 0, fooled: 0, likes: 0, house: 0, fell: 0 }
}

/** Players who pick (and lie) this round: everyone but the subject. */
export function pickersFor(item: Pick<LieItem, 'subject'>, players: string[]): string[] {
  return item.subject ? players.filter((id) => id !== item.subject) : players
}

/** Is the current round an About Us round? */
export function isAbout(s: Pick<LieState, 'cur'>): boolean {
  return !!s.cur.item.subject
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
  if (item.cat) out.cat = item.cat
  if (item.subject) out.subject = item.subject
  return out
}

function ids(ctx: GameCtx) {
  return ctx.players.map((p) => p.id)
}

function toPick(s: LieState, ctx: GameCtx): LieState {
  const cur = s.cur
  const subject = cur.item.subject
  // About Us with no truth from the subject: nothing to find, so the round is skipped.
  if (subject && !cur.item.truth) {
    return {
      ...s,
      stage: 'reveal',
      cur: { ...cur, skipped: true, answers: [], steps: [{ kind: 'tally', ms: SKIP_MS }], step: 0, gains: Object.fromEntries(ids(ctx).map((id) => [id, blankGain()])) },
      before: { ...s.scores },
      endsAt: ctx.now + SKIP_MS,
      stageStartedAt: ctx.now,
      stageTotal: SKIP_MS,
    }
  }
  const lies: Record<string, PlayerLie> = { ...cur.lies }
  if (subject) delete lies[subject]
  // Out of time: the House lies for you (a cop-out).
  // Spares nobody has used yet go first, so two sleepy players don't share one.
  const spares = cur.spares.length ? cur.spares : [cur.decoy]
  const pool = [
    ...spares.filter((h) => !Object.values(lies).some((l) => sameAnswer(l.text, h))),
    ...spares,
  ]
  let k = 0
  for (const id of ids(ctx)) {
    if (lies[id] || id === subject) continue
    lies[id] = { text: pool[k % pool.length], copout: true, auto: true }
    k++
  }

  const groups: Answer[] = []
  for (const id of ids(ctx)) {
    const l = lies[id]
    if (!l) continue
    const g = groups.find((x) => sameAnswer(x.text, l.text))
    if (g) {
      g.by.push(id)
      if (l.copout) g.copout.push(id)
    } else {
      groups.push({ id: '', text: l.text, by: [id], copout: l.copout ? [id] : [], house: false, truth: false })
    }
  }
  // The House's lie: its decoy, unless a player already wrote that, then a spare.
  const houseText = [cur.decoy, ...cur.spares].find((h) => !groups.some((g) => sameAnswer(g.text, h)) && !sameAnswer(h, cur.item.truth))
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
    cur: { ...cur, lies: subject ? { ...lies, [subject]: cur.lies[subject] } : lies, answers, picks: {} },
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
  const stats = { ...s.stats }
  const subject = cur.item.subject
  for (const id of ids(ctx)) {
    const a = cur.answers.find((x) => x.id === cur.picks[id])
    if (!a) continue
    if (a.truth) {
      gains[id].truth += TRUTH_POINTS * f
      if (subject && gains[subject]) gains[subject].told += TOLD_POINTS * f
    }
    if (a.house) gains[id].house -= HOUSE_PENALTY
    if (a.by.length) stats[id] = { ...(stats[id] ?? blankStats()), fell: (stats[id]?.fell ?? 0) + 1 }
    for (const author of a.by) {
      if (author === id || !gains[author]) continue
      const full = FOOL_POINTS * f
      gains[author].fooled += a.copout.includes(author) ? full / 2 : full
      gains[author].fooledCount += 1
    }
  }
  const before = { ...s.scores }
  const scores = { ...s.scores }
  for (const id of ids(ctx)) {
    const g = gains[id]
    const after = Math.max(0, (before[id] ?? 0) + g.truth + g.fooled + g.house + g.told)
    g.net = after - (before[id] ?? 0)
    scores[id] = after
    const st = stats[id] ?? blankStats()
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
  const best = s.cur.skipped ? s.best : bestAfterRound(s)
  const round = s.round + 1
  if (round >= s.items.length) {
    return { ...s, best, stage: 'final', choose: null, endsAt: ctx.now + FINAL_MS, stageStartedAt: ctx.now, stageTotal: FINAL_MS }
  }
  return startRound({ ...s, best, round }, ctx)
}

// ---------------- the game ----------------

/** Open round `s.round`: a category pick first when that is on, otherwise straight to writing. */
function startRound(s: LieState, ctx: GameCtx): LieState {
  const round = s.round
  const item = s.items[round]
  const base: LieState = { ...s, cur: newRound(item, s.factors[round], ctx.random), before: { ...s.scores }, stageStartedAt: ctx.now }
  if (s.pool && s.catNames && !item.subject) {
    const players = ids(ctx)
    const cats = catChoices(s, ctx.random)
    if (cats.length > 1) {
      return { ...base, stage: 'category', choose: { by: players[round % players.length], cats }, endsAt: ctx.now + CATEGORY_MS, stageTotal: CATEGORY_MS }
    }
  }
  const ms = item.subject ? ABOUT_LIE_MS : LIE_MS
  return { ...base, stage: 'lie', choose: null, endsAt: ctx.now + ms, stageTotal: ms }
}

/** Fact ids already in this game (played or queued), so a category never repeats one. */
function inGame(s: LieState): Set<string> {
  return new Set(s.items.slice(0, s.round).map((i) => i.id))
}

/** Three categories that still have an unplayed fact, picked at random. */
function catChoices(s: LieState, random: () => number): string[] {
  const seen = inGame(s)
  const open = Object.keys(s.catNames ?? {}).filter((c) => (s.pool ?? []).some((id) => !seen.has(id) && id.split('|')[1] === c))
  return shuffle(open, random).slice(0, 3)
}

export function createLieGame(bank: readonly LieItem[], cfg: LieConfig) {
  const byId = new Map(bank.map((b) => [b.id, b]))

  function setup(ctx: GameCtx, opts: Record<string, string | number>): LieState {
    const length = opts.length === 'short' ? 'short' : 'normal'
    const players = ids(ctx)
    const about = cfg.about?.length ? cfg.about : null
    const factFactors: number[] = [...(about ? ABOUT_LENGTHS : LENGTHS)[length]]
    const deck = freshFirst(bank, (b) => b.id, ctx.used, ctx.random)
    const items = factFactors.map((_, i) => slim(deck[i % deck.length]))
    const factors = [...factFactors]
    const aboutFrom = items.length
    if (about) {
      // One About Us round per player (a random few when the room is big), the last one triple.
      const subjects = shuffle(players, ctx.random).slice(0, ABOUT_MAX)
      const qs = freshFirst(about, (q) => `about:${q.id}`, ctx.used, ctx.random)
      subjects.forEach((id, i) => {
        const q = qs[i % qs.length]
        const name = ctx.players.find((p) => p.id === id)?.name ?? 'They'
        items.push({ id: `about:${q.id}`, prompt: q.prompt.split('{name}').join(name), truth: '', house: [...q.house], subject: id })
        factors.push(i === subjects.length - 1 ? 3 : 2)
      })
    }
    const zero = Object.fromEntries(players.map((id) => [id, 0]))
    const s: LieState = {
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
      stats: Object.fromEntries(players.map((id) => [id, blankStats()])),
      best: null,
      aboutFrom,
    }
    if (cfg.cats) {
      // Pool entries are "id|cat" so screens and choices never need the bank.
      s.pool = deck.filter((b) => b.cat && cfg.cats?.[b.cat]).map((b) => `${b.id}|${b.cat}`)
      s.catNames = { ...cfg.cats }
    }
    return startRound(s, ctx)
  }

  /** Swap this round's fact for the freshest one in the chosen category. */
  function chooseCat(s: LieState, cat: string, ctx: GameCtx): LieState {
    const seen = inGame(s)
    const hit = (s.pool ?? []).find((e) => e.split('|')[1] === cat && !seen.has(e.split('|')[0]))
    const item = hit ? byId.get(hit.split('|')[0]) : undefined
    const items = [...s.items]
    if (item) items[s.round] = slim(item)
    const next: LieState = { ...s, items, choose: null }
    return { ...next, stage: 'lie', cur: newRound(items[s.round], s.factors[s.round], ctx.random), endsAt: ctx.now + LIE_MS, stageStartedAt: ctx.now, stageTotal: LIE_MS }
  }

  function reduce(s: LieState, a: PlayerAction, ctx: GameCtx): LieState {
    if (!ctx.players.some((p) => p.id === a.playerId)) return s
    const me = a.playerId
    const payload = (a.payload && typeof a.payload === 'object' ? a.payload : {}) as Record<string, unknown>
    const cur = s.cur
    switch (a.type) {
      case 'cat': {
        if (s.stage !== 'category' || s.choose?.by !== me) return s
        const cat = String(payload.cat ?? '')
        if (!s.choose.cats.includes(cat)) return s
        return chooseCat(s, cat, ctx)
      }
      case 'lie': {
        if (s.stage !== 'lie' || cur.lies[me]) return s
        const text = cleanText(payload.text, cfg.maxLen)
        if (!text) return s
        if (cur.item.subject === me) {
          // The subject's answer is the truth. House lies that match it are retired.
          const house = [cur.decoy, ...cur.spares].filter((h) => !sameAnswer(h, text))
          const item = { ...cur.item, truth: text }
          const lies = { ...cur.lies, [me]: { text, copout: false } }
          const items = s.items.map((it, i) => (i === s.round ? { ...it, truth: text } : it))
          const next = { ...s, items, cur: { ...cur, item, lies, decoy: house[0] ?? cur.decoy, spares: house.slice(1) } }
          return ids(ctx).every((id) => lies[id]) ? toPick(next, ctx) : next
        }
        if (cur.item.truth && isTruth(text, cur.item, cfg.kind)) {
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
        if (s.stage !== 'pick' || cur.picks[me] || cur.item.subject === me) return s
        const ans = cur.answers.find((x) => x.id === payload.answerId)
        if (!ans || ans.by.includes(me)) return s
        const picks = { ...cur.picks, [me]: ans.id }
        const next = { ...s, cur: { ...cur, picks } }
        return pickersFor(cur.item, ids(ctx)).every((id) => picks[id]) ? toReveal(next, ctx) : next
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
          const st = stats[author] ?? blankStats()
          stats[author] = { ...st, likes: st.likes + (on ? 1 : -1) }
        }
        return { ...s, scores, stats, cur: { ...cur, likes, gains } }
      }
    }
    return s
  }

  function tick(s: LieState, ctx: GameCtx): LieState {
    if (s.stage === 'done' || ctx.now < s.endsAt) return s
    if (s.stage === 'category') {
      const cats = s.choose?.cats ?? []
      return cats.length ? chooseCat(s, cats[Math.floor(ctx.random() * cats.length)], ctx) : startRound({ ...s, pool: undefined }, ctx)
    }
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
      details: { length: s.length, questions: s.items.map((i) => i.id), stats: s.stats, ...(s.aboutFrom !== undefined && s.aboutFrom < s.items.length ? { about: s.items.slice(s.aboutFrom).map((i) => ({ q: i.id, subject: i.subject, truth: i.truth })) } : {}) },
      used: s.items.map((i) => i.id),
    }
  }

  // ---------------- bots ----------------

  /** A lie for a bot: a House lie the House isn't playing and nobody wrote, else one borrowed from another question. */
  function botLie(s: LieState, random: () => number): string {
    const cur = s.cur
    const taken = [cur.decoy, cur.item.truth, ...Object.values(cur.lies).map((l) => l.text)].filter(Boolean)
    const fits = (t: string) => t.length <= cfg.maxLen && !taken.some((x) => sameAnswer(x, t)) && !(cur.item.truth && isTruth(t, cur.item, cfg.kind))
    const spare = cur.spares.filter(fits)
    if (spare.length) return spare[Math.floor(random() * spare.length)]
    // Borrow: sample other questions' House lies, keep the one shaped most like the truth
    // (capitalized like it, about as many words), so it doesn't stick out too badly.
    const wordCount = (t: string) => t.trim().split(/\s+/).length
    const upper = (t: string) => /^[A-Z0-9]/.test(t.trim())
    const shape = (t: string) => (upper(t) === upper(cur.item.truth) ? 0 : 2) + Math.abs(wordCount(t) - wordCount(cur.item.truth))
    let borrowed: string | null = null
    for (let tries = 0; tries < 30 && bank.length > 1; tries++) {
      const other = bank[Math.floor(random() * bank.length)]
      if (other.id === cur.item.id) continue
      const t = other.house[Math.floor(random() * other.house.length)]
      if (t && fits(t) && (borrowed === null || shape(t) < shape(borrowed))) borrowed = t
    }
    return borrowed ?? cur.spares[0] ?? cur.decoy
  }

  /**
   * Bots: write a spare House lie (or one borrowed from another question) 6 to 25 seconds
   * in, pick the truth about a third of the time and otherwise a random lie that isn't
   * theirs, and now and then heart the lie being revealed.
   */
  function bot(s: LieState, id: string, ctx: GameCtx): BotMove | null {
    if (!ctx.players.some((p) => p.id === id)) return null
    const cur = s.cur
    const elapsed = ctx.now - s.stageStartedAt
    const ready = (min: number, max: number, chance: number) => elapsed >= min && (elapsed >= max || ctx.random() < chance)
    if (s.stage === 'category') {
      if (s.choose?.by !== id || !ready(1500, 5000, 0.08)) return null
      const cats = s.choose.cats
      return { type: 'cat', payload: { cat: cats[Math.floor(ctx.random() * cats.length)] } }
    }
    if (s.stage === 'lie') {
      if (cur.lies[id] || !ready(6000, 25_000, 0.03)) return null
      // A bot under questioning tells "the truth": one of the House lies, which then leaves the House's hand.
      if (cur.item.subject === id) return { type: 'lie', payload: { text: cur.spares[0] ?? cur.decoy } }
      return { type: 'lie', payload: { text: botLie(s, ctx.random) } }
    }
    if (s.stage === 'pick') {
      if (cur.picks[id] || cur.item.subject === id || !ready(4000, 15_000, 0.05)) return null
      const open = cur.answers.filter((a) => !a.by.includes(id))
      const truth = open.find((a) => a.truth)
      const lies = open.filter((a) => !a.truth)
      const pick = truth && (ctx.random() < 0.35 || !lies.length) ? truth : lies[Math.floor(ctx.random() * lies.length)]
      return pick ? { type: 'pick', payload: { answerId: pick.id } } : null
    }
    if (s.stage === 'reveal') {
      const step = cur.steps[cur.step]
      if (step?.kind !== 'lie' || elapsed < BEAT_FLIP_MS) return null
      const a = cur.answers.find((x) => x.id === step.answerId)
      if (!a || a.truth || !a.by.length || a.by.includes(id) || (cur.likes[a.id] ?? []).includes(id)) return null
      return ctx.random() < 0.015 ? { type: 'like', payload: { answerId: a.id } } : null
    }
    return null
  }

  return { setup, reduce, tick, outcome, bot }
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
