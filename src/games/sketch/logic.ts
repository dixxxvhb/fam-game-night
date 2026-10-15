import type { GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { freshFirst, shuffle } from '../../lib/shuffle'
import { cleanStroke, densify, inkUsed, MAX_STROKES, simplify } from '../_draw/strokes'
import { doodle } from '../_draw/doodles'
import { PACKS } from './words'

/**
 * A finished stroke. p is a flat [x, y, x, y, ...] list in 0..1000 canvas units.
 * f = 1 makes it a paint-bucket fill at its one point (p = [x, y]) instead of a line.
 */
export interface Stroke { c: string; w: number; p: number[]; f?: 1 }

export interface Guess { playerId: string; text: string; correct: boolean; close: boolean; at: number }

/** A finished drawing, kept (thinned) for the end-of-game wall. */
export interface GalleryItem { drawer: string; word: string; tier: number; strokes: Stroke[]; solvers: string[]; ms: number | null }

export interface SketchState {
  order: string[]
  turn: number
  drawer: string
  stage: 'choose' | 'draw' | 'reveal' | 'gallery' | 'done'
  choices: string[]
  word: string
  /** 1 easy, 2 medium, 3 hard: hard words pay more (see TIER_BONUS). */
  tier: number
  endsAt: number
  stageStartedAt: number
  stageTotal: number
  drawTime: number
  strokes: Stroke[]
  guesses: Guess[]
  solved: { playerId: string; at: number; points: number }[]
  scores: Record<string, number>
  used: string[]
  pack: string
  /** This pack in the order to offer it: words this group hasn't seen first. */
  deck: string[]
  /** Every finished drawing, for the wall at the end. */
  gallery: GalleryItem[]
  /** Fastest-solved drawing so far, saved to the Hall of Fame at the end. */
  best: { drawer: string; word: string; ms: number; strokes: Stroke[] } | null
  /** Last finished turn, for the reveal screen. */
  last: { drawer: string; word: string; solvers: string[]; points: Record<string, number> } | null
}

export const CHOOSE_MS = 12_000
export const REVEAL_MS = 6_000
export const GALLERY_MS = 14_000
/** Ink for one drawing (points plus STROKE_COST per stroke; about 8 bytes a unit). */
export const INK_CAP = 3000
/** Ink a drawing keeps on the wall. */
const WALL_INK = 700
/** Points multiplier by word tier. */
export const TIER_BONUS = [1, 1, 1.25, 1.5]

/** How hard a word is to draw, roughly: two words or long ones are hard. */
export function tierOf(word: string): number {
  const letters = word.replace(/[^a-z]/gi, '').length
  if (word.trim().includes(' ') || letters >= 9) return 3
  if (letters >= 6) return 2
  return 1
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
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

export function judge(guess: string, word: string): 'correct' | 'close' | 'wrong' {
  const g = normalize(guess)
  const w = normalize(word)
  if (!g) return 'wrong'
  if (g === w || g === `${w}s` || `${g}s` === w || g === `the${w}` || `the${g}` === w) return 'correct'
  if (w.length >= 5 && levenshtein(g, w) <= 1) return 'correct'
  if (w.length >= 4 && levenshtein(g, w) <= 2) return 'close'
  return 'wrong'
}

/** Which letters of the word the hint shows: none, then one at half time, two at three quarters (long words). */
export function hintMask(word: string, frac: number): boolean[] {
  const letters = [...word]
  const idx = letters.map((ch, i) => (/[a-z0-9]/i.test(ch) ? i : -1)).filter((i) => i >= 0)
  let reveal = 0
  if (frac >= 0.5) reveal = 1
  if (frac >= 0.75 && idx.length >= 6) reveal = 2
  const shown = new Set(idx.filter((_, k) => k % Math.max(1, Math.floor(idx.length / 2)) === 0).slice(0, reveal))
  return letters.map((_, i) => shown.has(i))
}

/** Word hint like "_ _ _ _   _ _ _", revealing letters as time runs down. */
export function hintFor(word: string, frac: number): string {
  const mask = hintMask(word, frac)
  return [...word].map((ch, i) => (ch === ' ' ? '  ' : /[a-z0-9]/i.test(ch) ? (mask[i] ? ch.toUpperCase() : '_') : ch)).join(' ')
}

/** Three words: one of each tier when the deck has them (easy, medium, hard), freshest first. */
function drawChoices(state: Pick<SketchState, 'pack' | 'used' | 'deck'>, random: () => number): string[] {
  const pool = state.deck?.length ? state.deck : (PACKS[state.pack]?.words ?? PACKS.classic.words)
  const fresh = pool.filter((w) => !state.used.includes(w))
  const from = fresh.length >= 3 ? fresh : shuffle(pool, random)
  const out: string[] = []
  for (const t of [1, 2, 3]) {
    const w = from.find((x) => tierOf(x) === t && !out.includes(x))
    if (w) out.push(w)
  }
  for (const w of from) if (out.length < 3 && !out.includes(w)) out.push(w)
  return out.sort((a, b) => tierOf(a) - tierOf(b))
}

/** A drawing thinned for the wall: coarser points, capped ink. */
export function thin(strokes: Stroke[], budget = WALL_INK): Stroke[] {
  const out: Stroke[] = []
  let left = budget
  for (const st of strokes) {
    const p = st.f ? st.p.slice(0, 2) : densify(simplify(st.p, 7), 90)
    const cost = p.length / 2 + 4
    if (cost > left) break
    left -= cost
    out.push({ ...st, p })
  }
  return out
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): SketchState {
  const ids = ctx.players.map((p) => p.id)
  const rounds = Number(opts.rounds ?? 2)
  const order: string[] = []
  for (let r = 0; r < rounds; r++) order.push(...shuffle(ids, ctx.random))
  const pack = String(opts.pack ?? 'classic')
  const drawTime = Number(opts.drawTime ?? 80) * 1000
  const words = PACKS[pack]?.words ?? PACKS.classic.words
  const deck = freshFirst(words, (w) => w, ctx.used, ctx.random)
  const base = { pack, used: [] as string[], deck }
  const choices = drawChoices(base, ctx.random)
  return {
    order,
    turn: 0,
    drawer: order[0],
    stage: 'choose',
    choices,
    word: '',
    tier: 1,
    endsAt: ctx.now + CHOOSE_MS,
    stageStartedAt: ctx.now,
    stageTotal: CHOOSE_MS,
    drawTime,
    strokes: [],
    guesses: [],
    solved: [],
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    used: [],
    pack,
    deck,
    gallery: [],
    best: null,
    last: null,
  }
}

function startDraw(s: SketchState, word: string, now: number): SketchState {
  return {
    ...s,
    stage: 'draw',
    word,
    tier: tierOf(word),
    choices: [],
    used: [...s.used, word],
    strokes: [],
    guesses: [],
    solved: [],
    endsAt: now + s.drawTime,
    stageStartedAt: now,
    stageTotal: s.drawTime,
  }
}

function toReveal(s: SketchState, now: number): SketchState {
  const fastest = s.solved.length ? Math.min(...s.solved.map((x) => x.at - s.stageStartedAt)) : null
  let best = s.best
  if (fastest !== null && s.strokes.length && (!best || fastest < best.ms)) {
    best = { drawer: s.drawer, word: s.word, ms: fastest, strokes: s.strokes }
  }
  const solvers = s.solved.map((x) => x.playerId)
  const points: Record<string, number> = {}
  for (const x of s.solved) points[x.playerId] = x.points
  if (s.solved.length) points[s.drawer] = drawerBonus(s.solved.length, s.tier)
  const gallery = s.strokes.length
    ? [...s.gallery, { drawer: s.drawer, word: s.word, tier: s.tier, strokes: thin(s.strokes), solvers, ms: fastest }]
    : s.gallery
  return {
    ...s,
    stage: 'reveal',
    endsAt: now + REVEAL_MS,
    stageStartedAt: now,
    stageTotal: REVEAL_MS,
    best,
    gallery,
    last: { drawer: s.drawer, word: s.word, solvers, points },
  }
}

/** What the drawer earns in all: 40 for the first solve, 20 for each after, times the tier. */
function drawerBonus(solves: number, tier: number): number {
  return solves ? Math.round((40 + 20 * (solves - 1)) * (TIER_BONUS[tier] ?? 1)) : 0
}

function toGallery(s: SketchState, now: number): SketchState {
  if (!s.gallery.length) return { ...s, stage: 'done' }
  return { ...s, stage: 'gallery', endsAt: now + GALLERY_MS, stageStartedAt: now, stageTotal: GALLERY_MS }
}

function nextTurn(s: SketchState, ctx: GameCtx): SketchState {
  const turn = s.turn + 1
  if (turn >= s.order.length) return toGallery({ ...s, turn }, ctx.now)
  return {
    ...s,
    turn,
    drawer: s.order[turn],
    stage: 'choose',
    choices: drawChoices(s, ctx.random),
    word: '',
    tier: 1,
    strokes: [],
    guesses: [],
    solved: [],
    endsAt: ctx.now + CHOOSE_MS,
    stageStartedAt: ctx.now,
    stageTotal: CHOOSE_MS,
  }
}

export function reduce(s: SketchState, a: PlayerAction, ctx: GameCtx): SketchState {
  const isDrawer = a.playerId === s.drawer
  switch (a.type) {
    case 'choose': {
      if (!isDrawer || s.stage !== 'choose') return s
      const word = String((a.payload as { word?: string })?.word ?? '')
      if (!s.choices.includes(word)) return s
      return startDraw(s, word, ctx.now)
    }
    case 'stroke': {
      if (!isDrawer || s.stage !== 'draw' || s.strokes.length >= MAX_STROKES) return s
      const st = cleanStroke((a.payload as { s?: unknown })?.s, INK_CAP - inkUsed(s.strokes))
      if (!st) return s
      return { ...s, strokes: [...s.strokes, st] }
    }
    case 'undo': {
      if (!isDrawer || s.stage !== 'draw' || !s.strokes.length) return s
      return { ...s, strokes: s.strokes.slice(0, -1) }
    }
    case 'clear': {
      if (!isDrawer || s.stage !== 'draw' || !s.strokes.length) return s
      return { ...s, strokes: [] }
    }
    case 'next': {
      // The TV's skip button (or any player) moves the wall along.
      if (s.stage !== 'gallery') return s
      if (a.playerId !== '__host' && !ctx.players.some((p) => p.id === a.playerId)) return s
      if (ctx.now - s.stageStartedAt < 1500) return s
      return { ...s, stage: 'done' }
    }
    case 'pass': {
      if (!isDrawer || s.stage !== 'draw') return s
      return toReveal(s, ctx.now)
    }
    case 'guess': {
      if (isDrawer || s.stage !== 'draw') return s
      if (!ctx.players.some((p) => p.id === a.playerId)) return s
      if (s.solved.some((x) => x.playerId === a.playerId)) return s
      const text = String((a.payload as { text?: string })?.text ?? '').trim().slice(0, 40)
      if (!text) return s
      const verdict = judge(text, s.word)
      if (verdict === 'correct') {
        const elapsed = ctx.now - s.stageStartedAt
        const bonus = TIER_BONUS[s.tier] ?? 1
        const points = Math.round((50 + 50 * Math.max(0, 1 - elapsed / s.drawTime)) * bonus)
        const drawerGets = Math.round((s.solved.length === 0 ? 40 : 20) * bonus)
        const solved = [...s.solved, { playerId: a.playerId, at: ctx.now, points }]
        const scores = { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + points, [s.drawer]: (s.scores[s.drawer] ?? 0) + drawerGets }
        const guesses = [...s.guesses, { playerId: a.playerId, text: '', correct: true, close: false, at: ctx.now }].slice(-30)
        const next = { ...s, solved, scores, guesses }
        const guessers = ctx.players.filter((p) => p.id !== s.drawer)
        if (guessers.every((p) => solved.some((x) => x.playerId === p.id))) return toReveal(next, ctx.now)
        return next
      }
      const guesses = [...s.guesses, { playerId: a.playerId, text, correct: false, close: verdict === 'close', at: ctx.now }].slice(-30)
      return { ...s, guesses }
    }
  }
  return s
}

export function tick(s: SketchState, ctx: GameCtx): SketchState {
  if (s.stage === 'done' || ctx.now < s.endsAt) return s
  if (s.stage === 'choose') return startDraw(s, s.choices[0] ?? 'pizza', ctx.now)
  if (s.stage === 'draw') return toReveal(s, ctx.now)
  if (s.stage === 'reveal') return nextTurn(s, ctx)
  if (s.stage === 'gallery') return { ...s, stage: 'done' }
  return s
}

export function outcome(s: SketchState, ctx: GameCtx): GameOutcome | null {
  if (s.stage !== 'done') return null
  const placements = placeByScore(ctx.players.map((p) => ({ playerId: p.id, score: s.scores[p.id] ?? 0 })))
  const top = placements[0]
  const name = ctx.players.find((p) => p.id === top?.playerId)?.name ?? 'Someone'
  return {
    placements,
    summary: `${name} scored ${top?.score ?? 0}`,
    highlights: s.best
      ? [{ playerId: s.best.drawer, kind: 'drawing', label: s.best.word, content: { strokes: s.best.strokes } }]
      : [],
    details: { turns: s.order.length, pack: s.pack },
    used: s.used,
  }
}

// ---------------- bots ----------------

/**
 * Bots: they pick words, draw nonsense and give up halfway (they can't really draw),
 * and as guessers they get the word with odds that climb as the clock runs down,
 * with the occasional wrong guess for the feed.
 */
export function bot(s: SketchState, id: string, ctx: GameCtx): { type: string; payload?: unknown } | null {
  const elapsed = ctx.now - s.stageStartedAt
  const frac = s.stageTotal ? elapsed / s.stageTotal : 0
  if (s.drawer === id) {
    if (s.stage === 'choose' && elapsed > 2500 && ctx.random() < 0.3) return { type: 'choose', payload: { word: s.choices[Math.floor(ctx.random() * s.choices.length)] } }
    if (s.stage === 'draw') {
      if (frac > 0.4 && ctx.random() < 0.05) return { type: 'pass' }
      if (s.strokes.length < 8 && ctx.random() < 0.12) return { type: 'stroke', payload: { s: doodle(ctx.random) } }
    }
    return null
  }
  if (s.stage !== 'draw' || s.solved.some((x) => x.playerId === id) || elapsed < 4000) return null
  if (ctx.random() < 0.012 + frac * 0.03) return { type: 'guess', payload: { text: s.word } }
  if (ctx.random() < 0.025) {
    const pool = PACKS[s.pack]?.words ?? PACKS.classic.words
    return { type: 'guess', payload: { text: pool[Math.floor(ctx.random() * pool.length)] } }
  }
  return null
}
