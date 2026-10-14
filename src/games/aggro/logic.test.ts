import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { BASE, CENTER, HOME0, isHome, isTrack, posAtProgress, startOf } from './geometry'
import {
  AUTO_MS,
  CHOOSE_MS,
  NOMOVE_MS,
  ROLL_MS,
  bestMove,
  legalMoves,
  outcome,
  reduce,
  setup,
  tick,
  type AggroState,
} from './logic'
import { eventText, moveText } from './text'

const P = (id: string, name: string, color: string): RoomPlayer => ({ id, name, color, guest: false, connected: true })
const ALL = [
  P('dixxx', 'Dixxx', '#3CCB72'),
  P('johnnyboy', 'Johnnyboy', '#6A9BFF'),
  P('torii', 'Torii', '#B67CFF'),
  P('g-kaley', 'Kaley', '#FFB547'),
]
const three = ALL.slice(0, 3)

/** random() that makes the next die roll come up `r`. */
const dieTo = (r: number) => () => (r - 1) / 6 + 0.01
let seed = 7
const seeded = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, random: () => number = seeded, players = three): GameCtx => ({ now, players, mode: 'together', random })

/** A three-player Classic game, seat 0 (Dixxx, arm 0) to roll, marbles as given. */
function board(marbles: number[][], over: Partial<AggroState> = {}, players = three): AggroState {
  const s = setup(ctx(0, seeded, players), { speed: 'classic' })
  return { ...s, turn: 0, marbles, ...over }
}
const allBase = () => [BASE, BASE, BASE, BASE]
const at = (arm: number, q: number) => posAtProgress(arm, q)

/** Seat 0 rolls r. */
function roll(s: AggroState, r: number, now = 0): AggroState {
  return reduce(s, { playerId: s.seats[s.turn], type: 'roll', payload: { seq: s.seq } }, ctx(now, dieTo(r)))
}
function pick(s: AggroState, i: number, now = 0): AggroState {
  return reduce(s, { playerId: s.seats[s.turn], type: 'move', payload: { i, seq: s.seq } }, ctx(now))
}

describe('getting out of base', () => {
  it('needs a 1 or a 6', () => {
    const s = board([allBase(), allBase(), allBase()])
    for (const r of [2, 3, 4, 5]) expect(legalMoves(s, 0, r)).toEqual([])
    for (const r of [1, 6]) {
      const mv = legalMoves(s, 0, r)
      expect(mv).toHaveLength(1)
      expect(mv[0]).toMatchObject({ kind: 'out', to: startOf(0), m: 0 })
    }
  })
  it('is blocked by your own marble on start, and Aggros an opponent sitting there', () => {
    const blocked = board([[startOf(0), BASE, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(blocked, 0, 1).filter((m) => m.kind === 'out')).toEqual([])
    const camper = board([allBase(), [startOf(0), BASE, BASE, BASE], allBase()])
    const mv = legalMoves(camper, 0, 6)
    expect(mv[0]).toMatchObject({ kind: 'out', hit: 1, hitM: 0 })
  })
})

describe('rolling a 6', () => {
  it('gives another roll after moving', () => {
    let s = board([allBase(), allBase(), allBase()])
    s = roll(s, 6, 1000)
    expect(s.phase).toBe('choose')
    expect(s.auto).toBe(true)
    s = tick(s, ctx(1000 + AUTO_MS))
    expect(s.phase).toBe('move')
    expect(s.marbles[0][0]).toBe(startOf(0))
    s = tick(s, ctx(s.endsAt))
    expect(s.phase).toBe('roll')
    expect(s.turn).toBe(0)
    expect(s.again).toBe(true)
  })
  it('still gives another roll when the 6 has no move', () => {
    // Three tucked home, the last one on the tip: a 6 overshoots.
    let s = board([[HOME0 + 3, HOME0 + 2, HOME0 + 1, at(0, 55)], allBase(), allBase()])
    s = roll(s, 6, 0)
    expect(s.moves).toEqual([])
    s = tick(s, ctx(NOMOVE_MS))
    expect(s).toMatchObject({ phase: 'roll', turn: 0, again: true })
  })
  it('passes the turn on anything else', () => {
    let s = board([[at(0, 10), BASE, BASE, BASE], allBase(), allBase()])
    s = roll(s, 3, 0)
    s = tick(s, ctx(AUTO_MS))
    s = tick(s, ctx(s.endsAt))
    expect(s).toMatchObject({ phase: 'roll', turn: 1, again: false })
  })
})

describe('moving on the loop', () => {
  it("can't land on your own marble but can pass it", () => {
    const s = board([[at(0, 3), at(0, 6), BASE, BASE], allBase(), allBase()])
    expect(legalMoves(s, 0, 3).find((m) => m.m === 0)).toBeUndefined()
    const pass = legalMoves(s, 0, 4).find((m) => m.m === 0)!
    expect(pass.to).toBe(at(0, 7))
    expect(pass.path).toHaveLength(4)
  })
  it('sends an opponent back to base on an exact landing', () => {
    let s = board([[at(0, 10), BASE, BASE, BASE], [BASE, at(0, 13), BASE, BASE], allBase()])
    s = roll(s, 3)
    s = pick(s, s.moves.findIndex((m) => m.hit === 1))
    expect(s.marbles[1][1]).toBe(BASE)
    expect(s.marbles[0][0]).toBe(at(0, 13))
    expect(s.hits[0]).toBe(1)
    expect(eventText(s.log.at(-1)!, (k) => three[k].name)).toBe("Dixxx rolled a 3 and Aggro'd Johnnyboy.")
  })
  it('passing an opponent does nothing', () => {
    let s = board([[at(0, 10), BASE, BASE, BASE], [at(0, 12), BASE, BASE, BASE], allBase()])
    s = roll(s, 4)
    s = tick(s, ctx(AUTO_MS))
    expect(s.marbles[1][0]).toBe(at(0, 12))
  })
})

describe('stars', () => {
  // Arm 0 stars by progress: 14 is 6 along, 28 is 20, 42 is 34, 0 is 48 (the one before home).
  it('hop star to star, then walk what is left', () => {
    const s = board([[14, BASE, BASE, BASE], allBase(), allBase()])
    const mv = legalMoves(s, 0, 4)
    const byTo = Object.fromEntries(mv.map((m) => [m.to, m]))
    expect(byTo[18]).toMatchObject({ kind: 'walk', hops: 0 })
    expect(byTo[31]).toMatchObject({ kind: 'stars', hops: 1, steps: 3, path: [28, 29, 30, 31] })
    expect(byTo[44]).toMatchObject({ kind: 'stars', hops: 2, steps: 2, path: [28, 42, 43, 44] })
    expect(byTo[1]).toMatchObject({ kind: 'stars', hops: 3, steps: 1, path: [28, 42, 0, 1] })
    expect(mv).toHaveLength(4)
  })
  it('stop at the star before your own home', () => {
    const own = board([[0, BASE, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(own, 0, 5).filter((m) => m.kind === 'stars')).toEqual([])
    const last = board([[42, BASE, BASE, BASE], allBase(), allBase()])
    const hops = legalMoves(last, 0, 5).filter((m) => m.kind === 'stars')
    expect(hops).toHaveLength(1)
    expect(hops[0]).toMatchObject({ hops: 1, to: 4 })
  })
  it('only work when the move starts on a star', () => {
    const s = board([[at(0, 4), BASE, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(s, 0, 5).map((m) => m.kind)).toEqual(['walk'])
  })
  it('Aggro whoever sits on the star you end on', () => {
    const s = board([[at(0, 2), BASE, BASE, BASE], allBase(), [28, BASE, BASE, BASE]])
    expect(legalMoves(s, 0, 4)[0]).toMatchObject({ to: 14, hit: -1 })
    const hop = board([[14, BASE, BASE, BASE], allBase(), [28, BASE, BASE, BASE]])
    const mv = legalMoves(hop, 0, 1).find((m) => m.kind === 'stars')!
    expect(mv).toMatchObject({ to: 28, hit: 2, hitM: 0 })
  })
  it('let a 1 hop or step, never more', () => {
    const s = board([[14, BASE, BASE, BASE], allBase(), allBase()])
    const kinds = legalMoves(s, 0, 1).filter((m) => m.m === 0).map((m) => m.kind).sort()
    expect(kinds).toEqual(['center-in', 'stars', 'walk'])
  })
})

describe('the center', () => {
  it('is entered with an exact 1 from a star', () => {
    const s = board([[28, at(0, 3), BASE, BASE], allBase(), allBase()])
    expect(legalMoves(s, 0, 1).some((m) => m.kind === 'center-in' && m.m === 0)).toBe(true)
    expect(legalMoves(s, 0, 1).some((m) => m.kind === 'center-in' && m.m === 1)).toBe(false)
    for (const r of [2, 3, 4, 5, 6]) expect(legalMoves(s, 0, r).some((m) => m.to === CENTER)).toBe(false)
  })
  it('sends home whoever is sitting in it', () => {
    let s = board([[28, BASE, BASE, BASE], [CENTER, BASE, BASE, BASE], allBase()])
    s = roll(s, 1)
    s = pick(s, s.moves.findIndex((m) => m.kind === 'center-in'))
    expect(s.marbles[0][0]).toBe(CENTER)
    expect(s.marbles[1][0]).toBe(BASE)
  })
  it('is left only with a 1, onto any star', () => {
    const s = board([[CENTER, 42, BASE, BASE], allBase(), [BASE, BASE, 14, BASE]])
    for (const r of [2, 3, 4, 5, 6]) expect(legalMoves(s, 0, r).filter((m) => m.m === 0)).toEqual([])
    const out = legalMoves(s, 0, 1).filter((m) => m.m === 0)
    // Star 42 holds our own marble; 14 holds Torii's.
    expect(out.map((m) => m.to).sort((a, b) => a - b)).toEqual([0, 14, 28])
    expect(out.find((m) => m.to === 14)?.hit).toBe(2)
    expect(moveText(out.find((m) => m.to === 0)!, s, (k) => three[k].name).detail).toBe('Out of the center to your home star')
  })
})

describe('home', () => {
  it('needs an exact count', () => {
    const s = board([[at(0, 53), BASE, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(s, 0, 6)[0]).toMatchObject({ to: HOME0 + 3 })
    expect(legalMoves(s, 0, 3)[0]).toMatchObject({ to: HOME0 })
    const tip = board([[at(0, 55), BASE, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(tip, 0, 5)).toEqual([])
    expect(legalMoves(tip, 0, 4)[0].to).toBe(HOME0 + 3)
  })
  it('turns in at your own arm, not anyone else', () => {
    // Arm 1's tip is loop hole 21; Dixxx (arm 0) walks right past it.
    const s = board([[at(0, 12), BASE, BASE, BASE], allBase(), allBase()])
    expect(at(0, 12)).toBe(20)
    expect(legalMoves(s, 0, 3)[0].to).toBe(23)
  })
  it("won't pass or land on your own marbles in home", () => {
    const s = board([[at(0, 54), HOME0 + 1, BASE, BASE], allBase(), allBase()])
    const m0 = legalMoves(s, 0, 4).filter((m) => m.m === 0)
    expect(m0).toEqual([])
    expect(legalMoves(s, 0, 2).filter((m) => m.m === 0)[0].to).toBe(HOME0)
    expect(legalMoves(s, 0, 3).filter((m) => m.m === 0)).toEqual([])
    // Inside home: slot 1 can step to 2 or 3, not past a marble.
    const inside = board([[HOME0 + 1, HOME0 + 3, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(inside, 0, 1).filter((m) => m.m === 0)[0].to).toBe(HOME0 + 2)
    expect(legalMoves(inside, 0, 2).filter((m) => m.m === 0)).toEqual([])
  })
})

describe('turn flow and timers', () => {
  it('passes the turn when there is no legal move', () => {
    let s = board([allBase(), allBase(), allBase()])
    s = roll(s, 4, 500)
    expect(s).toMatchObject({ phase: 'choose', auto: true, moves: [] })
    expect(eventText(s.log.at(-1)!, (k) => three[k].name)).toBe('Dixxx rolled a 4. No moves.')
    expect(tick(s, ctx(500 + NOMOVE_MS - 1))).toBe(s)
    s = tick(s, ctx(500 + NOMOVE_MS))
    expect(s).toMatchObject({ phase: 'roll', turn: 1 })
  })
  it('auto-rolls after 20 seconds', () => {
    let s = board([allBase(), allBase(), allBase()], { endsAt: ROLL_MS })
    expect(tick(s, ctx(ROLL_MS - 1))).toBe(s)
    s = tick(s, ctx(ROLL_MS, dieTo(5)))
    expect(s).toMatchObject({ phase: 'choose', roll: 5, rolls: 1 })
  })
  it('plays a single legal move by itself after a beat', () => {
    let s = board([[at(0, 10), BASE, BASE, BASE], allBase(), allBase()])
    s = roll(s, 2, 100)
    expect(s.auto).toBe(true)
    expect(tick(s, ctx(100 + AUTO_MS - 1))).toBe(s)
    s = tick(s, ctx(100 + AUTO_MS))
    expect(s.phase).toBe('move')
    expect(s.marbles[0][0]).toBe(at(0, 12))
  })
  it('auto-picks the move that goes farthest when the clock runs out', () => {
    let s = board([[14, at(0, 2), BASE, BASE], allBase(), allBase()])
    s = roll(s, 4, 0)
    expect(s.auto).toBe(false)
    expect(s.moves.length).toBeGreaterThan(1)
    expect(s.moves[bestMove(s.moves)]).toMatchObject({ m: 0, hops: 3 })
    s = tick(s, ctx(CHOOSE_MS))
    expect(s.marbles[0][0]).toBe(1)
  })
  it('rejects the wrong player, the wrong phase, stale or junk payloads', () => {
    const s = board([[at(0, 10), at(0, 21), BASE, BASE], allBase(), allBase()])
    const c = ctx(0, dieTo(3))
    expect(reduce(s, { playerId: 'johnnyboy', type: 'roll', payload: { seq: s.seq } }, c)).toBe(s)
    expect(reduce(s, { playerId: 'nobody', type: 'roll', payload: { seq: s.seq } }, c)).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'roll', payload: { seq: s.seq - 1 } }, c)).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'roll', payload: null }, c)).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'roll', payload: 'go' }, c)).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'move', payload: { i: 0, seq: s.seq } }, c)).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'dance', payload: { seq: s.seq } }, c)).toBe(s)
    const ch = roll(s, 3)
    expect(ch.moves).toHaveLength(2)
    for (const i of [-1, 2, 0.5, '0', null]) {
      expect(reduce(ch, { playerId: 'dixxx', type: 'move', payload: { i, seq: ch.seq } }, c)).toBe(ch)
    }
    expect(reduce(ch, { playerId: 'dixxx', type: 'roll', payload: { seq: ch.seq } }, c)).toBe(ch)
    expect(reduce(ch, { playerId: 'torii', type: 'move', payload: { i: 0, seq: ch.seq } }, c)).toBe(ch)
  })
})

describe('Quick mode', () => {
  it('starts everyone with one marble on start, and a 6 can launch 6 from base', () => {
    const s = setup(ctx(0), { speed: 'quick' })
    expect(s.speed).toBe('quick')
    s.arms.forEach((arm, seat) => {
      expect(s.marbles[seat]).toEqual([startOf(arm), BASE, BASE, BASE])
    })
    const mine = { ...s, turn: 0 }
    const six = legalMoves(mine, 0, 6).filter((m) => m.kind === 'out')
    expect(six.map((m) => m.to).sort((a, b) => a - b)).toEqual([at(0, 6)])
    // The start hole is taken by our own marble, so only the launch is open. Clear it:
    const clear = { ...mine, marbles: [[at(0, 20), BASE, BASE, BASE], ...s.marbles.slice(1)] }
    const both = legalMoves(clear, 0, 6).filter((m) => m.kind === 'out')
    expect(both.map((m) => m.to).sort((a, b) => a - b)).toEqual([startOf(0), at(0, 6)])
    expect(both.find((m) => m.steps === 6)?.path).toHaveLength(7)
    expect(legalMoves(clear, 0, 1).filter((m) => m.kind === 'out').map((m) => m.to)).toEqual([startOf(0)])
  })
  it('Classic has no launch', () => {
    const s = board([[at(0, 20), BASE, BASE, BASE], allBase(), allBase()])
    expect(legalMoves(s, 0, 6).filter((m) => m.kind === 'out').map((m) => m.to)).toEqual([startOf(0)])
  })
})

describe('winning and places', () => {
  function finish(marbles: number[][], players: RoomPlayer[]) {
    let s = board(marbles, {}, players)
    s = roll(s, 1)
    const win = s.moves.findIndex((m) => isHome(m.to))
    s = pick(s, win)
    expect(s.winner).toBe(0)
    expect(outcome(s, ctx(0, seeded, players))).toBeNull()
    s = tick(s, ctx(s.endsAt, seeded, players))
    expect(s.phase).toBe('done')
    return outcome(s, ctx(0, seeded, players))!
  }
  const almost = () => [HOME0 + 3, HOME0 + 2, HOME0 + 1, at(0, 55)]

  it('2 players', () => {
    const players = ALL.slice(0, 2)
    const out = finish([almost(), [HOME0 + 3, at(2, 30), BASE, BASE]], players)
    expect(out.placements).toEqual([
      { playerId: 'dixxx', place: 1, score: 4 },
      { playerId: 'johnnyboy', place: 2, score: 1 },
    ])
    expect(out.summary).toBe('Dixxx got all four marbles home first')
  })
  it('3 players: marbles home first, then distance', () => {
    const out = finish([almost(), [at(1, 40), at(1, 10), BASE, BASE], [HOME0 + 3, BASE, BASE, BASE]], three)
    expect(out.placements.map((p) => [p.playerId, p.place, p.score])).toEqual([
      ['dixxx', 1, 4],
      ['torii', 2, 1],
      ['johnnyboy', 3, 0],
    ])
  })
  it('4 players, with a tie sharing a place', () => {
    const out = finish(
      [almost(), [at(1, 12), BASE, BASE, BASE], [at(2, 12), BASE, BASE, BASE], [at(3, 30), BASE, BASE, BASE]],
      ALL,
    )
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([
      ['dixxx', 1],
      ['g-kaley', 2],
      ['johnnyboy', 3],
      ['torii', 3],
    ])
  })
})

describe('Hall of Fame moments', () => {
  it('saves Aggros of marbles near home, best three', () => {
    // Johnnyboy (arm 1) sits 4 away from home on loop hole 18; Dixxx lands on it.
    let s = board([[at(0, 7), BASE, BASE, BASE], [at(1, 52), BASE, BASE, BASE], allBase()])
    expect(at(1, 52)).toBe(at(0, 10))
    s = roll(s, 3)
    s = pick(s, 0)
    expect(s.moments).toEqual([{ by: 0, victim: 1, away: 4, seq: s.seq }])
    // Far from home: an Aggro, but no moment.
    const far = pick(roll(board([[at(0, 42), BASE, BASE, BASE], [at(1, 30), BASE, BASE, BASE], allBase()]), 2), 0)
    expect(far.hits[0]).toBe(1)
    expect(far.moments).toEqual([])
    s = { ...s, phase: 'done', winner: 0, moments: [...s.moments, { by: 2, victim: 0, away: 9, seq: 50 }, { by: 2, victim: 1, away: 1, seq: 60 }] }
    const out = outcome(s, ctx(0))!
    expect(out.highlights?.map((h) => h.label)).toEqual([
      'Torii sent Johnnyboy home from 1 away',
      'Dixxx sent Johnnyboy home from 4 away',
      'Torii sent Dixxx home from 9 away',
    ])
    expect(out.highlights?.every((h) => h.kind === 'moment')).toBe(true)
  })
})

describe('copy', () => {
  it('describes moves in plain words', () => {
    const name = (k: number) => three[k].name
    const s = board([[at(0, 2), 14, BASE, BASE], [at(0, 7), BASE, BASE, BASE], allBase()])
    const mv = legalMoves(s, 0, 5)
    const t = (pred: (m: (typeof mv)[number]) => boolean) => moveText(mv.find(pred)!, s, name)
    expect(t((m) => m.m === 0)).toEqual({ title: 'Marble 1', detail: '5 spaces, sends Johnnyboy home' })
    expect(t((m) => m.m === 1 && m.hops === 2)).toEqual({ title: 'Marble 2', detail: '2 star hops, then 3 spaces' })
    const s2 = board([[at(0, 1), BASE, BASE, BASE], allBase(), allBase()])
    expect(moveText(legalMoves(s2, 0, 5)[0], s2, name).detail).toBe('5 spaces, lands on a star')
    expect(moveText(legalMoves(s2, 0, 6).find((m) => m.kind === 'out')!, s2, name).detail).toBe('Out to start')
  })
})

describe('whole games on autopilot', () => {
  let captures = 0
  for (const n of [2, 3, 4]) {
    for (const speed of ['classic', 'quick']) {
      it(`${n} players, ${speed}: ends with everyone placed and the board legal`, () => {
        const players = ALL.slice(0, n)
        let now = 1_000
        const c = () => ctx(now, seeded, players)
        let s = setup(c(), { speed })
        let steps = 0
        while (s.phase !== 'done' && steps < 40_000) {
          now = Math.max(now, s.endsAt)
          const before = s.hits.reduce((a, b) => a + b, 0)
          s = tick(s, c())
          captures += s.hits.reduce((a, b) => a + b, 0) - before
          steps++
          // Nobody shares a loop hole or the center; home holes are per seat.
          const shared = s.marbles.flat().filter((p) => isTrack(p) || p === CENTER)
          expect(new Set(shared).size).toBe(shared.length)
          s.marbles.forEach((row) => {
            const home = row.filter(isHome)
            expect(new Set(home).size).toBe(home.length)
          })
        }
        expect(s.phase).toBe('done')
        const out = outcome(s, c())!
        expect(out.placements).toHaveLength(n)
        expect(out.placements.filter((p) => p.place === 1)).toHaveLength(1)
        expect(out.placements[0].score).toBe(4)
        expect(new Set(out.placements.map((p) => p.playerId)).size).toBe(n)
        expect((out.highlights ?? []).length).toBeLessThanOrEqual(3)
      })
    }
  }
  it('had some Aggros along the way', () => expect(captures).toBeGreaterThan(5))
})
