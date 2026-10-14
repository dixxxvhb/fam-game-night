import { describe, expect, it } from 'vitest'
import { COIN_MAX, ROCKET_WINDOW_MS } from './contract'
import {
  autoSteer, BOOST_MUL, botCap, ITEM_KINDS, ITEM_TABLES, itemBucket, makeWorld, minLapMs, MT_BOOST, MT_TIERS, mtTier, prestep,
  raceOrder, rollItem, snapshot, step, trackKart, turnpikeScene, VMAX,
  type KartInput, type SimEvent, type World,
} from './sim'
import { offsetAt, pointAt, TRACK_IDS } from './tracks'

const racers = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', char: 'chomp' as const },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', char: 'pete' as const },
  { id: 'torii', name: 'Torii', color: '#B67CFF', char: 'ibby' as const },
]
const bots = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i}`, color: '#888888', bot: true }))

/** Autopilot input for one kart (the QA steering, full gas). */
const auto = (w: World, id: string, extra: Partial<KartInput> = {}): KartInput => {
  const k = w.karts.find((x) => x.id === id)!
  return { s: Math.round(autoSteer(w, k) * 10) / 10, g: 1, b: 0, f: 0, ...extra }
}

/** Drive every non-bot kart with the autopilot for up to `secs`, collecting events. */
function drive(w: World, secs: number, extra?: (w: World, i: number) => Partial<Record<string, KartInput>>) {
  const events: SimEvent[] = []
  const steps = Math.round(secs * 60)
  for (let i = 0; i < steps; i++) {
    const inputs: Record<string, KartInput> = {}
    for (const k of w.karts) if (!k.bot) inputs[k.id] = auto(w, k.id)
    Object.assign(inputs, extra?.(w, i) ?? {})
    events.push(...step(w, inputs))
    if (w.karts.every((k) => k.finished)) break
  }
  return events
}

const lapsOf = (ev: SimEvent[], id: string) => ev.filter((e): e is Extract<SimEvent, { t: 'lap' }> => e.t === 'lap' && e.id === id)

describe('lap times on Rush Hour (25-40 s per lap, headless bot race)', () => {
  const report: string[] = []
  for (const id of TRACK_IDS) {
    it(`${id}: three bots race three laps; average lap 25-40 s`, () => {
      const w = makeWorld({ trackId: id, laps: 3, racers: bots(3), seed: 11, speed: 'rush' })
      const ev = drive(w, 240)
      const times: number[] = []
      for (const k of w.karts) {
        const laps = lapsOf(ev, k.id)
        expect(laps.length).toBe(3)
        for (let i = 1; i < laps.length; i++) times.push(laps[i].time - laps[i - 1].time)
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      const best = Math.min(...times)
      // A clean human autopilot lap, for comparison.
      const solo = makeWorld({ trackId: id, laps: 2, racers: racers.slice(0, 1), seed: 3, items: false })
      const sev = drive(solo, 120)
      const sl = lapsOf(sev, 'dixxx')
      const clean = sl[1].time - sl[0].time
      report.push(`${id}: L=${Math.round(w.track.L)} world=${w.track.w}x${w.track.h} bots avg=${(avg / 1000).toFixed(1)}s best=${(best / 1000).toFixed(1)}s autopilot=${(clean / 1000).toFixed(1)}s props=${w.track.props.length}`)
      console.log(report[report.length - 1])
      expect(avg).toBeGreaterThan(25_000)
      expect(avg).toBeLessThan(40_000)
      expect(clean).toBeGreaterThan(minLapMs(id))
      expect(clean).toBeGreaterThan(22_000)
    })
  }
})

describe('laps', () => {
  it('reversing back and forth over the line never adds a lap', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 1), seed: 1 })
    const k = w.karts[0]
    const ev: SimEvent[] = []
    for (let i = 0; i < 40; i++) {
      const s = i % 2 === 0 ? 20 : -20
      const p = offsetAt(w.track, s, 0)
      k.x = p.x
      k.y = p.y
      trackKart(w, k, 1 / 60, ev)
    }
    expect(ev.filter((e) => e.t === 'lap').length).toBeLessThanOrEqual(1)
    expect(k.laps).toBeLessThanOrEqual(1)
  })

  it('cutting across the infield does not skip track', () => {
    const w = makeWorld({ trackId: 'pier', laps: 3, racers: racers.slice(0, 1), seed: 1 })
    const k = w.karts[0]
    const t = w.track
    const ev: SimEvent[] = []
    // Hop from the outbound pier lane straight to the inbound lane.
    const from = pointAt(t, (t.waveAt! - 0.06) * t.L)
    const to = pointAt(t, (t.waveAt! + 0.06) * t.L)
    for (let i = 0; i <= 20; i++) {
      k.x = from.x + ((to.x - from.x) * i) / 20
      k.y = from.y + ((to.y - from.y) * i) / 20
      trackKart(w, k, 1 / 60, ev)
    }
    expect(k.prog).toBeLessThan((t.waveAt! - 0.06) * t.L + 400)
  })
})

describe('race', () => {
  it('runs three karts to a finish with ordered results and laps in order', () => {
    const w = makeWorld({ trackId: 'oval', laps: 2, racers, seed: 4, items: false })
    const ev = drive(w, 200)
    const fins = ev.filter((e): e is Extract<SimEvent, { t: 'finish' }> => e.t === 'finish')
    expect(fins.map((f) => f.place)).toEqual([1, 2, 3])
    for (const r of racers) expect(lapsOf(ev, r.id).map((l) => l.lap)).toEqual([1, 2])
    expect(raceOrder(w.karts)).toEqual(fins.map((f) => f.id))
  })

  it('is deterministic: same seed, same inputs, same race', () => {
    const run = () => {
      const w = makeWorld({ trackId: 'swamp', laps: 2, racers: [...racers.slice(0, 1), ...bots(3)], seed: 99 })
      drive(w, 40)
      return JSON.stringify(snapshot(w))
    }
    expect(run()).toBe(run())
  })
})

describe('mini-turbo', () => {
  it('drift charge picks a tier: blue, orange, pink', () => {
    expect(mtTier(0)).toBe(0)
    expect(mtTier(MT_TIERS[0])).toBe(1)
    expect(mtTier(MT_TIERS[1])).toBe(2)
    expect(mtTier(MT_TIERS[2] + 0.1)).toBe(3)
  })

  it('a long drift releases a longer boost than a short one', () => {
    const boostAfter = (holdSecs: number) => {
      const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 1), seed: 2, items: false })
      const k = w.karts[0]
      // Get up to speed.
      drive(w, 3)
      const ev: SimEvent[] = []
      for (let i = 0; i < holdSecs * 60; i++) {
        k.x = pointAt(w.track, k.s).x // stay on the road, it's a test
        k.y = pointAt(w.track, k.s).y
        ev.push(...step(w, { dixxx: { s: 1, g: 1, b: 1, f: 0 } }))
      }
      ev.push(...step(w, { dixxx: { s: 0, g: 1, b: 0, f: 0 } }))
      const b = ev.filter((e): e is Extract<SimEvent, { t: 'boost' }> => e.t === 'boost' && e.why === 'mt')
      return { tier: b[b.length - 1]?.tier ?? 0, boost: k.boost }
    }
    const short = boostAfter(0.3)
    const mid = boostAfter(1.4)
    const long = boostAfter(3.2)
    expect(short.tier).toBe(0)
    expect(mid.tier).toBeGreaterThanOrEqual(1)
    expect(long.tier).toBe(3)
    expect(long.boost).toBeGreaterThan(mid.boost)
    expect(long.boost).toBeCloseTo(MT_BOOST[2], 1)
  })
})

describe('rocket start', () => {
  function start(pressAtMsBeforeGo: number | null, gas: 'auto' | 'hold' = 'auto') {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 1), seed: 2, gas })
    for (let toGo = 3000; toGo > 0; toGo -= 50) {
      const down = pressAtMsBeforeGo !== null && toGo <= pressAtMsBeforeGo
      const inp: KartInput = gas === 'hold' ? { s: 0, g: down ? 1 : 0, b: 0, f: 0 } : { s: 0, g: 1, b: down ? 1 : 0, f: 0 }
      prestep(w, { dixxx: inp }, toGo)
    }
    const inp: KartInput = gas === 'hold' ? { s: 0, g: 1, b: 0, f: 0 } : { s: 0, g: 1, b: pressAtMsBeforeGo === null ? 0 : 1, f: 0 }
    const ev = step(w, { dixxx: inp })
    return { w, ev: ev.filter((e) => e.t === 'rocket') as Extract<SimEvent, { t: 'rocket' }>[] }
  }
  it('pressed inside the window: boost', () => {
    const { w, ev } = start(ROCKET_WINDOW_MS - 150)
    expect(ev).toEqual([{ t: 'rocket', id: 'dixxx', ok: true }])
    expect(w.karts[0].boost).toBeGreaterThan(0.5)
    expect(w.karts[0].rockets).toBe(1)
  })
  it('pressed too early: a sputter', () => {
    const { w, ev } = start(2000)
    expect(ev).toEqual([{ t: 'rocket', id: 'dixxx', ok: false }])
    expect(w.karts[0].sputter).toBeGreaterThan(0)
    for (let i = 0; i < 30; i++) step(w, { dixxx: { s: 0, g: 1, b: 0, f: 0 } })
    expect(w.karts[0].vf).toBeLessThanOrEqual(30)
  })
  it('not pressed: nothing; hold-to-go counts the gas', () => {
    expect(start(null).ev).toEqual([])
    expect(start(300, 'hold').ev[0]?.ok).toBe(true)
  })
  it('bots time it too (mostly)', () => {
    let ok = 0
    for (let seed = 1; seed <= 20; seed++) {
      const w = makeWorld({ trackId: 'oval', laps: 3, racers: bots(3), seed })
      ok += step(w, {}).filter((e) => e.t === 'rocket' && e.ok).length
    }
    expect(ok).toBeGreaterThan(30)
  })
})

describe('slipstream, pads, coins, ramps, off-road', () => {
  it('tucked in behind someone for a while = a slipstream boost', () => {
    const w = makeWorld({ trackId: 'keys', laps: 3, racers: racers.slice(0, 2), seed: 2, items: false })
    const [a, b] = w.karts
    const ev: SimEvent[] = []
    for (let i = 0; i < 120; i++) {
      // a drives a straight line 90 ahead of b, same heading and speed.
      const p = offsetAt(w.track, b.s + 90, 0)
      a.x = p.x; a.y = p.y; a.a = b.a; a.vf = b.vf
      b.vf = Math.max(b.vf, VMAX * 0.8)
      ev.push(...step(w, { dixxx: { s: 0, g: 1, b: 0, f: 0 }, johnnyboy: auto(w, 'johnnyboy') }))
    }
    expect(ev.some((e) => e.t === 'boost' && e.why === 'slip' && e.id === 'johnnyboy')).toBe(true)
  })

  it('a boost pad boosts', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 1), seed: 2, items: false })
    const pad = w.pads[0]
    const k = w.karts[0]
    const p = offsetAt(w.track, pad.s0 - 30, pad.d)
    k.x = p.x; k.y = p.y; k.a = p.a; k.vf = VMAX * 0.8
    k.hint = pointAt(w.track, pad.s0).i
    trackKart(w, k, 1 / 60, [])
    const ev: SimEvent[] = []
    for (let i = 0; i < 30; i++) ev.push(...step(w, { dixxx: { s: 0, g: 1, b: 0, f: 0 } }))
    expect(ev.some((e) => e.t === 'boost' && e.why === 'pad')).toBe(true)
  })

  it('coins: pick up to 10, each adds top speed; a hit drops 3 that scatter', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 2), seed: 2 })
    const k = w.karts[0]
    const ev: SimEvent[] = []
    for (const c of w.coins.slice(0, 14)) {
      k.x = c.x; k.y = c.y; k.level = c.level
      ev.push(...step(w, { dixxx: { s: 0, g: 0, b: 0, f: 0 } }))
    }
    expect(k.coins).toBe(COIN_MAX)
    expect(ev.filter((e) => e.t === 'coin').length).toBeGreaterThanOrEqual(10)
    // A mango right under the kart.
    w.mangos.push({ id: 900, x: k.x, y: k.y, level: k.level, owner: 'johnnyboy', safe: 0, age: 0 })
    const ev2 = step(w, {})
    expect(ev2.some((e) => e.t === 'hit' && e.id === 'dixxx' && e.kind === 'mango' && e.by === 'johnnyboy')).toBe(true)
    expect(ev2.some((e) => e.t === 'drop' && e.n === 3)).toBe(true)
    expect(k.coins).toBe(COIN_MAX - 3)
    expect(w.coins.filter((c) => c.loose)).toHaveLength(3)
  })

  it('ramps launch karts into the air; a trick in the air = a boost on landing', () => {
    const w = makeWorld({ trackId: 'coaster', laps: 3, racers: racers.slice(0, 1), seed: 2, items: false })
    const r = w.ramps[0]
    const k = w.karts[0]
    const p = offsetAt(w.track, r.s0 - 60, 0)
    k.x = p.x; k.y = p.y; k.a = p.a; k.vf = VMAX
    k.hint = pointAt(w.track, r.s0).i
    trackKart(w, k, 1 / 60, [])
    let maxZ = 0
    let tricked = false
    const ev: SimEvent[] = []
    for (let i = 0; i < 90; i++) {
      const press = k.z > 15 && !tricked
      if (press) tricked = true
      ev.push(...step(w, { dixxx: auto(w, 'dixxx', { b: press ? 1 : 0 }) }))
      maxZ = Math.max(maxZ, k.z)
    }
    expect(maxZ).toBeGreaterThan(30)
    expect(k.z).toBe(0)
    expect(ev.some((e) => e.t === 'boost' && e.why === 'trick')).toBe(true)
    // Cleared the lazy river: never wet on the way over.
  })

  it('off-road slows you unless you are boosting', () => {
    const speedOn = (off: boolean, boost: boolean) => {
      const w = makeWorld({ trackId: 'launch', laps: 3, racers: racers.slice(0, 1), seed: 2, items: false })
      const k = w.karts[0]
      for (let i = 0; i < 240; i++) {
        const p = offsetAt(w.track, 500 + i * 3, off ? w.track.half + 60 : 0)
        k.x = p.x; k.y = p.y; k.a = p.a
        if (boost) k.boost = 1
        step(w, { dixxx: { s: 0, g: 1, b: 0, f: 0 } })
      }
      return k.vf
    }
    expect(speedOn(true, false)).toBeLessThan(speedOn(false, false) * 0.65)
    expect(speedOn(true, true)).toBeGreaterThan(VMAX * BOOST_MUL * 0.9)
  })
})

describe('items', () => {
  const withItem = (item: (typeof ITEM_KINDS)[number], trackId = 'oval') => {
    const w = makeWorld({ trackId, laps: 3, racers, seed: 4 })
    drive(w, 2)
    const k = w.karts[0]
    k.item = item
    k.uses = item === 'cafecito3' ? 3 : 0
    return { w, k }
  }
  const fire = (w: World, n: number) => step(w, { dixxx: auto(w, 'dixxx', { f: n }), johnnyboy: auto(w, 'johnnyboy'), torii: auto(w, 'torii') })

  it('item boxes spin a roulette first, then the item is usable', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers, seed: 4 })
    const k = w.karts[0]
    const box = w.boxes[0]
    k.x = box.x; k.y = box.y; k.level = box.level
    const ev = step(w, {})
    expect(ev.some((e) => e.t === 'roll' && e.id === 'dixxx')).toBe(true)
    expect(k.item).not.toBeNull()
    expect(k.rolling).toBeGreaterThan(1)
    const item = k.item
    step(w, { dixxx: { s: 0, g: 0, b: 0, f: 0 } })
    step(w, { dixxx: { s: 0, g: 0, b: 0, f: 1 } })
    expect(k.item).toBe(item) // still spinning: the press did nothing
    let picked: SimEvent | undefined
    for (let i = 0; i < 100 && !picked; i++) picked = step(w, { dixxx: { s: 0, g: 0, b: 0, f: 1 } }).find((e) => e.t === 'pickup')
    expect(picked).toEqual({ t: 'pickup', id: 'dixxx', item })
  })

  it('one use per press; a counter reset does not fire; Triple Cafecito lasts three presses', () => {
    const { w, k } = withItem('cafecito3')
    fire(w, 0)
    fire(w, 1)
    expect(k.item).toBe('cafecito3')
    expect(k.uses).toBe(2)
    fire(w, 0) // counter reset: syncs, no use
    expect(k.uses).toBe(2)
    fire(w, 1)
    fire(w, 2)
    expect(k.item).toBeNull()
    expect(k.boost).toBeGreaterThan(1)
  })

  it('a floatie eats one hit, the next one lands', () => {
    const { w, k } = withItem('floatie')
    fire(w, 0)
    fire(w, 1)
    expect(k.shield).toBeGreaterThan(5)
    const drop = () => w.mangos.push({ id: w.nextId++, x: k.x, y: k.y, level: k.level, owner: 'torii', safe: 0, age: 0 })
    drop()
    const ev = step(w, {})
    expect(ev.some((e) => e.t === 'block' && e.id === 'dixxx')).toBe(true)
    for (let i = 0; i < 50; i++) step(w, {})
    drop()
    expect(step(w, {}).some((e) => e.t === 'hit' && e.id === 'dixxx')).toBe(true)
  })

  it('a coconut flies straight, bounces off the road edge at most twice', () => {
    const { w, k } = withItem('coconut', 'keys')
    fire(w, 0)
    fire(w, 1)
    const c = w.coconuts[0]
    expect(c).toBeTruthy()
    let maxB = 0
    for (let i = 0; i < 300 && w.coconuts.length; i++) {
      step(w, {})
      if (w.coconuts[0]) maxB = Math.max(maxB, w.coconuts[0].bounces)
    }
    expect(maxB).toBeLessThanOrEqual(2)
    expect(w.coconuts).toHaveLength(0)
    expect(k.item).toBeNull()
  })

  it('a pelican homes on the kart one place ahead', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers, seed: 4, items: false })
    drive(w, 1)
    // Spread them out: torii last, johnnyboy 500 ahead, dixxx way out front.
    const put = (id: string, s: number) => {
      const k = w.karts.find((x) => x.id === id)!
      const p = offsetAt(w.track, s, 0)
      k.x = p.x; k.y = p.y; k.a = p.a; k.prog = s; k.s = s; k.hint = pointAt(w.track, s).i
    }
    put('torii', 1000); put('johnnyboy', 1500); put('dixxx', 3500)
    w.order = ['dixxx', 'johnnyboy', 'torii']
    const last = w.karts.find((k) => k.id === 'torii')!
    const target = 'johnnyboy'
    last.item = 'pelican'
    const inp = (f: number) => Object.fromEntries(w.karts.map((k) => [k.id, auto(w, k.id, k === last ? { f } : {})]))
    step(w, inp(0))
    const ev = step(w, inp(1))
    expect(ev.some((e) => e.t === 'use' && e.item === 'pelican')).toBe(true)
    if (w.pelicans[0]) expect(w.pelicans[0].target).toBe(target)
    let hitEv: SimEvent | undefined = ev.find((e) => e.t === 'hit')
    for (let i = 0; i < 400 && !hitEv; i++) hitEv = step(w, inp(1)).find((e) => e.t === 'hit')
    expect(hitEv).toMatchObject({ t: 'hit', id: target, by: last.id, kind: 'pelican' })
  })

  it('love bugs splat everyone ahead; storm spins and shrinks everyone else', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers, seed: 4 })
    drive(w, 6)
    const last = w.karts.find((k) => k.id === w.order[2])!
    last.item = 'lovebugs'
    const inp = (f: number) => Object.fromEntries(w.karts.map((k) => [k.id, auto(w, k.id, k === last ? { f } : {})]))
    step(w, inp(0))
    const ev = step(w, inp(1))
    const bugs = ev.find((e) => e.t === 'bugs') as Extract<SimEvent, { t: 'bugs' }>
    expect(bugs.ids.sort()).toEqual(w.order.slice(0, 2).sort())
    expect(last.bugs).toBe(0)
    last.item = 'storm'
    const ev2 = step(w, inp(2))
    expect(ev2.some((e) => e.t === 'storm')).toBe(true)
    for (const k of w.karts) {
      if (k === last) expect(k.small).toBe(0)
      else { expect(k.small).toBeGreaterThan(2); expect(k.spin).toBeGreaterThan(0) }
    }
  })

  it('a hurricane flies to the leader and hits them', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers, seed: 4 })
    drive(w, 6)
    const last = w.karts.find((k) => k.id === w.order[2])!
    const lead = w.order[0]
    last.item = 'hurricane'
    const inp = (f: number) => Object.fromEntries(w.karts.map((k) => [k.id, auto(w, k.id, k === last ? { f } : {})]))
    step(w, inp(0))
    step(w, inp(1))
    let ev: SimEvent | undefined
    for (let i = 0; i < 600 && !ev; i++) ev = step(w, inp(1)).find((e) => e.t === 'hit' && e.kind === 'hurricane')
    expect(ev).toMatchObject({ id: lead, by: last.id })
    expect(w.shake).toBeGreaterThan(0.5)
  })

  it('distribution by place: leaders get defense, storms and hurricanes only at the back', () => {
    const count = (place: number, n: number) => {
      const c: Record<string, number> = {}
      for (let i = 0; i < 1000; i++) {
        const it2 = rollItem(place, n, i / 1000)
        c[it2] = (c[it2] ?? 0) + 1
      }
      return c
    }
    const lead = count(1, 6)
    expect((lead.mango ?? 0) + (lead.coconut ?? 0) + (lead.floatie ?? 0)).toBeGreaterThan(900)
    expect(lead.storm ?? 0).toBe(0)
    expect(lead.hurricane ?? 0).toBe(0)
    expect(count(3, 6).storm ?? 0).toBe(0)
    const back = count(6, 6)
    expect(back.storm).toBeGreaterThan(20)
    expect(back.hurricane).toBeGreaterThan(20)
    expect((back.cafecito3 ?? 0) + (back.pelican ?? 0)).toBeGreaterThan(300)
    expect(itemBucket(1, 1)).toBe('mid')
    for (const t of Object.values(ITEM_TABLES)) for (const [k] of t) expect(ITEM_KINDS).toContain(k)
    expect(ITEM_KINDS).toContain(rollItem(2, 3, NaN))
  })
})

describe('hazards', () => {
  it('the gator lunges and spins karts in its path', () => {
    const w = makeWorld({ trackId: 'swamp', laps: 3, racers: racers.slice(0, 1), seed: 5 })
    const lair = w.track.gator!
    const k = w.karts[0]
    w.gator!.next = 0.01
    const ev: SimEvent[] = []
    for (let i = 0; i < 160; i++) {
      k.x = lair.x + (lair.tx - lair.x) * 0.8
      k.y = lair.y + (lair.ty - lair.y) * 0.8
      k.vf = 0
      ev.push(...step(w, {}))
    }
    expect(ev.some((e) => e.t === 'gator')).toBe(true)
    expect(ev.some((e) => e.t === 'hit' && e.kind === 'gator')).toBe(true)
  })

  it('Keys wind: telegraphed, then shoves karts sideways', () => {
    const w = makeWorld({ trackId: 'keys', laps: 3, racers: racers.slice(0, 1), seed: 5, items: false })
    w.gust!.next = 0.05
    const ev: SimEvent[] = []
    let sawWarn = false
    let maxWind = 0
    for (let i = 0; i < 60 * 5; i++) {
      ev.push(...step(w, { dixxx: auto(w, 'dixxx') }))
      if (w.gust!.phase === 'warn') sawWarn = true
      maxWind = Math.max(maxWind, Math.abs(turnpikeScene(w).wind))
    }
    expect(ev.some((e) => e.t === 'gust')).toBe(true)
    expect(sawWarn).toBe(true)
    expect(maxWind).toBeGreaterThan(0.9)
    // The push itself.
    const w2 = makeWorld({ trackId: 'keys', laps: 3, racers: racers.slice(0, 1), seed: 5, items: false })
    w2.gust!.phase = 'gust'; w2.gust!.t = 1.3; w2.gust!.dir = 1; w2.gust!.v = 1
    const y0 = w2.karts[0].y
    step(w2, {})
    expect(w2.karts[0].y).toBeGreaterThan(y0)
  })

  it('Launch Pad: the rocket goes up once someone starts lap 2, shakes, smoke slows', () => {
    const w = makeWorld({ trackId: 'launch', laps: 3, racers: racers.slice(0, 1), seed: 5, items: false })
    expect(turnpikeScene(w).rocket).toBe(0)
    w.karts[0].laps = 1
    const ev = step(w, {})
    expect(ev.some((e) => e.t === 'liftoff')).toBe(true)
    for (let i = 0; i < 120; i++) step(w, {})
    const sc = turnpikeScene(w)
    expect(sc.rocket).toBeGreaterThan(0.1)
    expect(sc.smoke).toBeGreaterThan(0.5)
    expect(w.shake).toBeGreaterThan(0)
  })

  it('I-4 barrels move lanes when the leader starts a new lap, and karts bump off them', () => {
    const w = makeWorld({ trackId: 'night', laps: 3, racers: racers.slice(0, 1), seed: 5, items: false })
    expect(w.barrels.every((r) => r.lanes.length === 2)).toBe(true)
    const before = JSON.stringify(w.barrels)
    let moved = false
    for (let lap = 1; lap <= 4 && !moved; lap++) {
      w.karts[0].laps = lap
      const ev = step(w, {})
      expect(ev.some((e) => e.t === 'barrels')).toBe(true)
      moved = JSON.stringify(w.barrels) !== before
    }
    expect(moved).toBe(true)
    const row = w.barrels[0]
    const p = offsetAt(w.track, row.at * w.track.L - 40, row.lanes[0] * w.track.half)
    const k = w.karts[0]
    k.x = p.x; k.y = p.y; k.a = p.a; k.vf = VMAX
    k.hint = pointAt(w.track, row.at * w.track.L).i
    trackKart(w, k, 1 / 60, [])
    const ev: SimEvent[] = []
    for (let i = 0; i < 30; i++) ev.push(...step(w, { dixxx: { s: 0, g: 1, b: 0, f: 0 } }))
    expect(ev.some((e) => e.t === 'bump')).toBe(true)
  })

  it('Pier waves: telegraphed, then they splash the end of the pier', () => {
    const w = makeWorld({ trackId: 'pier', laps: 3, racers: racers.slice(0, 1), seed: 5, items: false })
    const k = w.karts[0]
    const at = w.track.waveAt! * w.track.L
    w.wave!.next = 0.05
    let warned = 0
    const ev: SimEvent[] = []
    for (let i = 0; i < 160; i++) {
      const p = offsetAt(w.track, at, 0)
      k.x = p.x; k.y = p.y; k.vf = 0
      k.hint = pointAt(w.track, at).i
      ev.push(...step(w, {}))
      const wv = turnpikeScene(w).wave
      if (wv > 0 && wv < 1) warned++
    }
    expect(warned).toBeGreaterThan(30)
    expect(ev.some((e) => e.t === 'wave')).toBe(true)
    expect(ev.some((e) => e.t === 'hit' && e.kind === 'wave')).toBe(true)
  })
})

describe('AI karts', () => {
  it('drive themselves around and finish', () => {
    const w = makeWorld({ trackId: 'eight', laps: 2, racers: bots(4), seed: 8 })
    const ev = drive(w, 150)
    expect(ev.filter((e) => e.t === 'finish')).toHaveLength(4)
  })

  it('use items with intent: a mango goes down when someone is right behind', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: [racers[0], ...bots(1)], seed: 8, items: false })
    drive(w, 4)
    const bot = w.karts[1]
    const me = w.karts[0]
    // Put the human right behind the bot, then hand the bot a mango.
    const p = offsetAt(w.track, bot.s - 90, 0)
    me.x = p.x; me.y = p.y; me.prog = bot.prog - 90
    me.hint = pointAt(w.track, bot.s - 90).i
    bot.item = 'mango'
    let used = false
    for (let i = 0; i < 90 && !used; i++) {
      used = step(w, { dixxx: auto(w, 'dixxx') }).some((e) => e.t === 'use' && e.id === bot.id && e.item === 'mango')
      const q = offsetAt(w.track, bot.s - 90, 0)
      me.x = q.x; me.y = q.y
    }
    expect(used).toBe(true)
  })

  it('hold a floatie while leading, until something is coming', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: [racers[0], ...bots(1)], seed: 8, items: false })
    const bot = w.karts[1]
    drive(w, 3)
    bot.prog = w.karts[0].prog + 300
    w.order = [bot.id, 'dixxx']
    bot.item = 'floatie'
    for (let i = 0; i < 300; i++) {
      step(w, { dixxx: auto(w, 'dixxx') })
      bot.prog = Math.max(bot.prog, w.karts[0].prog + 300)
    }
    expect(bot.item).toBe('floatie')
    w.coconuts.push({ id: 77, x: bot.x - 60, y: bot.y, vx: 0, vy: 0, hint: bot.hint, level: bot.level, owner: 'dixxx', age: 1, bounces: 0 })
    step(w, { dixxx: auto(w, 'dixxx') })
    step(w, { dixxx: auto(w, 'dixxx') })
    expect(bot.item).toBeNull()
  })

  it('rubber band: a bot far ahead of the best human eases off, one far behind pushes', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: [racers[0], ...bots(2)], seed: 8 })
    const [me, a, b] = w.karts
    me.prog = 2000
    a.prog = 5000
    b.prog = 0
    expect(botCap(w, a)).toBeLessThan(botCap(w, b))
    // No humans racing: no band.
    const w2 = makeWorld({ trackId: 'oval', laps: 3, racers: bots(2), seed: 8 })
    w2.karts[0].prog = 5000
    expect(botCap(w2, w2.karts[0])).toBeCloseTo(0.78 + 0.14 * w2.brains[w2.karts[0].id].skill, 5)
  })

  it('speed class scales top speed and bot skill', () => {
    const s = makeWorld({ trackId: 'oval', laps: 3, racers: bots(4), seed: 8, speed: 'sunday' })
    const f = makeWorld({ trackId: 'oval', laps: 3, racers: bots(4), seed: 8, speed: 'florida' })
    expect(s.vmax).toBeLessThan(f.vmax)
    const avg = (w: World) => Object.values(w.brains).reduce((a, b) => a + b.skill, 0) / 4
    expect(avg(s)).toBeLessThan(avg(f))
  })
})

describe('scene and snapshots', () => {
  it('turnpikeScene carries the contract extras', () => {
    const w = makeWorld({ trackId: 'swamp', laps: 3, racers, seed: 2 })
    drive(w, 3)
    const sc = turnpikeScene(w)
    expect(Object.keys(sc.fx)).toEqual(racers.map((r) => r.id))
    expect(sc.fx.dixxx.char).toBe('chomp')
    expect(sc.fx.dixxx.place).toBeGreaterThanOrEqual(1)
    expect(sc.order).toHaveLength(3)
    expect(sc.laps).toBe(3)
    expect(sc.things.some((t) => t.kind === 'box')).toBe(true)
    expect(sc.things.some((t) => t.kind === 'coin')).toBe(true)
    expect(sc.things.some((t) => t.kind === 'pad')).toBe(true)
    expect(sc.karts).toHaveLength(3)
  })

  it('snapshots are compact, rounded and small', () => {
    const six = [...racers, ...bots(3)]
    const w = makeWorld({ trackId: 'night', laps: 3, racers: six, seed: 2 })
    drive(w, 20)
    const snap = snapshot(w)
    for (const row of snap.k) for (const v of row) expect(Number.isInteger(v)).toBe(true)
    const bytes = JSON.stringify(snap).length
    console.log(`kart:pos snapshot, 6 karts on night after 20 s: ${bytes} bytes`)
    expect(bytes).toBeLessThan(900)
  })
})
