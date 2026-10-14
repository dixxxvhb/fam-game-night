import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  ANSWER_MS, HOUSE, LAST_ANSWER_MS, LAST_VOTE_MS, MAX_ANSWER, SCORES_MS, VOTE_MS,
  cleanAnswer, outcome, reduce, revealMs, roundIdx, scorePrompt, setup, tick,
  type QPrompt, type QuipState,
} from './logic'
import { ABOUT, PACKS, PROMPTS, PROMPT_BY_ID, SAFETY_FALLBACK, promptsForPack } from './prompts'

const three: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
const guests = (n: number): RoomPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `g-${i}`, name: `Guest${i}`, color: '#888888', guest: true, connected: true }))

let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctxFor = (players: RoomPlayer[]) => (now: number): GameCtx => ({ now, players, mode: 'together', random })
const ctx = ctxFor(three)
const ids = three.map((p) => p.id)

function answerAll(s: QuipState, now: number, skip: string[] = [], c = ctx): QuipState {
  for (const i of roundIdx(s, s.round)) {
    for (const id of s.players) {
      if (skip.includes(id)) continue
      s = reduce(s, { playerId: id, type: 'answer', payload: { i, text: `${id} answer ${i}` } }, c(now))
    }
  }
  return s
}

/** A bare prompt for scoring tests. */
function prompt(answers: Record<string, string | [string, boolean]>, votes: Record<string, string[]>, order?: string[]): QPrompt {
  const a = Object.fromEntries(Object.entries(answers).map(([id, v]) => [id, Array.isArray(v) ? { text: v[0], safety: v[1] } : { text: v, safety: false }]))
  return { id: 'c01', text: 'A terrible name for a boat', about: null, round: 1, house: 'Boat', houseIdx: 2, answers: a, order: order ?? [...Object.keys(a), HOUSE], votes, result: null }
}
const row = (r: ReturnType<typeof scorePrompt>['result'], by: string) => r.rows.find((x) => x.by === by)!

describe('setup', () => {
  it('builds 2 + 2 + 1 prompts for three players, unique, from the pack', () => {
    const s = setup(ctx(1000), { pack: 'classic' })
    expect(s.perRound).toBe(2)
    expect(s.prompts.map((p) => p.round)).toEqual([1, 1, 2, 2, 3])
    expect(new Set(s.prompts.map((p) => p.id)).size).toBe(5)
    expect(s.prompts.every((p) => PROMPT_BY_ID[p.id].tag === 'classic')).toBe(true)
    expect(s.stage).toBe('answer')
    expect(s.endsAt).toBe(1000 + ANSWER_MS)
    expect(Object.values(s.scores)).toEqual([0, 0, 0])
  })

  it('uses 3 prompts a round for 5+ players', () => {
    const s = setup(ctxFor(guests(5))(0), {})
    expect(s.perRound).toBe(3)
    expect(s.prompts.map((p) => p.round)).toEqual([1, 1, 1, 2, 2, 2, 3])
  })

  it('falls back to Mixed on a junk pack', () => {
    expect(setup(ctx(0), { pack: 'nope' }).pack).toBe('mixed')
  })

  it('picks a House answer from that prompt', () => {
    const s = setup(ctx(0), {})
    for (const p of s.prompts) expect(PROMPT_BY_ID[p.id].house[p.houseIdx]).toBe(p.house)
  })

  it('swaps {player} for the name of a player in the game, never the House, and spreads the names', () => {
    for (let g = 0; g < 30; g++) {
      const s = setup(ctx(0), { pack: 'each' })
      const named: string[] = []
      for (const p of s.prompts) {
        expect(p.text).not.toContain(ABOUT)
        expect(p.about).not.toBeNull()
        expect(p.about).not.toBe(HOUSE)
        expect(ids).toContain(p.about)
        const name = three.find((x) => x.id === p.about)!.name
        expect(p.text).toContain(name)
        expect(p.text).not.toContain('The House')
        named.push(p.about!)
      }
      // 5 prompts over 3 players: everyone named at least once, nobody more than twice.
      for (const id of ids) {
        const n = named.filter((x) => x === id).length
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(2)
      }
    }
  })

  it('never repeats a prompt in a game', () => {
    for (let g = 0; g < 50; g++) {
      const s = setup(ctxFor(guests(8))(0), { pack: 'florida' })
      expect(new Set(s.prompts.map((p) => p.id)).size).toBe(s.prompts.length)
    }
  })
})

describe('answering', () => {
  it('moves to voting early once everyone has answered every prompt', () => {
    let s = setup(ctx(0), {})
    const [a, b] = roundIdx(s, 1)
    s = reduce(s, { playerId: 'dixxx', type: 'answer', payload: { i: a, text: '  Big   boat  ' } }, ctx(10))
    expect(s.prompts[a].answers.dixxx).toEqual({ text: 'Big boat', safety: false })
    // can't change it once sent
    expect(reduce(s, { playerId: 'dixxx', type: 'answer', payload: { i: a, text: 'Other' } }, ctx(11))).toBe(s)
    // can't answer next round's prompt yet
    const r2 = roundIdx(s, 2)[0]
    expect(reduce(s, { playerId: 'dixxx', type: 'answer', payload: { i: r2, text: 'early' } }, ctx(11))).toBe(s)
    s = answerAll(s, 20)
    expect(s.stage).toBe('vote')
    expect(s.current).toBe(a)
    expect(s.endsAt).toBe(20 + VOTE_MS)
    expect(s.prompts[a].order).toHaveLength(4)
    expect(s.prompts[a].order).toContain(HOUSE)
    expect(s.prompts[b].order).toEqual([])
  })

  it('moves to voting on the timer, with missing answers last', () => {
    let s = setup(ctx(0), {})
    const a = roundIdx(s, 1)[0]
    s = reduce(s, { playerId: 'torii', type: 'answer', payload: { i: a, text: 'Only me' } }, ctx(5))
    expect(tick(s, ctx(ANSWER_MS - 1))).toBe(s)
    s = tick(s, ctx(ANSWER_MS))
    expect(s.stage).toBe('vote')
    const order = s.prompts[a].order
    expect(order.slice(-2).sort()).toEqual(['dixxx', 'johnnyboy'])
    expect(order.slice(0, 2).sort()).toEqual([HOUSE, 'torii'].sort())
  })

  it('caps answers at 80 characters and rejects empty ones', () => {
    expect(cleanAnswer('x'.repeat(200))).toHaveLength(MAX_ANSWER)
    expect(cleanAnswer('line\nbreak\ttab')).toBe('line break tab')
    let s = setup(ctx(0), {})
    const i = roundIdx(s, 1)[0]
    expect(reduce(s, { playerId: 'dixxx', type: 'answer', payload: { i, text: '   ' } }, ctx(1))).toBe(s)
    s = reduce(s, { playerId: 'dixxx', type: 'answer', payload: { i, text: 'y'.repeat(300) } }, ctx(1))
    expect(s.prompts[i].answers.dixxx.text).toHaveLength(80)
  })
})

describe('safety quip', () => {
  it('fills in a spare House answer for that prompt, marked', () => {
    let s = setup(ctx(0), {})
    const i = roundIdx(s, 1)[0]
    s = reduce(s, { playerId: 'johnnyboy', type: 'safety', payload: { i } }, ctx(1))
    const p = s.prompts[i]
    const a = p.answers.johnnyboy
    expect(a.safety).toBe(true)
    expect(a.text).not.toBe(p.house)
    expect(PROMPT_BY_ID[p.id].house).toContain(a.text)
    // second safety from another player gets the other spare
    s = reduce(s, { playerId: 'torii', type: 'safety', payload: { i } }, ctx(1))
    expect(s.prompts[i].answers.torii.text).not.toBe(a.text)
    expect(s.prompts[i].answers.torii.text).not.toBe(p.house)
    // third falls back to the generic list
    s = reduce(s, { playerId: 'dixxx', type: 'safety', payload: { i } }, ctx(1))
    expect(SAFETY_FALLBACK).toContain(s.prompts[i].answers.dixxx.text)
  })

  it('votes for a safety quip count half', () => {
    const p = prompt({ dixxx: ['Spare', true], johnnyboy: 'Mine', torii: 'Hers' }, { johnnyboy: ['dixxx'], torii: ['dixxx'], dixxx: ['torii'] })
    const r = scorePrompt(p, ids, 1, { dixxx: 0, johnnyboy: 0, torii: 0 }, 0)
    const d = row(r.result, 'dixxx')
    expect(d.votes).toBe(2)
    expect(d.points).toBe(100) // 2 votes x 100 x half
    expect(d.safety).toBe(true)
    // 2 votes is every possible vote: a sweep, still +100
    expect(d.sweep).toBe(true)
    expect(r.scores.dixxx).toBe(100 + 50 + 100)
    expect(row(r.result, 'torii').points).toBe(100)
  })
})

describe('voting', () => {
  function toVote(): QuipState {
    return answerAll(setup(ctx(0), {}), 1)
  }

  it("can't vote for your own answer, a missing answer, a stranger, or twice", () => {
    let s = answerAll(setup(ctx(0), {}), 1, ['torii'])
    s = tick(s, ctx(ANSWER_MS))
    const i = s.current
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: 'dixxx' } }, ctx(ANSWER_MS))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: 'torii' } }, ctx(ANSWER_MS))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: 'nobody' } }, ctx(ANSWER_MS))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i: i + 1, for: HOUSE } }, ctx(ANSWER_MS))).toBe(s)
    s = reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: HOUSE } }, ctx(ANSWER_MS))
    expect(s.prompts[i].votes.dixxx).toEqual([HOUSE])
    expect(reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: 'johnnyboy' } }, ctx(ANSWER_MS))).toBe(s)
    // someone who did not answer can still vote
    s = reduce(s, { playerId: 'torii', type: 'vote', payload: { i, for: 'johnnyboy' } }, ctx(ANSWER_MS))
    expect(s.prompts[i].votes.torii).toEqual(['johnnyboy'])
  })

  it('reveals early when everyone has voted, and on the timer otherwise', () => {
    let s = toVote()
    const i = s.current
    s = reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: HOUSE } }, ctx(2))
    s = reduce(s, { playerId: 'johnnyboy', type: 'vote', payload: { i, for: 'dixxx' } }, ctx(2))
    expect(s.stage).toBe('vote')
    s = reduce(s, { playerId: 'torii', type: 'vote', payload: { i, for: 'dixxx' } }, ctx(3))
    expect(s.stage).toBe('reveal')
    expect(s.prompts[i].result).not.toBeNull()

    let t = toVote()
    t = reduce(t, { playerId: 'dixxx', type: 'vote', payload: { i: t.current, for: HOUSE } }, ctx(2))
    expect(tick(t, ctx(1 + VOTE_MS - 1))).toBe(t)
    t = tick(t, ctx(1 + VOTE_MS))
    expect(t.stage).toBe('reveal')
    expect(t.endsAt).toBe(1 + VOTE_MS + revealMs(4))
  })
})

describe('House rules', () => {
  const zero = { dixxx: 0, johnnyboy: 0, torii: 0 }

  it('pays 100 x round per vote and +50 x round for beating the House', () => {
    const p = { ...prompt({ dixxx: 'A', johnnyboy: 'B', torii: 'C' }, { dixxx: ['johnnyboy'], johnnyboy: ['dixxx'], torii: [HOUSE] }), round: 2 }
    const r = scorePrompt(p, ids, 2, zero, 0)
    expect(r.result.houseWins).toBe(false)
    // 1 vote each vs House 1: nobody beats it
    expect(row(r.result, 'dixxx').points).toBe(200)
    expect(row(r.result, 'dixxx').beatHouse).toBe(false)
    expect(r.scores).toEqual({ dixxx: 200, johnnyboy: 200, torii: 0 })
    expect(r.houseScore).toBe(200)

    const q = prompt({ dixxx: 'A', johnnyboy: 'B', torii: 'C' }, { dixxx: ['johnnyboy'], johnnyboy: ['torii'], torii: ['johnnyboy'] })
    const r2 = scorePrompt(q, ids, 1, zero, 0)
    expect(row(r2.result, 'johnnyboy').beatHouse).toBe(true)
    expect(row(r2.result, 'johnnyboy').sweep).toBe(true)
    expect(r2.scores.johnnyboy).toBe(200 + 50 + 100)
    expect(r2.scores.torii).toBe(100 + 50)
    expect(r2.scores.dixxx).toBe(0)
  })

  it('House wins: everyone who answered loses 50 x round, never below zero, no-shows untouched', () => {
    const p = prompt({ dixxx: 'A', johnnyboy: 'B' }, { dixxx: [HOUSE], johnnyboy: [HOUSE], torii: ['dixxx'] })
    const r = scorePrompt(p, ids, 2, { dixxx: 500, johnnyboy: 30, torii: 70 }, 0)
    expect(r.result.houseWins).toBe(true)
    expect(r.scores.dixxx).toBe(500 + 200 - 100)
    expect(r.scores.johnnyboy).toBe(0) // 30 - 100 floors at 0
    expect(row(r.result, 'johnnyboy').delta).toBe(-30)
    expect(r.scores.torii).toBe(70) // did not answer: no penalty
    expect(r.result.rows[0]).toMatchObject({ by: 'torii', text: null })
  })

  it('a tie with the House is not a House win', () => {
    const p = prompt({ dixxx: 'A', johnnyboy: 'B', torii: 'C' }, { dixxx: [HOUSE], johnnyboy: ['dixxx'], torii: [] })
    const r = scorePrompt(p, ids, 1, zero, 0)
    expect(r.result.houseWins).toBe(false)
    expect(row(r.result, 'dixxx').beatHouse).toBe(false)
  })

  it('needs at least two voters for a clean sweep', () => {
    const two = ['dixxx', 'johnnyboy']
    const p = prompt({ dixxx: 'A', johnnyboy: 'B' }, { johnnyboy: ['dixxx'], dixxx: [HOUSE] })
    const r = scorePrompt(p, two, 1, { dixxx: 0, johnnyboy: 0 }, 0)
    expect(row(r.result, 'dixxx').sweep).toBe(false)
    expect(r.result.sweepBy).toBeNull()
  })

  it('reveals in order: no answers, then fewest votes to most', () => {
    const p = prompt({ dixxx: 'A', johnnyboy: 'B' }, { dixxx: ['johnnyboy'], johnnyboy: [HOUSE], torii: ['johnnyboy'] })
    const r = scorePrompt(p, ids, 1, zero, 0)
    expect(r.result.rows.map((x) => x.by)).toEqual(['torii', 'dixxx', HOUSE, 'johnnyboy'])
  })
})

describe('Last Quip', () => {
  function toLast(): { s: QuipState; now: number } {
    let now = 0
    let s = setup(ctx(now), {})
    for (let round = 1; round <= 2; round++) {
      s = answerAll(s, now)
      while (s.stage === 'vote' || s.stage === 'reveal') {
        now = s.endsAt
        s = tick(s, ctx(now))
      }
      expect(s.stage).toBe('scores')
      expect(s.endsAt).toBe(now + SCORES_MS)
      now = s.endsAt
      s = tick(s, ctx(now))
    }
    expect(s.round).toBe(3)
    expect(s.endsAt).toBe(now + LAST_ANSWER_MS)
    return { s, now }
  }

  it('one prompt, three stackable votes each, 300 a vote', () => {
    let { s, now } = toLast()
    expect(roundIdx(s, 3)).toHaveLength(1)
    s = answerAll(s, now)
    expect(s.stage).toBe('vote')
    expect(s.endsAt).toBe(now + LAST_VOTE_MS)
    const i = s.current
    const before = { ...s.scores }
    const v = (id: string, target: string) => { s = reduce(s, { playerId: id, type: 'vote', payload: { i, for: target } }, ctx(now)) }
    v('dixxx', 'torii'); v('dixxx', 'torii')
    // start over
    s = reduce(s, { playerId: 'dixxx', type: 'clearVotes', payload: { i } }, ctx(now))
    expect(s.prompts[i].votes.dixxx).toBeUndefined()
    v('dixxx', 'torii'); v('dixxx', 'torii'); v('dixxx', 'johnnyboy')
    const full = s
    v('dixxx', 'torii')
    expect(s).toBe(full) // no fourth vote
    v('johnnyboy', 'torii'); v('johnnyboy', 'torii'); v('johnnyboy', 'torii')
    expect(s.stage).toBe('vote')
    v('torii', HOUSE); v('torii', 'johnnyboy'); v('torii', 'johnnyboy')
    expect(s.stage).toBe('reveal')
    const r = s.prompts[i].result!
    // torii: 5 votes x 300 + beat House (1) 150 = 1650
    expect(s.scores.torii - before.torii).toBe(1500 + 150)
    // johnnyboy: 3 votes x 300 + 150
    expect(s.scores.johnnyboy - before.johnnyboy).toBe(900 + 150)
    expect(s.scores.dixxx - before.dixxx).toBe(0)
    expect(r.houseWins).toBe(false)
    now = s.endsAt
    s = tick(s, ctx(now))
    expect(s.stage).toBe('done')
  })

  it('clean sweep in Last Quip needs all six votes', () => {
    const p = { ...prompt({ dixxx: 'A', johnnyboy: 'B', torii: 'C' }, { johnnyboy: ['dixxx', 'dixxx', 'dixxx'], torii: ['dixxx', 'dixxx', 'dixxx'], dixxx: [HOUSE, HOUSE, 'torii'] }), round: 3 }
    const r = scorePrompt(p, ids, 3, { dixxx: 0, johnnyboy: 0, torii: 0 }, 0)
    expect(row(r.result, 'dixxx').sweep).toBe(true)
    expect(r.scores.dixxx).toBe(1800 + 150 + 300)
  })

  it('clearVotes only works in Last Quip', () => {
    let s = answerAll(setup(ctx(0), {}), 1)
    s = reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i: s.current, for: HOUSE } }, ctx(2))
    expect(reduce(s, { playerId: 'dixxx', type: 'clearVotes', payload: { i: s.current } }, ctx(2))).toBe(s)
  })
})

describe('junk', () => {
  it('ignores strangers, wrong phases and bad payloads', () => {
    const s = setup(ctx(0), {})
    const i = roundIdx(s, 1)[0]
    const bad: { playerId: string; type: string; payload: unknown }[] = [
      { playerId: 'stranger', type: 'answer', payload: { i, text: 'hi' } },
      { playerId: HOUSE, type: 'answer', payload: { i, text: 'hi' } },
      { playerId: 'dixxx', type: 'answer', payload: null },
      { playerId: 'dixxx', type: 'answer', payload: 'hello' },
      { playerId: 'dixxx', type: 'answer', payload: [i, 'hi'] },
      { playerId: 'dixxx', type: 'answer', payload: { i: '0', text: 'hi' } },
      { playerId: 'dixxx', type: 'answer', payload: { i: 1.5, text: 'hi' } },
      { playerId: 'dixxx', type: 'answer', payload: { i: 99, text: 'hi' } },
      { playerId: 'dixxx', type: 'answer', payload: { i, text: 42 } },
      { playerId: 'dixxx', type: 'answer', payload: { i, text: { a: 1 } } },
      { playerId: 'dixxx', type: 'safety', payload: { i: -1 } },
      { playerId: 'dixxx', type: 'vote', payload: { i, for: HOUSE } },
      { playerId: 'dixxx', type: 'clearVotes', payload: { i } },
      { playerId: 'dixxx', type: 'explode', payload: {} },
    ]
    for (const a of bad) expect(reduce(s, a, ctx(1))).toBe(s)
    let v = answerAll(s, 1)
    v = reduce(v, { playerId: 'dixxx', type: 'answer', payload: { i, text: 'late' } }, ctx(2))
    expect(reduce(v, { playerId: 'dixxx', type: 'vote', payload: { i: v.current, for: 7 } }, ctx(2))).toBe(v)
    expect(reduce(v, { playerId: 'dixxx', type: 'vote', payload: { i: v.current } }, ctx(2))).toBe(v)
    expect(reduce(v, { playerId: 'dixxx', type: 'vote', payload: null }, ctx(2))).toBe(v)
  })

  it('tick does nothing before a deadline or after the end', () => {
    const s = setup(ctx(0), {})
    expect(tick(s, ctx(10))).toBe(s)
    const done = { ...s, stage: 'done' as const }
    expect(tick(done, ctx(10 ** 12))).toBe(done)
  })
})

describe('a full game', () => {
  it('plays all three rounds through reduce/tick to placements and highlights', () => {
    let now = 1_000_000
    let s = setup(ctx(now), { pack: 'mixed' })
    expect(outcome(s, ctx(now))).toBeNull()
    for (let round = 1; round <= 3; round++) {
      expect(s.stage).toBe('answer')
      s = answerAll(s, now)
      expect(s.stage).toBe('vote')
      while (s.stage === 'vote') {
        const i = s.current
        // Everyone votes for Torii's answer except Torii, who votes for the House.
        for (let k = 0; k < (round === 3 ? 3 : 1); k++) {
          s = reduce(s, { playerId: 'dixxx', type: 'vote', payload: { i, for: 'torii' } }, ctx(now))
          s = reduce(s, { playerId: 'johnnyboy', type: 'vote', payload: { i, for: 'torii' } }, ctx(now))
          s = reduce(s, { playerId: 'torii', type: 'vote', payload: { i, for: HOUSE } }, ctx(now))
        }
        expect(s.stage).toBe('reveal')
        now = s.endsAt
        s = tick(s, ctx(now))
      }
      if (round < 3) {
        expect(s.stage).toBe('scores')
        now = s.endsAt
        s = tick(s, ctx(now))
      }
    }
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    expect(out.placements[0]).toMatchObject({ playerId: 'torii', place: 1 })
    // Torii: R1 2 prompts x (200 + 50 + 100), R2 2 x (400 + 100 + 200), R3 6 x 300 + 150 + 300
    expect(out.placements[0].score).toBe(700 + 1400 + 2250)
    // Dixxx and Johnnyboy got nothing and tie for second
    expect(out.placements.slice(1).map((p) => p.place)).toEqual([2, 2])
    expect(out.summary).toContain('Torii won with 4350')
    expect(out.highlights).toHaveLength(3)
    for (const h of out.highlights!) {
      expect(h.kind).toBe('answer')
      expect(h.playerId).toBe('torii')
      expect(h.content).toMatchObject({ votes: expect.any(Number), text: expect.stringContaining('torii answer') })
    }
    expect((out.details as { prompts: string[] }).prompts).toHaveLength(5)
  })

  it('places ties together', () => {
    const s = { ...setup(ctx(0), {}), stage: 'done' as const, scores: { dixxx: 300, johnnyboy: 300, torii: 100 } }
    const out = outcome(s, ctx(0))!
    expect(out.placements.map((p) => p.place)).toEqual([1, 1, 3])
    expect(out.summary).toContain('tied at 300')
  })
})

describe('prompt packs', () => {
  const emoji = /\p{Extended_Pictographic}/u
  it('has at least 160 prompts, each with three House answers, unique ids', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(160)
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length)
    expect(new Set(PROMPTS.map((p) => p.text.toLowerCase())).size).toBe(PROMPTS.length)
    for (const p of PROMPTS) {
      expect(p.id).toMatch(/^[cfde]\d{2}$/)
      expect(p.house, p.id).toHaveLength(3)
      expect(new Set(p.house).size, p.id).toBe(3)
    }
  })

  it('keeps lengths short and the copy clean', () => {
    for (const p of PROMPTS) {
      expect(p.text.length, p.id).toBeGreaterThan(5)
      expect(p.text.length, p.id).toBeLessThanOrEqual(70)
      for (const t of [p.text, ...p.house]) {
        expect(t, p.id).not.toMatch(/[—–]/) // no em or en dashes
        expect(emoji.test(t), `${p.id}: ${t}`).toBe(false)
        expect(t, p.id).not.toMatch(/malik/i)
        expect(t.trim(), p.id).toBe(t)
      }
      for (const h of p.house) {
        expect(h.length, `${p.id}: ${h}`).toBeGreaterThan(0)
        expect(h.length, `${p.id}: ${h}`).toBeLessThanOrEqual(60)
        expect(h, p.id).not.toContain(ABOUT)
      }
    }
    for (const t of SAFETY_FALLBACK) expect(t.length).toBeLessThanOrEqual(MAX_ANSWER)
  })

  it('every pack has enough prompts for a game of eight', () => {
    for (const key of Object.keys(PACKS)) expect(promptsForPack(key).length, key).toBeGreaterThanOrEqual(30)
    expect(promptsForPack('each').every((p) => p.text.includes(ABOUT))).toBe(true)
    expect(promptsForPack('mixed')).toHaveLength(PROMPTS.length)
  })
})
