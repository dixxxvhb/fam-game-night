import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { ATTACK_CAP_MS, END_MS, MAX_INCOMING, outcome, pickTarget, reduce, READY_MS, setup, tick, type MelonState } from './logic'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 7
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, ps: RoomPlayer[] = players): GameCtx => ({ now, players: ps, mode: 'together', random })
const act = (s: MelonState, playerId: string, type: string, payload: unknown, now: number, ps = players) =>
  reduce(s, { playerId, type, payload }, ctx(now, ps))

const T0 = 1_000_000

/** Play stops: the end scene runs END_MS, then the game is done. */
function ended(s: MelonState, now: number, ps = players): MelonState {
  const e = tick(s, ctx(now, ps))
  expect(e.stage).toBe('end')
  expect(outcome(e, ctx(now, ps))).toBeNull()
  expect(tick(e, ctx(now + END_MS - 1, ps)).stage).toBe('end')
  return tick(e, ctx(now + END_MS, ps))
}

function started(opts: Record<string, string | number>, ps = players): MelonState {
  const s = setup(ctx(T0, ps), opts)
  return tick(s, ctx(T0 + READY_MS, ps))
}

describe('setup and options', () => {
  it('defaults to a 3 minute race after a 3 second count-in', () => {
    const s = setup(ctx(T0), {})
    expect(s.mode).toBe('race')
    expect(s.stage).toBe('ready')
    expect(s.startsAt).toBe(T0 + READY_MS)
    expect(s.endsAt - s.startsAt).toBe(3 * 60_000)
    expect(Object.keys(s.players)).toEqual(['dixxx', 'johnnyboy', 'torii'])
    expect(s.players.dixxx).toEqual({ score: 0, alive: true, best: 0, bestAt: 0, outAt: null, incoming: [] })
  })
  it('takes race length and attack mode, ignores junk options', () => {
    expect(setup(ctx(T0), { length: 2 }).total).toBe(120_000)
    expect(setup(ctx(T0), { length: 5 }).total).toBe(300_000)
    expect(setup(ctx(T0), { length: 4 }).total).toBe(180_000)
    expect(setup(ctx(T0), { mode: 'chaos' }).mode).toBe('race')
    const a = setup(ctx(T0), { mode: 'attack', length: 2 })
    expect(a.mode).toBe('attack')
    expect(a.total).toBe(ATTACK_CAP_MS)
  })
  it('counts in, then plays; nothing is accepted during the count-in', () => {
    const s = setup(ctx(T0), {})
    expect(tick(s, ctx(T0 + 1000))).toBe(s)
    expect(act(s, 'dixxx', 'score', { score: 10 }, T0 + 1000)).toBe(s)
    const p = tick(s, ctx(T0 + READY_MS))
    expect(p.stage).toBe('play')
    expect(tick(p, ctx(T0 + READY_MS + 200))).toBe(p)
  })
})

describe('score, best, over', () => {
  it('takes score rises from players in the game only', () => {
    let s = started({})
    s = act(s, 'dixxx', 'score', { score: 30 }, T0 + 5000)
    expect(s.players.dixxx.score).toBe(30)
    // same, lower, junk, strangers: same object back
    for (const [who, payload] of [
      ['dixxx', { score: 30 }],
      ['dixxx', { score: 12 }],
      ['dixxx', { score: -1 }],
      ['dixxx', { score: 3.5 }],
      ['dixxx', { score: '99' }],
      ['dixxx', { score: Number.NaN }],
      ['dixxx', { score: 1e12 }],
      ['dixxx', null],
      ['dixxx', 'lots'],
      ['nobody', { score: 50 }],
      ['__host', { score: 50 }],
    ] as [string, unknown][]) {
      expect(act(s, who, 'score', payload, T0 + 5000)).toBe(s)
    }
    expect(act(s, 'dixxx', 'dance', { score: 99 }, T0 + 5000)).toBe(s)
  })
  it('records the biggest fruit made, only going up', () => {
    let s = started({})
    s = act(s, 'torii', 'best', { tier: 6 }, T0 + 6000)
    expect(s.players.torii.best).toBe(6)
    expect(s.players.torii.bestAt).toBe(T0 + 6000)
    expect(act(s, 'torii', 'best', { tier: 4 }, T0 + 7000)).toBe(s)
    expect(act(s, 'torii', 'best', { tier: 6 }, T0 + 7000)).toBe(s)
    expect(act(s, 'torii', 'best', { tier: 12 }, T0 + 7000)).toBe(s)
    expect(act(s, 'torii', 'best', { tier: 'watermelon' }, T0 + 7000)).toBe(s)
  })
  it('topping out ends your run, keeps your score, and nothing more counts', () => {
    let s = started({})
    s = act(s, 'johnnyboy', 'score', { score: 100 }, T0 + 9000)
    s = act(s, 'johnnyboy', 'over', { score: 120 }, T0 + 10_000)
    expect(s.players.johnnyboy).toMatchObject({ alive: false, outAt: T0 + 10_000, score: 120 })
    expect(act(s, 'johnnyboy', 'over', {}, T0 + 11_000)).toBe(s)
    expect(act(s, 'johnnyboy', 'score', { score: 500 }, T0 + 11_000)).toBe(s)
    // an over with a lower or junk score keeps the higher one
    const t = act(started({}), 'dixxx', 'score', { score: 80 }, T0 + 4000)
    expect(act(t, 'dixxx', 'over', { score: 10 }, T0 + 5000).players.dixxx.score).toBe(80)
    expect(act(t, 'dixxx', 'over', 'junk', T0 + 5000).players.dixxx).toMatchObject({ score: 80, alive: false })
  })
})

describe('attack', () => {
  it('only works in attack mode, from a live jar, with a sane size', () => {
    const race = started({})
    expect(act(race, 'dixxx', 'attack', { n: 2 }, T0 + 5000)).toBe(race)
    const s = started({ mode: 'attack' })
    for (const payload of [{ n: 0 }, { n: 7 }, { n: 2.5 }, { n: '3' }, {}, null]) {
      expect(act(s, 'dixxx', 'attack', payload, T0 + 5000)).toBe(s)
    }
    const out = act(s, 'dixxx', 'over', {}, T0 + 5000)
    expect(act(out, 'dixxx', 'attack', { n: 2 }, T0 + 6000)).toBe(out)
  })
  it('hits the leader among live rivals', () => {
    let s = started({ mode: 'attack' })
    s = act(s, 'johnnyboy', 'score', { score: 50 }, T0 + 4000)
    s = act(s, 'torii', 'score', { score: 90 }, T0 + 4000)
    s = act(s, 'dixxx', 'attack', { n: 3 }, T0 + 5000)
    expect(s.players.torii.incoming).toEqual([{ id: 1, n: 3, from: 'dixxx' }])
    expect(s.lastHit).toEqual({ from: 'dixxx', to: 'torii', n: 3, at: T0 + 5000 })
    expect(s.nextId).toBe(2)
    // the leader never hits themself: Johnnyboy is the top rival for Torii
    s = act(s, 'torii', 'attack', { n: 2 }, T0 + 5500)
    expect(s.players.johnnyboy.incoming).toEqual([{ id: 2, n: 2, from: 'torii' }])
    // a dead leader is skipped
    s = act(s, 'torii', 'over', {}, T0 + 6000)
    expect(s.players.torii.incoming).toEqual([])
    s = act(s, 'dixxx', 'attack', { n: 4 }, T0 + 6500)
    expect(s.players.johnnyboy.incoming.at(-1)).toEqual({ id: 3, n: 4, from: 'dixxx' })
  })
  it('picks a random live rival when nobody leads, and nobody when alone', () => {
    const s = started({ mode: 'attack' })
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(pickTarget(s, 'dixxx', random)!)
    expect([...seen].sort()).toEqual(['johnnyboy', 'torii'])
    let lone = act(s, 'johnnyboy', 'over', {}, T0 + 5000)
    lone = act(lone, 'torii', 'over', {}, T0 + 5000)
    expect(pickTarget(lone, 'dixxx', random)).toBeNull()
    expect(act(lone, 'dixxx', 'attack', { n: 2 }, T0 + 5000)).toBe(lone)
  })
  it('caps the incoming queue', () => {
    let s = act(started({ mode: 'attack' }), 'torii', 'score', { score: 10 }, T0 + 4000)
    for (let i = 0; i < MAX_INCOMING; i++) s = act(s, 'dixxx', 'attack', { n: 1 }, T0 + 5000 + i)
    expect(s.players.torii.incoming).toHaveLength(MAX_INCOMING)
    expect(act(s, 'dixxx', 'attack', { n: 1 }, T0 + 6000)).toBe(s)
  })
  it('absorb clears only your own entry', () => {
    let s = act(started({ mode: 'attack' }), 'torii', 'score', { score: 10 }, T0 + 4000)
    s = act(s, 'dixxx', 'attack', { n: 2 }, T0 + 5000)
    s = act(s, 'johnnyboy', 'attack', { n: 3 }, T0 + 5100)
    const [a, b] = s.players.torii.incoming
    expect(act(s, 'dixxx', 'absorb', { id: a.id }, T0 + 5200)).toBe(s)
    expect(act(s, 'torii', 'absorb', { id: 999 }, T0 + 5200)).toBe(s)
    expect(act(s, 'torii', 'absorb', { id: String(a.id) }, T0 + 5200)).toBe(s)
    s = act(s, 'torii', 'absorb', { id: a.id }, T0 + 5200)
    expect(s.players.torii.incoming).toEqual([b])
  })
})

describe('race to the end', () => {
  it('plays a full race to the clock and places by score', () => {
    let s = started({ mode: 'race', length: 2 })
    let now = T0 + READY_MS
    s = act(s, 'dixxx', 'score', { score: 300 }, (now += 20_000))
    s = act(s, 'torii', 'score', { score: 1240 }, (now += 20_000))
    s = act(s, 'johnnyboy', 'score', { score: 300 }, (now += 20_000))
    s = act(s, 'torii', 'best', { tier: 11 }, now)
    s = act(s, 'dixxx', 'best', { tier: 11 }, now + 10)
    s = act(s, 'johnnyboy', 'best', { tier: 9 }, now)
    // torii tops out but her score stands
    s = act(s, 'torii', 'over', { score: 1240 }, (now += 10_000))
    s = tick(s, ctx(now))
    expect(s.stage).toBe('play')
    expect(outcome(s, ctx(now))).toBeNull()
    s = ended(s, T0 + READY_MS + 120_000)
    expect(s.stage).toBe('done')
    expect(s.endedBy).toBe('clock')
    const out = outcome(s, ctx(now))!
    expect(out.placements).toEqual([
      { playerId: 'torii', place: 1, score: 1240 },
      { playerId: 'dixxx', place: 2, score: 300 },
      { playerId: 'johnnyboy', place: 2, score: 300 },
    ])
    expect(out.summary).toBe('Torii won the race with 1,240 and made a watermelon')
    expect(out.highlights).toEqual([{ playerId: 'torii', kind: 'moment', label: 'Biggest fruit', content: { text: 'Torii made a watermelon', tier: 11 } }])
    // done is done
    expect(act(s, 'dixxx', 'score', { score: 5000 }, now)).toBe(s)
    expect(tick(s, ctx(now + 1000))).toBe(s)
  })
  it('ends early when every jar has topped out', () => {
    let s = started({})
    for (const p of players) s = act(s, p.id, 'over', {}, T0 + 10_000)
    s = ended(s, T0 + 10_200)
    expect(s.stage).toBe('done')
    expect(s.endedBy).toBe('out')
    const out = outcome(s, ctx(T0 + 10_200))!
    expect(out.placements.every((p) => p.place === 1)).toBe(true)
    expect(out.highlights).toEqual([])
  })
  it('works solo', () => {
    const solo = [players[0]]
    let s = started({}, solo)
    s = act(s, 'dixxx', 'score', { score: 40 }, T0 + 5000, solo)
    expect(tick(s, ctx(T0 + 6000, solo)).stage).toBe('play')
    s = act(s, 'dixxx', 'over', {}, T0 + 7000, solo)
    s = ended(s, T0 + 7200, solo)
    expect(outcome(s, ctx(T0 + 7200, solo))!.placements).toEqual([{ playerId: 'dixxx', place: 1, score: 40 }])
  })
})

describe('attack to the end', () => {
  it('last jar standing wins, then by who lasted longer', () => {
    let s = started({ mode: 'attack' })
    s = act(s, 'dixxx', 'score', { score: 900 }, T0 + 10_000)
    s = act(s, 'johnnyboy', 'score', { score: 200 }, T0 + 10_000)
    s = act(s, 'torii', 'score', { score: 400 }, T0 + 10_000)
    s = act(s, 'dixxx', 'over', {}, T0 + 20_000)
    s = tick(s, ctx(T0 + 20_100))
    expect(s.stage).toBe('play')
    s = act(s, 'torii', 'over', {}, T0 + 30_000)
    s = ended(s, T0 + 30_100)
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(T0 + 30_100))!
    expect(out.placements).toEqual([
      { playerId: 'johnnyboy', place: 1, score: 200 },
      { playerId: 'torii', place: 2, score: 400 },
      { playerId: 'dixxx', place: 3, score: 900 },
    ])
    expect(out.summary).toBe('Johnnyboy was the last jar standing')
    // someone else's big fruit gets its own sentence
    const withBig = { ...s, players: { ...s.players, dixxx: { ...s.players.dixxx, best: 10, bestAt: T0 + 15_000 } } }
    expect(outcome(withBig, ctx(T0 + 30_100))!.summary).toBe('Johnnyboy was the last jar standing. Dixxx made a melon.')
  })
  it('at the 5 minute cap, survivors place by score ahead of the fallen', () => {
    let s = started({ mode: 'attack' })
    s = act(s, 'dixxx', 'score', { score: 500 }, T0 + 10_000)
    s = act(s, 'johnnyboy', 'score', { score: 800 }, T0 + 10_000)
    s = act(s, 'torii', 'score', { score: 2000 }, T0 + 10_000)
    s = act(s, 'torii', 'over', {}, T0 + 60_000)
    s = ended(s, T0 + READY_MS + ATTACK_CAP_MS)
    expect(s.stage).toBe('done')
    expect(s.endedBy).toBe('clock')
    const out = outcome(s, ctx(T0 + READY_MS + ATTACK_CAP_MS))!
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([['johnnyboy', 1], ['dixxx', 2], ['torii', 3]])
    expect(out.summary).toBe('Johnnyboy led at the buzzer with 800')
  })
  it('survivors tied on score share a place', () => {
    let s = started({ mode: 'attack' })
    s = act(s, 'dixxx', 'score', { score: 100 }, T0 + 10_000)
    s = act(s, 'torii', 'score', { score: 100 }, T0 + 10_000)
    s = act(s, 'johnnyboy', 'over', {}, T0 + 20_000)
    s = ended(s, T0 + READY_MS + ATTACK_CAP_MS)
    const out = outcome(s, ctx(T0 + READY_MS + ATTACK_CAP_MS))!
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([['dixxx', 1], ['torii', 1], ['johnnyboy', 3]])
  })
  it('solo attack runs until you top out', () => {
    const solo = [players[2]]
    let s = started({ mode: 'attack' }, solo)
    expect(tick(s, ctx(T0 + 10_000, solo)).stage).toBe('play')
    s = act(s, 'torii', 'over', {}, T0 + 11_000, solo)
    expect(ended(s, T0 + 11_200, solo).stage).toBe('done')
  })
})
