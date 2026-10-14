import type { GameCtx, GameOutcome, Highlight, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'
import { cleanStroke, cleanText, inkUsed, MAX_STROKES, sameTitle, titleKey, type Stroke } from '../_draw/strokes'
import { BLUFF_PROMPTS } from './prompts'

/**
 * DRAW BLUFF
 * Everyone draws a secret weird prompt at once. Then, one drawing at a time, everyone but the
 * artist writes a fake title, the House slips in one more, and everyone but the artist picks
 * the title they think is real. Fool people, find the truth, draw clearly.
 */

export type OptionKind = 'real' | 'house' | 'fake'

export interface BOption {
  id: string
  text: string
  /** Who wrote it: the artist for the real one, nobody for the House, one or more players for a lie. */
  by: string[]
  kind: OptionKind
}

export interface BEntry {
  artist: string
  prompt: string
  /** House titles, in the order the House will try them. */
  house: string[]
  strokes: Stroke[]
  done: boolean
  /** Fake titles by player. */
  fakes: Record<string, string>
  /** Shuffled titles shown for picking. */
  options: BOption[]
  /** Option id by player. */
  picks: Record<string, string>
  likes: string[]
  /** Option ids in reveal order: picked lies, then the House, then the truth. */
  reveal: string[]
  /** Points this drawing gave each player (likes not included). */
  deltas: Record<string, number>
}

export interface DrawBluffState {
  order: string[]
  phase: 'draw' | 'title' | 'pick' | 'reveal' | 'done'
  entries: BEntry[]
  /** Entry indices to play, in play order (blank drawings are skipped). */
  queue: number[]
  /** Position in the queue. */
  cur: number
  /** Reveal beat: index into the entry's reveal list. */
  shown: number
  endsAt: number
  stageTotal: number
  scores: Record<string, number>
  /** People fooled by each player's lies, whole game. */
  fooled: Record<string, number>
  cap: number
}

export const DRAW_MS = 80_000
export const TITLE_MS = 45_000
export const PICK_MS = 25_000
export const GRACE_MS = 1_500
export const LIE_BEAT_MS = 4_000
export const TRUTH_BEAT_MS = 6_000
export const MAX_TITLE = 60
export const INK_CAP = 2500
/** Ink per drawing: full for up to six players, a little less for seven or eight so the state stays small. */
export const inkCapFor = (players: number) => Math.max(1500, Math.min(INK_CAP, Math.floor(16_000 / Math.max(1, players))))
export const POINTS = { found: 1000, fooled: 500, artist: 500, house: 250, like: 100 }

export function entryNow(s: DrawBluffState): BEntry | null {
  if (s.phase === 'draw' || s.phase === 'done') return null
  return s.entries[s.queue[s.cur]] ?? null
}

export function myEntry(s: DrawBluffState, playerId: string): BEntry | null {
  const i = s.order.indexOf(playerId)
  return i < 0 ? null : s.entries[i] ?? null
}

export function guessersOf(s: DrawBluffState, e: BEntry): string[] {
  return s.order.filter((id) => id !== e.artist)
}

/** A fake title that is really just the real one (case, punctuation, articles, a typo, or wrapped in extra words). */
export function tooReal(text: string, prompt: string): boolean {
  if (sameTitle(text, prompt)) return true
  const t = titleKey(text)
  const p = titleKey(prompt)
  return p.length >= 6 && t.includes(p)
}

export function setup(ctx: GameCtx, _opts: Record<string, string | number>): DrawBluffState {
  void _opts
  const order = ctx.players.map((p) => p.id)
  const pool = shuffle(BLUFF_PROMPTS, ctx.random)
  const entries: BEntry[] = order.map((artist, i) => {
    const bp = pool[i % pool.length]
    return {
      artist,
      prompt: bp.prompt,
      house: shuffle(bp.house, ctx.random),
      strokes: [],
      done: false,
      fakes: {},
      options: [],
      picks: {},
      likes: [],
      reveal: [],
      deltas: {},
    }
  })
  return {
    order,
    phase: 'draw',
    entries,
    queue: [],
    cur: 0,
    shown: 0,
    endsAt: ctx.now + DRAW_MS,
    stageTotal: DRAW_MS,
    scores: Object.fromEntries(order.map((id) => [id, 0])),
    fooled: Object.fromEntries(order.map((id) => [id, 0])),
    cap: inkCapFor(order.length),
  }
}

function patchEntry(s: DrawBluffState, i: number, patch: Partial<BEntry>): DrawBluffState {
  return { ...s, entries: s.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) }
}

function startTitle(s: DrawBluffState, cur: number, now: number): DrawBluffState {
  return { ...s, phase: 'title', cur, shown: 0, endsAt: now + TITLE_MS, stageTotal: TITLE_MS }
}

function finishDraw(s: DrawBluffState, ctx: GameCtx): DrawBluffState {
  const entries = s.entries.map((e) => (e.done ? e : { ...e, done: true }))
  const drawn = entries.map((e, i) => (e.strokes.length ? i : -1)).filter((i) => i >= 0)
  const queue = shuffle(drawn, ctx.random)
  const next = { ...s, entries, queue }
  if (!queue.length) return { ...next, phase: 'done' }
  return startTitle(next, 0, ctx.now)
}

function startPick(s: DrawBluffState, ctx: GameCtx): DrawBluffState {
  const i = s.queue[s.cur]
  const e = s.entries[i]
  const opts: BOption[] = [{ id: 'real', text: e.prompt, by: [e.artist], kind: 'real' }]
  for (const id of guessersOf(s, e)) {
    const t = e.fakes[id]
    if (!t) continue
    const twin = opts.find((o) => o.kind === 'fake' && sameTitle(o.text, t))
    if (twin) twin.by = [...twin.by, id]
    else opts.push({ id: `f:${id}`, text: t, by: [id], kind: 'fake' })
  }
  const houseText = e.house.find((h) => !opts.some((o) => sameTitle(o.text, h)))
  if (houseText) opts.push({ id: 'house', text: houseText, by: [], kind: 'house' })
  const options = shuffle(opts, ctx.random)
  return { ...patchEntry(s, i, { options }), phase: 'pick', endsAt: ctx.now + PICK_MS, stageTotal: PICK_MS }
}

function beatFor(e: BEntry, shown: number) {
  return e.reveal[shown] === 'real' ? TRUTH_BEAT_MS : LIE_BEAT_MS
}

/** Score the drawing and line up the reveal. Points land now; the TV holds them back until the truth. */
function startReveal(s: DrawBluffState, now: number): DrawBluffState {
  const i = s.queue[s.cur]
  const e = s.entries[i]
  const gains: Record<string, number> = {}
  const penalty: Record<string, number> = {}
  const fooled = { ...s.fooled }
  const add = (m: Record<string, number>, id: string, n: number) => { m[id] = (m[id] ?? 0) + n }
  for (const [player, id] of Object.entries(e.picks)) {
    const o = e.options.find((x) => x.id === id)
    if (!o) continue
    if (o.kind === 'real') { add(gains, player, POINTS.found); add(gains, e.artist, POINTS.artist) }
    else if (o.kind === 'house') add(penalty, player, POINTS.house)
    else for (const a of o.by) { add(gains, a, POINTS.fooled); add(fooled, a, 1) }
  }
  const scores = { ...s.scores }
  const deltas: Record<string, number> = {}
  for (const id of s.order) {
    const old = scores[id] ?? 0
    const next = Math.max(0, old + (gains[id] ?? 0) - (penalty[id] ?? 0))
    scores[id] = next
    if (next !== old) deltas[id] = next - old
  }
  const picked = new Set(Object.values(e.picks))
  const lies = e.options.filter((o) => o.kind === 'fake' && picked.has(o.id)).map((o) => o.id)
  const reveal = [...lies, ...(picked.has('house') ? ['house'] : []), 'real']
  const entry = { ...e, reveal, deltas }
  const next: DrawBluffState = { ...patchEntry(s, i, entry), scores, fooled, phase: 'reveal', shown: 0 }
  const d = beatFor(entry, 0)
  return { ...next, endsAt: now + d, stageTotal: d }
}

function nextBeat(s: DrawBluffState, now: number): DrawBluffState {
  const e = entryNow(s)!
  if (s.shown + 1 < e.reveal.length) {
    const d = beatFor(e, s.shown + 1)
    return { ...s, shown: s.shown + 1, endsAt: now + d, stageTotal: d }
  }
  if (s.cur + 1 < s.queue.length) return startTitle(s, s.cur + 1, now)
  return { ...s, phase: 'done' }
}

export function reduce(s: DrawBluffState, a: PlayerAction, ctx: GameCtx): DrawBluffState {
  const me = s.order.indexOf(a.playerId)
  if (me < 0) return s
  const p = a.payload && typeof a.payload === 'object' ? (a.payload as Record<string, unknown>) : {}

  if (s.phase === 'draw') {
    const e = s.entries[me]
    switch (a.type) {
      case 'stroke': {
        if (e.done || e.strokes.length >= MAX_STROKES) return s
        const st = cleanStroke(p.s, s.cap - inkUsed(e.strokes))
        if (!st) return s
        return patchEntry(s, me, { strokes: [...e.strokes, st] })
      }
      case 'undo':
        if (e.done || !e.strokes.length) return s
        return patchEntry(s, me, { strokes: e.strokes.slice(0, -1) })
      case 'clear':
        if (e.done || !e.strokes.length) return s
        return patchEntry(s, me, { strokes: [] })
      case 'done': {
        if (e.done || !e.strokes.length) return s
        const next = patchEntry(s, me, { done: true })
        return next.entries.every((x) => x.done) ? finishDraw(next, ctx) : next
      }
      case 'edit':
        if (!e.done || ctx.now >= s.endsAt) return s
        return patchEntry(s, me, { done: false })
    }
    return s
  }

  const e = entryNow(s)
  if (!e) return s
  const i = s.queue[s.cur]
  const isArtist = a.playerId === e.artist

  switch (a.type) {
    case 'title': {
      if (s.phase !== 'title' || isArtist) return s
      const text = cleanText(p.text, MAX_TITLE)
      if (!text || tooReal(text, e.prompt) || e.fakes[a.playerId] === text) return s
      const next = patchEntry(s, i, { fakes: { ...e.fakes, [a.playerId]: text } })
      const ne = next.entries[i]
      return guessersOf(next, ne).every((id) => ne.fakes[id]) ? startPick(next, ctx) : next
    }
    case 'pick': {
      if (s.phase !== 'pick' || isArtist) return s
      const id = typeof p.id === 'string' ? p.id : ''
      const o = e.options.find((x) => x.id === id)
      if (!o || o.by.includes(a.playerId) || e.picks[a.playerId] === id) return s
      const next = patchEntry(s, i, { picks: { ...e.picks, [a.playerId]: id } })
      const ne = next.entries[i]
      return guessersOf(next, ne).every((g) => ne.picks[g]) ? startReveal(next, ctx.now) : next
    }
    case 'like': {
      if (s.phase !== 'reveal' || isArtist) return s
      const liked = e.likes.includes(a.playerId)
      const likes = liked ? e.likes.filter((x) => x !== a.playerId) : [...e.likes, a.playerId]
      const scores = { ...s.scores, [e.artist]: Math.max(0, (s.scores[e.artist] ?? 0) + (liked ? -POINTS.like : POINTS.like)) }
      return { ...patchEntry(s, i, { likes }), scores }
    }
  }
  return s
}

export function tick(s: DrawBluffState, ctx: GameCtx): DrawBluffState {
  if (s.phase === 'done') return s
  if (s.phase === 'reveal') return ctx.now >= s.endsAt ? nextBeat(s, ctx.now) : s
  if (ctx.now < s.endsAt + GRACE_MS) return s
  if (s.phase === 'draw') return finishDraw(s, ctx)
  if (s.phase === 'title') return startPick(s, ctx)
  if (s.phase === 'pick') return startReveal(s, ctx.now)
  return s
}

/** Scores as the TV should show them: this drawing's points stay hidden until the truth is out. */
export function shownScores(s: DrawBluffState): Record<string, number> {
  const e = entryNow(s)
  if (s.phase !== 'reveal' || !e || e.reveal[s.shown] === 'real') return s.scores
  const out = { ...s.scores }
  for (const [id, d] of Object.entries(e.deltas)) out[id] = (out[id] ?? 0) - d
  return out
}

export function mostLiked(s: DrawBluffState): BEntry | null {
  let best: BEntry | null = null
  for (const i of s.queue) {
    const e = s.entries[i]
    if (e.likes.length && (!best || e.likes.length > best.likes.length)) best = e
  }
  return best
}

export function outcome(s: DrawBluffState, ctx: GameCtx): GameOutcome | null {
  if (s.phase !== 'done') return null
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: s.scores[p.id] ?? 0 })))
  const name = (id: string) => ctx.players.find((p) => p.id === id)?.name ?? 'Someone'
  const tops = placements.filter((x) => x.place === 1)
  const topScore = tops[0]?.score ?? 0
  let summary: string
  if (!topScore) summary = 'Nobody scored. Impressive, in a way.'
  else if (tops.length > 1) summary = `${tops.map((t) => name(t.playerId)).join(' and ')} tied at ${topScore.toLocaleString('en-US')}.`
  else {
    const f = s.fooled[tops[0].playerId] ?? 0
    const times = f === 1 ? 'once' : f === 2 ? 'twice' : `${f} times`
    summary = `${name(tops[0].playerId)} won with ${topScore.toLocaleString('en-US')}${f ? ` and fooled the room ${times}` : ''}.`
  }
  const highlights: Highlight[] = []
  const best = mostLiked(s)
  if (best) highlights.push({ playerId: best.artist, kind: 'drawing', label: best.prompt, content: { strokes: best.strokes } })
  return { placements, summary, highlights, details: { drawings: s.queue.length } }
}
