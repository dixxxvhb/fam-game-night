import { describe, expect, it } from 'vitest'
import type { GameCtx, PlayerAction, RoomPlayer } from '../../engine/types'
import {
  COUNTDOWN_MS, FINISH_WINDOW_MS, FREEZE_MS, fmtMs, HOST, lapTimes, ordinal, outcome, reduce, setup, standings, tick,
  TRIAL_MS,
} from './logic'
import { minLapMs } from './sim'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
let seed = 5
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, mode: 'together' | 'apart' = 'together'): GameCtx => ({ now, players, mode, random })
const host = (type: string, payload: unknown, from = HOST): PlayerAction => ({ playerId: from, type, payload })
const TV = 'b9e0f3c2-tv-client-id'

function startedRace(now: number, opts: Record<string, string | number> = {}) {
  let s = setup(ctx(now), { track: 'oval', laps: 3, ...opts })
  s = tick(s, ctx(s.goAt))
  expect(s.stage).toBe('race')
  return s
}

describe('setup', () => {
  it('together is a race with a countdown; apart is a time trial', () => {
    const r = setup(ctx(1000), { track: 'swamp', laps: 5, gas: 'hold' })
    expect(r.kind).toBe('race')
    expect(r.stage).toBe('countdown')
    expect(r.goAt).toBe(1000 + COUNTDOWN_MS)
    expect(r.track).toBe('swamp')
    expect(r.laps).toBe(5)
    expect(r.gas).toBe('hold')
    expect(Object.keys(r.racers)).toEqual(['dixxx', 'johnnyboy', 'torii'])
    const t = setup(ctx(1000, 'apart'), {})
    expect(t.kind).toBe('trial')
    expect(t.stage).toBe('trial')
    expect(t.endsAt).toBe(1000 + TRIAL_MS)
    expect(Object.keys(t.runners)).toHaveLength(3)
  })
  it('falls back on junk options', () => {
    const r = setup(ctx(0), { track: 'rainbow-road', laps: 99, gas: 'nitro' })
    expect(r.track).toBe('oval')
    expect(r.laps).toBe(3)
    expect(r.gas).toBe('auto')
  })
  it('waits for GO', () => {
    const s = setup(ctx(0), {})
    expect(tick(s, ctx(s.goAt - 1))).toBe(s)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 10_000 }), ctx(10))).toBe(s)
  })
})

describe('a full race', () => {
  it('counts laps, finishes, freezes for 3 seconds, then places by finish', () => {
    const t0 = 1_000_000
    let s = startedRace(t0)
    const go = s.goAt
    // Positions and items stream in from the TV.
    s = reduce(s, host('place', { o: ['torii', 'dixxx', 'johnnyboy'], i: { torii: 'peel', dixxx: null, johnnyboy: 'missile' }, p: { torii: 0.4, dixxx: 0.3, johnnyboy: 0.2 }, h: { johnnyboy: 1 } }), ctx(go + 5000))
    expect(s.order).toEqual(['torii', 'dixxx', 'johnnyboy'])
    expect(s.racers.johnnyboy.item).toBe('missile')
    expect(s.racers.torii.prog).toBe(0.4)
    // The TV's client id works as the host too (the platform doesn't stamp '__host' yet).
    s = reduce(s, host('lap', { id: 'torii', lap: 1, time: 14_000 }, TV), ctx(go + 14_000))
    expect(s.racers.torii.lap).toBe(1)

    const finishOrder = ['torii', 'johnnyboy', 'dixxx']
    for (const [i, id] of finishOrder.entries()) {
      for (let lap = s.racers[id].lap + 1; lap <= 3; lap++) {
        s = reduce(s, host('lap', { id, lap, time: lap * 14_000 + i * 900 }), ctx(go + lap * 14_000 + i * 900))
      }
      s = reduce(s, host('finish', { id, time: 42_000 + i * 900 }), ctx(go + 42_000 + i * 900))
    }
    expect(s.stage).toBe('freeze')
    expect(outcome(s, ctx(go + 43_000))).toBeNull()
    s = tick(s, ctx(s.freezeUntil - 1))
    expect(s.stage).toBe('freeze')
    s = tick(s, ctx(s.freezeUntil))
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(go + 50_000))!
    expect(out.placements).toEqual([
      { playerId: 'torii', place: 1 },
      { playerId: 'johnnyboy', place: 2 },
      { playerId: 'dixxx', place: 3 },
    ])
    expect(out.summary).toBe('Torii won Oval in 42.00s')
    expect(out.highlights?.[0]?.label).toMatch(/Fastest lap on Oval/)
  })

  it('stops 30 seconds after the winner and places the rest by progress (ties share)', () => {
    let s = startedRace(0)
    const go = s.goAt
    for (let lap = 1; lap <= 3; lap++) s = reduce(s, host('lap', { id: 'dixxx', lap, time: lap * 12_000 }), ctx(go + lap * 12_000))
    s = reduce(s, host('finish', { id: 'dixxx', time: 36_000 }), ctx(go + 36_000))
    expect(s.firstFinishAt).toBe(go + 36_000)
    s = reduce(s, host('place', { o: ['dixxx', 'torii', 'johnnyboy'], p: { torii: 2.31, johnnyboy: 2.31 } }), ctx(go + 40_000))
    expect(tick(s, ctx(go + 36_000 + FINISH_WINDOW_MS - 1)).stage).toBe('race')
    s = tick(s, ctx(go + 36_000 + FINISH_WINDOW_MS))
    expect(s.stage).toBe('freeze')
    // a late finish after the window doesn't count
    expect(reduce(s, host('finish', { id: 'torii', time: 70_000 }), ctx(go + 70_000)).racers.torii.finishMs).toBeNull()
    s = tick(s, ctx(go + 36_000 + FINISH_WINDOW_MS + FREEZE_MS))
    const out = outcome(s, ctx(0))!
    expect(out.placements).toEqual([
      { playerId: 'dixxx', place: 1 },
      { playerId: 'johnnyboy', place: 2 },
      { playerId: 'torii', place: 2 },
    ])
    expect(standings(s).map((x) => x.place)).toEqual([1, 2, 2])
  })

  it('nobody finishing still ends the race at the hard stop', () => {
    let s = startedRace(0)
    s = reduce(s, host('place', { o: ['torii', 'dixxx', 'johnnyboy'], p: { torii: 1.5, dixxx: 1.2, johnnyboy: 0 } }), ctx(s.goAt + 1000))
    s = tick(s, ctx(s.endsAt))
    expect(s.stage).toBe('freeze')
    s = tick(s, ctx(s.freezeUntil))
    const out = outcome(s, ctx(0))!
    expect(out.placements.map((p) => p.playerId)).toEqual(['torii', 'dixxx', 'johnnyboy'])
    expect(out.summary).toBe('Nobody finished. Torii got the furthest')
  })

  it('a finish tie shares first place', () => {
    let s = startedRace(0)
    for (const id of ['dixxx', 'torii', 'johnnyboy']) {
      for (let lap = 1; lap <= 3; lap++) s = reduce(s, host('lap', { id, lap, time: lap * 13_000 }), ctx(s.goAt + lap * 13_000))
      s = reduce(s, host('finish', { id, time: id === 'johnnyboy' ? 41_000 : 40_000 }), ctx(s.goAt + 41_000))
    }
    s = tick(s, ctx(s.freezeUntil))
    const out = outcome(s, ctx(0))!
    expect(out.placements.map((p) => p.place)).toEqual([1, 1, 3])
  })
})

describe('lap reports are hard to fake', () => {
  it('rejects skipped, repeated, backwards and player-sent laps', () => {
    let s = startedRace(0)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 2, time: 20_000 }), ctx(1))).toBe(s)
    s = reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 20_000 }), ctx(1))
    expect(s.racers.dixxx.lap).toBe(1)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 21_000 }), ctx(1))).toBe(s)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 2, time: 19_000 }), ctx(1))).toBe(s)
    // a player can't report their own lap
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 2, time: 30_000 }, 'dixxx'), ctx(1))).toBe(s)
    expect(reduce(s, host('finish', { id: 'dixxx', time: 30_000 }, 'torii'), ctx(1))).toBe(s)
    // a finish needs the laps first, and a believable time
    expect(reduce(s, host('finish', { id: 'torii', time: 60_000 }), ctx(1))).toBe(s)
    let t = s
    for (let lap = 1; lap <= 3; lap++) t = reduce(t, host('lap', { id: 'torii', lap, time: lap * 4000 }), ctx(1))
    expect(reduce(t, host('finish', { id: 'torii', time: 12_000 }), ctx(1))).toBe(t)
    expect(reduce(s, host('place', { o: ['dixxx', 'torii', 'johnnyboy'] }, 'johnnyboy'), ctx(1))).toBe(s)
  })

  it('ignores junk payloads', () => {
    const s = startedRace(0)
    const junk: unknown[] = [
      null, undefined, 'lap', 7, [], { id: 'nobody', lap: 1, time: 1000 }, { id: 'dixxx', lap: '1', time: 1000 },
      { id: 'dixxx', lap: 1, time: -5 }, { id: 'dixxx', lap: 1, time: NaN }, { id: 'dixxx', lap: 1, time: 'soon' },
      { id: 'dixxx', lap: 1, time: 1e12 }, { id: 'dixxx', lap: 9, time: 1000 },
    ]
    for (const p of junk) {
      expect(reduce(s, host('lap', p), ctx(1))).toBe(s)
      expect(reduce(s, host('finish', p), ctx(1))).toBe(s)
    }
    for (const p of [null, { o: 'dixxx' }, { o: ['dixxx', 'dixxx', 'torii'] }, { o: ['dixxx', 'torii'] }, { o: ['a', 'b', 'c'] }, { i: { dixxx: 'banana' } }, { p: { dixxx: -3 } }, { p: { dixxx: 'far' } }, { h: { dixxx: 1.5 } }]) {
      expect(reduce(s, host('place', p), ctx(1))).toBe(s)
    }
    expect(reduce(s, host('honk', { loud: true }), ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'dixxx', type: 'trial:lap', payload: { time: 20_000, n: 1 } }, ctx(1))).toBe(s)
    // an unchanged place update returns the same state (no rebroadcast)
    const p = { o: s.order, i: { dixxx: null }, p: { dixxx: 0 } }
    expect(reduce(s, host('place', p), ctx(1))).toBe(s)
  })
})

describe('time trial (apart)', () => {
  const min = minLapMs('oval')

  it('three runs each, best lap wins, then a 3 second freeze', () => {
    let s = setup(ctx(0, 'apart'), { track: 'oval' })
    const lap = (id: string, time: number, now = 1000) => {
      const n = s.runners[id].runs.length + 1
      s = reduce(s, { playerId: id, type: 'trial:lap', payload: { time, n } }, ctx(now, 'apart'))
      // a resend of the same run changes nothing
      expect(reduce(s, { playerId: id, type: 'trial:lap', payload: { time, n } }, ctx(now, 'apart'))).toBe(s)
    }
    s = reduce(s, { playerId: 'torii', type: 'trial:start', payload: undefined }, ctx(10, 'apart'))
    expect(s.runners.torii.driving).toBe(true)
    lap('torii', 15_000)
    expect(s.runners.torii).toEqual({ runs: [15_000], best: 15_000, driving: false })
    lap('torii', 13_400)
    lap('torii', 14_100)
    expect(s.runners.torii.best).toBe(13_400)
    // a fourth run is refused
    const before = s
    s = reduce(s, { playerId: 'torii', type: 'trial:lap', payload: { time: 12_000, n: 4 } }, ctx(1000, 'apart'))
    expect(s).toBe(before)
    for (const t of [16_000, 15_500, 15_800]) lap('dixxx', t)
    for (const t of [14_000, 13_900]) lap('johnnyboy', t)
    expect(s.stage).toBe('trial')
    lap('johnnyboy', 13_400, 50_000)
    expect(s.stage).toBe('freeze')
    expect(s.freezeUntil).toBe(50_000 + FREEZE_MS)
    s = tick(s, ctx(s.freezeUntil, 'apart'))
    const out = outcome(s, ctx(0, 'apart'))!
    expect(out.placements).toEqual([
      { playerId: 'johnnyboy', place: 1 },
      { playerId: 'torii', place: 1 },
      { playerId: 'dixxx', place: 3 },
    ])
    expect(out.summary).toMatch(/fastest lap: 13\.40s on Oval/)
  })

  it('ends after 3 minutes; no lap means last place, tied', () => {
    let s = setup(ctx(0, 'apart'), {})
    s = reduce(s, { playerId: 'dixxx', type: 'trial:lap', payload: { time: 20_000, n: 1 } }, ctx(10, 'apart'))
    expect(tick(s, ctx(TRIAL_MS - 1, 'apart'))).toBe(s)
    s = tick(s, ctx(TRIAL_MS, 'apart'))
    expect(s.stage).toBe('freeze')
    // too late now
    expect(reduce(s, { playerId: 'torii', type: 'trial:lap', payload: { time: 20_000, n: 1 } }, ctx(TRIAL_MS + 1, 'apart'))).toBe(s)
    s = tick(s, ctx(TRIAL_MS + FREEZE_MS, 'apart'))
    const out = outcome(s, ctx(0, 'apart'))!
    expect(out.placements[0]).toEqual({ playerId: 'dixxx', place: 1 })
    expect(out.placements.slice(1).map((p) => p.place)).toEqual([2, 2])
  })

  it('rejects impossible or junk lap times and strangers', () => {
    const s = setup(ctx(0, 'apart'), { track: 'oval' })
    for (const time of [min - 1, 0, -1, NaN, 'fast', null, 700_000, Infinity]) {
      expect(reduce(s, { playerId: 'dixxx', type: 'trial:lap', payload: { time, n: 1 } }, ctx(1, 'apart'))).toBe(s)
    }
    // the run number has to be the next one
    for (const n of [undefined, 0, 2, '1', 1.5]) {
      expect(reduce(s, { playerId: 'dixxx', type: 'trial:lap', payload: { time: 20_000, n } }, ctx(1, 'apart'))).toBe(s)
    }
    expect(reduce(s, { playerId: 'dixxx', type: 'trial:lap', payload: null }, ctx(1, 'apart'))).toBe(s)
    expect(reduce(s, { playerId: 'g-stranger', type: 'trial:lap', payload: { time: 20_000, n: 1 } }, ctx(1, 'apart'))).toBe(s)
    expect(reduce(s, { playerId: 'g-stranger', type: 'trial:start', payload: null }, ctx(1, 'apart'))).toBe(s)
    expect(reduce(s, host('lap', { id: 'dixxx', lap: 1, time: 20_000 }), ctx(1, 'apart'))).toBe(s)
    const ok = reduce(s, { playerId: 'dixxx', type: 'trial:lap', payload: { time: min + 1, n: 1 } }, ctx(1, 'apart'))
    expect(ok.runners.dixxx.best).toBe(min + 1)
  })
})

describe('helpers', () => {
  it('formats times and places', () => {
    expect(fmtMs(13_421)).toBe('13.42s')
    expect(fmtMs(62_340)).toBe('1:02.3')
    expect(fmtMs(null)).toBe('--')
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
    expect(ordinal(11)).toBe('11th')
    expect(lapTimes([14_000, 27_000, 41_500])).toEqual([14_000, 13_000, 14_500])
  })
})
