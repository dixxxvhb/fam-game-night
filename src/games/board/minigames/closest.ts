import { freshFirst } from '../../../lib/shuffle'
import type { MgBase, Minigame } from './types'
import { botNoise, clamp, isInt, judge, obj } from './util'
import { CLUES } from './clues'

/** Closest: a clue, a secret number from 1 to 100, one guess each. Closest wins. */

export const CLOSEST_MS = 20_000
export const COOP_RANGE = 10

export interface ClosestState extends MgBase {
  clue: string
  text: string
  answer: number
  guesses: Record<string, number | null>
}

export const clueUsedId = (id: string) => `cl:${id}`

export function teamAverage(s: ClosestState): number | null {
  const g = s.players.map((id) => s.guesses[id]).filter((v): v is number => v !== null)
  return g.length ? g.reduce((a, b) => a + b, 0) / g.length : null
}

export const closest: Minigame<ClosestState> = {
  id: 'closest',
  name: 'Closest',
  rule: 'A clue hides a number from 1 to 100. Guess it. Closest wins.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Team average lands within ${COOP_RANGE}`,
  soloRule: 'Beat the closest of the rest.',
  setup(a) {
    const clue = freshFirst(CLUES, (c) => clueUsedId(c.id), a.used, a.random)[0]
    return { players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, clue: clue.id, text: clue.text, answer: clue.answer, guesses: Object.fromEntries(a.players.map((id) => [id, null])) }
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'guess' || !(id in s.guesses) || s.guesses[id] !== null || ctx.now < s.startAt) return s
    const v = obj(payload).v
    if (!isInt(v, 1, 100)) return s
    return { ...s, guesses: { ...s.guesses, [id]: v } }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + CLOSEST_MS || s.players.every((id) => s.guesses[id] !== null),
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, s.guesses[id] === null ? null : Math.abs(s.guesses[id]! - s.answer)]))
    const best = s.players.filter((id) => scores[id] !== null).sort((a, b) => scores[a]! - scores[b]!)[0]
    const avg = teamAverage(s)
    return judge(s, {
      scores,
      better: 'low',
      lines: Object.fromEntries(s.players.map((id) => [id, s.guesses[id] === null ? 'No guess' : `Guessed ${s.guesses[id]}${scores[id] ? ` (${scores[id]} off)` : ' exactly'}`])),
      coop: () => avg !== null && Math.abs(avg - s.answer) <= COOP_RANGE,
      headline: () => `The answer was ${s.answer}`,
      moment: best && scores[best] === 0 ? { playerId: best, label: 'Closest', text: `Guessed ${s.answer} exactly: ${s.text}` } : null,
    })
  },
  bot(s, id, ctx) {
    if (s.guesses[id] !== null) return null
    if (ctx.now < s.startAt + 4000 + botNoise(id, s.startAt) * 9000) return null
    const off = Math.round((botNoise(id, s.startAt, 1) * 2 - 1) * 22)
    return { type: 'guess', payload: { v: clamp(s.answer + off, 1, 100) } }
  },
  used: (s) => [clueUsedId(s.clue)],
}
