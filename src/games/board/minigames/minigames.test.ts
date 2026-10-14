import { describe, expect, it } from 'vitest'
import type { MgFormat, Minigame, MgBase } from './types'
import { MINIGAMES, minigame } from './registry'
import { judge, rank } from './util'
import { MASH_MS, mashCap, mash } from './mash'
import { quickdraw, QD_PAUSE, QD_WINDOW, type QdState } from './quickdraw'
import { clock, clampStop, TARGET_MS, type ClockState } from './clock'
import { memory, roundLen, showMs, litPad, LEAD_MS, LIT_MS, type MemoryState } from './memory'
import { oddone, WRONG_PEN, type OddState } from './oddone'
import { potato, MIN_HOLD_MS, BOOM_SHOW_MS, type PotatoState } from './potato'
import { eight, nearestCount, scoreEight, countTime, beatAt, type EightState } from './eight'
import { stroop, stroopCard, type StroopState } from './stroop'
import { math, MATH_PEN, type MathState } from './math'
import { closest, type ClosestState } from './closest'
import { reflex, reflexTile, type ReflexState } from './reflex'
import { CLUES } from './clues'

const A = 'dixxx'
const B = 'johnnyboy'
const C = 'torii'
const T0 = 2_000_000

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}
const ctx = (now: number) => ({ now, random: rng(now % 1000 + 1) })

function start<S extends MgBase>(m: Minigame<S>, format: MgFormat = 'ffa', players = [A, B, C], solo: string | null = null, used: string[] = []): S {
  return m.setup({ players, format, solo: format === '1v2' ? solo ?? players[0] : null, startAt: T0, random: rng(42), used })
}

/** Run it with every player a bot until it is done. */
function playBots<S extends MgBase>(m: Minigame<S>, s0: S, bots: string[], limit = 120_000): { s: S; now: number } {
  let s = s0
  let now = T0 - 3000
  while (!m.done(s, now) && now < T0 + limit) {
    now += 200
    s = m.tick(s, ctx(now))
    for (const id of bots) {
      const play = m.bot(s, id, ctx(now))
      if (play) s = m.reduce(s, id, play.type, play.payload, ctx(now))
    }
  }
  return { s, now }
}

describe('judging helpers', () => {
  it('ranks with ties and puts did-not-finish last', () => {
    expect(rank({ a: 5, b: 9, c: 5 }, 'high')).toEqual({ b: 1, a: 2, c: 2 })
    expect(rank({ a: 5, b: null, c: 3 }, 'low')).toEqual({ c: 1, a: 2, b: 3 })
    expect(rank({ a: null, b: null }, 'high')).toEqual({ a: 1, b: 1 })
  })
  it('1 vs the rest: team best or team average, ties go to nobody', () => {
    const base = { players: [A, B, C], format: '1v2' as const, solo: A, startAt: 0 }
    const h = () => ''
    expect(judge(base, { scores: { [A]: 10, [B]: 9, [C]: 2 }, better: 'high', lines: {}, headline: h }).winner).toBe('solo')
    expect(judge(base, { scores: { [A]: 10, [B]: 11, [C]: 2 }, better: 'high', lines: {}, headline: h }).winner).toBe('team')
    expect(judge(base, { scores: { [A]: 10, [B]: 11, [C]: 2 }, better: 'high', team: 'avg', lines: {}, headline: h }).winner).toBe('solo')
    expect(judge(base, { scores: { [A]: 10, [B]: 10, [C]: 2 }, better: 'high', lines: {}, headline: h }).winner).toBe('none')
    expect(judge(base, { scores: { [A]: null, [B]: 1, [C]: 2 }, better: 'low', lines: {}, headline: h }).winner).toBe('team')
  })
})

describe('every minigame', () => {
  it('has an id, a name, a rule line, and at least ffa', () => {
    expect(MINIGAMES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(MINIGAMES.map((m) => m.id)).size).toBe(MINIGAMES.length)
    for (const m of MINIGAMES) {
      expect(m.name && m.rule).toBeTruthy()
      expect(m.formats).toContain('ffa')
      expect(m.formats).toContain('duel')
      if (m.formats.includes('coop')) expect(m.coopGoal).toBeTruthy()
      expect(`${m.rule} ${m.coopGoal ?? ''} ${m.soloRule ?? ''}`).not.toMatch(/—/)
    }
    expect(minigame('nope')).toBe(null)
  })

  for (const m of MINIGAMES) {
    for (const f of m.formats) {
      it(`${m.name} (${f}) plays to a result with bots, inside 45 seconds`, () => {
        const players = f === 'duel' ? [A, B] : [A, B, C]
        const { s, now } = playBots(m, start(m, f, players), players)
        expect(m.done(s, now)).toBe(true)
        expect(now - T0).toBeLessThanOrEqual(45_000)
        const r = m.result(s)
        expect(Object.keys(r.places).sort()).toEqual([...players].sort())
        for (const id of players) expect(typeof r.lines[id]).toBe('string')
        expect(r.headline).toBeTruthy()
        if (f === '1v2') expect(['solo', 'team', 'none']).toContain(r.winner)
        if (f === 'coop') expect(typeof r.success).toBe('boolean')
      })
    }
    it(`${m.name} ignores junk, strangers and wrong types`, () => {
      const s = start(m)
      for (const p of [null, undefined, 7, 'x', [], { n: 'lots' }, { r: -1 }, { ms: Infinity }, { list: 'no' }]) {
        for (const t of ['taps', 'tap', 'early', 'stop', 'answer', 'pick', 'pass', 'ans', 'guess', 'hit', 'zzz']) {
          expect(m.reduce(s, 'stranger', t, p, ctx(T0 + 5000))).toBe(s)
          expect(m.reduce(s, A, t, p, ctx(T0 + 5000))).toBe(s)
        }
      }
    })
    it(`${m.name}: nobody doing anything still ends`, () => {
      let s = start(m)
      let now = T0
      for (let i = 0; i < 1000 && !m.done(s, now); i++) { now += 200; s = m.tick(s, ctx(now)) }
      expect(m.done(s, now)).toBe(true)
      m.result(s)
    })
  }
})

describe('Mash', () => {
  it('caps taps at 16 a second of play', () => {
    expect(mashCap(MASH_MS)).toBe(128)
    expect(mashCap(MASH_MS + 5000)).toBe(128)
    let s = start(mash)
    s = mash.reduce(s, A, 'taps', { n: 500 }, ctx(T0 + MASH_MS + 100))
    expect(s.taps[A]).toBe(128)
    // Claiming 100 taps two seconds in: capped at 32.
    s = mash.reduce(s, B, 'taps', { n: 100 }, ctx(T0 + 2000))
    expect(s.taps[B]).toBe(32)
    // Before the start: ignored. Second submission: ignored.
    expect(mash.reduce(s, C, 'taps', { n: 10 }, ctx(T0 - 1))).toBe(s)
    expect(mash.reduce(s, A, 'taps', { n: 10 }, ctx(T0 + 9000))).toBe(s)
    expect(mash.reduce(s, C, 'taps', { n: 1.5 }, ctx(T0 + 9000))).toBe(s)
    s = mash.reduce(s, C, 'taps', { n: 60 }, ctx(T0 + 8200))
    const r = mash.result(s)
    expect(r.places).toEqual({ [A]: 1, [B]: 3, [C]: 2 })
    expect(r.lines[A]).toBe('128 taps')
  })
  it('co-op needs 50 each on average', () => {
    let s = start(mash, 'coop')
    for (const [id, n] of [[A, 60], [B, 50], [C, 41]] as const) s = mash.reduce(s, id, 'taps', { n }, ctx(T0 + 8100))
    expect(mash.result(s).success).toBe(true)
    let t = start(mash, 'coop')
    for (const [id, n] of [[A, 60], [B, 50], [C, 30]] as const) t = mash.reduce(t, id, 'taps', { n }, ctx(T0 + 8100))
    expect(mash.result(t).success).toBe(false)
  })
  it('bots mash 8 to 11 a second', () => {
    const { s } = playBots(mash, start(mash), [A, B, C])
    for (const id of [A, B, C]) { expect(s.taps[id]).toBeGreaterThanOrEqual(64); expect(s.taps[id]).toBeLessThanOrEqual(88) }
  })
})

describe('Quick Draw', () => {
  const open = (s: QdState) => s.rounds[s.r]
  it('reaction under 100 ms is a false start; claiming NOW before it happened too', () => {
    let s = start(quickdraw)
    const go = open(s).goAt
    s = quickdraw.reduce(s, A, 'tap', { r: 0, ms: 80 }, ctx(go + 100))
    expect(open(s).taps[A]).toBe('early')
    s = quickdraw.reduce(s, B, 'tap', { r: 0, ms: 250 }, ctx(go - 1000))
    expect(open(s).taps[B]).toBe('early')
    s = quickdraw.reduce(s, C, 'tap', { r: 0, ms: 230 }, ctx(go + 300))
    expect(open(s).taps[C]).toEqual({ ms: 230 })
    expect(open(s).closedAt).not.toBe(null)
  })
  it('early tap knocks you out of the round; wins then best time decide', () => {
    let s = start(quickdraw)
    let now = T0
    for (let r = 0; r < 3; r++) {
      const go = open(s).goAt
      s = quickdraw.reduce(s, A, 'tap', { r, ms: 300 }, ctx(go + 320))
      s = quickdraw.reduce(s, B, r === 0 ? 'early' : 'tap', { r, ms: 250 }, ctx(r === 0 ? go - 500 : go + 270))
      // C never taps: the round closes at the window.
      now = go + QD_WINDOW
      s = quickdraw.tick(s, ctx(now))
      expect(open(s).closedAt).not.toBe(null)
      now += QD_PAUSE
      s = quickdraw.tick(s, ctx(now))
    }
    expect(quickdraw.done(s, now)).toBe(true)
    const r = quickdraw.result(s)
    // B won rounds 2 and 3, A won round 1.
    expect(r.places).toEqual({ [B]: 1, [A]: 2, [C]: 3 })
    expect(r.lines[B]).toBe('2 wins · best 250 ms')
    expect(r.lines[C]).toBe('No taps')
    // Wrong round number: ignored.
    expect(quickdraw.reduce(s, A, 'tap', { r: 0, ms: 200 }, ctx(now))).toBe(s)
  })
  it('bots react in 250 to 450 ms and sometimes flinch', () => {
    let flinch = 0
    let taps = 0
    for (let k = 0; k < 20; k++) {
      const s0 = quickdraw.setup({ players: [A, B, C], format: 'ffa', solo: null, startAt: T0, random: rng(100 + k), used: [] })
      const { s } = playBots(quickdraw, s0, [A, B, C])
      for (const round of s.rounds) for (const id of [A, B, C]) {
        const t = round.taps[id]
        if (t === 'early') flinch += 1
        else if (t) { taps += 1; expect(t.ms).toBeGreaterThanOrEqual(250); expect(t.ms).toBeLessThanOrEqual(450) }
      }
    }
    expect(flinch).toBeGreaterThan(0)
    expect(flinch).toBeLessThan(taps / 4)
  })
})

describe('Stop the Clock', () => {
  it('keeps claims within reach of the host clock', () => {
    expect(clampStop(10_000, 10_200)).toBe(10_000)
    expect(clampStop(10_000, 13_000)).toBe(11_500)
    expect(clampStop(10_000, 4_000)).toBe(4_300)
    let s: ClockState = start(clock)
    s = clock.reduce(s, A, 'stop', { ms: 10_000 }, ctx(T0 + 10_150))
    s = clock.reduce(s, B, 'stop', { ms: 10_000 }, ctx(T0 + 3_000))
    s = clock.reduce(s, C, 'stop', { ms: 9_870 }, ctx(T0 + 10_000))
    expect(s.stops).toEqual({ [A]: 10_000, [B]: 3_300, [C]: 9_870 })
    const r = clock.result(s)
    expect(r.places).toEqual({ [A]: 1, [C]: 2, [B]: 3 })
    expect(r.lines[A]).toBe('10.00 s (0.00 off)')
    expect(r.moment?.playerId).toBe(A)
    expect(clock.reduce(s, A, 'stop', { ms: 9000 }, ctx(T0 + 9000))).toBe(s)
  })
  it('never stopping ranks last; co-op is the team average within 0.6 s', () => {
    let s = start(clock, 'coop')
    s = clock.reduce(s, A, 'stop', { ms: 10_300 }, ctx(T0 + 10_400))
    s = clock.reduce(s, B, 'stop', { ms: 9_500 }, ctx(T0 + 9_600))
    s = clock.reduce(s, C, 'stop', { ms: 10_900 }, ctx(T0 + 11_000))
    expect(clock.result(s).success).toBe(true)
    let t = start(clock)
    t = clock.reduce(t, A, 'stop', { ms: 12_000 }, ctx(T0 + 12_100))
    expect(clock.done(t, T0 + 25_000)).toBe(true)
    expect(clock.result(t).places[A]).toBe(1)
    expect(clock.result(t).lines[B]).toBe('Never stopped')
  })
  it('bots stop within 0.6 s of 10', () => {
    for (let k = 0; k < 10; k++) {
      const s0 = clock.setup({ players: [A, B, C], format: 'ffa', solo: null, startAt: T0 + k * 997, random: rng(k + 1), used: [] })
      let s = s0
      for (let now = s0.startAt; now < s0.startAt + 15_000; now += 200) {
        for (const id of [A, B, C]) { const p = clock.bot(s, id, ctx(now)); if (p) s = clock.reduce(s, id, p.type, p.payload, ctx(now)) }
      }
      for (const id of [A, B, C]) expect(Math.abs(s.stops[id]! - TARGET_MS)).toBeLessThanOrEqual(600)
    }
  })
})

describe('Memory', () => {
  function toInput(s: MemoryState, now: number) {
    const t = now + showMs(s.r) + 1
    return { s: memory.tick(s, ctx(t)), now: t }
  }
  it('shows the sequence, takes answers, knocks out a miss, last one standing wins', () => {
    let s = start(memory)
    expect(litPad(s, T0 + LEAD_MS + 10)).toBe(s.seq[0])
    expect(litPad(s, T0 + LEAD_MS + LIT_MS + 20)).toBe(null)
    let now = T0
    ;({ s, now } = toInput(s, now))
    expect(s.phase).toBe('input')
    const want = s.seq.slice(0, roundLen(0))
    // Answering during the show or with junk does nothing.
    expect(memory.reduce(s, A, 'answer', { r: 0, seq: [9, 9, 9] }, ctx(now))).toBe(s)
    s = memory.reduce(s, A, 'answer', { r: 0, seq: want }, ctx(now))
    s = memory.reduce(s, B, 'answer', { r: 0, seq: want }, ctx(now))
    s = memory.reduce(s, C, 'answer', { r: 0, seq: [...want.slice(0, 2), (want[2] + 1) % 4] }, ctx(now))
    expect(s.phase).toBe('between')
    expect(s.alive).toEqual({ [A]: true, [B]: true, [C]: false })
    now = s.phaseEnd
    s = memory.tick(s, ctx(now))
    expect(s.r).toBe(1)
    ;({ s, now } = toInput(s, now))
    s = memory.reduce(s, A, 'answer', { r: 1, seq: s.seq.slice(0, 4) }, ctx(now))
    // B times out.
    now = s.phaseEnd
    s = memory.tick(s, ctx(now))
    expect(s.over).toBe(true)
    expect(memory.done(s, s.phaseEnd)).toBe(true)
    const r = memory.result(s)
    expect(r.places).toEqual({ [A]: 1, [B]: 2, [C]: 3 })
  })
  it('everyone out in the same round ties', () => {
    let s = start(memory)
    let now = T0
    ;({ s, now } = toInput(s, now))
    for (const id of [A, B, C]) s = memory.reduce(s, id, 'answer', { r: 0, seq: [0] }, ctx(now))
    expect(s.over).toBe(true)
    expect(memory.result(s).places).toEqual({ [A]: 1, [B]: 1, [C]: 1 })
  })
})

describe('Odd One Out', () => {
  it('host times the picks; a wrong tap costs 1.5 s; fastest total wins', () => {
    let s: OddState = start(oddone)
    let now = T0
    for (let r = 0; r < 5; r++) {
      now += 1000
      if (r === 2) s = oddone.reduce(s, B, 'pick', { r, i: (s.rounds[r].odd + 1) % 16 }, ctx(now - 300))
      s = oddone.reduce(s, A, 'pick', { r, i: s.rounds[r].odd }, ctx(now))
      s = oddone.reduce(s, B, 'pick', { r, i: s.rounds[r].odd }, ctx(now + 50 + (r === 2 ? 200 : 0)))
    }
    expect(s.fin[A]).toBe(5000)
    expect(s.fin[B]).toBe(5050 + WRONG_PEN)
    expect(s.wrong[B]).toBe(1)
    // Too fast after the last pick: ignored.
    const t = start(oddone)
    const t1 = oddone.reduce(t, A, 'pick', { r: 0, i: t.rounds[0].odd }, ctx(T0 + 500))
    expect(oddone.reduce(t1, A, 'pick', { r: 1, i: t1.rounds[1].odd }, ctx(T0 + 560))).toBe(t1)
    expect(oddone.reduce(t1, A, 'pick', { r: 0, i: 0 }, ctx(T0 + 900))).toBe(t1)
    const r = oddone.result(s)
    expect(r.places).toEqual({ [A]: 1, [B]: 2, [C]: 3 })
    expect(r.lines[C]).toBe('0 of 5')
  })
})

describe('Hot Potato', () => {
  it('only the holder passes, not too fast; it blows on the holder; last one standing', () => {
    let s: PotatoState = start(potato)
    const h = s.holder
    const notH = [A, B, C].find((x) => x !== h)!
    expect(potato.reduce(s, notH, 'pass', { round: 0 }, ctx(T0 + 1000))).toBe(s)
    expect(potato.reduce(s, h, 'pass', { round: 0 }, ctx(T0 + MIN_HOLD_MS - 50))).toBe(s)
    s = potato.reduce(s, h, 'pass', { round: 0 }, ctx(T0 + 600))
    expect(s.holder).not.toBe(h)
    const victim = s.holder
    s = potato.tick(s, ctx(s.boomAt))
    expect(s.phase).toBe('boom')
    expect(s.blown).toBe(victim)
    s = potato.tick(s, ctx(s.phaseAt + BOOM_SHOW_MS))
    expect(s.round).toBe(1)
    expect(s.alive[s.holder]).toBe(true)
    const second = s.holder
    s = potato.tick(s, ctx(s.boomAt))
    s = potato.tick(s, ctx(s.phaseAt + BOOM_SHOW_MS))
    expect(s.over).toBe(true)
    const r = potato.result(s)
    const winner = [A, B, C].find((x) => x !== victim && x !== second)!
    expect(r.places[winner]).toBe(1)
    expect(r.places[second]).toBe(2)
    expect(r.places[victim]).toBe(3)
    expect(r.headline).toBe(`It blew up on @{${second}}`)
  })
  it('1 vs the rest: back and forth; the solo player wins if it blows on the team', () => {
    let s = start(potato, '1v2', [A, B, C], A)
    expect(s.holder).toBe(A)
    s = potato.reduce(s, A, 'pass', { round: 0 }, ctx(T0 + 400))
    expect(s.holder).toBe(B)
    s = potato.reduce(s, B, 'pass', { round: 0 }, ctx(T0 + 800))
    expect(s.holder).toBe(A)
    s = potato.reduce(s, A, 'pass', { round: 0 }, ctx(T0 + 1200))
    expect(s.holder).toBe(C)
    s = potato.tick(s, ctx(s.boomAt))
    s = potato.tick(s, ctx(s.phaseAt + BOOM_SHOW_MS))
    expect(potato.result(s).winner).toBe('solo')
    let t = start(potato, '1v2', [A, B, C], A)
    t = potato.tick(t, ctx(t.boomAt))
    t = potato.tick(t, ctx(t.phaseAt + BOOM_SHOW_MS))
    expect(potato.result(t).winner).toBe('team')
  })
})

describe('Eight Count', () => {
  it('scores timing: dead on 100, half a beat off 0, extras cost', () => {
    const s: EightState = start(eight)
    const r = s.rounds[0]
    const on = r.pattern.map((c) => ({ c, off: 0 }))
    expect(scoreEight(r, on)).toBe(100)
    expect(scoreEight(r, r.pattern.map((c) => ({ c, off: r.beat / 4 })))).toBe(50)
    expect(scoreEight(r, [])).toBe(0)
    const extra = [1, 2, 3, 4, 5, 6, 7, 8].find((c) => !r.pattern.includes(c))!
    expect(scoreEight(r, [...on, { c: extra, off: 0 }])).toBe(Math.round(((r.pattern.length - 0.25) / r.pattern.length) * 100))
    // Tapping every count is not a strategy.
    const all = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => ({ c, off: 0 }))
    expect(scoreEight(r, all)).toBeLessThan(100)
    expect(nearestCount(r, countTime(r, 3) + 40)).toEqual({ c: 3, off: 40 })
    expect(nearestCount(r, r.oneAt - r.beat * 2)).toBe(null)
    expect(beatAt(s, r.oneAt + 5).count).toBe(1)
    expect(beatAt(s, r.oneAt - r.beat + 5)).toMatchObject({ phase: 'lead', count: 8 })
  })
  it('takes one submission per round, caps offsets and tap count, late is ignored', () => {
    let s: EightState = start(eight)
    const r = s.rounds[0]
    const huge = Array.from({ length: 40 }, () => ({ c: r.pattern[0], off: 99999 }))
    expect(eight.reduce(s, A, 'taps', { r: 0, taps: huge }, ctx(r.endAt + 10))).toBe(s)
    s = eight.reduce(s, A, 'taps', { r: 0, taps: r.pattern.map((c) => ({ c, off: 10 })) }, ctx(r.endAt + 10))
    expect(s.scores[A][0]).toBe(Math.round((1 - 10 / (r.beat * 0.5)) * 100))
    expect(eight.reduce(s, A, 'taps', { r: 0, taps: [] }, ctx(r.endAt + 20))).toBe(s)
    expect(eight.reduce(s, B, 'taps', { r: 0, taps: [] }, ctx(r.endAt + 9000))).toBe(s)
    expect(eight.reduce(s, B, 'taps', { r: 0, taps: [{ c: 9, off: 0 }] }, ctx(r.endAt + 10))).toBe(s)
  })
})

describe('Stroop', () => {
  it('checks every answer against the ink, enforces gaps and the clock', () => {
    let s: StroopState = start(stroop)
    const seed = s.seeds[A]
    const ink = (i: number) => stroopCard(seed, i).ink
    s = stroop.reduce(s, A, 'ans', { list: [{ i: 0, c: ink(0), t: 500 }, { i: 1, c: (ink(1) + 1) % 4, t: 900 }, { i: 2, c: ink(2), t: 950 }] }, ctx(T0 + 1200))
    // Third answer only 50 ms after the second: rejected, batch stops there.
    expect(s.right[A]).toBe(1)
    expect(s.wrong[A]).toBe(1)
    expect(s.idx[A]).toBe(2)
    // From the future: rejected.
    expect(stroop.reduce(s, A, 'ans', { list: [{ i: 2, c: ink(2), t: 9000 }] }, ctx(T0 + 2000))).toBe(s)
    // Wrong index: rejected.
    expect(stroop.reduce(s, A, 'ans', { list: [{ i: 5, c: ink(5), t: 1500 }] }, ctx(T0 + 2000))).toBe(s)
    const r = stroop.result(s)
    expect(r.lines[A]).toBe('1 right, 1 wrong')
    // Most cards do not match their word.
    let mismatch = 0
    for (let i = 0; i < 200; i++) if (stroopCard(seed, i).ink !== stroopCard(seed, i).word) mismatch += 1
    expect(mismatch).toBeGreaterThan(120)
  })
  it('random mashing scores nothing', () => {
    let s: StroopState = start(stroop)
    const list = Array.from({ length: 30 }, (_, i) => ({ i, c: i % 4, t: 200 + i * 130 }))
    s = stroop.reduce(s, A, 'ans', { list }, ctx(T0 + 5000))
    expect(s.idx[A]).toBe(30)
    expect(stroop.result(s).places[A]).toBeGreaterThanOrEqual(1)
    expect(s.right[A] - s.wrong[A]).toBeLessThan(5)
  })
})

describe('Math Dash', () => {
  it('right answers advance, wrong ones cost 2 s, choices only', () => {
    let s: MathState = start(math)
    for (const q of s.qs) {
      expect(q.choices).toContain(q.ans)
      expect(new Set(q.choices).size).toBe(4)
      expect(Function(`return ${q.text.replace('x', '*')}`)()).toBe(q.ans)
    }
    let now = T0
    for (let q = 0; q < 5; q++) {
      now += 1000
      if (q === 0) { s = math.reduce(s, A, 'ans', { q, v: s.qs[q].choices.find((v) => v !== s.qs[q].ans) }, ctx(now - 500)) }
      s = math.reduce(s, A, 'ans', { q, v: s.qs[q].ans }, ctx(now))
    }
    expect(s.fin[A]).toBe(5000 + MATH_PEN)
    expect(math.reduce(s, B, 'ans', { q: 0, v: 99999 }, ctx(now))).toBe(s)
    expect(math.result(s).places[A]).toBe(1)
  })
})

describe('Closest', () => {
  it('closest wins, one guess each, 1 to 100 only; co-op is the average within 10', () => {
    expect(CLUES.length).toBeGreaterThanOrEqual(20)
    for (const c of CLUES) { expect(c.answer).toBeGreaterThanOrEqual(1); expect(c.answer).toBeLessThanOrEqual(100) }
    let s: ClosestState = start(closest)
    expect(closest.reduce(s, A, 'guess', { v: 0 }, ctx(T0 + 100))).toBe(s)
    expect(closest.reduce(s, A, 'guess', { v: 101 }, ctx(T0 + 100))).toBe(s)
    s = closest.reduce(s, A, 'guess', { v: s.answer }, ctx(T0 + 100))
    expect(closest.reduce(s, A, 'guess', { v: 50 }, ctx(T0 + 200))).toBe(s)
    s = closest.reduce(s, B, 'guess', { v: Math.min(100, s.answer + 5) }, ctx(T0 + 100))
    const r = closest.result(s)
    expect(r.places[A]).toBe(1)
    expect(r.places[C]).toBe(3)
    expect(r.lines[A]).toBe(`Guessed ${s.answer} exactly`)
    expect(closest.used!(s)).toEqual([`cl:${s.clue}`])
    let c = start(closest, 'coop')
    c = closest.reduce(c, A, 'guess', { v: Math.max(1, c.answer - 12) }, ctx(T0 + 100))
    c = closest.reduce(c, B, 'guess', { v: Math.min(100, c.answer + 12) }, ctx(T0 + 100))
    expect(closest.result(c).success).toBe(true)
  })
  it('prefers clues the group has not seen', () => {
    const used = CLUES.slice(0, CLUES.length - 1).map((c) => `cl:${c.id}`)
    expect(start(closest, 'ffa', [A, B, C], null, used).clue).toBe(CLUES[CLUES.length - 1].id)
  })
})

describe('Reflex Grid', () => {
  it('hits must be the lit tile; misses cost; never the same tile twice', () => {
    let s: ReflexState = start(reflex)
    const seed = s.seeds[A]
    for (let i = 1; i < 50; i++) expect(reflexTile(seed, i)).not.toBe(reflexTile(seed, i - 1))
    s = reflex.reduce(s, A, 'hit', { list: [{ i: 0, tile: reflexTile(seed, 0), t: 300 }, { i: 1, tile: (reflexTile(seed, 1) + 1) % 9, t: 600 }, { i: 1, tile: reflexTile(seed, 1), t: 900 }] }, ctx(T0 + 1000))
    expect(s.hits[A]).toBe(2)
    expect(s.misses[A]).toBe(1)
    // 50 ms apart: too fast.
    expect(reflex.reduce(s, A, 'hit', { list: [{ i: 2, tile: reflexTile(seed, 2), t: 950 }] }, ctx(T0 + 1100))).toBe(s)
    expect(reflex.result(s).lines[A]).toBe('2 hits, 1 missed')
  })
})
