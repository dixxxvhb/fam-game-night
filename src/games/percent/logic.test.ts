import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  betPoints, finalPoints, outcome, reduce, setup, setupWith, spyPoints, tick, truthSide,
  BET_MS, DEFAULT_GUESS, FINAL_MS, FINAL_REVEAL_MS, REVEAL_MS, SPY_MS,
  type PercentState,
} from './logic'
import { QUESTIONS, type Question } from './questions'

const three: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctxFor = (players: RoomPlayer[]) => (now: number): GameCtx => ({ now, players, mode: 'together', random })
const ctx = ctxFor(three)

const BANK: Question[] = Array.from({ length: 12 }, (_, i) => ({
  q: `What percent of test people like thing ${i}?`,
  answer: [62, 5, 95, 40, 0, 100, 33, 71, 18, 50, 88, 9][i],
  source: 'Test',
  year: 2024,
  url: `https://example.com/${i}`,
  tag: `thing ${i}`,
}))

const act = (s: PercentState, playerId: string, type: string, payload: unknown, now: number, c = ctx) =>
  reduce(s, { playerId, type, payload }, c(now))

describe('spy scoring', () => {
  it('is 1000 minus 40 per point, floored at 0, with 500 for exact', () => {
    expect(spyPoints(62, 62)).toBe(1500)
    expect(spyPoints(61, 62)).toBe(960)
    expect(spyPoints(65, 62)).toBe(880)
    expect(spyPoints(37, 62)).toBe(0)
    expect(spyPoints(38, 62)).toBe(40)
    expect(spyPoints(0, 100)).toBe(0)
    expect(spyPoints(100, 0)).toBe(0)
  })
  it('always lands on a multiple of 10', () => {
    for (let g = 0; g <= 100; g++) for (const a of [0, 13, 50, 87, 100]) expect(spyPoints(g, a) % 10).toBe(0)
  })
})

describe('bet scoring', () => {
  // guess 50 every time; [bet, truth, points]
  const table: [Parameters<typeof betPoints>[0], number, number][] = [
    ['higher', 51, 400], ['higher', 80, 400], ['higher', 49, 0], ['higher', 50, 0],
    ['lower', 49, 400], ['lower', 10, 400], ['lower', 51, 0], ['lower', 50, 0],
    ['muchHigher', 65, 800], ['muchHigher', 64, 200], ['muchHigher', 51, 200], ['muchHigher', 100, 800],
    ['muchHigher', 49, 0], ['muchHigher', 20, 0], ['muchHigher', 50, 0],
    ['muchLower', 35, 800], ['muchLower', 36, 200], ['muchLower', 49, 200], ['muchLower', 0, 800],
    ['muchLower', 51, 0], ['muchLower', 90, 0], ['muchLower', 50, 0],
  ]
  for (const [bet, truth, pts] of table) {
    it(`${bet} with truth ${truth} vs guess 50 pays ${pts}`, () => expect(betPoints(bet, 50, truth)).toBe(pts))
  }
  it('exactly 15 away counts as much, 14 does not', () => {
    expect(betPoints('muchHigher', 20, 35)).toBe(800)
    expect(betPoints('muchHigher', 20, 34)).toBe(200)
    expect(betPoints('muchLower', 20, 5)).toBe(800)
    expect(betPoints('muchLower', 20, 6)).toBe(200)
    expect(truthSide(20, 35)).toBe('muchHigher')
    expect(truthSide(20, 34)).toBe('higher')
    expect(truthSide(20, 20)).toBe('exact')
  })
  it('an exact Spy guess beats every bet', () => {
    for (const b of ['higher', 'lower', 'muchHigher', 'muchLower'] as const) expect(betPoints(b, 42, 42)).toBe(0)
  })
})

describe('final round scoring', () => {
  it('closest 1500, second 750, third nothing, exact +500', () => {
    expect(finalPoints({ a: 60, b: 70, c: 90 }, 62)).toEqual({ a: 1500, b: 750, c: 0 })
    expect(finalPoints({ a: 62, b: 70, c: 90 }, 62)).toEqual({ a: 2000, b: 750, c: 0 })
  })
  it('ties share the place', () => {
    expect(finalPoints({ a: 60, b: 64, c: 90 }, 62)).toEqual({ a: 1500, b: 1500, c: 0 })
    expect(finalPoints({ a: 60, b: 70, c: 54 }, 62)).toEqual({ a: 1500, b: 750, c: 750 })
    expect(finalPoints({ a: 50, b: 72, c: 75 }, 61)).toEqual({ a: 1500, b: 1500, c: 0 })
  })
  it('nobody guessed: nobody scores', () => expect(finalPoints({}, 50)).toEqual({}))
})

describe('setup and rotation', () => {
  it('everyone is the Spy `rounds` times, rotating, never twice in a row', () => {
    for (const rounds of [1, 2, 3]) {
      const s = setupWith(ctx(0), { rounds }, BANK)
      expect(s.order).toHaveLength(3 * rounds)
      for (const p of three) expect(s.order.filter((id) => id === p.id)).toHaveLength(rounds)
      for (let i = 1; i < s.order.length; i++) expect(s.order[i]).not.toBe(s.order[i - 1])
      // same seat order every lap
      for (let i = 3; i < s.order.length; i++) expect(s.order[i]).toBe(s.order[i - 3])
      expect(s.questions).toHaveLength(3 * rounds + 1)
      expect(new Set(s.questions.map((q) => q.q)).size).toBe(s.questions.length)
    }
  })
  it('defaults to twice each and handles 2 and 8 players', () => {
    expect(setupWith(ctx(0), {}, BANK).order).toHaveLength(6)
    const two = three.slice(0, 2)
    expect(setupWith(ctxFor(two)(0), {}, BANK).order).toHaveLength(4)
    const eight = Array.from({ length: 8 }, (_, i) => ({ ...three[0], id: `p${i}`, name: `P${i}` }))
    const s = setup(ctxFor(eight)(0), { rounds: 3 })
    expect(s.order).toHaveLength(24)
    expect(s.questions).toHaveLength(25)
  })
  it('starts with the first Spy on a 30 second clock', () => {
    const s = setupWith(ctx(1000), { rounds: 1 }, BANK)
    expect(s.stage).toBe('spy')
    expect(s.spy).toBe(s.order[0])
    expect(s.endsAt).toBe(1000 + SPY_MS)
  })
})

describe('a full game', () => {
  it('plays every Spy round and the final, then places by score', () => {
    let now = 1_000_000
    let s = setupWith(ctx(now), { rounds: 2 }, BANK)
    const spies: string[] = []
    for (let round = 0; round < 6; round++) {
      expect(s.stage).toBe('spy')
      expect(s.round).toBe(round)
      const spy = s.spy
      spies.push(spy)
      const truth = s.questions[round].answer
      const bettors = three.filter((p) => p.id !== spy).map((p) => p.id)
      // a bettor cannot lock for the Spy
      expect(act(s, bettors[0], 'lock', { value: 40 }, now)).toBe(s)
      const guess = truth >= 50 ? truth - 20 : truth + 20
      s = act(s, spy, 'lock', { value: guess }, now)
      expect(s.stage).toBe('bet')
      expect(s.guess).toBe(guess)
      expect(s.endsAt).toBe(now + BET_MS)
      // the Spy cannot bet
      expect(act(s, spy, 'bet', { bet: 'higher' }, now)).toBe(s)
      const right = truth > guess ? 'muchHigher' : 'muchLower'
      const wrong = truth > guess ? 'lower' : 'higher'
      s = act(s, bettors[0], 'bet', { bet: right }, now)
      expect(s.stage).toBe('bet')
      // a second bet from the same player is ignored
      expect(act(s, bettors[0], 'bet', { bet: wrong }, now)).toBe(s)
      s = act(s, bettors[1], 'bet', { bet: wrong }, now)
      // everyone bet: reveal early
      expect(s.stage).toBe('reveal')
      const last = s.history.at(-1)!
      expect(last.spyPoints).toBe(200)
      expect(last.points[bettors[0]]).toBe(800)
      expect(last.points[bettors[1]]).toBe(0)
      now += REVEAL_MS
      s = tick(s, ctx(now))
    }
    // rotation: each spied twice
    for (const p of three) expect(spies.filter((x) => x === p.id)).toHaveLength(2)
    expect(s.stage).toBe('final')
    expect(s.endsAt).toBe(now + FINAL_MS)
    const truth = s.questions[6].answer
    s = act(s, 'dixxx', 'final', { value: truth }, now)
    expect(act(s, 'dixxx', 'final', { value: 3 }, now)).toBe(s)
    s = act(s, 'johnnyboy', 'final', { value: truth >= 50 ? truth - 10 : truth + 10 }, now)
    expect(s.stage).toBe('final')
    s = act(s, 'torii', 'final', { value: truth >= 50 ? 0 : 100 }, now)
    expect(s.stage).toBe('finalReveal')
    expect(s.final?.points.dixxx).toBe(2000)
    expect(s.final?.points.johnnyboy).toBe(750)
    expect(s.final?.points.torii).toBe(0)
    expect(outcome(s, ctx(now))).toBeNull()
    now += FINAL_REVEAL_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('done')

    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    // every Spy round: Spy 200; one bettor 800, one 0. Each player bets 4 times.
    const total = Object.values(s.scores).reduce((a, b) => a + b, 0)
    expect(total).toBe(6 * (200 + 800) + 2000 + 750)
    const sorted = [...out.placements].sort((a, b) => a.place - b.place)
    expect(sorted[0].score).toBe(Math.max(...Object.values(s.scores)))
    for (const p of out.placements) expect(p.score).toBe(s.scores[p.playerId])
    expect(out.summary).toMatch(/was off by 20 on the thing \d+ one/)
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights![0].kind).toBe('moment')
    expect(out.highlights![0].content).toEqual({ text: expect.stringMatching(/^Guessed \d+, it was \d+$/) })
  })

  it('ties share a place', () => {
    let now = 0
    let s = setupWith(ctx(now), { rounds: 1 }, BANK)
    // run the clock out on everything: nobody scores but the Spies on 50
    for (let i = 0; i < 3; i++) {
      now = s.endsAt; s = tick(s, ctx(now)) // spy -> bet
      now = s.endsAt; s = tick(s, ctx(now)) // bet -> reveal
      now = s.endsAt; s = tick(s, ctx(now)) // reveal -> next
    }
    s = { ...s, scores: { dixxx: 500, johnnyboy: 500, torii: 100 } }
    now = s.endsAt; s = tick(s, ctx(now)) // final -> reveal
    now = s.endsAt; s = tick(s, ctx(now)) // -> done
    const out = outcome(s, ctx(now))!
    const place = Object.fromEntries(out.placements.map((p) => [p.playerId, p.place]))
    expect(place).toEqual({ dixxx: 1, johnnyboy: 1, torii: 3 })
  })
})

describe('timers', () => {
  it('a Spy who never locks is scored on 50, unbet players get 0', () => {
    let now = 0
    let s = setupWith(ctx(now), { rounds: 1 }, BANK)
    expect(tick(s, ctx(now + SPY_MS - 1))).toBe(s)
    now += SPY_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('bet')
    expect(s.guess).toBe(DEFAULT_GUESS)
    expect(tick(s, ctx(now + BET_MS - 1))).toBe(s)
    now += BET_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('reveal')
    const r = s.history[0]
    expect(r.locked).toBe(false)
    expect(r.spyPoints).toBe(spyPoints(DEFAULT_GUESS, r.answer))
    expect(Object.values(r.points)).toEqual([0, 0])
  })
  it('the final round times out and only scores who guessed', () => {
    let now = 0
    let s = setupWith(ctx(now), { rounds: 1 }, BANK)
    while (s.stage !== 'final') { now = s.endsAt; s = tick(s, ctx(now)) }
    const truth = s.questions[3].answer
    s = act(s, 'torii', 'final', { value: truth }, now)
    now = s.endsAt
    s = tick(s, ctx(now))
    expect(s.stage).toBe('finalReveal')
    expect(s.final?.points).toEqual({ dixxx: 0, johnnyboy: 0, torii: 2000 })
  })
  it('an exact Spy guess beats every bet in a real round', () => {
    const now = 0
    let s = setupWith(ctx(now), { rounds: 1 }, BANK)
    const truth = s.questions[0].answer
    s = act(s, s.spy, 'lock', { value: truth }, now)
    for (const p of three.filter((x) => x.id !== s.spy)) s = act(s, p.id, 'bet', { bet: 'higher' }, now)
    const r = s.history[0]
    expect(r.spyPoints).toBe(1500)
    expect(Object.values(r.points)).toEqual([0, 0])
  })
})

describe('junk input', () => {
  it('ignores wrong players, wrong stages and bad payloads', () => {
    const now = 0
    const s = setupWith(ctx(now), { rounds: 1 }, BANK)
    const spy = s.spy
    const bad = [null, undefined, 'x', 5, {}, { value: '50' }, { value: NaN }, { value: Infinity }, { value: -1 }, { value: 101 }, { value: [50] }]
    for (const p of bad) expect(act(s, spy, 'lock', p, now)).toBe(s)
    expect(act(s, 'stranger', 'lock', { value: 50 }, now)).toBe(s)
    expect(act(s, spy, 'nonsense', { value: 50 }, now)).toBe(s)
    expect(act(s, spy, 'final', { value: 50 }, now)).toBe(s)
    const other = three.find((p) => p.id !== spy)!.id
    expect(act(s, other, 'bet', { bet: 'higher' }, now)).toBe(s) // not betting yet

    const b = act(s, spy, 'lock', { value: 49.6 }, now)
    expect(b.guess).toBe(50)
    for (const p of [null, {}, { bet: 'up' }, { bet: 'HIGHER' }, { bet: 1 }]) expect(act(b, other, 'bet', p, now)).toBe(b)
    expect(act(b, spy, 'lock', { value: 10 }, now)).toBe(b) // already locked
    expect(act(b, 'stranger', 'bet', { bet: 'higher' }, now)).toBe(b)
  })
  it('accepts 0 and 100 as guesses', () => {
    const s = setupWith(ctx(0), { rounds: 1 }, BANK)
    expect(act(s, s.spy, 'lock', { value: 0 }, 0).guess).toBe(0)
    expect(act(s, s.spy, 'lock', { value: 100 }, 0).guess).toBe(100)
  })
})

describe('the question bank', () => {
  it('has at least 60 questions', () => expect(QUESTIONS.length).toBeGreaterThanOrEqual(60))
  it('every answer is an integer 0 to 100 with a real source', () => {
    for (const q of QUESTIONS) {
      expect(Number.isInteger(q.answer), q.q).toBe(true)
      expect(q.answer, q.q).toBeGreaterThanOrEqual(0)
      expect(q.answer, q.q).toBeLessThanOrEqual(100)
      expect(q.source.trim().length, q.q).toBeGreaterThan(0)
      expect(q.url, q.q).toMatch(/^https:\/\/[^\s]+\.[^\s]+/)
      expect(Number.isInteger(q.year), q.q).toBe(true)
      expect(q.year, q.q).toBeGreaterThanOrEqual(2010)
      expect(q.year, q.q).toBeLessThanOrEqual(2026)
      expect(q.tag.trim().length, q.q).toBeGreaterThan(0)
      expect(q.q, q.q).toMatch(/^What percent of .+\?$/)
      expect(q.q.length, q.q).toBeLessThanOrEqual(130)
    }
  })
  it('has no duplicate questions or tags', () => {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
    expect(new Set(QUESTIONS.map((q) => norm(q.q))).size).toBe(QUESTIONS.length)
    expect(new Set(QUESTIONS.map((q) => norm(q.tag))).size).toBe(QUESTIONS.length)
  })
  it('spreads answers across the range', () => {
    expect(QUESTIONS.filter((q) => q.answer < 20).length).toBeGreaterThanOrEqual(6)
    expect(QUESTIONS.filter((q) => q.answer > 75).length).toBeGreaterThanOrEqual(6)
  })
  it('a 8-player, 3-lap game still has enough questions', () => expect(QUESTIONS.length).toBeGreaterThanOrEqual(25))
})
