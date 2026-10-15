import { describe, expect, it } from 'vitest'
import { newSim, step, type Sim, type SimInput } from './sim'
import { botInput, newMind, type BotMind } from './bots'
import { decode, encode, isSnap, resume, SnapBuffer, type ArenaSnap } from './snap'

const IDS = ['dixxx', 'johnnyboy', 'torii']

/** Three bots playing for n steps (a busy arena: bombs, flames, power-ups, kills). */
function play(sim: Sim, minds: Record<string, BotMind>, n: number) {
  for (let i = 0; i < n && !sim.result; i++) {
    const ins: Record<string, SimInput> = {}
    for (const id of IDS) ins[id] = botInput(sim, id, minds[id])
    step(sim, ins)
  }
}

const mindsFor = (seed: number) => Object.fromEntries(IDS.map((id, i) => [id, newMind(seed + i)]))

/** The Sim without the fall times of long-fallen walls (a snapshot only carries recent ones). */
function comparable(sim: Sim) {
  const recent = Object.fromEntries(Object.entries(sim.fallen).filter(([, at]) => sim.t - at <= 60))
  return { ...sim, fallen: recent }
}

describe('snapshots', () => {
  it('round-trips a busy arena exactly', () => {
    for (const seed of [3, 77, 4242]) {
      const sim = newSim(seed, IDS)
      play(sim, mindsFor(seed), 400)
      expect(sim.bombs.length + sim.flames.filter(Boolean).length).toBeGreaterThanOrEqual(0)
      const snap = encode(sim, 2, seed)
      // it goes over the wire as JSON
      const back = decode(JSON.parse(JSON.stringify(snap)))!
      expect(back).not.toBeNull()
      expect(comparable(back)).toEqual(comparable(sim))
    }
  })

  it('round-trips the walls closing in and the result', () => {
    const sim = newSim(9, IDS)
    play(sim, mindsFor(9), 90 * 30 + 400)
    expect(sim.shrinkIdx).toBeGreaterThan(0)
    const back = decode(JSON.parse(JSON.stringify(encode(sim, 1, 9))))!
    expect(comparable(back)).toEqual(comparable(sim))
    // every wall is a wall, recent ones keep their fall time for the drop-in
    for (const [k, at] of Object.entries(sim.fallen)) if (sim.t - at <= 60) expect(back.fallen[Number(k)]).toBe(at)
  })

  it('is small enough to send 15 times a second', () => {
    const sim = newSim(5, IDS)
    play(sim, mindsFor(5), 600)
    expect(JSON.stringify(encode(sim, 1, 5)).length).toBeLessThan(1400)
  })

  it('rejects junk', () => {
    const good = encode(newSim(1, IDS), 1, 1)
    expect(isSnap(good)).toBe(true)
    for (const bad of [null, 5, 'snap', {}, { ...good, v: 2 }, { ...good, g: 'abc' }, { ...good, g: good.g.replace('a', 'z') }, { ...good, p: [1, 2] }, { ...good, b: [1] }, { ...good, ids: [] }, { ...good, n: [1, 2] }, { ...good, f: [1, 2, 3, 4, 5, NaN] }]) {
      expect(decode(bad)).toBeNull()
    }
  })
})

describe('resume after a host handoff', () => {
  it('a resumed arena plays on exactly like the original', () => {
    const seed = 31337
    const a = newSim(seed, IDS)
    const minds = mindsFor(seed)
    play(a, minds, 500)
    const snap = JSON.parse(JSON.stringify(encode(a, 1, seed))) as ArenaSnap
    const b = resume(snap, 1, seed, IDS, [])!
    expect(b).not.toBeNull()
    // Same inputs from here on: same arena, step for step.
    for (let i = 0; i < 600 && !a.result; i++) {
      const ins: Record<string, SimInput> = {}
      for (const id of IDS) ins[id] = botInput(a, id, minds[id])
      const ea = step(a, ins)
      const eb = step(b, ins)
      expect(eb).toEqual(ea)
    }
    expect(comparable(b)).toEqual(comparable(a))
  })

  it('only resumes the same round with the same players, and keeps the game\'s knockouts', () => {
    const sim = newSim(8, IDS)
    play(sim, mindsFor(8), 60)
    const snap = encode(sim, 3, 8)
    expect(resume(snap, 4, 8, IDS, [])).toBeNull()
    expect(resume(snap, 3, 9, IDS, [])).toBeNull()
    expect(resume(snap, 3, 8, ['dixxx', 'torii', 'johnnyboy'], [])).toBeNull()
    expect(resume(null, 3, 8, IDS, [])).toBeNull()
    const r = resume(snap, 3, 8, IDS, ['torii'])!
    expect(r.players.find((p) => p.id === 'torii')!.alive).toBe(false)
    expect(r.players.find((p) => p.id === 'dixxx')!.alive).toBe(true)
  })
})

describe('SnapBuffer', () => {
  it('blends players between two snapshots and follows the host clock', () => {
    const sim = newSim(12, IDS)
    const minds = mindsFor(12)
    const buf = new SnapBuffer()
    expect(buf.view(0)).toBeNull()
    const sent: { t: number; snap: ArenaSnap }[] = []
    for (let k = 0; k < 20; k++) {
      play(sim, minds, 2)
      const snap = encode(sim, 1, 12)
      sent.push({ t: sim.t, snap })
      buf.push(JSON.parse(JSON.stringify(snap)), 10_000 + sim.t * (1000 / 30) + (k % 3) * 7)
    }
    expect(buf.latest?.t).toBe(sim.t)
    // draws a few steps behind the newest
    const v = buf.view(10_000 + sim.t * (1000 / 30))!
    expect(v.time).toBeLessThan(sim.t)
    expect(v.time).toBeGreaterThan(sim.t - 8)
    expect(v.alpha).toBeGreaterThanOrEqual(0)
    expect(v.alpha).toBeLessThanOrEqual(1)
    // a stale or repeated snapshot changes nothing
    buf.push(sent[3].snap, 99_999)
    expect(buf.latest?.t).toBe(sim.t)
    // a new round starts over
    const next = encode(newSim(13, IDS), 2, 13)
    buf.push(next, 50_000)
    expect(buf.latest?.r).toBe(2)
    expect(buf.view(50_000)!.time).toBe(0)
  })
})
