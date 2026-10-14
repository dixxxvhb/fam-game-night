import type { GameCtx, GameOutcome, PlayerAction } from '../../engine/types'
import { placeByScore } from '../../engine/points'
import { shuffle } from '../../lib/shuffle'
import { PACKS } from './words'

/** A finished stroke. p is a flat [x, y, x, y, ...] list in 0..1000 canvas units. */
export interface Stroke { c: string; w: number; p: number[] }

export interface Guess { playerId: string; text: string; correct: boolean; close: boolean; at: number }

export interface SketchState {
  order: string[]
  turn: number
  drawer: string
  stage: 'choose' | 'draw' | 'reveal' | 'done'
  choices: string[]
  word: string
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
  /** Fastest-solved drawing so far, saved to the Hall of Fame at the end. */
  best: { drawer: string; word: string; ms: number; strokes: Stroke[] } | null
  /** Last finished turn, for the reveal screen. */
  last: { drawer: string; word: string; solvers: string[] } | null
}

export const CHOOSE_MS = 12_000
export const REVEAL_MS = 5_000
const MAX_STROKES = 400
const MAX_POINTS = 1600

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

/** Word hint like "_ _ _ _   _ _ _", revealing letters as time runs down. */
export function hintFor(word: string, frac: number): string {
  const letters = [...word]
  const idx = letters.map((ch, i) => (/[a-z0-9]/i.test(ch) ? i : -1)).filter((i) => i >= 0)
  let reveal = 0
  if (frac >= 0.5) reveal = 1
  if (frac >= 0.75 && idx.length >= 6) reveal = 2
  const shown = new Set(idx.filter((_, k) => k % Math.max(1, Math.floor(idx.length / 2)) === 0).slice(0, reveal))
  return letters.map((ch, i) => (ch === ' ' ? '  ' : /[a-z0-9]/i.test(ch) ? (shown.has(i) ? ch.toUpperCase() : '_') : ch)).join(' ')
}

function drawChoices(state: Pick<SketchState, 'pack' | 'used'>, random: () => number): string[] {
  const pool = PACKS[state.pack]?.words ?? PACKS.classic.words
  const fresh = pool.filter((w) => !state.used.includes(w))
  return shuffle(fresh.length >= 3 ? fresh : pool, random).slice(0, 3)
}

export function setup(ctx: GameCtx, opts: Record<string, string | number>): SketchState {
  const ids = ctx.players.map((p) => p.id)
  const rounds = Number(opts.rounds ?? 2)
  const order: string[] = []
  for (let r = 0; r < rounds; r++) order.push(...shuffle(ids, ctx.random))
  const pack = String(opts.pack ?? 'classic')
  const drawTime = Number(opts.drawTime ?? 80) * 1000
  const base = { pack, used: [] as string[] }
  const choices = drawChoices(base, ctx.random)
  return {
    order,
    turn: 0,
    drawer: order[0],
    stage: 'choose',
    choices,
    word: '',
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
    best: null,
    last: null,
  }
}

function startDraw(s: SketchState, word: string, now: number): SketchState {
  return {
    ...s,
    stage: 'draw',
    word,
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
  return {
    ...s,
    stage: 'reveal',
    endsAt: now + REVEAL_MS,
    stageStartedAt: now,
    stageTotal: REVEAL_MS,
    best,
    last: { drawer: s.drawer, word: s.word, solvers: s.solved.map((x) => x.playerId) },
  }
}

function nextTurn(s: SketchState, ctx: GameCtx): SketchState {
  const turn = s.turn + 1
  if (turn >= s.order.length) return { ...s, stage: 'done', turn }
  return {
    ...s,
    turn,
    drawer: s.order[turn],
    stage: 'choose',
    choices: drawChoices(s, ctx.random),
    word: '',
    strokes: [],
    guesses: [],
    solved: [],
    endsAt: ctx.now + CHOOSE_MS,
    stageStartedAt: ctx.now,
    stageTotal: CHOOSE_MS,
  }
}

function validStroke(x: unknown): Stroke | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Partial<Stroke>
  if (typeof s.c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.c)) return null
  const w = Number(s.w)
  if (!Number.isFinite(w) || w < 1 || w > 80) return null
  if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2 !== 0) return null
  const p = s.p.slice(0, MAX_POINTS * 2).map((v) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0))))
  return { c: s.c, w: Math.round(w), p }
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
      const st = validStroke((a.payload as { s?: unknown })?.s)
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
        const points = Math.round(50 + 50 * Math.max(0, 1 - elapsed / s.drawTime))
        const drawerBonus = s.solved.length === 0 ? 40 : 20
        const solved = [...s.solved, { playerId: a.playerId, at: ctx.now, points }]
        const scores = { ...s.scores, [a.playerId]: (s.scores[a.playerId] ?? 0) + points, [s.drawer]: (s.scores[s.drawer] ?? 0) + drawerBonus }
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
  }
}

// ---------------- bots ----------------

/** A doodle a bot "draws": a few random wobbly strokes in 0..1000 space. */
function doodle(random: () => number): Stroke {
  const p: number[] = []
  let x = 200 + random() * 600
  let y = 200 + random() * 600
  const steps = 6 + Math.floor(random() * 10)
  for (let i = 0; i < steps; i++) {
    p.push(Math.round(x), Math.round(y))
    x = Math.max(60, Math.min(940, x + (random() - 0.5) * 260))
    y = Math.max(60, Math.min(940, y + (random() - 0.5) * 260))
  }
  return { c: '#0C1130', w: 8, p }
}

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
