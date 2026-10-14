import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  FINAL_Q_MS, FINAL_REVEAL_MS, FINAL_SPIN_MS, PICK_MS, QUESTION_MS, ROUND_INTRO_MS, SPIN_MS, WAGER_MS,
  maxWager, outcome, pointsFor, reduce, setup, tick, underdog, type TriviaState,
} from './logic'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, ps = players): GameCtx => ({ now, players: ps, mode: 'together', random })

/** Run the clock forward to the next phase. */
function advance(s: TriviaState, now: number): [TriviaState, number] {
  const t = Math.max(now, s.endsAt)
  return [tick(s, ctx(t)), t]
}

function toQuestion(s: TriviaState, now: number): [TriviaState, number] {
  let t = now
  for (let i = 0; i < 6 && s.phase !== 'question'; i++) [s, t] = advance(s, t)
  return [s, t]
}

const act = (s: TriviaState, playerId: string, type: string, payload: unknown, now: number) =>
  reduce(s, { playerId, type, payload }, ctx(now))

describe('scoring', () => {
  it('pays 100 plus a linear speed bonus, times the round', () => {
    expect(pointsFor(0, QUESTION_MS, 1)).toBe(200)
    expect(pointsFor(QUESTION_MS, QUESTION_MS, 1)).toBe(100)
    expect(pointsFor(QUESTION_MS / 2, QUESTION_MS, 1)).toBe(150)
    expect(pointsFor(QUESTION_MS / 2, QUESTION_MS, 3)).toBe(450)
    expect(pointsFor(QUESTION_MS + 500, QUESTION_MS, 1)).toBe(100)
  })
  it('caps the wager at your points, or 500 if you have less', () => {
    expect(maxWager(0)).toBe(500)
    expect(maxWager(320)).toBe(500)
    expect(maxWager(2400)).toBe(2400)
  })
})

describe('underdog pick', () => {
  it('gives the pick to last place, then to whoever has picked least', () => {
    const ids = players.map((p) => p.id)
    expect(underdog({ scores: { dixxx: 300, johnnyboy: 100, torii: 500 }, pickCount: {} }, ids, random)).toBe('johnnyboy')
    expect(underdog({ scores: { dixxx: 0, johnnyboy: 0, torii: 0 }, pickCount: { dixxx: 1, johnnyboy: 1 } }, ids, random)).toBe('torii')
  })

  it('only the picker can pick, only from the three offered', () => {
    let now = 1_000
    let s = setup(ctx(now))
    expect(s.phase).toBe('roundIntro')
    now += ROUND_INTRO_MS
    s = tick(s, ctx(now))
    expect(s.phase).toBe('pick')
    expect(s.offered).toHaveLength(3)
    expect(new Set(s.offered).size).toBe(3)
    const picker = s.picker!
    const other = players.find((p) => p.id !== picker)!.id
    expect(act(s, other, 'pick', { cat: s.offered[0] }, now)).toBe(s)
    const notOffered = (['movies', 'dance', 'food', 'tv'] as const).find((c) => !s.offered.includes(c))!
    expect(act(s, picker, 'pick', { cat: notOffered }, now)).toBe(s)
    expect(act(s, picker, 'pick', { cat: 42 }, now)).toBe(s)
    expect(act(s, picker, 'pick', null, now)).toBe(s)
    const next = act(s, picker, 'pick', { cat: s.offered[1] }, now)
    expect(next.phase).toBe('spin')
    expect(next.cat).toBe(s.offered[1])
    expect(next.current?.cat).toBe(s.offered[1])
    expect(next.pickCount[picker]).toBe(1)
  })

  it('picks one of the offered for the underdog when time runs out', () => {
    let now = 50_000
    let s = setup(ctx(now))
    now += ROUND_INTRO_MS
    s = tick(s, ctx(now))
    const offered = s.offered
    expect(tick(s, ctx(now + PICK_MS - 1))).toBe(s)
    s = tick(s, ctx(now + PICK_MS))
    expect(s.phase).toBe('spin')
    expect(offered).toContain(s.cat)
  })
})

describe('questions', () => {
  it('opens after the spin, locks first answers, advances early when all are in', () => {
    let now = 10_000
    let s = setup(ctx(now))
    ;[s, now] = advance(s, now)
    ;[s, now] = advance(s, now) // auto pick
    expect(s.phase).toBe('spin')
    expect(act(s, 'dixxx', 'answer', { pick: 0 }, now)).toBe(s)
    now += SPIN_MS
    s = tick(s, ctx(now))
    expect(s.phase).toBe('question')
    expect(s.endsAt).toBe(now + QUESTION_MS)
    const right = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: right }, now + 1_500)
    expect(s.answers.dixxx.pick).toBe(right)
    // a second answer does not replace the first
    expect(act(s, 'dixxx', 'answer', { pick: (right + 1) % 4 }, now + 2_000)).toBe(s)
    s = act(s, 'johnnyboy', 'answer', { pick: (right + 1) % 4 }, now + 3_000)
    expect(s.phase).toBe('question')
    s = act(s, 'torii', 'answer', { pick: right }, now + 7_500)
    expect(s.phase).toBe('reveal')
    expect(s.last!.gained.dixxx).toBe(pointsFor(now + 1_500, now + QUESTION_MS, 1))
    expect(s.last!.gained.dixxx).toBe(190)
    expect(s.last!.gained.torii).toBe(150)
    expect(s.last!.gained.johnnyboy).toBe(0)
    expect(s.scores).toEqual({ dixxx: 190, johnnyboy: 0, torii: 150 })
    expect(s.last!.picks.johnnyboy).toBe((right + 1) % 4)
  })

  it('times out to the reveal with no answer counted as wrong', () => {
    let now = 20_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    s = act(s, 'torii', 'answer', { pick: s.current!.answer }, now)
    expect(tick(s, ctx(now + QUESTION_MS - 1))).toBe(s)
    s = tick(s, ctx(now + QUESTION_MS))
    expect(s.phase).toBe('reveal')
    expect(s.last!.picks.dixxx).toBeNull()
    expect(s.last!.gained.dixxx).toBe(0)
    expect(s.last!.gained.torii).toBe(200)
  })

  it('ignores junk answers, strangers, and late answers', () => {
    let now = 30_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    for (const bad of [null, {}, { pick: 4 }, { pick: -1 }, { pick: 1.5 }, { pick: '2' }, 'A', [1]]) {
      expect(act(s, 'dixxx', 'answer', bad, now)).toBe(s)
    }
    expect(act(s, 'stranger', 'answer', { pick: 1 }, now)).toBe(s)
    expect(act(s, 'dixxx', 'answer', { pick: 1 }, now + QUESTION_MS)).toBe(s)
    expect(act(s, 'dixxx', 'nonsense', { pick: 1 }, now)).toBe(s)
    expect(act(s, 'dixxx', 'wager', { amount: 100 }, now)).toBe(s)
  })

  it('steal round: the first right answer gets full points, later ones get half', () => {
    let now = 40_000
    let s = setup(ctx(now))
    s = { ...s, round: 2 }
    ;[s, now] = toQuestion(s, now)
    const right = s.current!.answer
    s = act(s, 'torii', 'answer', { pick: right }, now + 3_000)
    s = act(s, 'dixxx', 'answer', { pick: right }, now + 6_000)
    s = act(s, 'johnnyboy', 'answer', { pick: (right + 2) % 4 }, now + 1_000)
    expect(s.phase).toBe('reveal')
    expect(s.last!.steal).toBe(true)
    expect(s.last!.first).toBe('torii')
    expect(s.last!.gained.torii).toBe(pointsFor(now + 3_000, now + QUESTION_MS, 2)) // 360
    expect(s.last!.gained.dixxx).toBe(Math.round(pointsFor(now + 6_000, now + QUESTION_MS, 2) / 2)) // 160
    expect(s.last!.gained.torii).toBe(360)
    expect(s.last!.gained.dixxx).toBe(160)
    expect(s.last!.gained.johnnyboy).toBe(0)
  })

  it('round 1 has no steal', () => {
    let now = 45_000
    let s = setup(ctx(now))
    ;[s, now] = toQuestion(s, now)
    const right = s.current!.answer
    s = act(s, 'torii', 'answer', { pick: right }, now)
    s = act(s, 'dixxx', 'answer', { pick: right }, now)
    s = act(s, 'johnnyboy', 'answer', { pick: right }, now)
    expect(s.last!.steal).toBe(false)
    expect(s.last!.gained).toEqual({ torii: 200, dixxx: 200, johnnyboy: 200 })
  })
})

describe('the final', () => {
  function toWager(): [TriviaState, number] {
    let now = 60_000
    let s = setup(ctx(now), { rounds: 1, perRound: 1 })
    ;[s, now] = toQuestion(s, now)
    const right = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: right }, now) // 200
    s = act(s, 'johnnyboy', 'answer', { pick: (right + 1) % 4 }, now)
    s = act(s, 'torii', 'answer', { pick: right }, now + QUESTION_MS / 2) // 150
    expect(s.phase).toBe('reveal')
    expect(tick(s, ctx(s.endsAt - 1))).toBe(s)
    ;[s, now] = advance(s, now)
    expect(now).toBe(s.phaseAt)
    expect(s.phase).toBe('finalSpin')
    expect(s.current!.difficulty).toBe(3)
    expect(s.cat).toBe(s.current!.cat)
    expect(s.round).toBe(2)
    expect(tick(s, ctx(now + FINAL_SPIN_MS - 1))).toBe(s)
    now += FINAL_SPIN_MS
    s = tick(s, ctx(now))
    expect(s.phase).toBe('wager')
    expect(s.endsAt).toBe(now + WAGER_MS)
    return [s, now]
  }

  it('clamps wagers to 0..max(points, 500) and rejects junk', () => {
    const [s, now] = toWager()
    for (const bad of [null, {}, { amount: 'all' }, { amount: Number.NaN }, { amount: Infinity }]) {
      expect(act(s, 'dixxx', 'wager', bad, now)).toBe(s)
    }
    expect(act(s, 'dixxx', 'wager', { amount: 99_999 }, now).wagers.dixxx).toBe(500)
    expect(act(s, 'dixxx', 'wager', { amount: -50 }, now).wagers.dixxx).toBe(0)
    expect(act(s, 'torii', 'wager', { amount: 120.6 }, now).wagers.torii).toBe(121)
    const once = act(s, 'dixxx', 'wager', { amount: 100 }, now)
    expect(act(once, 'dixxx', 'wager', { amount: 300 }, now)).toBe(once)
  })

  it('a big score can wager it all', () => {
    const [s0, now] = toWager()
    let s = s0
    s = { ...s, scores: { ...s.scores, dixxx: 2_000 } }
    expect(act(s, 'dixxx', 'wager', { amount: 5_000 }, now).wagers.dixxx).toBe(2_000)
    s = tick(s, ctx(now + WAGER_MS))
    expect(s.phase).toBe('finalQ')
    expect(s.wagers).toEqual({ dixxx: 0, johnnyboy: 0, torii: 0 })
  })

  it('wins or loses the wager, then places by score with a streak moment', () => {
    const [s0, now] = toWager()
    let s = s0
    s = act(s, 'dixxx', 'wager', { amount: 200 }, now)
    s = act(s, 'johnnyboy', 'wager', { amount: 500 }, now)
    s = act(s, 'torii', 'wager', { amount: 150 }, now)
    expect(s.phase).toBe('finalQ')
    expect(s.endsAt).toBe(now + FINAL_Q_MS)
    const right = s.current!.answer
    s = act(s, 'dixxx', 'answer', { pick: right }, now)
    s = act(s, 'johnnyboy', 'answer', { pick: right }, now)
    s = act(s, 'torii', 'answer', { pick: (right + 1) % 4 }, now)
    expect(s.phase).toBe('finalReveal')
    expect(s.last!.gained).toEqual({ dixxx: 200, johnnyboy: 500, torii: -150 })
    expect(s.scores).toEqual({ dixxx: 400, johnnyboy: 500, torii: 0 })
    expect(outcome(s, ctx(now))).toBeNull()
    s = tick(s, ctx(now + FINAL_REVEAL_MS))
    expect(s.phase).toBe('done')
    const out = outcome(s, ctx(now))!
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([['johnnyboy', 1], ['dixxx', 2], ['torii', 3]])
    expect(out.summary).toBe('Johnnyboy won with 500')
    expect(out.highlights).toEqual([{ playerId: 'dixxx', kind: 'moment', label: 'Dixxx got 2 right in a row', content: { streak: 2 } }])
  })
})

describe('a full game', () => {
  it('plays 3 rounds of 5 and the final through reduce and tick', () => {
    let now = 1_000_000
    let s = setup(ctx(now))
    const seen = new Set<string>()
    const rounds = new Set<number>()
    let questions = 0
    for (let guard = 0; guard < 200 && s.phase !== 'done'; guard++) {
      if (s.phase === 'pick') {
        s = act(s, s.picker!, 'pick', { cat: s.offered[0] }, now)
        continue
      }
      if (s.phase === 'question' || s.phase === 'finalQ') {
        questions++
        rounds.add(s.round)
        expect(seen.has(s.current!.id)).toBe(false)
        seen.add(s.current!.id)
        const right = s.current!.answer
        // Dixxx always right, Johnnyboy always wrong, Torii right on even questions.
        s = act(s, 'dixxx', 'answer', { pick: right }, now + 2_000)
        s = act(s, 'johnnyboy', 'answer', { pick: (right + 1) % 4 }, now + 2_000)
        s = act(s, 'torii', 'answer', { pick: questions % 2 ? (right + 3) % 4 : right }, now + 4_000)
        expect(['reveal', 'finalReveal']).toContain(s.phase)
        continue
      }
      if (s.phase === 'wager') {
        for (const p of players) s = act(s, p.id, 'wager', { amount: 300 }, now)
        continue
      }
      ;[s, now] = advance(s, now)
    }
    expect(s.phase).toBe('done')
    expect(questions).toBe(16)
    expect([...rounds].sort()).toEqual([1, 2, 3, 4])
    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    expect(out.placements[0].playerId).toBe('dixxx')
    expect(out.placements[2].playerId).toBe('johnnyboy')
    expect(out.highlights?.[0]).toMatchObject({ playerId: 'dixxx', kind: 'moment', content: { streak: 16 } })
  })

  it('works with one player', () => {
    const solo = [players[0]]
    let now = 0
    let s = setup(ctx(now, solo), { rounds: 1, perRound: 2 })
    for (let guard = 0; guard < 60 && s.phase !== 'done'; guard++) {
      const t = Math.max(now, s.endsAt)
      if (s.phase === 'question' || s.phase === 'finalQ') {
        s = reduce(s, { playerId: 'dixxx', type: 'answer', payload: { pick: s.current!.answer } }, ctx(now, solo))
        continue
      }
      s = tick(s, ctx(t, solo))
      now = t
    }
    const out = outcome(s, ctx(now, solo))!
    expect(out.placements).toEqual([{ playerId: 'dixxx', place: 1, score: expect.any(Number) }])
  })
})
