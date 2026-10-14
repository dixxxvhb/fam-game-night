import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { bot, botWager, maxWager, outcome, reduce, setup, tick, type TriviaState } from './logic'
import { botPick } from '../_quiz/botkit'
import { QUESTIONS } from '../_quiz/questions'
import { prepare } from '../_quiz/bank'

const human: RoomPlayer = { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true }
const bots: RoomPlayer[] = [
  { id: 'bot-a', name: 'Bot A', color: '#FFB547', guest: true, connected: true, bot: true },
  { id: 'bot-b', name: 'Bot B', color: '#4FD1C5', guest: true, connected: true, bot: true },
]
const players = [human, ...bots]
let seed = 99
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, used: string[] = []): GameCtx => ({ now, players, mode: 'apart', random, used })

/** Drive a game with only the clock and the bots: the human never touches the phone. */
function playOut(s: TriviaState, start: number, used: string[] = []) {
  let now = start
  const moves: { id: string; type: string; phase: string }[] = []
  for (let i = 0; i < 40_000 && !outcome(s, ctx(now, used)); i++) {
    now += 200
    s = tick(s, ctx(now, used))
    for (const b of bots) {
      const m = bot(s, b.id, ctx(now, used))
      if (!m) continue
      moves.push({ id: b.id, type: m.type, phase: s.phase })
      const next = reduce(s, { playerId: b.id, type: m.type, payload: m.payload }, ctx(now, used))
      expect(next, `${b.id} ${m.type} in ${s.phase} was refused`).not.toBe(s)
      s = next
    }
  }
  return { s, now, moves }
}

describe('Trivia Night bots', () => {
  it('an idle human and two bots finish a whole game on tick + bot alone', () => {
    const { s, now, moves } = playOut(setup(ctx(0)), 0)
    const out = outcome(s, ctx(now))
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    expect(out!.used).toHaveLength(16)
    // Every bot answered all 16 questions and wagered once; picks only happened as the underdog.
    for (const b of bots) {
      expect(moves.filter((m) => m.id === b.id && m.type === 'answer')).toHaveLength(16)
      expect(moves.filter((m) => m.id === b.id && m.type === 'wager')).toHaveLength(1)
    }
    expect(moves.every((m) => m.type !== 'pick' || m.phase === 'pick')).toBe(true)
    // The idle human scored nothing and bet nothing.
    expect(s.scores.dixxx).toBe(0)
  })

  it('bots wait 3 to 10 seconds before answering', () => {
    let s = setup(ctx(0))
    let now = 0
    while (s.phase !== 'question') { now = s.endsAt; s = tick(s, ctx(now)) }
    const start = now
    for (let t = start; t < start + 2_900; t += 200) expect(bot(s, 'bot-a', ctx(t))).toBeNull()
    let answeredAt = -1
    for (let t = start; t <= start + 10_200; t += 200) {
      if (bot(s, 'bot-a', ctx(t))) { answeredAt = t - start; break }
    }
    expect(answeredAt).toBeGreaterThanOrEqual(3_000)
    expect(answeredAt).toBeLessThanOrEqual(10_200)
  })

  it('bots are right about 70 / 55 / 40% of the time by difficulty', () => {
    for (const [d, want] of [[1, 0.7], [2, 0.55], [3, 0.4]] as const) {
      const qs = QUESTIONS.filter((q) => q.difficulty === d).slice(0, 20).map((q) => prepare(q, random))
      let right = 0
      const n = 4_000
      for (let i = 0; i < n; i++) {
        const q = qs[i % qs.length]
        if (botPick(q, random) === q.answer) right++
      }
      expect(Math.abs(right / n - want)).toBeLessThan(0.04)
    }
  })

  it('bot wagers stay in bounds, small when leading, big when chasing', () => {
    const base = setup(ctx(0))
    for (let i = 0; i < 200; i++) {
      const scores = { dixxx: Math.floor(random() * 3000), 'bot-a': Math.floor(random() * 3000), 'bot-b': Math.floor(random() * 3000) }
      const s = { ...base, scores }
      const w = botWager(s, 'bot-a', ctx(0))
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThanOrEqual(maxWager(scores['bot-a']))
    }
    const lead = { ...base, scores: { dixxx: 500, 'bot-a': 3000, 'bot-b': 400 } }
    expect(botWager(lead, 'bot-a', ctx(0))).toBeLessThanOrEqual(1200)
    const chase = { ...base, scores: { dixxx: 2000, 'bot-a': 1500, 'bot-b': 400 } }
    expect(botWager(chase, 'bot-a', ctx(0))).toBeGreaterThan(500)
  })

  it('prefers questions this group has not seen on earlier nights', () => {
    const first = playOut(setup(ctx(0)), 0)
    const used = outcome(first.s, ctx(first.now))!.used!
    const second = playOut(setup(ctx(0, used)), 0, used)
    const again = outcome(second.s, ctx(second.now, used))!.used!
    expect(again.filter((id) => used.includes(id))).toEqual([])
  })
})
