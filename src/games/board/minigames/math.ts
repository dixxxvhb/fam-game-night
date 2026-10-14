import { shuffle } from '../../../lib/shuffle'
import type { MgBase, Minigame } from './types'
import { botNoise, isInt, judge, obj, secs1 } from './util'

/**
 * Math Dash: the same five quick sums for everyone, four choices each. The host times each
 * answer itself; a wrong answer costs 2 seconds. Fastest total wins.
 */

export const MATH_Q = 5
export const MATH_LIMIT = 30_000
export const MATH_PEN = 2000
export const MATH_GAP = 200
export const COOP_MATH_MS = 20_000

export interface MathQ { text: string; ans: number; choices: number[] }

export interface MathState extends MgBase {
  qs: MathQ[]
  prog: Record<string, number>
  pen: Record<string, number>
  fin: Record<string, number | null>
  lastAt: Record<string, number>
  wrong: Record<string, number>
}

function between(random: () => number, lo: number, hi: number): number {
  return lo + Math.floor(random() * (hi - lo + 1))
}

/** A sum and three believable wrong answers. */
export function makeQ(kind: number, random: () => number): MathQ {
  let text: string
  let ans: number
  if (kind === 0) { const a = between(random, 12, 48); const b = between(random, 6, 39); text = `${a} + ${b}`; ans = a + b }
  else if (kind === 1) { const a = between(random, 31, 79); const b = between(random, 4, 28); text = `${a} - ${b}`; ans = a - b }
  else if (kind === 2) { const a = between(random, 3, 9); const b = between(random, 3, 9); text = `${a} x ${b}`; ans = a * b }
  else { const a = between(random, 2, 9); const b = between(random, 2, 9); const c = between(random, 2, 9); text = `${a} + ${b} + ${c}`; ans = a + b + c }
  const near = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10, ans + 9, ans - 9].filter((v) => v > 0 && v !== ans)
  const wrong = shuffle([...new Set(near)], random).slice(0, 3)
  return { text, ans, choices: shuffle([ans, ...wrong], random) }
}

export const math: Minigame<MathState> = {
  id: 'math',
  name: 'Math Dash',
  rule: 'Five quick sums. Tap the answer. Wrong ones cost 2 seconds.',
  formats: ['ffa', '1v2', 'coop', 'duel'],
  coopGoal: `Everyone done in ${COOP_MATH_MS / 1000} s`,
  soloRule: 'Beat the fastest of the rest.',
  setup(a) {
    const kinds = shuffle([0, 1, 2, 3, Math.floor(a.random() * 4)], a.random)
    const qs = kinds.map((k) => makeQ(k, a.random))
    const z = (v: number) => Object.fromEntries(a.players.map((id) => [id, v]))
    return {
      players: a.players, format: a.format, solo: a.solo, startAt: a.startAt, qs,
      prog: z(0), pen: z(0), fin: Object.fromEntries(a.players.map((id) => [id, null])), lastAt: z(0), wrong: z(0),
    }
  },
  reduce(s, id, type, payload, ctx) {
    if (type !== 'ans' || !(id in s.prog) || s.fin[id] !== null) return s
    const p = obj(payload)
    const q = s.prog[id]
    const cur = s.qs[q]
    if (p.q !== q || !cur || !isInt(p.v, -1000, 1000) || !cur.choices.includes(p.v)) return s
    if (ctx.now < s.startAt || ctx.now >= s.startAt + MATH_LIMIT || ctx.now - s.lastAt[id] < MATH_GAP) return s
    const base = { ...s, lastAt: { ...s.lastAt, [id]: ctx.now } }
    if (p.v !== cur.ans) return { ...base, pen: { ...s.pen, [id]: s.pen[id] + MATH_PEN }, wrong: { ...s.wrong, [id]: s.wrong[id] + 1 } }
    const fin = q + 1 >= MATH_Q ? { ...s.fin, [id]: ctx.now - s.startAt + s.pen[id] } : s.fin
    return { ...base, prog: { ...s.prog, [id]: q + 1 }, fin }
  },
  tick: (s) => s,
  done: (s, now) => now >= s.startAt + MATH_LIMIT || s.players.every((id) => s.fin[id] !== null),
  result(s) {
    const scores = Object.fromEntries(s.players.map((id) => [id, s.fin[id] ?? 1_000_000 - s.prog[id]]))
    const best = s.players.filter((id) => s.fin[id] !== null).sort((a, b) => s.fin[a]! - s.fin[b]!)[0]
    return judge(s, {
      scores,
      better: 'low',
      lines: Object.fromEntries(s.players.map((id) => [id, s.fin[id] !== null ? `${secs1(s.fin[id]!)}${s.wrong[id] ? ` (${s.wrong[id]} wrong)` : ''}` : `${s.prog[id]} of ${MATH_Q}`])),
      coop: () => s.players.every((id) => s.fin[id] !== null && s.fin[id]! <= COOP_MATH_MS),
      headline: () => (best ? `Calculator: ${secs1(s.fin[best]!)}` : 'Nobody finished. Math wins.'),
    })
  },
  bot(s, id, ctx) {
    if (s.fin[id] !== null || ctx.now < s.startAt) return null
    const q = s.prog[id]
    const cur = s.qs[q]
    const wait = 1300 + botNoise(id, s.startAt, q * 10 + s.wrong[id]) * 1700
    if (ctx.now < Math.max(s.startAt, s.lastAt[id]) + wait) return null
    const slip = botNoise(id, s.startAt + 2, q * 10 + s.wrong[id]) < 0.1
    return { type: 'ans', payload: { q, v: slip ? cur.choices.find((v) => v !== cur.ans)! : cur.ans } }
  },
}
