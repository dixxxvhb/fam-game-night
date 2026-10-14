import type { BotMove, GameCtx } from '../../engine/types'
import { HOUSE, roundIdx, votesPer, type QPrompt, type QuipState } from './logic'
import { PROMPT_BY_ID, SAFETY_FALLBACK } from './prompts'

const key = (t: string) => t.trim().toLowerCase()

/**
 * A bot's answer: one of the prompt's spare House answers nobody has used yet, else a
 * line from the safety list. Never the answer the House itself is playing.
 */
export function botAnswer(p: QPrompt, random: () => number): string {
  const taken = new Set([p.house, ...Object.values(p.answers).map((a) => a.text)].map(key))
  const spare = (PROMPT_BY_ID[p.id]?.house ?? []).filter((t, k) => k !== p.houseIdx && !taken.has(key(t)))
  const pool = spare.length ? spare : SAFETY_FALLBACK.filter((t) => !taken.has(key(t)))
  const list = pool.length ? pool : SAFETY_FALLBACK.filter((t) => key(t) !== key(p.house))
  return list[Math.floor(random() * list.length)]
}

/** Who a bot votes for: any answer but its own, longer ones a little more often, spread out when it has several votes. */
export function botVote(p: QPrompt, me: string, random: () => number): string | null {
  const mine = p.votes[me] ?? []
  const open = p.order.filter((t) => t !== me && (t === HOUSE || p.answers[t]))
  if (!open.length) return null
  const fresh = open.filter((t) => !mine.includes(t))
  const pool = fresh.length ? fresh : open
  const weight = (t: string) => 1 + (t === HOUSE ? p.house : p.answers[t].text).length / 40
  const total = pool.reduce((a, t) => a + weight(t), 0)
  let r = random() * total
  for (const t of pool) {
    r -= weight(t)
    if (r <= 0) return t
  }
  return pool[pool.length - 1]
}

/** True once `min` ms have passed: a small chance per call, certain by `max`. */
function ready(elapsed: number, min: number, max: number, random: () => number, chance: number): boolean {
  if (elapsed < min) return false
  return elapsed >= max || random() < chance
}

/**
 * Bots answer every prompt with a spare House answer or a safety line (8 to 30 seconds in,
 * one prompt at a time), vote for anything but their own (a slight lean toward longer
 * answers), and spread their three Last Quip votes.
 */
export function bot(s: QuipState, id: string, ctx: GameCtx): BotMove | null {
  if (!s.players.includes(id)) return null
  const elapsed = ctx.now - s.stageStartedAt
  if (s.stage === 'answer') {
    const ids = roundIdx(s, s.round)
    const done = ids.filter((i) => s.prompts[i].answers[id]).length
    const todo = ids.find((i) => !s.prompts[i].answers[id])
    if (todo === undefined) return null
    if (!ready(elapsed, 8000 + done * 4000, 30_000 + done * 4000, ctx.random, 0.035)) return null
    return { type: 'answer', payload: { i: todo, text: botAnswer(s.prompts[todo], ctx.random) } }
  }
  if (s.stage === 'vote') {
    const p = s.prompts[s.current]
    if (!p) return null
    const cast = p.votes[id]?.length ?? 0
    if (cast >= votesPer(s.round)) return null
    if (!ready(elapsed, 3000 + cast * 1500, 12_000 + cast * 2000, ctx.random, 0.08)) return null
    const target = botVote(p, id, ctx.random)
    return target ? { type: 'vote', payload: { i: s.current, for: target } } : null
  }
  return null
}
