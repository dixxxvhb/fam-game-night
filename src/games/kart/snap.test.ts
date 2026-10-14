import { describe, expect, it } from 'vitest'
import { autoSteer, makeWorld, snapshot, step, turnpikeScene, type KartInput, type World } from './sim'
import { decodeSnapshot, hudOf, interpolate, isSnapshot, SnapBuffer, type Roster } from './snap'
import { TRACK_IDS } from './tracks'

const six = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', char: 'chomp' as const },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', char: 'pete' as const },
  { id: 'torii', name: 'Torii', color: '#B67CFF', char: 'ibby' as const },
  { id: 'b1', name: 'Gator', color: '#888', char: 'zippy' as const, bot: true },
  { id: 'b2', name: 'Pigeon', color: '#999', char: 'dillo' as const, bot: true },
  { id: 'b3', name: 'Nana', color: '#aaa', char: 'shelly' as const, bot: true },
]
const roster: Roster = six.map((r) => ({ id: r.id, name: r.name, color: r.color, char: r.char }))

function run(w: World, secs: number, each?: (w: World) => void) {
  for (let i = 0; i < secs * 60; i++) {
    const inp: Record<string, KartInput> = {}
    for (const k of w.karts) if (!k.bot) inp[k.id] = { s: Math.round(autoSteer(w, k) * 10) / 10, g: 1, b: 0, f: i % 90 === 0 ? i / 90 : Math.floor(i / 90) }
    step(w, inp)
    each?.(w)
  }
}

describe('kart:pos snapshots', () => {
  it('decode to the same scene the host draws (within rounding)', () => {
    for (const id of TRACK_IDS) {
      const w = makeWorld({ trackId: id, laps: 3, racers: six, seed: 7 })
      run(w, 12)
      const host = turnpikeScene(w)
      const remote = decodeSnapshot(w.track, roster, snapshot(w), w.laps)
      expect(remote.order).toEqual(host.order)
      expect(remote.laps).toBe(3)
      for (const k of host.karts) {
        const r = remote.karts.find((x) => x.id === k.id)!
        expect(Math.abs(r.x - k.x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(r.y - k.y)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(r.a - k.a)).toBeLessThanOrEqual(0.006)
        expect(r.level).toBe(k.level)
        expect(r.spin).toBe(k.spin)
        expect(r.boost).toBe(k.boost)
        const hf = host.fx[k.id]
        const rf = remote.fx[k.id]
        expect(rf.char).toBe(hf.char)
        expect(rf.place).toBe(hf.place)
        expect(rf.lap).toBe(hf.lap)
        expect(rf.coins).toBe(hf.coins)
        expect(rf.item).toBe(hf.item)
        expect(rf.rolling).toBe(hf.rolling)
        expect(rf.mt).toBe(hf.mt)
        expect(rf.finished).toBe(hf.finished)
        expect(Math.abs(rf.z - hf.z)).toBeLessThanOrEqual(0.5)
      }
      const count = (sc: typeof host, kind: string) => sc.things.filter((t) => t.kind === kind && t.on !== false).length
      for (const kind of ['box', 'coin', 'mango', 'coconut', 'pelican', 'hurricane', 'pad', 'ramp', 'barrel']) {
        expect(count(remote, kind), `${id} ${kind}`).toBe(count(host, kind))
      }
      expect(remote.wind).toBeCloseTo(host.wind, 2)
      expect(remote.rocket).toBeCloseTo(host.rocket, 2)
    }
  })

  it('stay small: 6 karts, about 250-450 bytes of JSON', () => {
    const sizes: number[] = []
    for (const id of TRACK_IDS) {
      const w = makeWorld({ trackId: id, laps: 3, racers: six, seed: 3 })
      run(w, 25, () => { if (Math.round(w.time) % 1000 < 17) sizes.push(JSON.stringify(snapshot(w)).length) })
    }
    const max = Math.max(...sizes)
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length
    console.log(`kart:pos JSON bytes, 6 karts, all tracks: avg ${avg.toFixed(0)}, max ${max}; at 10 Hz about ${(avg * 10 / 1024).toFixed(1)} KB/s`)
    expect(max).toBeLessThan(800)
  })

  it('interpolate blends positions and angles the short way round; discrete bits come from the newer one', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: six.slice(0, 2), seed: 3 })
    run(w, 3)
    const a = snapshot(w)
    run(w, 0.1)
    const b = snapshot(w)
    const mid = interpolate(a, b, 0.5)
    expect(mid.k[0][1]).toBeCloseTo((a.k[0][1] + b.k[0][1]) / 2, 5)
    expect(mid.t).toBeCloseTo((a.t + b.t) / 2, 5)
    expect(mid.k[0][6]).toBe(b.k[0][6])
    const wrapA = { ...a, k: [[0, 0, 0, 310, 0, 0, 0, 0, 0, 0]] as typeof a.k }
    const wrapB = { ...b, k: [[0, 0, 0, -310, 0, 0, 0, 0, 0, 0]] as typeof b.k }
    const ang = interpolate(wrapA, wrapB, 0.5).k[0][3]
    expect(Math.abs(Math.abs(ang) - 314.159)).toBeLessThan(1)
    expect(interpolate(a, b, 1)).toBe(b)
  })

  it('SnapBuffer: draws between the two snapshots around renderAt, resets on a new race', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: six.slice(0, 2), seed: 3 })
    const buf = new SnapBuffer()
    expect(buf.scene(w.track, roster, 3, 0)).toBeNull()
    buf.push({ junk: true }, 0)
    expect(buf.size).toBe(0)
    run(w, 2)
    const a = snapshot(w)
    buf.push(a, 1000)
    run(w, 0.1)
    const b = snapshot(w)
    buf.push(b, 1100)
    const s = buf.sample(1050)!
    expect(s.k[0][1]).toBeCloseTo((a.k[0][1] + b.k[0][1]) / 2, 5)
    expect(buf.sample(500)).toBe(a)
    expect(buf.sample(5000)).toBe(b)
    const sc = buf.scene(w.track, roster, 3, 1050)!
    expect(sc.karts).toHaveLength(2)
    expect(sc.fx.dixxx.char).toBe('chomp')
    // A new race: time jumps back.
    const fresh = snapshot(makeWorld({ trackId: 'oval', laps: 3, racers: six.slice(0, 2), seed: 4 }))
    buf.push(fresh, 1200)
    expect(buf.size).toBe(1)
    expect(isSnapshot(fresh)).toBe(true)
  })

  it('hudOf gives a phone its own place, lap, coins, item and drift tier', () => {
    const w = makeWorld({ trackId: 'oval', laps: 3, racers: six.slice(0, 3), seed: 3 })
    run(w, 5)
    w.karts[1].item = 'cafecito3'
    w.karts[1].uses = 2
    w.karts[1].coins = 4
    const h = hudOf(snapshot(w), 1, 3)!
    expect(h.item).toBe('cafecito3')
    expect(h.uses).toBe(2)
    expect(h.coins).toBe(4)
    expect(h.place).toBe(w.order.indexOf('johnnyboy') + 1)
    expect(h.lap).toBe(1)
    expect(hudOf(snapshot(w), 9, 3)).toBeNull()
  })
})
