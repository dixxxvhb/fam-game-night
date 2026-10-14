import { freshFirst, shuffle } from '../../lib/shuffle'
import { CAT_KEYS, type CatKey, type Question } from './categories'
import { QUESTIONS } from './questions'

export const LETTERS = ['A', 'B', 'C', 'D'] as const

/** A question as it sits in game state: options already shuffled, answer re-pointed. */
export interface LiveQ {
  id: string
  cat: CatKey
  q: string
  options: string[]
  answer: number
  difficulty: 1 | 2 | 3
}

export interface Answer { pick: number; at: number }

export interface DrawOpts {
  used: readonly string[]
  cat?: CatKey | null
  min?: number
  max?: number
  /** Skip this category when cat is not set (no two in a row). */
  avoid?: CatKey | null
  /** Ids this group saw in earlier games (ctx.used, newest last): unseen ones come first. */
  seen?: readonly string[]
}

function inRange(q: Question, min: number, max: number) {
  return q.difficulty >= min && q.difficulty <= max
}

/** Categories that still have an unused question in the difficulty range. */
export function catsWith(used: readonly string[], min = 1, max = 3, bank: readonly Question[] = QUESTIONS): CatKey[] {
  const seen = new Set(used)
  return CAT_KEYS.filter((k) => bank.some((q) => q.cat === k && !seen.has(q.id) && inRange(q, min, max)))
}

/**
 * Draw an unused question. Falls back step by step (any difficulty in that category,
 * then any category, then repeats) so a long night never runs dry.
 */
export function drawQuestion(o: DrawOpts, random: () => number, bank: readonly Question[] = QUESTIONS): LiveQ {
  const min = o.min ?? 1
  const max = o.max ?? 3
  const seen = new Set(o.used)
  const fresh = (q: Question) => !seen.has(q.id)
  const catOk = (q: Question) => (o.cat ? q.cat === o.cat : q.cat !== o.avoid)
  const tiers: ((q: Question) => boolean)[] = [
    (q) => fresh(q) && catOk(q) && inRange(q, min, max),
    (q) => fresh(q) && catOk(q),
    (q) => fresh(q) && inRange(q, min, max),
    (q) => fresh(q),
    (q) => catOk(q),
    () => true,
  ]
  let pool: readonly Question[] = bank
  for (const t of tiers) {
    const p = bank.filter(t)
    if (p.length) { pool = p; break }
  }
  const q = freshFirst(pool, (x) => x.id, o.seen ?? [], random)[0] ?? bank[0]
  return prepare(q, random)
}

/** Shuffle the four options so the right one is not always in the same spot. */
export function prepare(q: Question, random: () => number): LiveQ {
  const order = shuffle([0, 1, 2, 3].slice(0, q.options.length), random)
  return {
    id: q.id,
    cat: q.cat,
    q: q.q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer),
    difficulty: q.difficulty,
  }
}

/** A pick from a phone: an integer 0..3, anything else is junk. */
export function readPick(payload: unknown): number | null {
  const v = (payload as { pick?: unknown } | null)?.pick
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 3) return null
  return v
}

export function allIn(ids: readonly string[], answered: Record<string, unknown>): boolean {
  return ids.length > 0 && ids.every((id) => answered[id] !== undefined)
}
