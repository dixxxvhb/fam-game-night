import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { bot, botAnswer, botVote } from './bot'
import { HOUSE, outcome, reduce, roundIdx, setup, tick, type QPrompt, type QuipState } from './logic'
import { PROMPT_BY_ID, SAFETY_FALLBACK } from './prompts'

const P = (id: string, name: string, isBot = false): RoomPlayer => ({ id, name, color: '#888888', guest: isBot, connected: true, ...(isBot ? { bot: true } : {}) })
const SOLO = [P('dixxx', 'Dixxx'), P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true)]
const BOTS = ['bot-gator', 'bot-pigeon']

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}

/** Run the clock in 200 ms steps; the human does nothing, tick and the bots move the game. */
function playSolo(seed: number, human?: (s: QuipState, ctx: GameCtx) => QuipState) {
  const random = rng(seed)
  let now = 5_000_000
  const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
  let s = setup(ctx(), { pack: 'mixed' })
  const answeredAt: number[] = []
  for (let i = 0; i < 20_000 && !outcome(s, ctx()); i++) {
    now += 200
    s = tick(s, ctx())
    if (human) s = human(s, ctx())
    for (const id of BOTS) {
      const m = bot(s, id, ctx())
      if (!m) continue
      if (m.type === 'answer') answeredAt.push(now - s.stageStartedAt)
      const next = reduce(s, { playerId: id, type: m.type, payload: m.payload }, ctx())
      expect(next).not.toBe(s) // every bot move is legal
      s = next
    }
  }
  return { s, out: outcome(s, ctx()), answeredAt }
}

describe('Quip bots', () => {
  it('play a whole solo game to an outcome while the human does nothing', () => {
    const { s, out, answeredAt } = playSolo(4)
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    for (const p of s.prompts) {
      for (const id of BOTS) {
        const a = p.answers[id]
        expect(a, `${id} answered ${p.id}`).toBeDefined()
        expect(a.safety).toBe(false)
        expect(a.text).not.toBe(p.house)
        expect(a.text.length).toBeGreaterThan(0)
      }
      // The two bots never play the same line on one prompt.
      expect(p.answers['bot-gator'].text).not.toBe(p.answers['bot-pigeon'].text)
      // Votes: never their own, three in the Last Quip.
      for (const id of BOTS) {
        const v = p.votes[id] ?? []
        expect(v.length).toBe(p.round === 3 ? 3 : 1)
        expect(v).not.toContain(id)
      }
      if (p.round === 3) {
        for (const id of BOTS) {
          const open = p.order.filter((t) => t !== id && (t === HOUSE || p.answers[t])).length
          expect(new Set(p.votes[id]).size).toBe(Math.min(3, open)) // spread over everything it can vote for
        }
      }
    }
    // Human pace: 8 to 30 seconds for the first answer of a round, never faster than 8.
    expect(Math.min(...answeredAt)).toBeGreaterThanOrEqual(8000)
    expect(Math.max(...answeredAt)).toBeLessThanOrEqual(38_200)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('a human who answers and votes still finishes early when the bots are done', () => {
    const human = (s: QuipState, ctx: GameCtx): QuipState => {
      if (s.stage === 'answer') {
        const i = roundIdx(s, s.round).find((k) => !s.prompts[k].answers.dixxx)
        if (i !== undefined) return reduce(s, { playerId: 'dixxx', type: 'answer', payload: { i, text: `mine ${i}` } }, ctx)
      }
      if (s.stage === 'vote') {
        const p = s.prompts[s.current]
        if ((p.votes.dixxx?.length ?? 0) < (s.round === 3 ? 3 : 1)) return reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i: s.current, for: HOUSE } }, ctx)
      }
      return s
    }
    const { out } = playSolo(8, human)
    expect(out).not.toBeNull()
  })

  it('answers from the spare House lines, then the safety list, never the House pick', () => {
    const src = PROMPT_BY_ID.c01
    const p: QPrompt = { id: 'c01', text: src.text, about: null, round: 1, house: src.house[0], houseIdx: 0, answers: {}, order: [], votes: {}, result: null }
    const random = rng(2)
    for (let i = 0; i < 50; i++) expect(src.house.slice(1)).toContain(botAnswer(p, random))
    const taken = { ...p, answers: { a: { text: src.house[1], safety: false }, b: { text: src.house[2], safety: false } } }
    for (let i = 0; i < 50; i++) expect(SAFETY_FALLBACK).toContain(botAnswer(taken, random))
  })

  it('votes for anything but its own answer', () => {
    const p: QPrompt = {
      id: 'c01', text: 'x', about: null, round: 1, house: 'Boat', houseIdx: 2,
      answers: { 'bot-gator': { text: 'mine', safety: false }, dixxx: { text: 'a much longer answer than the others here', safety: false } },
      order: ['bot-gator', HOUSE, 'dixxx'], votes: {}, result: null,
    }
    const random = rng(6)
    const picks = Array.from({ length: 1000 }, () => botVote(p, 'bot-gator', random))
    expect(picks).not.toContain('bot-gator')
    const long = picks.filter((x) => x === 'dixxx').length
    expect(long).toBeGreaterThan(500) // longer answers get a slight lean
    expect(long).toBeLessThan(750)
  })

  it('waits when it has nothing to do', () => {
    const random = rng(1)
    const ctx = (now: number): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
    const s = setup(ctx(1000), {})
    for (let i = 0; i < 40; i++) expect(bot(s, 'bot-gator', ctx(1000 + 7000))).toBeNull()
    expect(bot({ ...s, stage: 'scores' }, 'bot-gator', ctx(1000 + 60_000))).toBeNull()
    expect(bot(s, 'nobody', ctx(1000 + 60_000))).toBeNull()
  })
})
