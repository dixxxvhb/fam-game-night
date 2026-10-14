import { describe, expect, it } from 'vitest'
import type { GameCtx, PlayerAction, RoomPlayer } from '../../engine/types'
import { COUNTDOWN_MS, CUP_INTRO_MS, CUP_POINTS, PICK_MS, PODIUM_MS, RACE_RESULT_MS, TRACK_INTRO_MS } from './contract'
import {
  bot, charOf, cupPoints, cupStandings, FINISH_WINDOW_MS, FREEZE_MS, fmtMs, gridOf, HOST, lapTimes, ordinal, outcome, PICK_DONE_MS,
  reduce, setup, standings, tick, TRIAL_MS, type KartState,
} from './logic'
import { autoSteer, makeWorld, minLapMs, prestep, progressOf, step, type KartInput } from './sim'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 5
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, mode: 'together' | 'apart' = 'together', ps = players): GameCtx => ({ now, players: ps, mode, random })
const host = (type: string, payload: unknown, from = HOST): PlayerAction => ({ playerId: from, type, payload })
const act = (playerId: string, type: string, payload?: unknown): PlayerAction => ({ playerId, type, payload })
const TV = 'b9e0f3c2-tv-client-id'

/** Everyone picks, then tick through to the race of `raceNo`. */
function toRace(s: KartState): KartState {
  let t = s.stageAt
  for (const [i, id] of s.ids.entries()) if (!s.chars[id]) s = reduce(s, act(id, 'pick', { char: ['chomp', 'pete', 'ibby', 'zippy', 'dillo', 'shelly'][i] }), ctx(t))
  for (let guard = 0; guard < 10 && s.stage !== 'race'; guard++) {
    t = Math.max(t, s.stage === 'countdown' ? s.goAt : s.stageEnds)
    s = tick(s, ctx(t))
  }
  expect(s.stage).toBe('race')
  return s
}

/** Finish a race in the given order with plausible times. */
function finishRace(s: KartState, order: string[], t0 = s.goAt): KartState {
  const lap = 30_000
  for (const [i, id] of order.entries()) {
    for (let l = s.racers[id].lap + 1; l <= s.laps; l++) s = reduce(s, host('lap', { id, lap: l, time: l * lap + i * 700 }), ctx(t0 + l * lap + i * 700))
    s = reduce(s, host('finish', { id, time: s.laps * lap + i * 700 }), ctx(t0 + s.laps * lap + i * 700))
  }
  expect(s.stage).toBe('freeze')
  return s
}

describe('setup', () => {
  it('starts with the pick, Grand Prix by default, Rush Hour, four Sunshine Cup tracks', () => {
    const s = setup(ctx(1000), {})
    expect(s.kind).toBe('race')
    expect(s.format).toBe('gp')
    expect(s.stage).toBe('pick')
    expect(s.stageEnds).toBe(1000 + PICK_MS)
    expect(s.tracks).toEqual(['oval', 'eight', 'swamp', 'night'])
    expect(s.speed).toBe('rush')
    expect(s.laps).toBe(3)
    expect(Object.values(s.chars)).toEqual([null, null, null])
    expect([...s.grid].sort()).toEqual([...s.ids].sort())
  })
  it('reads every option, and falls back on junk', () => {
    const s = setup(ctx(0), { race: 'single', track: 'keys', cup: 'hurricane', speed: 'florida', gas: 'hold', cam: 'overview' })
    expect(s.format).toBe('single')
    expect(s.tracks).toEqual(['keys'])
    expect(s.speed).toBe('florida')
    expect(s.gas).toBe('hold')
    expect(s.cam).toBe('overview')
    expect(setup(ctx(0), { cup: 'hurricane' }).tracks).toEqual(['pier', 'coaster', 'keys', 'launch'])
    const j = setup(ctx(0), { race: 'single', track: 'rainbow-road', speed: 'warp', gas: 'nitro', cam: 'drone' })
    expect(j.tracks).toEqual(['oval'])
    expect(j.speed).toBe('rush')
    expect(j.gas).toBe('auto')
    expect(j.cam).toBe('split')
  })
  it('apart is a real race by default; Time trial needs two people', () => {
    expect(setup(ctx(0, 'apart'), {}).kind).toBe('race')
    expect(setup(ctx(0, 'apart'), { apart: 'trial' }).kind).toBe('trial')
    const solo = [players[0], { ...players[1], bot: true }]
    expect(setup(ctx(0, 'apart', solo), { apart: 'trial' }).kind).toBe('race')
  })
})

describe('pick', () => {
  it('unique critters, one each; all picked ends the pick early', () => {
    let s = setup(ctx(0), {})
    s = reduce(s, act('dixxx', 'pick', { char: 'chomp' }), ctx(100))
    expect(charOf(s, 'dixxx')).toBe('chomp')
    // Taken, a second pick, junk, strangers: all ignored.
    expect(reduce(s, act('torii', 'pick', { char: 'chomp' }), ctx(200))).toBe(s)
    expect(reduce(s, act('dixxx', 'pick', { char: 'pete' }), ctx(200))).toBe(s)
    expect(reduce(s, act('torii', 'pick', { char: 'unicorn' }), ctx(200))).toBe(s)
    expect(reduce(s, act('nobody', 'pick', { char: 'pete' }), ctx(200))).toBe(s)
    s = reduce(s, act('torii', 'pick', { char: 'ibby' }), ctx(300))
    expect(s.stageEnds).toBe(PICK_MS)
    s = reduce(s, act('johnnyboy', 'pick', { char: 'pete' }), ctx(400))
    expect(s.stageEnds).toBe(400 + PICK_DONE_MS)
    s = tick(s, ctx(400 + PICK_DONE_MS))
    expect(s.stage).toBe('cupIntro')
  })
  it('45 s runs out: everyone left gets a free critter, no repeats', () => {
    let s = setup(ctx(0), {})
    s = reduce(s, act('dixxx', 'pick', { char: 'zippy' }), ctx(100))
    expect(tick(s, ctx(PICK_MS - 1))).toBe(s)
    s = tick(s, ctx(PICK_MS))
    const chars = Object.values(s.chars)
    expect(chars.every(Boolean)).toBe(true)
    expect(new Set(chars).size).toBe(3)
    expect(s.chars.dixxx).toBe('zippy')
  })
  it('bots pick a free critter after a beat', () => {
    const ps = [players[0], { ...players[1], bot: true }, { ...players[2], bot: true }]
    let s = setup(ctx(0, 'together', ps), {})
    expect(bot(s, 'johnnyboy', ctx(100, 'together', ps))).toBeNull()
    s = reduce(s, act('dixxx', 'pick', { char: 'chomp' }), ctx(200))
    let t = 1300
    while ((!s.chars.johnnyboy || !s.chars.torii) && t < 20_000) {
      for (const id of ['johnnyboy', 'torii']) {
        const m = bot(s, id, ctx(t, 'together', ps))
        if (m) s = reduce(s, { playerId: id, ...m, payload: m.payload }, ctx(t, 'together', ps))
      }
      t += 200
    }
    expect(s.chars.johnnyboy).toBeTruthy()
    expect(s.chars.torii).toBeTruthy()
    expect(new Set(Object.values(s.chars)).size).toBe(3)
  })
})

describe('the Grand Prix flow', () => {
  it('pick, cup intro, then per race: track intro, countdown, race, freeze, results; then the podium', () => {
    let s = setup(ctx(0), {})
    for (const [i, id] of s.ids.entries()) s = reduce(s, act(id, 'pick', { char: ['chomp', 'pete', 'ibby'][i] }), ctx(10))
    s = tick(s, ctx(10 + PICK_DONE_MS))
    expect(s.stage).toBe('cupIntro')
    let t = s.stageAt
    s = tick(s, ctx(t + CUP_INTRO_MS - 1))
    expect(s.stage).toBe('cupIntro')
    s = tick(s, ctx(t + CUP_INTRO_MS))
    expect(s.stage).toBe('trackIntro')
    expect(s.track).toBe('oval')
    t = s.stageAt
    expect(s.goAt).toBe(t + TRACK_INTRO_MS + COUNTDOWN_MS)
    s = tick(s, ctx(t + TRACK_INTRO_MS))
    expect(s.stage).toBe('countdown')
    // Nothing counts before GO.
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 1 }), ctx(s.goAt - 10))).toBe(s)
    s = tick(s, ctx(s.goAt))
    expect(s.stage).toBe('race')

    const races = [
      ['torii', 'dixxx', 'johnnyboy'],
      ['dixxx', 'torii', 'johnnyboy'],
      ['johnnyboy', 'dixxx', 'torii'],
      ['dixxx', 'johnnyboy', 'torii'],
    ]
    for (const [n, order] of races.entries()) {
      if (n > 0) s = toRace(s)
      expect(s.raceNo).toBe(n)
      expect(s.track).toBe(['oval', 'eight', 'swamp', 'night'][n])
      s = finishRace(s, order)
      s = tick(s, ctx(s.freezeUntil))
      expect(s.stage).toBe('raceResult')
      expect(s.results).toHaveLength(n + 1)
      expect(s.results[n].pts[order[0]]).toBe(CUP_POINTS[0])
      expect(s.results[n].pts[order[2]]).toBe(CUP_POINTS[2])
      expect(outcome(s, ctx(s.stageAt))).toBeNull()
      s = tick(s, ctx(s.stageAt + RACE_RESULT_MS))
    }
    expect(s.stage).toBe('podium')
    // dixxx: 12+15+12+15 = 54, torii: 15+12+10+10 = 47, johnnyboy: 10+10+15+12 = 47; johnnyboy beat torii in the last race.
    expect(s.cupPts).toEqual({ dixxx: 54, torii: 47, johnnyboy: 47 })
    expect(cupStandings(s).map((x) => [x.id, x.place])).toEqual([['dixxx', 1], ['johnnyboy', 2], ['torii', 3]])
    s = tick(s, ctx(s.stageAt + PODIUM_MS))
    expect(s.stage).toBe('done')
    const o = outcome(s, ctx(s.stageAt))!
    expect(o.placements).toEqual([
      { playerId: 'dixxx', place: 1, score: 54 },
      { playerId: 'johnnyboy', place: 2, score: 47 },
      { playerId: 'torii', place: 3, score: 47 },
    ])
    expect(o.summary).toBe('Dixxx won the Sunshine Cup with 54 points')
    expect(o.highlights?.some((h) => h.label?.startsWith('Fastest lap on'))).toBe(true)
  })

  it('the grid after race 1 puts the cup leader at the back', () => {
    let s = toRace(setup(ctx(0), {}))
    s = finishRace(s, ['torii', 'dixxx', 'johnnyboy'])
    s = tick(s, ctx(s.freezeUntil))
    s = tick(s, ctx(s.stageAt + RACE_RESULT_MS))
    expect(s.stage).toBe('trackIntro')
    expect(gridOf(s)).toEqual(['johnnyboy', 'dixxx', 'torii'])
    expect(Object.values(s.racers).every((r) => r.lap === 0 && r.finishMs === null)).toBe(true)
  })

  it('single race skips the cup intro and goes results, podium, done', () => {
    let s = setup(ctx(0), { race: 'single', track: 'pier' })
    for (const [i, id] of s.ids.entries()) s = reduce(s, act(id, 'pick', { char: ['chomp', 'pete', 'ibby'][i] }), ctx(10))
    s = tick(s, ctx(s.stageEnds))
    expect(s.stage).toBe('trackIntro')
    expect(s.track).toBe('pier')
    s = toRace(s)
    s = finishRace(s, ['johnnyboy', 'torii', 'dixxx'])
    s = tick(s, ctx(s.freezeUntil))
    expect(s.stage).toBe('raceResult')
    s = tick(s, ctx(s.stageAt + RACE_RESULT_MS))
    expect(s.stage).toBe('podium')
    s = tick(s, ctx(s.stageAt + PODIUM_MS))
    const o = outcome(s, ctx(s.stageAt))!
    expect(o.placements.map((p) => p.playerId)).toEqual(['johnnyboy', 'torii', 'dixxx'])
    expect(o.summary).toMatch(/^Johnnyboy won Pier Pressure in /)
  })

  it('cup points: everyone who races scores; ties share a place and its points', () => {
    expect(cupPoints(1)).toBe(15)
    expect(cupPoints(8)).toBe(1)
    expect(cupPoints(9)).toBe(0)
    let s = toRace(setup(ctx(0), { race: 'single' }))
    // Nobody finishes; two tie on progress.
    s = reduce(s, host('place', { o: ['torii', 'dixxx', 'johnnyboy'], p: { torii: 1.5, dixxx: 1.2, johnnyboy: 1.2 } }), ctx(s.goAt + 9000))
    s = tick(s, ctx(s.endsAt))
    s = tick(s, ctx(s.freezeUntil))
    expect(s.results[0].places).toEqual({ torii: 1, dixxx: 2, johnnyboy: 2 })
    expect(s.results[0].pts).toEqual({ torii: 15, dixxx: 12, johnnyboy: 12 })
  })
})

describe('the race itself', () => {
  it('stops 30 seconds after the winner and places the rest by progress', () => {
    let s = toRace(setup(ctx(0), { race: 'single' }))
    const go = s.goAt
    for (let l = 1; l <= 3; l++) s = reduce(s, host('lap', { id: 'torii', lap: l, time: l * 30_000 }), ctx(go + l * 30_000))
    s = reduce(s, host('finish', { id: 'torii', time: 90_000 }), ctx(go + 90_000))
    s = reduce(s, host('place', { o: ['torii', 'johnnyboy', 'dixxx'], p: { johnnyboy: 2.6, dixxx: 2.1 } }), ctx(go + 95_000))
    expect(tick(s, ctx(go + 90_000 + FINISH_WINDOW_MS - 1)).stage).toBe('race')
    s = tick(s, ctx(go + 90_000 + FINISH_WINDOW_MS))
    expect(s.stage).toBe('freeze')
    expect(s.freezeUntil).toBe(s.stageAt + FREEZE_MS)
    expect(standings(s).map((x) => x.id)).toEqual(['torii', 'johnnyboy', 'dixxx'])
  })

  it('lap reports are hard to fake: skipped, repeated, backwards, too fast and player-sent laps are dropped', () => {
    let s = toRace(setup(ctx(0), { race: 'single' }))
    const go = s.goAt
    s = reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 30_000 }), ctx(go + 30_000))
    const before = s
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 3, time: 60_000 }), ctx(go))).toBe(before)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 31_000 }), ctx(go))).toBe(before)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 2, time: 20_000 }), ctx(go))).toBe(before)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 2, time: 60_000 }, 'dixxx'), ctx(go))).toBe(before)
    expect(reduce(s, host('finish', { id: 'dixxx', time: minLapMs('oval') }), ctx(go))).toBe(before)
    expect(reduce(s, host('lap', null), ctx(go))).toBe(before)
    expect(reduce(s, host('place', 'junk'), ctx(go))).toBe(before)
    // The TV's client id is the host too.
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 2, time: 60_000 }, TV), ctx(go)).racers.dixxx.lap).toBe(2)
  })

  it('place reports carry items, roulette, coins, rocket starts; worst place tracks the comeback', () => {
    let s = toRace(setup(ctx(0), { race: 'single' }))
    const go = s.goAt
    s = reduce(s, host('place', { o: ['torii', 'johnnyboy', 'dixxx'], i: { dixxx: 'pelican', torii: 'bogus' }, r: ['johnnyboy'], c: { dixxx: 7, torii: 99 }, k: { dixxx: 1 } }), ctx(go + 9000))
    expect(s.racers.dixxx.item).toBe('pelican')
    expect(s.racers.torii.item).toBeNull()
    expect(s.racers.johnnyboy.rolling).toBe(true)
    expect(s.racers.dixxx.coins).toBe(7)
    expect(s.racers.torii.coins).toBe(0)
    expect(s.racers.dixxx.rockets).toBe(1)
    expect(s.racers.dixxx.worst).toBe(3)
    s = finishRace(s, ['dixxx', 'torii', 'johnnyboy'])
    s = tick(s, ctx(s.freezeUntil))
    expect(s.results[0].climb.dixxx).toBe(2)
    s = tick(s, ctx(s.stageAt + RACE_RESULT_MS))
    s = tick(s, ctx(s.stageAt + PODIUM_MS))
    const o = outcome(s, ctx(s.stageAt))!
    expect(o.highlights?.map((h) => h.label)).toContain('From 3rd to 1st on Gate Loop')
    expect(o.highlights?.map((h) => h.label)).toContain('Nailed the rocket start')
  })
})

describe('time trial (apart, option)', () => {
  const apart = (now: number) => ctx(now, 'apart')
  it('pick, then three runs each, best lap wins, then a freeze and done', () => {
    let s = setup(apart(0), { apart: 'trial', track: 'swamp' })
    expect(s.kind).toBe('trial')
    s = tick(s, apart(PICK_MS))
    expect(s.stage).toBe('trial')
    expect(s.endsAt).toBe(PICK_MS + TRIAL_MS)
    const t = PICK_MS
    const lap = minLapMs('swamp') + 5000
    for (const [i, id] of ['dixxx', 'johnnyboy', 'torii'].entries()) {
      for (let n = 1; n <= 3; n++) {
        s = reduce(s, act(id, 'trial:start'), apart(t))
        s = reduce(s, act(id, 'trial:lap', { time: lap + i * 1000 + n * 10, n }), apart(t + 1000))
      }
    }
    expect(s.stage).toBe('freeze')
    s = tick(s, apart(s.freezeUntil))
    expect(s.stage).toBe('done')
    const o = outcome(s, apart(s.stageAt))!
    expect(o.placements.map((p) => p.playerId)).toEqual(['dixxx', 'johnnyboy', 'torii'])
  })
})

describe('helpers', () => {
  it('formats times and places', () => {
    expect(fmtMs(12_345)).toBe('12.35s')
    expect(fmtMs(75_000)).toBe('1:15.0')
    expect(fmtMs(null)).toBe('--')
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(11)).toBe('11th')
    expect(lapTimes([30_000, 58_000, 87_000])).toEqual([30_000, 28_000, 29_000])
  })
})

describe('a whole race through the sim', () => {
  it('a solo race against AI karts: the host sim reports, the logic scores it, cup points land', () => {
    const ps = [players[0], { ...players[1], bot: true }, { ...players[2], bot: true }]
    const c = (now: number) => ctx(now, 'apart', ps)
    let s = setup(c(0), { race: 'single', track: 'oval' })
    s = reduce(s, act('dixxx', 'pick', { char: 'chomp' }), c(10))
    s = tick(s, c(PICK_MS))
    s = tick(s, c(s.stageEnds))
    expect(s.stage).toBe('countdown')
    const racers = gridOf(s).map((id) => ({ ...ps.find((p) => p.id === id)!, char: charOf(s, id) }))
    const w = makeWorld({ trackId: s.track, laps: s.laps, racers, seed: s.seed, speed: s.speed, gas: s.gas })
    // The countdown: hop pressed 300 ms before GO = rocket start.
    for (let toGo = COUNTDOWN_MS; toGo > 0; toGo -= 100) prestep(w, { dixxx: { s: 0, g: 1, b: toGo <= 300 ? 1 : 0, f: 0 } }, toGo)
    s = tick(s, c(s.goAt))
    let rocket = false
    for (let i = 0; i < 60 * 200 && s.stage === 'race'; i++) {
      const k = w.karts.find((x) => x.id === 'dixxx')!
      const inp: KartInput = { s: Math.round(autoSteer(w, k) * 10) / 10, g: 1, b: i < 5 ? 1 : 0, f: 0 }
      for (const e of step(w, { dixxx: inp })) {
        if (e.t === 'rocket' && e.id === 'dixxx' && e.ok) rocket = true
        if (e.t === 'lap') s = reduce(s, act('dixxx', 'lap', { id: e.id, lap: e.lap, time: e.time }), c(s.goAt + e.time))
        if (e.t === 'finish') s = reduce(s, act('dixxx', 'finish', { id: e.id, time: e.time }), c(s.goAt + e.time))
      }
      if (i % 30 === 0) {
        s = reduce(s, act('dixxx', 'place', { o: w.order, p: Object.fromEntries(w.karts.map((k2) => [k2.id, progressOf(w, k2)])), k: Object.fromEntries(w.karts.map((k2) => [k2.id, Math.min(1, k2.rockets)])) }), c(s.goAt + w.time))
        s = tick(s, c(s.goAt + w.time))
      }
    }
    expect(rocket).toBe(true)
    expect(s.stage).toBe('freeze')
    s = tick(s, c(s.freezeUntil))
    expect(s.stage).toBe('raceResult')
    expect(Object.values(s.cupPts).reduce((a, b) => a + b, 0)).toBe(15 + 12 + 10)
  })
})
