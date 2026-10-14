import { describe, expect, it } from 'vitest'
import {
  autoSteer, ITEM_TABLES, itemBucket, makeWorld, minLapMs, raceOrder, rollItem, snapshot, step, trackKart,
  type KartInput, type SimEvent, type World,
} from './sim'
import { getTrack, offsetAt, TRACK_IDS } from './tracks'

const racers = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72' },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF' },
  { id: 'torii', name: 'Torii', color: '#B67CFF' },
]

/** Drive every kart with the autopilot for up to `secs`, collecting events. */
function drive(w: World, secs: number, extra?: (w: World, t: number) => Partial<Record<string, KartInput>>) {
  const events: SimEvent[] = []
  const steps = Math.round(secs * 60)
  for (let i = 0; i < steps; i++) {
    const inputs: Record<string, KartInput> = {}
    for (const k of w.karts) inputs[k.id] = { s: Math.round(autoSteer(w, k) * 10) / 10, g: 1, b: 0, f: 0 }
    Object.assign(inputs, extra?.(w, i) ?? {})
    events.push(...step(w, inputs))
    if (w.karts.every((k) => k.finished)) break
  }
  return events
}

describe('laps', () => {
  for (const id of TRACK_IDS) {
    it(`${id}: an autopilot kart laps in a sane time`, () => {
      const w = makeWorld({ trackId: id, laps: 2, racers: racers.slice(0, 1), seed: 7, items: false })
      const ev = drive(w, 120)
      const laps = ev.filter((e) => e.t === 'lap')
      expect(laps.map((e) => (e as { lap: number }).lap)).toEqual([1, 2])
      const fin = ev.find((e) => e.t === 'finish') as { time: number } | undefined
      expect(fin).toBeTruthy()
      const lap2 = (laps[1] as { time: number }).time - (laps[0] as { time: number }).time
      console.log(`${id}: L=${Math.round(getTrack(id).L)} lap1=${(laps[0] as { time: number }).time}ms lap2=${lap2}ms min=${minLapMs(id)}`)
      expect(lap2).toBeGreaterThan(minLapMs(id))
      expect(lap2).toBeLessThan(40_000)
    })
  }

  it('reversing back and forth over the line never adds a lap', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 1), seed: 1, items: false })
    const k = w.karts[0]
    const t = w.track
    const ev: SimEvent[] = []
    // Teleport-free wiggle across s = 0: from 80 behind to 80 ahead and back, 10 times.
    for (let n = 0; n < 10; n++) {
      for (let s = -80; s <= 80; s += 4) { const p = offsetAt(t, s, 0); k.x = p.x; k.y = p.y; trackKart(w, k, 1 / 60, ev) }
      for (let s = 80; s >= -80; s -= 4) { const p = offsetAt(t, s, 0); k.x = p.x; k.y = p.y; trackKart(w, k, 1 / 60, ev) }
    }
    expect(ev.filter((e) => e.t === 'lap')).toHaveLength(0)
    expect(k.laps).toBe(0)
    // Driving the wrong way round a whole lap doesn't count either.
    for (let s = -80; s >= -t.L - 200; s -= 4) { const p = offsetAt(t, s, 0); k.x = p.x; k.y = p.y; trackKart(w, k, 1 / 60, ev) }
    expect(ev.filter((e) => e.t === 'lap')).toHaveLength(0)
    expect(k.prog).toBeLessThan(-t.L)
    // ...and digs a hole: one real lap forward from there is still not a lap.
    for (let s = -t.L - 200; s <= -80; s += 4) { const p = offsetAt(t, s, 0); k.x = p.x; k.y = p.y; trackKart(w, k, 1 / 60, ev) }
    expect(k.laps).toBe(0)
    // Then a clean lap forward counts exactly once.
    for (let s = -80; s <= t.L + 40; s += 4) { const p = offsetAt(t, s, 0); k.x = p.x; k.y = p.y; trackKart(w, k, 1 / 60, ev) }
    expect(ev.filter((e) => e.t === 'lap')).toHaveLength(1)
    expect(k.laps).toBe(1)
  })

  it('cutting across the infield does not skip track', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 1), seed: 1, items: false })
    const k = w.karts[0]
    const ev: SimEvent[] = []
    // Bottom straight to top straight straight through the middle, at kart speed.
    const from = { x: 850, y: 690 }
    const to = { x: 850, y: 270 }
    const n = 120
    for (let i = 0; i <= n; i++) {
      k.x = from.x + ((to.x - from.x) * i) / n
      k.y = from.y + ((to.y - from.y) * i) / n
      trackKart(w, k, 1 / 60, ev)
    }
    // Half a lap of centerline is ~1300 units; the cut may only bank what a kart could drive.
    expect(k.prog).toBeLessThan(700)
  })
})

describe('race', () => {
  it('runs three karts to a finish with ordered results and laps in order', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers, seed: 42 })
    const ev = drive(w, 240)
    const fins = ev.filter((e) => e.t === 'finish') as { id: string; time: number; place: number }[]
    expect(fins).toHaveLength(3)
    expect(fins.map((f) => f.place)).toEqual([1, 2, 3])
    for (const r of racers) {
      const laps = ev.filter((e) => e.t === 'lap' && e.id === r.id).map((e) => (e as { lap: number }).lap)
      expect(laps).toEqual([1, 2, 3])
    }
    expect(raceOrder(w.karts)).toEqual(fins.map((f) => f.id))
    // Items happened.
    expect(ev.some((e) => e.t === 'pickup')).toBe(true)
  })

  it('a fired item is used once per press, and a counter reset does not fire', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 2), seed: 3 })
    const k = w.karts[1]
    k.item = 'boost'
    const base = { s: 0, g: 1 as const, b: 0 as const }
    step(w, { [k.id]: { ...base, f: 5 } }) // first message syncs the counter
    expect(k.item).toBe('boost')
    step(w, { [k.id]: { ...base, f: 6 } })
    expect(k.item).toBeNull()
    expect(k.boost).toBeGreaterThan(1)
    k.item = 'shield'
    step(w, { [k.id]: { ...base, f: 6 } })
    step(w, { [k.id]: { ...base, f: 0 } }) // phone reloaded: counter reset
    expect(k.item).toBe('shield')
    step(w, { [k.id]: { ...base, f: 1 } })
    expect(k.item).toBeNull()
    expect(k.shield).toBeGreaterThan(10)
  })

  it('a shield eats one peel, the next peel spins you', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: racers.slice(0, 2), seed: 3 })
    const k = w.karts[0]
    k.shield = 5
    const ev: SimEvent[] = []
    w.peels.push({ id: 1, x: k.x, y: k.y, level: 0, owner: 'johnnyboy', safe: 0, age: 0 })
    ev.push(...step(w, {}))
    expect(ev.some((e) => e.t === 'block' && e.id === k.id)).toBe(true)
    expect(k.spin).toBe(0)
    k.invuln = 0
    w.peels.push({ id: 2, x: k.x, y: k.y, level: 0, owner: 'johnnyboy', safe: 0, age: 0 })
    ev.push(...step(w, {}))
    expect(ev.some((e) => e.t === 'hit' && e.id === k.id && e.kind === 'peel')).toBe(true)
    expect(k.spin).toBeGreaterThan(0)
    expect(w.karts[1].hits).toBe(1)
  })

  it('karts on the bridge pass right over karts in the tunnel', () => {
    const w = makeWorld({ trackId: 'eight', laps: 3, racers: racers.slice(0, 2), seed: 3, items: false })
    const t = w.track
    const [a, b] = w.karts
    const overI = t.level.indexOf(2) + 15
    const underI = t.level.indexOf(1) + 8
    // Put both right at the crossing, each on its own branch.
    const c = t.crossing!
    a.x = c.x; a.y = c.y; a.hint = overI
    b.x = c.x; b.y = c.y + 1; b.hint = underI
    trackKart(w, a, 1 / 60, [])
    trackKart(w, b, 1 / 60, [])
    expect(a.level).toBe(2)
    expect(b.level).toBe(1)
    step(w, {})
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(10)
    // Same spot, same level: they bump apart.
    b.hint = overI
    trackKart(w, b, 1 / 60, [])
    expect(b.level).toBe(2)
    step(w, {})
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20)
  })

  it('the gator lunges and spins karts in its path', () => {
    const w = makeWorld({ trackId: 'swamp', laps: 3, racers: racers.slice(0, 1), seed: 9, items: false })
    const k = w.karts[0]
    const g = w.track.gator!
    let hit = false
    for (let i = 0; i < 60 * 30 && !hit; i++) {
      k.x = g.tx; k.y = g.ty; k.vf = 0; k.vl = 0; k.invuln = 0
      const ev = step(w, {})
      hit = ev.some((e) => e.t === 'hit' && e.kind === 'gator')
    }
    expect(hit).toBe(true)
  })

  it('a walled solo trial keeps a kart that never steers inside the track box', () => {
    const w = makeWorld({ trackId: 'eight', laps: 1, racers: racers.slice(0, 1), seed: 2, items: false, walled: true })
    const k = w.karts[0]
    for (let i = 0; i < 60 * 20; i++) {
      step(w, { [k.id]: { s: 0, g: 1, b: 0, f: 0 } })
      expect(k.x).toBeGreaterThanOrEqual(w.bounds.x0)
      expect(k.x).toBeLessThanOrEqual(w.bounds.x1)
      expect(k.y).toBeGreaterThanOrEqual(w.bounds.y0)
      expect(k.y).toBeLessThanOrEqual(w.bounds.y1)
    }
    expect(w.bounds.x0).toBeGreaterThan(0)
  })

  it('snapshots are compact and rounded', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers, seed: 3 })
    drive(w, 2)
    const snap = snapshot(w)
    expect(snap.k).toHaveLength(3)
    for (const row of snap.k) for (const v of row) expect(Number.isInteger(v)).toBe(true)
    expect(JSON.stringify(snap).length).toBeLessThan(400)
  })
})

describe('items by position', () => {
  const sweep = (place: number, n: number) => {
    const counts: Record<string, number> = { boost: 0, peel: 0, missile: 0, shield: 0 }
    for (let i = 0; i < 1000; i++) counts[rollItem(place, n, i / 1000)] += 1
    return counts
  }

  it('the leader mostly peels and never gets a missile', () => {
    for (const n of [2, 3, 6]) {
      const c = sweep(1, n)
      expect(c.missile).toBe(0)
      expect(c.peel).toBeGreaterThanOrEqual(650)
    }
  })

  it('the back of the pack gets the good stuff', () => {
    const last = sweep(3, 3)
    const lead = sweep(1, 3)
    expect(last.missile + last.boost).toBeGreaterThanOrEqual(750)
    expect(last.peel).toBeLessThanOrEqual(60)
    expect(last.missile).toBeGreaterThan(lead.missile)
    expect(sweep(6, 6).missile).toBeGreaterThan(sweep(2, 6).missile)
  })

  it('buckets by position, and a solo racer gets the middle table', () => {
    expect(itemBucket(1, 1)).toBe('mid')
    expect(itemBucket(1, 3)).toBe('leader')
    expect(itemBucket(2, 3)).toBe('mid')
    expect(itemBucket(3, 3)).toBe('back')
    expect(itemBucket(2, 6)).toBe('front')
    expect(itemBucket(6, 6)).toBe('back')
    for (const table of Object.values(ITEM_TABLES)) expect(table.reduce((a, [, w]) => a + w, 0)).toBe(100)
  })

  it('handles junk rolls', () => {
    expect(['boost', 'peel', 'missile', 'shield']).toContain(rollItem(2, 3, 1.5))
    expect(['boost', 'peel', 'missile', 'shield']).toContain(rollItem(2, 3, -1))
    expect(['boost', 'peel', 'missile', 'shield']).toContain(rollItem(0, 0, NaN))
  })
})
