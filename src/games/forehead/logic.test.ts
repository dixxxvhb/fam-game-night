import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { DECKS } from './decks'
import { bot, DEBOUNCE_MS, ON_FIRE_AT, outcome, READY_MS, recapOf, reduce, SET_MS, setup, streakOf, tick, TURN_END_MS, TURN_MS, type ForeheadState } from './logic'
import { facing, freshTilt, landscapeTurn, REARM_MS, tiltStep, type TiltState } from './tilt'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
const ids = players.map((p) => p.id)
let seed = 11
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, ps: RoomPlayer[] = players): GameCtx => ({ now, players: ps, mode: 'together', random })

/** Ready, then through the 3-2-1, into play. */
function toPlay(s: ForeheadState, now: number): { s: ForeheadState; now: number } {
  s = reduce(s, { playerId: s.guesser, type: 'ready', payload: null }, ctx(now))
  expect(s.stage).toBe('set')
  now += SET_MS
  s = tick(s, ctx(now))
  expect(s.stage).toBe('play')
  return { s, now }
}

const call = (s: ForeheadState, type: 'got' | 'pass', now: number, who = s.guesser, word = s.word) =>
  reduce(s, { playerId: who, type, payload: { word } }, ctx(now))

describe('turns', () => {
  it('rotates every player through as Guesser, twice by default, same order each lap', () => {
    const s = setup(ctx(1), {})
    expect(s.order).toHaveLength(6)
    expect(new Set(s.order.slice(0, 3))).toEqual(new Set(ids))
    expect(s.order.slice(3)).toEqual(s.order.slice(0, 3))
    expect(setup(ctx(1), { turns: 1 }).order).toHaveLength(3)
    expect(setup(ctx(1), { turns: 3 }).order).toHaveLength(9)
    expect(setup(ctx(1), { turns: 'junk' }).order).toHaveLength(6)
  })
  it('only the Guesser can start the turn, then 3-2-1, then 60 seconds', () => {
    let now = 1000
    let s = setup(ctx(now), {})
    const other = ids.find((id) => id !== s.guesser)!
    expect(reduce(s, { playerId: other, type: 'ready', payload: null }, ctx(now))).toBe(s)
    s = reduce(s, { playerId: s.guesser, type: 'ready', payload: null }, ctx(now))
    expect(s.stage).toBe('set')
    expect(reduce(s, { playerId: s.guesser, type: 'ready', payload: null }, ctx(now))).toBe(s)
    now += SET_MS - 1
    expect(tick(s, ctx(now))).toBe(s)
    now += 1
    s = tick(s, ctx(now))
    expect(s.stage).toBe('play')
    expect(s.endsAt).toBe(now + TURN_MS)
    now += TURN_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('turnEnd')
    now += TURN_END_MS
    s = tick(s, ctx(now))
    expect(s.stage).toBe('ready')
    expect(s.turn).toBe(1)
    expect(s.guesser).toBe(s.order[1])
  })
  it('starts the turn on its own if the Guesser never taps Ready', () => {
    let s = setup(ctx(1), {})
    s = tick(s, ctx(1 + READY_MS))
    expect(s.stage).toBe('set')
  })
})

describe('got and pass', () => {
  it('counts gots and passes and moves to a new word each time', () => {
    let { s, now } = toPlay(setup(ctx(1), {}), 1)
    const g = s.guesser
    const w1 = s.word
    now += 2000
    s = call(s, 'got', now)
    expect(s.word).not.toBe(w1)
    now += 1500
    s = call(s, 'pass', now)
    now += 1500
    s = call(s, 'got', now)
    expect(s.calls.map((c) => c.got)).toEqual([true, false, true])
    expect(s.calls[0]).toMatchObject({ word: w1, ms: 2000 })
    expect(s.guessed[g]).toBe(2)
    expect(new Set(s.calls.map((c) => c.word)).size).toBe(3)
  })
  it('pays the Guesser 2 and every actor 1 per word the Guesser gets', () => {
    let { s, now } = toPlay(setup(ctx(1), {}), 1)
    const g = s.guesser
    const actors = ids.filter((id) => id !== g)
    for (let i = 0; i < 3; i++) { now += 1000; s = call(s, 'got', now) }
    now += 1000
    s = call(s, 'pass', now)
    expect(s.guessed[g]).toBe(3)
    for (const a of actors) {
      expect(s.acted[a]).toBe(3)
      expect(s.scores[a]).toBe(3)
    }
    expect(s.acted[g]).toBe(0)
    expect(s.scores[g]).toBe(6)
  })
  it('only takes calls from the Guesser, in play, for the word on screen', () => {
    const started = toPlay(setup(ctx(1), {}), 1)
    const s = started.s
    let now = started.now
    now += 1000
    const other = ids.find((id) => id !== s.guesser)!
    expect(call(s, 'got', now, other)).toBe(s)
    expect(call(s, 'got', now, s.guesser, 'not the word')).toBe(s)
    expect(reduce(s, { playerId: s.guesser, type: 'got', payload: null }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: s.guesser, type: 'got', payload: { word: 42 } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: s.guesser, type: 'got', payload: 'junk' }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: 'stranger', type: 'got', payload: { word: s.word } }, ctx(now))).toBe(s)
    expect(reduce(s, { playerId: s.guesser, type: 'bogus', payload: { word: s.word } }, ctx(now))).toBe(s)
    // after the clock
    expect(call(s, 'got', s.endsAt)).toBe(s)
    // not before play
    const fresh = setup(ctx(1), {})
    expect(call(fresh, 'got', 2)).toBe(fresh)
  })
})

describe('debounce', () => {
  it('rejects a repeated got for the same word (it already moved on)', () => {
    let { s, now } = toPlay(setup(ctx(1), {}), 1)
    now += 2000
    const w = s.word
    s = call(s, 'got', now)
    // the same tilt arrives twice: second one still names the old word
    expect(call(s, 'got', now + 50, s.guesser, w)).toBe(s)
    expect(call(s, 'got', now + 2000, s.guesser, w)).toBe(s)
    expect(s.calls).toHaveLength(1)
  })
  it(`rejects any call within ${DEBOUNCE_MS} ms of the last one, even for the new word`, () => {
    let { s, now } = toPlay(setup(ctx(1), {}), 1)
    // too soon after the turn starts
    expect(call(s, 'got', now + 100)).toBe(s)
    now += 1000
    s = call(s, 'got', now)
    expect(call(s, 'got', now + 200)).toBe(s)
    expect(call(s, 'pass', now + DEBOUNCE_MS - 1)).toBe(s)
    s = call(s, 'got', now + DEBOUNCE_MS)
    expect(s.calls).toHaveLength(2)
  })
  it('fires one call per tilt on the phone, with a re-arm', () => {
    let st: TiltState = freshTilt()
    const calls: string[] = []
    const feed = (beta: number, gamma: number, t: number) => {
      const r = tiltStep(st, beta, gamma, t)
      st = r.st
      if (r.call) calls.push(r.call)
    }
    // Upright in landscape (screen at the room): arms, no call.
    feed(0, -90, 0)
    expect(st.armed).toBe(true)
    // Nod down: screen to the floor. A burst of events while tilted is one call.
    for (let t = 10; t < 400; t += 16) feed(170, 40, t)
    expect(calls).toEqual(['got'])
    // Back upright too fast: not re-armed yet.
    feed(0, -88, 450)
    feed(0, 20, 500) // tilt up again immediately
    expect(calls).toEqual(['got'])
    // Upright long enough: re-arms. Then tilt up = pass.
    feed(0, -89, 450 + REARM_MS)
    feed(10, -30, 450 + REARM_MS + 20)
    expect(calls).toEqual(['got', 'pass'])
    // Junk readings do nothing.
    const before = st
    feed(NaN, 3, 5000)
    expect(st).toBe(before)
    expect(tiltStep(st, null, null, 9999).call).toBeNull()
  })
  it('does not fire if the phone starts tilted (needs upright first)', () => {
    const r = tiltStep(freshTilt(), 170, 60, 0)
    expect(r.call).toBeNull()
    expect(r.st.armed).toBe(false)
  })
  it('reads facing the same in portrait and both landscapes', () => {
    expect(facing(0, 0)).toBeCloseTo(1)
    expect(facing(180, 0)).toBeCloseTo(-1)
    expect(facing(90, 0)).toBeCloseTo(0)
    expect(facing(0, 90)).toBeCloseTo(0)
    expect(facing(0, -90)).toBeCloseTo(0)
    expect(landscapeTurn(0, -90)).toBe(90)
    expect(landscapeTurn(0, 90)).toBe(-90)
    expect(landscapeTurn(0, 5, -90)).toBe(-90)
    expect(landscapeTurn(null, null)).toBe(90)
  })
})

describe('a full game', () => {
  it('plays every turn to placements with a fastest-guess moment', () => {
    let now = 10_000
    let s = setup(ctx(now), { turns: 2, deck: 'dance' })
    const gotBy: Record<string, number> = {}
    for (let turn = 0; turn < 6; turn++) {
      expect(s.stage).toBe('ready')
      ;({ s, now } = toPlay(s, now))
      const g = s.guesser
      // Seat order decides how good you are tonight.
      const n = 1 + ids.indexOf(g) + (turn >= 3 ? 1 : 0)
      for (let i = 0; i < n; i++) { now += 1200 + i * 100; s = call(s, 'got', now) }
      now += 800
      s = call(s, 'pass', now)
      gotBy[g] = (gotBy[g] ?? 0) + n
      now = s.endsAt
      s = tick(s, ctx(now))
      expect(s.stage).toBe('turnEnd')
      expect(outcome(s, ctx(now))).toBeNull()
      now += TURN_END_MS
      s = tick(s, ctx(now))
    }
    expect(s.stage).toBe('done')
    expect(s.turns).toHaveLength(6)
    for (const id of ids) expect(s.guessed[id]).toBe(gotBy[id])
    const total = Object.values(gotBy).reduce((a, b) => a + b, 0)
    // Every actor gets every word somebody else guessed.
    for (const id of ids) expect(s.acted[id]).toBe(total - gotBy[id])
    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    for (const p of out.placements) expect(p.score).toBe(s.scores[p.playerId])
    expect(out.highlights).toHaveLength(1)
    expect(out.highlights![0]).toMatchObject({ kind: 'moment', content: { ms: 1200 } })
    expect(out.summary).toContain(`The room got ${total} words`)
  })
  it('places by total and shares a tie', () => {
    let now = 1
    let s = setup(ctx(now), { turns: 1 })
    while (s.stage !== 'done') { now += 100_000; s = tick(s, ctx(now)) }
    const out = outcome(s, ctx(now))!
    expect(out.placements.every((p) => p.place === 1)).toBe(true)
    expect(out.highlights).toEqual([])
    expect(out.summary).toContain('Nobody got a single word')
  })
  it('ranks by guessing: guesser +2 and each actor +1 per word', () => {
    let now = 1
    let s = setup(ctx(now), { turns: 1 })
    ;({ s, now } = toPlay(s, now))
    for (let i = 0; i < 4; i++) { now += 1000; s = call(s, 'got', now) }
    const first = s.guesser
    expect(s.scores[first]).toBe(8)
    for (const id of ids.filter((x) => x !== first)) expect(s.scores[id]).toBe(4)
  })
  it('never runs out of words', () => {
    let { s, now } = toPlay(setup(ctx(1), { deck: 'florida' }), 1)
    for (let i = 0; i < DECKS.florida.words.length + 5; i++) {
      now += DEBOUNCE_MS
      s = { ...s, endsAt: now + 10_000 }
      s = call(s, 'pass', now)
      expect(typeof s.word).toBe('string')
      expect(s.word.length).toBeGreaterThan(0)
    }
  })
})

describe('decks', () => {
  it('has at least 300 unique words, clean and emoji free', () => {
    const all = Object.entries(DECKS).filter(([k]) => k !== 'mixed').flatMap(([, d]) => d.words)
    const lower = all.map((w) => w.toLowerCase().trim())
    expect(new Set(lower).size).toBe(all.length)
    expect(all.length).toBeGreaterThanOrEqual(300)
    expect(DECKS.mixed.words.length).toBe(all.length)
    for (const w of all) {
      expect(w.trim()).toBe(w)
      expect(w.length).toBeGreaterThan(1)
      expect(w.length).toBeLessThanOrEqual(28)
      expect(/\p{Extended_Pictographic}/u.test(w)).toBe(false)
      expect(/[—\u{1F000}-\u{1FFFF}]/u.test(w)).toBe(false)
    }
    for (const key of ['classic', 'movies', 'dance', 'celebrities', 'florida', 'mixed']) {
      expect(DECKS[key].words.length).toBeGreaterThanOrEqual(50)
    }
  })
  it('falls back to Mixed for an unknown deck', () => {
    expect(setup(ctx(1), { deck: 'nope' }).deck).toBe('mixed')
  })
})

describe('bots', () => {
  const solo: RoomPlayer[] = [
    { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
    { id: 'bot-gator', name: 'Gator', color: '#2DD4BF', guest: true, connected: true, bot: true },
    { id: 'bot-pigeon', name: 'Pigeon', color: '#94A3B8', guest: true, connected: true, bot: true },
  ]
  const bots = solo.filter((p) => p.bot).map((p) => p.id)

  it('one idle human and two bots finish a game on tick + bot alone', () => {
    let now = 5_000_000
    let s = setup(ctx(now, solo), {})
    for (let step = 0; step < 20_000 && !outcome(s, ctx(now, solo)); step++) {
      now += 200
      s = tick(s, ctx(now, solo))
      for (const id of bots) {
        const move = bot(s, id, ctx(now, solo))
        if (move) s = reduce(s, { playerId: id, type: move.type, payload: move.payload }, ctx(now, solo))
      }
    }
    const out = outcome(s, ctx(now, solo))
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    // The idle human got nothing as Guesser; the bots got words on their turns.
    expect(s.guessed.dixxx).toBe(0)
    for (const b of bots) expect(s.guessed[b]).toBeGreaterThan(0)
    // Every word that went up is remembered for next time.
    const shown = s.turns.flatMap((t) => t.calls.map((c) => c.word))
    expect(out!.used!.length).toBe(new Set(shown).size)
    expect(out!.used!.length).toBeGreaterThan(5)
  })

  it('only moves on its own turn, and no faster than a person', () => {
    let s = setup(ctx(1, solo), {})
    const other = bots.find((b) => b !== s.guesser) ?? bots[0]
    if (s.guesser === 'dixxx') for (let i = 0; i < 50; i++) expect(bot(s, bots[0], ctx(10_000, solo))).toBeNull()
    for (let i = 0; i < 50; i++) if (other !== s.guesser) expect(bot(s, other, ctx(10_000, solo))).toBeNull()
    // force a bot turn in play, right after a call: it waits
    s = { ...s, guesser: 'bot-gator', stage: 'play', lastCallAt: 100_000, endsAt: 200_000 }
    for (let i = 0; i < 100; i++) expect(bot(s, 'bot-gator', ctx(101_000, solo))).toBeNull()
  })

  it('puts words this group has not seen first', () => {
    const words = DECKS.florida.words
    const seen = words.slice(0, words.length - 10)
    const s = setup({ ...ctx(1), used: seen }, { deck: 'florida' })
    expect(seen).not.toContain(s.word)
    for (const w of s.queue.slice(0, 9)) expect(seen).not.toContain(w)
  })
})

describe('the show: streaks and recap', () => {
  const c = (got: boolean, ms = 3000, word = 'x'): import('./logic').Call => ({ word, got, at: 0, ms })
  it('counts the gots in a row at the end, a pass resets it', () => {
    expect(streakOf([])).toBe(0)
    expect(streakOf([c(true), c(true)])).toBe(2)
    expect(streakOf([c(true), c(false)])).toBe(0)
    expect(streakOf([c(true), c(false), c(true), c(true), c(true)])).toBe(3)
    expect(streakOf([c(true), c(true), c(true)]) >= ON_FIRE_AT).toBe(true)
  })
  it('recaps a turn: got, passed, best run, fastest got', () => {
    expect(recapOf([])).toEqual({ got: 0, passed: 0, best: 0, fastest: null })
    const r = recapOf([c(true, 4000, 'a'), c(true, 1500, 'b'), c(false, 900, 'c'), c(true, 2000, 'd')])
    expect(r.got).toBe(3)
    expect(r.passed).toBe(1)
    expect(r.best).toBe(2)
    expect(r.fastest?.word).toBe('b')
  })
  it('tracks the streak live through a real turn', () => {
    let s = setup(ctx(1), {})
    let now = 1
    ;({ s, now } = toPlay(s, now))
    for (const t of ['got', 'got', 'got', 'pass', 'got'] as const) { now += DEBOUNCE_MS + 10; s = call(s, t, now) }
    expect(recapOf(s.calls).best).toBe(3)
    expect(streakOf(s.calls)).toBe(1)
  })
})

describe('apart mode', () => {
  it('lists apart, and a game with two bots plays to the end the same way over a call', async () => {
    const def = (await import('./index')).default
    expect(def.modes).toEqual(['together', 'apart'])
    const ps: RoomPlayer[] = [players[0], { ...players[1], bot: true }, { ...players[2], bot: true }]
    const actx = (now: number): GameCtx => ({ now, players: ps, mode: 'apart', random })
    let s = setup(actx(1), { turns: 1 })
    let now = 1
    for (let i = 0; i < 20_000 && s.stage !== 'done'; i++) {
      now += 200
      s = tick(s, actx(now))
      for (const p of ps.filter((x) => x.bot)) {
        const m = bot(s, p.id, actx(now))
        if (m) s = reduce(s, { playerId: p.id, type: m.type, payload: m.payload ?? null }, actx(now))
      }
    }
    expect(s.stage).toBe('done')
    expect(outcome(s, actx(now))?.placements).toHaveLength(3)
  })
})

describe('show reads', () => {
  it('a call is a moment for a second, then it is not; the mood follows', async () => {
    const { momentOf, moodFor, MOMENT_MS } = await import('./show')
    let s = setup(ctx(1), {})
    let now = 1
    ;({ s, now } = toPlay(s, now))
    expect(momentOf(s, () => now)).toBeNull()
    expect(moodFor(s, null)).toBe('think')
    now += DEBOUNCE_MS + 10
    s = call(s, 'got', now)
    expect(momentOf(s, () => now + 100)?.got).toBe(true)
    expect(moodFor(s, momentOf(s, () => now + 100))).toBe('happy')
    expect(momentOf(s, () => now + MOMENT_MS)).toBeNull()
    now += DEBOUNCE_MS + 10
    s = call(s, 'pass', now)
    expect(moodFor(s, momentOf(s, () => now))).toBe('oops')
  })
})
