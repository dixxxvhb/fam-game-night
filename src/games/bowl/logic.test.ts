import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { AIM_MS, bot, frameOrder, outcome, PICK_DONE_MS, PICK_MS, PODIUM_MS, readThrow, reduce, setup as realSetup, tick, totals, type BowlState } from './logic'
import { ALL_PINS, scoreCard } from './score'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 1
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctxFor = (now: number, ps: RoomPlayer[] = players): GameCtx => ({ now, players: ps, mode: 'together', random })

/**
 * Setup, then the pick stage played out (everyone gets a critter at the bell), rebased so the
 * first ball's clock starts at ctx.now like it did before there was a pick stage.
 */
function setup(ctx: GameCtx, opts: Record<string, string | number>): BowlState {
  const s = realSetup(ctx, opts)
  const t = tick(s, { ...ctx, now: s.endsAt })
  return { ...t, stageStartedAt: ctx.now, endsAt: ctx.now + AIM_MS }
}

/** Past the podium to the end. */
function toDone(s: BowlState, now: { t: number }, ps: RoomPlayer[] = players): BowlState {
  expect(s.stage).toBe('podium')
  return settle(s, now, ps)
}

/** Run the clock forward through tick until the stage changes (or a cap). */
function settle(s: BowlState, now: { t: number }, ps: RoomPlayer[] = players): BowlState {
  const from = s.stage
  for (let i = 0; i < 400 && s.stage === from; i++) {
    now.t += 250
    s = tick(s, ctxFor(now.t, ps))
  }
  return s
}

/** Force a ball's result: throw for real, then swap in the pins we want down before it's scored. */
function bowlExact(s: BowlState, knock: number[], now: { t: number }): BowlState {
  s = reduce(s, { playerId: s.bowler, type: 'throw', payload: { x: 0, aim: 0, speed: 0.5, curve: 0 } }, ctxFor(now.t))
  expect(s.stage).toBe('roll')
  const before = s.roll!.before
  const knocked = before.filter((p) => knock.includes(p))
  s = { ...s, roll: { ...s.roll!, knocked, left: before.filter((p) => !knocked.includes(p)), gutter: knocked.length === 0, split: false } }
  s = settle(s, now) // roll -> result
  expect(s.stage).toBe('result')
  return settle(s, now) // result -> aim / done
}

describe('setup and turns', () => {
  it('starts on frame 1 with everyone at zero and a full rack', () => {
    const s = setup(ctxFor(0), { frames: 5 })
    expect(s.frames).toBe(5)
    expect(s.order).toHaveLength(3)
    expect(s.bowler).toBe(s.order[0])
    expect(s.standing).toEqual(ALL_PINS)
    expect(s.stage).toBe('aim')
    expect(setup(ctxFor(0), { frames: 10 }).frames).toBe(10)
    expect(setup(ctxFor(0), { frames: 7 }).frames).toBe(5)
  })

  it('rotates who leads off every frame', () => {
    const s = setup(ctxFor(0), {})
    const [a, b, c] = s.order
    expect(frameOrder(s, 0)).toEqual([a, b, c])
    expect(frameOrder(s, 1)).toEqual([b, c, a])
    expect(frameOrder(s, 2)).toEqual([c, a, b])
    expect(frameOrder(s, 3)).toEqual([a, b, c])
  })

  it('a strike ends the frame, an open frame takes two balls, and the next bowler is up', () => {
    const now = { t: 1000 }
    let s = setup(ctxFor(now.t), { frames: 5 })
    const [a, b, c] = s.order
    s = bowlExact(s, ALL_PINS, now)
    expect(s.rolls[a]).toEqual([10])
    expect(s.bowler).toBe(b)
    s = bowlExact(s, [1, 2, 3], now)
    expect(s.bowler).toBe(b)
    expect(s.standing).toEqual([4, 5, 6, 7, 8, 9, 10])
    s = bowlExact(s, [4, 5], now)
    expect(s.rolls[b]).toEqual([3, 2])
    expect(s.bowler).toBe(c)
    s = bowlExact(s, [], now)
    s = bowlExact(s, ALL_PINS, now)
    expect(s.rolls[c]).toEqual([0, 10])
    expect(s.frame).toBe(1)
    expect(s.bowler).toBe(b)
  })

  it('the last frame gets a third ball on a strike or spare, with fresh racks', () => {
    const now = { t: 1000 }
    const solo = [players[0]]
    let s = setup(ctxFor(now.t, solo), { frames: 5 })
    for (let i = 0; i < 8; i++) s = bowlExactP(s, [], now, solo)
    expect(s.frame).toBe(4)
    s = bowlExactP(s, ALL_PINS, now, solo)
    expect(s.standing).toEqual(ALL_PINS)
    s = bowlExactP(s, [1, 2, 3], now, solo)
    expect(s.standing).toEqual([4, 5, 6, 7, 8, 9, 10])
    s = bowlExactP(s, [4, 5, 6, 7, 8, 9, 10], now, solo)
    s = toDone(s, now, solo)
    expect(s.stage).toBe('done')
    expect(s.rolls.dixxx.slice(-3)).toEqual([10, 3, 7])
    expect(totals(s).dixxx).toBe(20)
    expect(outcome(s, ctxFor(now.t, solo))?.placements).toEqual([{ playerId: 'dixxx', place: 1, score: 20 }])
  })

  it('an open last frame ends after two balls', () => {
    const now = { t: 1000 }
    const solo = [players[1]]
    let s = setup(ctxFor(now.t, solo), { frames: 5 })
    for (let i = 0; i < 9; i++) s = bowlExactP(s, [], now, solo)
    expect(s.frame).toBe(4)
    s = bowlExactP(s, [1, 2, 3, 4], now, solo)
    s = toDone(s, now, solo)
    expect(s.stage).toBe('done')
    expect(s.rolls.johnnyboy).toHaveLength(10)
  })
})

function bowlExactP(s: BowlState, knock: number[], now: { t: number }, ps: RoomPlayer[]): BowlState {
  s = reduce(s, { playerId: s.bowler, type: 'throw', payload: { x: 0, aim: 0, speed: 0.5, curve: 0 } }, ctxFor(now.t, ps))
  const before = s.roll!.before
  const knocked = before.filter((p) => knock.includes(p))
  s = { ...s, roll: { ...s.roll!, knocked, left: before.filter((p) => !knocked.includes(p)), split: false } }
  s = settle(s, now, ps)
  return settle(s, now, ps)
}

describe('throws', () => {
  it('clamps everything on the host', () => {
    expect(readThrow({ x: 3, aim: -9, speed: 5, curve: 2 })).toEqual({ x: 1, aim: -1, speed: 1, curve: 1 })
    expect(readThrow({ x: 0.1234567, aim: 0, speed: 0.5, curve: -0.25 })).toEqual({ x: 0.123, aim: 0, speed: 0.5, curve: -0.25 })
  })

  it('rejects junk, the wrong player and the wrong moment', () => {
    const s = setup(ctxFor(0), {})
    const other = s.order[1]
    const junk: unknown[] = [null, undefined, 'fast', 7, [], { x: 0 }, { x: NaN, aim: 0, speed: 0.5, curve: 0 }, { x: '0', aim: 0, speed: 0.5, curve: 0 }, { x: 0, aim: 0, speed: Infinity, curve: 0 }]
    for (const p of junk) expect(reduce(s, { playerId: s.bowler, type: 'throw', payload: p }, ctxFor(1))).toBe(s)
    const ok = { x: 0, aim: 0, speed: 0.5, curve: 0 }
    expect(reduce(s, { playerId: other, type: 'throw', payload: ok }, ctxFor(1))).toBe(s)
    expect(reduce(s, { playerId: 'nobody', type: 'throw', payload: ok }, ctxFor(1))).toBe(s)
    expect(reduce(s, { playerId: s.bowler, type: 'aim', payload: ok }, ctxFor(1))).toBe(s)
    const rolling = reduce(s, { playerId: s.bowler, type: 'throw', payload: ok }, ctxFor(1))
    expect(rolling.stage).toBe('roll')
    expect(reduce(rolling, { playerId: s.bowler, type: 'throw', payload: ok }, ctxFor(2))).toBe(rolling)
  })

  it('the clock rolls a lazy one for a bowler who stalls', () => {
    let s = setup(ctxFor(0), {})
    expect(tick(s, ctxFor(AIM_MS - 1))).toBe(s)
    s = tick(s, ctxFor(AIM_MS))
    expect(s.stage).toBe('roll')
    expect(s.roll?.auto).toBe(true)
    expect(s.roll?.th.speed).toBe(0.3)
  })

  it('tick returns the same object while nothing is due', () => {
    const s = setup(ctxFor(0), {})
    expect(tick(s, ctxFor(5))).toBe(s)
  })
})

describe('a full game', () => {
  it('three players swipe through five frames to a scored outcome', () => {
    const now = { t: 10_000 }
    let s = setup(ctxFor(now.t), { frames: 5 })
    let throws = 0
    for (let i = 0; i < 200 && s.stage !== 'podium'; i++) {
      expect(s.stage).toBe('aim')
      const th = { x: 0.5 + (i % 3) * 0.05, aim: 0.12, speed: 0.4 + (i % 5) * 0.1, curve: -0.5 + (i % 4) * 0.1 }
      s = reduce(s, { playerId: s.bowler, type: 'throw', payload: th }, ctxFor(now.t))
      throws += 1
      s = settle(s, now)
      s = settle(s, now)
    }
    expect(outcome(s, ctxFor(now.t))).toBeNull()
    s = toDone(s, now)
    expect(s.stage).toBe('done')
    expect(throws).toBeGreaterThanOrEqual(15)
    expect(throws).toBeLessThanOrEqual(33)
    const out = outcome(s, ctxFor(now.t))!
    expect(out.placements).toHaveLength(3)
    for (const p of out.placements) expect(p.score).toBe(scoreCard(s.rolls[p.playerId], 5).total)
    const sorted = [...out.placements].sort((a, b) => a.place - b.place)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].score!).toBeLessThanOrEqual(sorted[i - 1].score!)
    expect(out.summary).toMatch(/bowled|tied/)
    expect(JSON.stringify(out).length).toBeLessThan(40_000)
  })

  it('ties share a place', () => {
    const now = { t: 1000 }
    const two = players.slice(0, 2)
    let s = setup(ctxFor(now.t, two), { frames: 5 })
    for (let i = 0; i < 20 && s.stage !== 'podium'; i++) s = bowlExactP(s, [], now, two)
    s = toDone(s, now, two)
    expect(s.stage).toBe('done')
    const out = outcome(s, ctxFor(now.t, two))!
    expect(out.placements.map((p) => p.place)).toEqual([1, 1])
    expect(out.summary).toContain('tied at 0')
  })

  it('three strikes in a row is a turkey moment', () => {
    const now = { t: 1000 }
    const solo = [players[2]]
    let s = setup(ctxFor(now.t, solo), { frames: 5 })
    for (let i = 0; i < 3; i++) s = bowlExactP(s, ALL_PINS, now, solo)
    expect(s.moments.at(-1)?.text).toBe('Torii, turkey')
    while (s.stage !== 'podium') s = bowlExactP(s, [], now, solo)
    s = toDone(s, now, solo)
    const out = outcome(s, ctxFor(now.t, solo))!
    expect(out.highlights?.[0]).toMatchObject({ playerId: 'torii', kind: 'moment', content: { text: 'Torii, turkey' } })
  })
})

describe('pick', () => {
  it('starts on the pick screen, critters are unique, and everyone picked shortens the clock', () => {
    const s0 = realSetup(ctxFor(0), { frames: 5 })
    expect(s0.stage).toBe('pick')
    expect(Object.values(s0.chars).every((c) => c === null)).toBe(true)
    const [a, b, c] = s0.order
    let s = reduce(s0, { playerId: a, type: 'pick', payload: { char: 'chomp' } }, ctxFor(100))
    expect(s.chars[a]).toBe('chomp')
    expect(reduce(s, { playerId: b, type: 'pick', payload: { char: 'chomp' } }, ctxFor(200))).toBe(s)
    expect(reduce(s, { playerId: a, type: 'pick', payload: { char: 'pete' } }, ctxFor(200))).toBe(s)
    expect(reduce(s, { playerId: b, type: 'pick', payload: { char: 'malware' } }, ctxFor(200))).toBe(s)
    expect(reduce(s, { playerId: 'nobody', type: 'pick', payload: { char: 'pete' } }, ctxFor(200))).toBe(s)
    expect(reduce(s, { playerId: b, type: 'throw', payload: { x: 0, aim: 0, speed: 0.5, curve: 0 } }, ctxFor(200))).toBe(s)
    s = reduce(s, { playerId: b, type: 'pick', payload: { char: 'pete' } }, ctxFor(300))
    expect(s.endsAt).toBe(PICK_MS)
    s = reduce(s, { playerId: c, type: 'pick', payload: { char: 'ibby' } }, ctxFor(400))
    expect(s.endsAt).toBe(400 + PICK_DONE_MS)
    s = tick(s, ctxFor(400 + PICK_DONE_MS))
    expect(s.stage).toBe('aim')
    expect(s.endsAt).toBe(400 + PICK_DONE_MS + AIM_MS)
  })

  it('fills in a unique critter for anyone who did not pick', () => {
    let s = realSetup(ctxFor(0), {})
    s = reduce(s, { playerId: s.order[0], type: 'pick', payload: { char: 'shelly' } }, ctxFor(10))
    s = tick(s, ctxFor(PICK_MS))
    expect(s.stage).toBe('aim')
    const chars = s.order.map((id) => s.chars[id])
    expect(chars[0]).toBe('shelly')
    expect(chars.every(Boolean)).toBe(true)
    expect(new Set(chars).size).toBe(chars.length)
  })

  it('bots take a free critter after a beat', () => {
    const ps: RoomPlayer[] = [players[0], { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true }]
    const c = (now: number) => ({ now, players: ps, mode: 'together' as const, random: () => 0.1 })
    let s = realSetup(c(0), {})
    s = reduce(s, { playerId: 'dixxx', type: 'pick', payload: { char: 'chomp' } }, c(100))
    expect(bot(s, 'bot-gator', c(500))).toBeNull()
    const m = bot(s, 'bot-gator', c(2000))
    expect(m?.type).toBe('pick')
    expect((m?.payload as { char: string }).char).not.toBe('chomp')
    s = reduce(s, { playerId: 'bot-gator', type: m!.type, payload: m!.payload }, c(2000))
    expect(s.chars['bot-gator']).toBeTruthy()
    expect(bot(s, 'bot-gator', c(3000))).toBeNull()
  })

  it('holds the podium before the game reports', () => {
    const now = { t: 1000 }
    const solo = [players[0]]
    let s = setup(ctxFor(now.t, solo), { frames: 5 })
    while (s.stage !== 'podium') s = bowlExactP(s, [1], now, solo)
    expect(outcome(s, ctxFor(now.t, solo))).toBeNull()
    expect(s.endsAt - now.t).toBeLessThanOrEqual(PODIUM_MS)
    s = tick(s, ctxFor(s.endsAt, solo))
    expect(s.stage).toBe('done')
    const out = outcome(s, ctxFor(now.t, solo))!
    expect(out.details).toMatchObject({ chars: { dixxx: expect.any(String) } })
  })
})

describe('bots', () => {
  it('only bowl on their own turn, after a breath', () => {
    const ps: RoomPlayer[] = [players[0], { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true }]
    const c = (now: number) => ({ now, players: ps, mode: 'apart' as const, random: () => 0.1 })
    const s0 = setup(c(0), {})
    const s = { ...s0, bowler: 'bot-gator' }
    expect(bot(s, 'dixxx', c(5000))).toBeNull()
    expect(bot(s, 'bot-gator', c(500))).toBeNull()
    const m = bot(s, 'bot-gator', c(5000))
    expect(m?.type).toBe('throw')
    expect(readThrow(m?.payload)).not.toBeNull()
    const rolling = reduce(s, { playerId: 'bot-gator', type: m!.type, payload: m!.payload }, c(5000))
    expect(rolling.stage).toBe('roll')
    expect(bot(rolling, 'bot-gator', c(9000))).toBeNull()
  })

  it('one human doing nothing and two bots finish a five-frame game on tick + bot alone', () => {
    const ps: RoomPlayer[] = [
      players[1],
      { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
      { id: 'bot-pigeon', name: 'Pigeon', color: '#94A3B8', guest: true, connected: true, bot: true },
    ]
    let now = 0
    const c = () => ({ now, players: ps, mode: 'apart' as const, random })
    let s = setup(c(), { frames: 5 })
    for (let i = 0; i < 40_000 && s.stage !== 'done'; i++) {
      now += 200
      s = tick(s, c())
      for (const b of ps.filter((p) => p.bot)) {
        const m = bot(s, b.id, c())
        if (m) s = reduce(s, { playerId: b.id, type: m.type, payload: m.payload }, c())
      }
    }
    expect(s.stage).toBe('done')
    const out = outcome(s, c())!
    expect(out.placements).toHaveLength(3)
    // The human never threw: every one of their balls was the lane's lazy auto-roll.
    expect(s.rolls.johnnyboy.length).toBeGreaterThanOrEqual(5)
    expect(s.rolls['bot-gator'].length).toBeGreaterThanOrEqual(5)
  })
})
