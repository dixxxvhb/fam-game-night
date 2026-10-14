import { describe, expect, it } from 'vitest'
import type { MgBase, MgFormat, Minigame } from './types'
import { MINIGAMES } from './registry'
import { normStick, quantize, reduceStick, STEP, stepWalker, body, FIELD, BODY_R } from './rt'
import { frenzy, coinsOf, cartsOf, cartX, cartHits, frenzyAt, score, CART_LOSS, COOP_GOAL, FRENZY_AT } from './frenzy'
import { tubes, tubesAt, collide, poolR, isOut, endAt as tubesEnd, floating, stepTube, tubeR, tubeSpawn, TUBE_R, BIG_MASS, POOL_R0, POOL_R1, POOL_X, POOL_Y, TUBES_MS } from './tubes'
import { paint, paintAt, cellAt, cellCenter, counts, painted, COLS, CELLS } from './paint'
import { coconut, cocoAt, cocoSpawn, endAt, nutsOf, outAt, COCO_MS, INVULN_MS, type CocoState } from './coconut'

const A = 'dixxx'
const B = 'bot-gator'
const C = 'bot-pigeon'
const T0 = 2_000_000

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}
const ctx = (now: number) => ({ now, random: rng(now % 1000 + 1) })

function start<S extends MgBase>(m: Minigame<S>, format: MgFormat = 'ffa', players = [A, B, C], seed = 42): S {
  return m.setup({ players, format, solo: format === '1v2' ? players[0] : null, startAt: T0, random: rng(seed), used: [] })
}

/** Bots for `bots`, and `human(s, now)` for anyone else (a phone stand-in), every 200 ms like the host. */
function play<S extends MgBase>(m: Minigame<S>, s0: S, bots: string[], human?: (s: S, now: number) => S, limit = 60_000): { s: S; now: number } {
  let s = s0
  let now = T0 - 3000
  while (!m.done(s, now) && now < T0 + limit) {
    now += 200
    s = m.tick(s, ctx(now))
    for (const id of bots) {
      const p = m.bot(s, id, ctx(now))
      if (p) s = m.reduce(s, id, p.type, p.payload, ctx(now))
    }
    if (human) s = human(s, now)
  }
  return { s, now }
}

describe('real-time kit', () => {
  it('sticks are clamped, deduped and rate limited', () => {
    const s = start(coconut)
    expect(normStick(0.05, 0.05)).toEqual([0, 0])
    expect(normStick(3, 4)).toEqual([0.6, 0.8])
    let t = reduceStick(s, A, { x: 1, y: 0 }, T0)
    expect(t.sticks[A]).toEqual([{ t: T0, x: 1, y: 0 }])
    expect(reduceStick(t, A, { x: 1, y: 0 }, T0 + 500)).toBe(t)
    expect(reduceStick(t, A, { x: 0, y: 1 }, T0 + 20)).toBe(t)
    t = reduceStick(t, A, { x: 0, y: 1 }, T0 + 200)
    expect(t.sticks[A].length).toBe(2)
    expect(reduceStick(t, 'stranger', { x: 0, y: 1 }, T0 + 900)).toBe(t)
    expect(reduceStick(t, A, { x: 'left' }, T0 + 900)).toBe(t)
  })
  it('quantize picks the nearest of 16 directions', () => {
    expect(quantize(1, 0.01, 1)).toEqual([1, 0])
    expect(quantize(0, -5, 0.5)).toEqual([0, -0.5])
    expect(quantize(0, 0, 1)).toEqual([0, 0])
  })
  it('walkers stop at the walls', () => {
    const b = body(FIELD.x0 + 2, 40)
    for (let i = 0; i < 40; i++) stepWalker(b, -1, -1)
    expect([b.x, b.y]).toEqual([FIELD.x0, FIELD.y0])
    for (let i = 0; i < 200; i++) stepWalker(b, 1, 1)
    expect([b.x, b.y]).toEqual([FIELD.x1, FIELD.y1])
  })
  it('the action minigames are registered with every format they claim', () => {
    for (const id of ['coconut', 'frenzy', 'tubes', 'paint']) {
      const m = MINIGAMES.find((x) => x.id === id)
      expect(m).toBeTruthy()
      expect(m!.formats).toContain('ffa')
      expect(m!.formats).toContain('duel')
    }
  })
})

describe('Coconut Drop', () => {
  it('the schedule is the same on every device and ramps up', () => {
    const s = start(coconut)
    const again = start(coconut)
    expect(nutsOf(s)).toEqual(nutsOf(again))
    const nuts = nutsOf(s).filter((n) => n.kind !== 'volley')
    const early = nuts.filter((n) => n.at < T0 + 10_000).length
    const late = nuts.filter((n) => n.at >= T0 + 20_000).length
    expect(late).toBeGreaterThan(early)
    expect(nuts.every((n) => n.land <= T0 + COCO_MS)).toBe(true)
  })

  it('a phone reports a hit; the host checks it landed, caps lives, and gives a moment of mercy', () => {
    let s = start(coconut)
    const n = nutsOf(s)[0]
    expect(coconut.reduce(s, A, 'hit', { k: n.k }, ctx(n.land - 2000))).toBe(s)
    s = coconut.reduce(s, A, 'hit', { k: n.k }, ctx(n.land + 50))
    expect(s.hits[A]).toEqual([{ k: n.k, t: n.land }])
    expect(coconut.reduce(s, A, 'hit', { k: n.k }, ctx(n.land + 60))).toBe(s)
    const soon = nutsOf(s).find((x) => x.land > n.land && x.land < n.land + INVULN_MS)
    if (soon) expect(coconut.reduce(s, A, 'hit', { k: soon.k }, ctx(soon.land + 10))).toBe(s)
    expect(coconut.reduce(s, A, 'hit', { k: 4321 }, ctx(n.land + 60))).toBe(s)
  })

  it('last critter standing ends it (after the hold)', () => {
    let s = start(coconut)
    const later = nutsOf(s).filter((n) => n.kind === 'nut')
    // B and C each take three spaced hits.
    for (const id of [B, C]) {
      let lastT = -Infinity
      let got = 0
      for (const n of later) {
        if (got === 3) break
        if (n.land < lastT + INVULN_MS) continue
        s = coconut.reduce(s, id, 'hit', { k: n.k }, ctx(n.land + 10))
        lastT = n.land
        got++
      }
    }
    expect(outAt(s, B)).not.toBe(null)
    expect(outAt(s, C)).not.toBe(null)
    const end = endAt(s)
    expect(end).toBe(Math.max(outAt(s, B)!, outAt(s, C)!))
    expect(coconut.done(s, end + 100)).toBe(false)
    expect(coconut.done(s, end + 2000)).toBe(true)
    const r = coconut.result(s)
    expect(r.places[A]).toBe(1)
    expect(r.headline).toContain(`@{${A}}`)
    expect(r.lines[A]).toBe('3 lives left')
  })

  it('bots dodge most coconuts but not all, and the sim agrees with what they report', () => {
    let lost = 0
    let rounds = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const players = [A, B, C]
      const { s, now } = play(coconut, start(coconut, 'ffa', players, seed), players)
      expect(coconut.done(s, now)).toBe(true)
      for (const id of players) {
        const w = cocoAt(s, Math.min(now, endAt(s)))
        const simHits = w.hits[id].filter((h) => h.t <= endAt(s)).map((h) => h.k)
        expect(s.hits[id].map((h) => h.k)).toEqual(simHits)
        lost += s.hits[id].length
      }
      rounds += 1
    }
    const perBot = lost / (rounds * 3)
    expect(perBot).toBeGreaterThan(0.4)
    expect(perBot).toBeLessThan(2.95)
  })

  it('a phone that never moves gets bonked out before a dodging bot', () => {
    let wins = 0
    for (const seed of [11, 12, 13, 14, 15]) {
      const players = [A, B]
      const s0 = start(coconut, 'duel', players, seed)
      const [x, y] = cocoSpawn(s0, A)
      const { s } = play(coconut, s0, [B], (cur, now) => {
        let out = cur
        for (const n of nutsOf(cur)) {
          if (n.land > now || n.land <= now - 200) continue
          if (Math.hypot(n.x - x, n.y - y) <= n.r + BODY_R * 0.8) out = coconut.reduce(out, A, 'hit', { k: n.k }, ctx(now))
        }
        return out
      })
      if (coconut.result(s).places[B] === 1) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
  })

  it('1 vs 2: the solo bot throws at the team and only the solo can throw', () => {
    const players = [A, B, C]
    const s0 = start(coconut, '1v2', players)
    expect(Object.keys(s0.lives).sort()).toEqual([B, C].sort())
    expect(coconut.reduce(s0, B, 'drop', { x: 50, y: 50 }, ctx(T0 + 1000))).toBe(s0)
    const one = coconut.reduce(s0, A, 'drop', { x: 50, y: 50 }, ctx(T0 + 1000))
    expect(one.drops.length).toBe(1)
    expect(coconut.reduce(one, A, 'drop', { x: 60, y: 50 }, ctx(T0 + 1100))).toBe(one)
    const { s } = play(coconut, s0, players)
    expect(s.drops.length).toBeGreaterThan(10)
    const r = coconut.result(s)
    expect(['solo', 'team']).toContain(r.winner)
  })

  it('co-op fails the moment someone runs out', () => {
    let s = start(coconut, 'coop')
    let lastT = -Infinity
    let got = 0
    for (const n of nutsOf(s)) {
      if (got === 3) break
      if (n.land < lastT + INVULN_MS) continue
      s = coconut.reduce(s, B, 'hit', { k: n.k }, ctx(n.land + 10))
      lastT = n.land
      got++
    }
    expect(endAt(s)).toBe(outAt(s, B))
    expect(coconut.result(s).success).toBe(false)
  })

  it('steps are 50 ms', () => { expect(STEP).toBe(50); expect(start(coconut) as CocoState).toBeTruthy() })
})

describe('Coin Frenzy', () => {
  it('coins are the same everywhere, coin k sits at index k, and the end is a frenzy', () => {
    const s = start(frenzy)
    const coins = coinsOf(s)
    coins.forEach((c, i) => expect(c.k).toBe(i))
    const calm = coins.filter((c) => c.at < T0 + 5000).length
    const mad = coins.filter((c) => c.at >= T0 + FRENZY_AT).length
    expect(mad).toBeGreaterThan(calm)
  })

  it('first grab wins, only while the coin is on the ground', () => {
    let s = start(frenzy)
    const c = coinsOf(s)[3]
    expect(frenzy.reduce(s, A, 'grab', { k: 3 }, ctx(c.land - 1000))).toBe(s)
    s = frenzy.reduce(s, A, 'grab', { k: 3 }, ctx(c.land + 100))
    expect(s.taken[3].by).toBe(A)
    expect(frenzy.reduce(s, B, 'grab', { k: 3 }, ctx(c.land + 120))).toBe(s)
    const late = coinsOf(s)[4]
    expect(frenzy.reduce(s, B, 'grab', { k: 4 }, ctx(late.gone + 2000))).toBe(s)
    expect(score(s, A)).toBe(c.v)
  })

  it('a golf cart costs up to 3 coins, once per cart', () => {
    let s = start(frenzy)
    const coins = coinsOf(s)
    for (let k = 0; k < 5; k++) s = frenzy.reduce(s, A, 'grab', { k }, ctx(coins[k].land + 10))
    const before = score(s, A)
    const cart = cartsOf(s)[0]
    expect(frenzy.reduce(s, A, 'bonk', { c: 0 }, ctx(cart.go - 500))).toBe(s)
    s = frenzy.reduce(s, A, 'bonk', { c: 0 }, ctx(cart.go + 600))
    expect(score(s, A)).toBe(Math.max(0, before - CART_LOSS))
    expect(frenzy.reduce(s, A, 'bonk', { c: 0 }, ctx(cart.go + 700))).toBe(s)
    expect(cartHits(cart, cart.go + 600, cartX(cart, cart.go + 600)!, cart.y)).toBe(true)
  })

  it('bots grab plenty, split it, and what they report matches the sim', () => {
    let total = 0
    const runs = [21, 22, 23, 24]
    for (const seed of runs) {
      const players = [A, B, C]
      const { s, now } = play(frenzy, start(frenzy, 'ffa', players, seed), players)
      expect(frenzy.done(s, now)).toBe(true)
      const w = frenzyAt(s, now)
      for (const k in s.taken) {
        const g = w.grabs[Number(k)]
        expect(g?.by).toBe(s.taken[k].by)
      }
      for (const id of players) expect(score(s, id)).toBeGreaterThan(8)
      total += players.reduce((a, id) => a + score(s, id), 0)
    }
    const avg = total / runs.length
    // The co-op goal should be a stretch for three bots and doable for three people trying.
    expect(avg).toBeGreaterThan(COOP_GOAL * 0.7)
    expect(avg).toBeLessThan(COOP_GOAL * 1.3)
  })

  it('a phone that stands still gets almost nothing', () => {
    const players = [A, B]
    const { s } = play(frenzy, start(frenzy, 'duel', players, 5), [B])
    expect(score(s, B)).toBeGreaterThan(score(s, A))
    expect(frenzy.result(s).places[B]).toBe(1)
  })
})

describe('Bumper Tubes', () => {
  it('a head-on bump sends both tubes back, heavier tubes move less', () => {
    const a = { x: 0, y: 0, vx: 40, vy: 0 }
    const o = { x: 12, y: 0, vx: -40, vy: 0 }
    const h = collide(a, TUBE_R, 1, o, TUBE_R, 1)!
    expect(h.dvx).toBeLessThan(-80)
    expect(h.ovx).toBeGreaterThan(80)
    const heavy = collide(a, TUBE_R, 1, o, TUBE_R, BIG_MASS)!
    expect(Math.abs(heavy.ovx)).toBeLessThan(Math.abs(heavy.dvx))
    expect(collide(a, TUBE_R, 1, { x: 40, y: 0, vx: 0, vy: 0 }, TUBE_R, 1)).toBe(null)
  })

  it('the pool shrinks after the first stretch', () => {
    expect(poolR(T0, T0 + 5000)).toBe(POOL_R0)
    expect(poolR(T0, T0 + TUBES_MS)).toBeCloseTo(POOL_R1)
    expect(isOut(T0, T0, POOL_X + POOL_R0 + 1, POOL_Y)).toBe(true)
  })

  it('outs are self-reported once; bumps only go to bot tubes, capped and spaced', () => {
    let s = start(tubes)
    s = tubes.reduce(s, A, 'out', {}, ctx(T0 + 4000))
    expect(s.outs[A]).toBe(T0 + 4000)
    expect(tubes.reduce(s, A, 'out', {}, ctx(T0 + 5000))).toBe(s)
    expect(tubes.reduce(s, B, 'bump', { to: C, ix: 10, iy: 0 }, ctx(T0 + 5000))).toBe(s) // C is not a sim tube yet
    s = tubes.reduce(s, C, 'stick', { x: 0, y: 0 }, ctx(T0 - 1000))
    const one = tubes.reduce(s, B, 'bump', { to: C, ix: 10, iy: 0 }, ctx(T0 + 5000))
    expect(one.bumps.length).toBe(1)
    expect(tubes.reduce(one, B, 'bump', { to: C, ix: 10, iy: 0 }, ctx(T0 + 5050))).toBe(one)
    expect(tubes.reduce(one, B, 'bump', { to: C, ix: 999, iy: 0 }, ctx(T0 + 6000))).toBe(one)
    // A bump moves the bot tube in the sim.
    const before = tubesAt(s, T0 + 6000).bodies[C].x
    const after = tubesAt(one, T0 + 6000).bodies[C].x
    expect(after).toBeGreaterThan(before + 3)
  })

  it('last one floating ends it; ranks by when you splashed', () => {
    let s = start(tubes)
    s = tubes.reduce(s, B, 'out', {}, ctx(T0 + 3000))
    expect(tubes.done(s, T0 + 9000)).toBe(false)
    s = tubes.reduce(s, C, 'out', {}, ctx(T0 + 8000))
    expect(tubesEnd(s)).toBe(T0 + 8000)
    expect(tubes.done(s, T0 + 8000 + 2000)).toBe(true)
    const r = tubes.result(s)
    expect(r.places).toEqual({ [A]: 1, [C]: 2, [B]: 3 })
    expect(r.headline).toBe(`@{${A}} rules the wave pool`)
  })

  it('three bots knock each other out, and the sim agrees with their reports', () => {
    let early = 0
    for (const seed of [31, 32, 33, 34, 35]) {
      const players = [A, B, C]
      const { s, now } = play(tubes, start(tubes, 'ffa', players, seed), players)
      expect(tubes.done(s, now)).toBe(true)
      const w = tubesAt(s, now)
      for (const id of players) expect(s.outs[id] !== null).toBe(id in w.outs && w.outs[id] <= tubesEnd(s) + 300)
      if (tubesEnd(s) < T0 + TUBES_MS) early++
    }
    expect(early).toBeGreaterThanOrEqual(2)
  })

  it('1 vs 2: the big tube is heavy and the result picks a side', () => {
    const players = [A, B, C]
    const { s } = play(tubes, start(tubes, '1v2', players, 3), players)
    expect(['solo', 'team']).toContain(tubes.result(s).winner)
    expect(tubeR(s, A)).toBeGreaterThan(tubeR(s, B))
  })

  it('a phone tube that just sits there gets shoved out by a bot', () => {
    let wins = 0
    for (const seed of [41, 42, 43, 44]) {
      const players = [A, B]
      const s0 = start(tubes, 'duel', players, seed)
      const me = body(...tubeSpawn(s0, A))
      let k = 0
      const { s } = play(tubes, s0, [B], (cur, now) => {
        let out = cur
        // Step my (idle) tube like a phone would, colliding with the bot from the sim.
        while (k < Math.floor((now - T0) / STEP)) {
          const t1 = T0 + (k + 1) * STEP
          stepTube(me, 0, 0)
          const bot = tubesAt(out, t1).bodies[B]
          if (bot && floating(out, B, t1)) {
            const h = collide(me, TUBE_R, 1, bot, TUBE_R, 1)
            if (h) {
              me.vx += h.dvx; me.vy += h.dvy; me.x += h.px; me.y += h.py
              out = tubes.reduce(out, A, 'bump', { to: B, ix: h.ovx, iy: h.ovy }, ctx(t1))
            }
          }
          if (floating(out, A, t1) && isOut(T0, t1, me.x, me.y)) out = tubes.reduce(out, A, 'out', {}, ctx(t1))
          k++
        }
        return out
      })
      if (tubes.result(s).places[B] === 1) wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
  })
})

describe('Wet Paint', () => {
  it('maps the field to planks and back', () => {
    for (const i of [0, 5, COLS, CELLS - 1]) expect(cellAt(...cellCenter(i))).toBe(i)
  })

  it('painting claims planks, painting over steals them, junk is ignored', () => {
    let s = start(paint)
    expect(paint.reduce(s, A, 'paint', { c: [1, 2] }, ctx(T0 - 500))).toBe(s)
    s = paint.reduce(s, A, 'paint', { c: [1, 2, 3] }, ctx(T0 + 1000))
    s = paint.reduce(s, B, 'paint', { c: [3] }, ctx(T0 + 1100))
    expect(counts(s)).toEqual({ [A]: 2, [B]: 1, [C]: 0 })
    expect(paint.reduce(s, B, 'paint', { c: [3] }, ctx(T0 + 1200))).toBe(s)
    expect(paint.reduce(s, B, 'paint', { c: [CELLS] }, ctx(T0 + 1200))).toBe(s)
    expect(paint.reduce(s, B, 'paint', { c: 'all' }, ctx(T0 + 1200))).toBe(s)
    const r = paint.result({ ...s, startAt: T0 })
    expect(r.places[A]).toBe(1)
  })

  it('co-op ends a beat after the last plank', () => {
    let s = start(paint, 'coop')
    s = paint.reduce(s, A, 'paint', { c: Array.from({ length: 40 }, (_, i) => i) }, ctx(T0 + 1000))
    s = paint.reduce(s, B, 'paint', { c: Array.from({ length: 40 }, (_, i) => i + 40) }, ctx(T0 + 2000))
    s = paint.reduce(s, C, 'paint', { c: Array.from({ length: CELLS - 80 }, (_, i) => i + 80) }, ctx(T0 + 3000))
    expect(s.fullAt).toBe(T0 + 3000)
    expect(paint.done(s, T0 + 3500)).toBe(false)
    expect(paint.done(s, T0 + 5000)).toBe(true)
    expect(paint.result(s).success).toBe(true)
  })

  it('bots spread out and paint most of the boardwalk; the sim matches their reports', () => {
    let share = 0
    for (const seed of [61, 62, 63]) {
      const players = [A, B, C]
      const { s, now } = play(paint, start(paint, 'ffa', players, seed), players)
      expect(paint.done(s, now)).toBe(true)
      const sc = counts(s)
      for (const id of players) expect(sc[id]).toBeGreaterThan(10)
      share += painted(s) / CELLS
      const w = paintAt(s, now)
      for (const id of players) expect(s.upTo[id]).toBe(w.trail[id].at(-1)!.t)
    }
    expect(share / 3).toBeGreaterThan(0.8)
  })

  it('co-op with bots is a real race', () => {
    const results: boolean[] = []
    for (const seed of [71, 72, 73, 74]) {
      const players = [A, B, C]
      const { s } = play(paint, start(paint, 'coop', players, seed), players)
      results.push(!!paint.result(s).success)
    }
  })
})
