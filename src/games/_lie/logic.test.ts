import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import {
  createLieGame,
  isCopout,
  isTruth,
  sameAnswer,
  FINAL_MS,
  LIE_MS,
  PICK_MS,
  type LieItem,
  type LieState,
} from './logic'

const players: RoomPlayer[] = [
  { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true },
  { id: 'johnnyboy', name: 'Johnnyboy', color: '#6A9BFF', guest: false, connected: true },
  { id: 'torii', name: 'Torii', color: '#B67CFF', guest: false, connected: true },
]
const [D, J, T] = players.map((p) => p.id)

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}
let random = rng(7)
const ctx = (now: number, ps: RoomPlayer[] = players): GameCtx => ({ now, players: ps, mode: 'together', random })

const BANK: LieItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `q${i}`,
  prompt: `In 1932, the Australian army fought a war against ____ number ${i}.`,
  truth: 'emus',
  alt: ['emu'],
  house: ['kangaroos', 'rabbits with hats', 'koalas'],
  source: 'Test',
}))

const game = createLieGame(BANK, { kind: 'blank', maxLen: 60 })
const { setup, reduce, tick, outcome } = game

function lie(s: LieState, id: string, text: unknown, now = 1000) {
  return reduce(s, { playerId: id, type: 'lie', payload: { text } }, ctx(now))
}
function answerId(s: LieState, pred: (a: LieState['cur']['answers'][number]) => boolean) {
  const a = s.cur.answers.find(pred)
  if (!a) throw new Error('no such answer')
  return a.id
}
function pick(s: LieState, id: string, aid: string, now = 2000) {
  return reduce(s, { playerId: id, type: 'pick', payload: { answerId: aid } }, ctx(now))
}
/** All three write their own lie; returns the pick-phase state. */
function writeAll(s: LieState, now = 1000) {
  s = lie(s, D, 'dingoes in tuxedos', now)
  s = lie(s, J, 'giant wombats', now)
  s = lie(s, T, 'a flock of seagulls', now)
  return s
}
const byText = (text: string) => (a: { text: string }) => a.text === text
const truthOf = (a: { truth: boolean }) => a.truth
const houseOf = (a: { house: boolean; by: string[] }) => a.house && !a.by.length
/** Tick through the whole reveal into the next stage. */
function finishReveal(s: LieState, now: number) {
  let guard = 0
  while (s.stage === 'reveal' && guard++ < 20) { now = s.endsAt; s = tick(s, ctx(now)) }
  return { s, now }
}

describe('matching', () => {
  it('catches the truth typed as a lie', () => {
    const item = { truth: 'emus', alt: ['emu'] }
    for (const t of ['emus', 'Emus', '  the EMUS ', 'emu', 'Emus!', 'some emus', 'emuss']) expect(isTruth(t, item, 'blank')).toBe(true)
    for (const t of ['kangaroos', 'angry emus', 'emus and kangaroos and koalas', 'giant wombats', '']) expect(isTruth(t, item, 'blank')).toBe(false)
    const two = { truth: 'lawn mower' }
    expect(isTruth('lawnmower', two, 'blank')).toBe(true)
    expect(isTruth('lawn mowr', two, 'blank')).toBe(true)
    expect(isTruth('riding lawn mower', two, 'blank')).toBe(true)
    expect(isTruth('lawn chair', two, 'blank')).toBe(false)
  })
  it('catches a reworded copy of a real definition', () => {
    const item = { truth: 'a shrewd person with no principles, often a politician' }
    expect(isTruth('A shrewd person with no principles, often a politician.', item, 'word')).toBe(true)
    expect(isTruth('shrewd person with no principles often politician', item, 'word')).toBe(true)
    expect(isTruth('a politician with no principles, a shrewd person', item, 'word')).toBe(true)
    expect(isTruth('a small ghost that lives in a snowman', item, 'word')).toBe(false)
    expect(isTruth('a person who snores', item, 'word')).toBe(false)
  })
  it('spots cop-outs and duplicates', () => {
    expect(isCopout('Kangaroos', BANK[0])).toBe(true)
    expect(isCopout('rabbits with hat', BANK[0])).toBe(true)
    expect(isCopout('giant wombats', BANK[0])).toBe(false)
    expect(sameAnswer('Giant Wombats!', 'giant wombats')).toBe(true)
    expect(sameAnswer('giant wombat', 'giant wombats')).toBe(true)
    expect(sameAnswer('giant wombats', 'tiny wombats')).toBe(false)
  })
})

describe('setup', () => {
  it('builds Normal (3+3+1) and Short (2+2+1)', () => {
    random = rng(1)
    const n = setup(ctx(0), { length: 'normal' })
    expect(n.factors).toEqual([1, 1, 1, 2, 2, 2, 3])
    expect(n.items).toHaveLength(7)
    expect(new Set(n.items.map((i) => i.id)).size).toBe(7)
    const s = setup(ctx(0), { length: 'short' })
    expect(s.factors).toEqual([1, 1, 2, 2, 3])
    expect(s.items).toHaveLength(5)
    expect(setup(ctx(0), {}).items).toHaveLength(7)
    expect(s.stage).toBe('lie')
    expect(s.endsAt).toBe(LIE_MS)
    expect(s.scores).toEqual({ dixxx: 0, johnnyboy: 0, torii: 0 })
    // The House keeps one lie for itself; the other two feed "Lie for me".
    expect([s.cur.decoy, ...s.cur.spares].sort()).toEqual([...BANK[0].house].sort())
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})

describe('lie phase', () => {
  it('moves to pick early once everyone is in, with the House and the truth added', () => {
    let s = setup(ctx(0), { length: 'short' })
    s = lie(s, D, 'dingoes in tuxedos')
    s = lie(s, J, 'giant wombats')
    expect(s.stage).toBe('lie')
    s = lie(s, T, 'a flock of seagulls')
    expect(s.stage).toBe('pick')
    expect(s.endsAt).toBe(1000 + PICK_MS)
    expect(s.cur.answers).toHaveLength(5)
    expect(new Set(s.cur.answers.map((a) => a.id)).size).toBe(5)
    expect(s.cur.answers.filter((a) => a.truth)).toHaveLength(1)
    expect(s.cur.answers.filter(houseOf)).toHaveLength(1)
    expect(s.cur.answers.find(houseOf)?.text).toBe(s.cur.decoy)
  })

  it('on the timer, the House lies for anyone who did not write one (a cop-out)', () => {
    let s = setup(ctx(0), { length: 'short' })
    s = lie(s, D, 'dingoes in tuxedos')
    expect(tick(s, ctx(LIE_MS - 1))).toBe(s)
    s = tick(s, ctx(LIE_MS))
    expect(s.stage).toBe('pick')
    expect(s.cur.lies[J]).toMatchObject({ copout: true, auto: true })
    expect(s.cur.lies[T]).toMatchObject({ copout: true, auto: true })
    // two sleepy players get two different spares, and neither is the House's own lie
    expect(s.cur.lies[J].text).not.toBe(s.cur.lies[T].text)
    expect(s.cur.spares).toContain(s.cur.lies[J].text)
    expect(s.cur.answers).toHaveLength(5)
  })

  it('rejects the truth with a message, then takes a real lie', () => {
    let s = setup(ctx(0), { length: 'short' })
    const r = lie(s, D, 'The emus')
    expect(r.cur.lies[D]).toBeUndefined()
    expect(r.cur.rejected[D]).toBe('The emus')
    expect(lie(r, D, 'The emus')).toBe(r)
    s = lie(r, D, 'kangaroo cops')
    expect(s.cur.lies[D]?.text).toBe('kangaroo cops')
    expect(s.cur.rejected[D]).toBeUndefined()
  })

  it('ignores junk, wrong players, wrong phases and second lies', () => {
    const s = setup(ctx(0), { length: 'short' })
    for (const bad of [null, 42, '', '   ', ['x'], { a: 1 }]) expect(lie(s, D, bad)).toBe(s)
    expect(reduce(s, { playerId: D, type: 'lie', payload: null }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: D, type: 'lie', payload: 'just a string' }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: 'stranger', type: 'lie', payload: { text: 'hi' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: D, type: 'nonsense', payload: { text: 'hi' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: D, type: 'pick', payload: { answerId: 'a1' } }, ctx(1))).toBe(s)
    expect(reduce(s, { playerId: D, type: 'like', payload: { answerId: 'a1' } }, ctx(1))).toBe(s)
    const one = lie(s, D, 'x'.repeat(200))
    expect(one.cur.lies[D].text).toHaveLength(60)
    expect(lie(one, D, 'another one')).toBe(one)
    const ctl = lie(s, D, 'bad\u0000\ntext   here')
    expect(ctl.cur.lies[D].text).toBe('bad text here')
  })

  it('merges two identical lies and swaps the House lie if a player wrote it', () => {
    let s = setup(ctx(0), { length: 'short' })
    const decoy = s.cur.decoy
    s = lie(s, D, 'giant wombats')
    s = lie(s, J, 'Giant wombats!')
    s = lie(s, T, decoy)
    expect(s.stage).toBe('pick')
    // wombats (2 authors) + Torii's (the decoy text, a cop-out) + House (a spare) + truth
    expect(s.cur.answers).toHaveLength(4)
    const w = s.cur.answers.find((a) => a.by.includes(D))!
    expect(w.by).toEqual([D, J])
    const house = s.cur.answers.find(houseOf)!
    expect(house.text).not.toBe(decoy)
    expect(s.cur.spares).toContain(house.text)
    expect(s.cur.lies[T].copout).toBe(true)
  })
})

describe('pick phase', () => {
  it("can't pick your own lie, picks once, and reveals early when all in", () => {
    let s = writeAll(setup(ctx(0), { length: 'short' }))
    const mine = answerId(s, byText('dingoes in tuxedos'))
    expect(pick(s, D, mine)).toBe(s)
    expect(pick(s, D, 'nope')).toBe(s)
    expect(reduce(s, { playerId: D, type: 'pick', payload: null }, ctx(2000))).toBe(s)
    s = pick(s, D, answerId(s, truthOf))
    expect(pick(s, D, answerId(s, houseOf))).toBe(s)
    s = pick(s, J, mine)
    expect(s.stage).toBe('pick')
    s = pick(s, T, mine)
    expect(s.stage).toBe('reveal')
  })

  it('times out into the reveal; no pick scores nothing', () => {
    let s = writeAll(setup(ctx(0), { length: 'short' }))
    s = pick(s, D, answerId(s, truthOf))
    s = tick(s, ctx(1000 + PICK_MS))
    expect(s.stage).toBe('reveal')
    expect(s.scores).toEqual({ dixxx: 1000, johnnyboy: 0, torii: 0 })
  })
})

describe('scoring', () => {
  it('truth 1000, each fooled 500, nothing for nothing, House -250 with a floor of 0', () => {
    let s = writeAll(setup(ctx(0), { length: 'short' }))
    s = pick(s, D, answerId(s, byText('giant wombats'))) // Johnnyboy fools Dixxx
    s = pick(s, J, answerId(s, truthOf)) // Johnnyboy finds it
    s = pick(s, T, answerId(s, houseOf)) // Torii falls for the House at 0
    expect(s.stage).toBe('reveal')
    expect(s.scores).toEqual({ dixxx: 0, johnnyboy: 1500, torii: 0 })
    expect(s.cur.gains[J]).toMatchObject({ truth: 1000, fooled: 500, fooledCount: 1, net: 1500 })
    expect(s.cur.gains[T]).toMatchObject({ house: -250, net: 0 })
    expect(s.cur.gains[D]).toMatchObject({ truth: 0, fooled: 0, net: 0 })
    expect(s.before).toEqual({ dixxx: 0, johnnyboy: 0, torii: 0 })

    // Round 2: two fall for Torii's lie, Johnnyboy (1500) falls for the House.
    let now = 0
    ;({ s, now } = finishReveal(s, now))
    expect(s.stage).toBe('lie')
    expect(s.round).toBe(1)
    s = writeAll(s, now)
    s = pick(s, D, answerId(s, byText('a flock of seagulls')), now)
    s = pick(s, J, answerId(s, houseOf), now)
    expect(s.stage).toBe('pick')
    s = pick(s, T, answerId(s, truthOf), now)
    expect(s.scores).toEqual({ dixxx: 0, johnnyboy: 1250, torii: 1500 })
  })

  it('doubles in the middle and triples the final question', () => {
    let s = setup(ctx(0), { length: 'short' })
    let now = 0
    const seen: number[] = []
    for (let r = 0; r < 5; r++) {
      expect(s.stage).toBe('lie')
      const before = { ...s.scores }
      s = writeAll(s, now)
      s = pick(s, D, answerId(s, truthOf), now)
      s = pick(s, J, answerId(s, byText('dingoes in tuxedos')), now)
      s = pick(s, T, answerId(s, byText('dingoes in tuxedos')), now)
      seen.push(s.cur.factor)
      // Dixxx: truth 1000f + fooled two 500f each
      expect(s.scores[D] - before[D]).toBe(2000 * s.cur.factor)
      ;({ s, now } = finishReveal(s, now))
    }
    expect(seen).toEqual([1, 1, 2, 2, 3])
    expect(s.stage).toBe('final')
    expect(s.scores[D]).toBe(2000 * (1 + 1 + 2 + 2 + 3))
  })

  it('a cop-out that fools someone is worth half', () => {
    let s = setup(ctx(0), { length: 'short' })
    const spare = s.cur.spares[0]
    s = lie(s, D, spare)
    expect(s.cur.lies[D].copout).toBe(true)
    s = lie(s, J, 'giant wombats')
    s = lie(s, T, 'a flock of seagulls')
    s = pick(s, D, answerId(s, truthOf))
    s = pick(s, J, answerId(s, byText(spare)))
    s = pick(s, T, answerId(s, byText(spare)))
    expect(s.cur.gains[D]).toMatchObject({ truth: 1000, fooled: 500, fooledCount: 2 })
    expect(s.scores[D]).toBe(1500)
  })

  it('a shared lie pays every author', () => {
    let s = setup(ctx(0), { length: 'short' })
    s = lie(s, D, 'giant wombats')
    s = lie(s, J, 'giant wombats')
    s = lie(s, T, 'a flock of seagulls')
    const w = answerId(s, byText('giant wombats'))
    expect(pick(s, D, w)).toBe(s)
    expect(pick(s, J, w)).toBe(s)
    s = pick(s, D, answerId(s, truthOf))
    s = pick(s, J, answerId(s, truthOf))
    s = pick(s, T, w)
    expect(s.scores).toEqual({ dixxx: 1500, johnnyboy: 1500, torii: 0 })
  })
})

describe('reveal', () => {
  it('walks picked lies (least picked first), then the truth, then the tally', () => {
    let s = writeAll(setup(ctx(0), { length: 'short' }))
    const wombats = answerId(s, byText('giant wombats'))
    const dingoes = answerId(s, byText('dingoes in tuxedos'))
    s = pick(s, D, wombats)
    s = pick(s, J, dingoes)
    s = pick(s, T, dingoes, 3000)
    expect(s.cur.steps.map((x) => x.kind)).toEqual(['lie', 'lie', 'truth', 'tally'])
    expect(s.cur.steps[0].answerId).toBe(wombats)
    expect(s.cur.steps[1].answerId).toBe(dingoes)
    expect(s.cur.steps[2].answerId).toBe(answerId(s, truthOf))
    expect(s.stageStartedAt).toBe(3000)
    expect(tick(s, ctx(s.endsAt - 1))).toBe(s)
    const next = tick(s, ctx(s.endsAt))
    expect(next.cur.step).toBe(1)
    expect(next.stageStartedAt).toBe(s.endsAt)
  })

  it('goes straight to the truth when nobody was fooled', () => {
    let s = writeAll(setup(ctx(0), { length: 'short' }))
    for (const id of [D, J, T]) s = pick(s, id, answerId(s, truthOf))
    expect(s.cur.steps.map((x) => x.kind)).toEqual(['truth', 'tally'])
  })
})

describe('likes', () => {
  function revealState() {
    let s = writeAll(setup(ctx(0), { length: 'short' }))
    for (const id of [D, J, T]) s = pick(s, id, answerId(s, truthOf))
    return s
  }
  const like = (s: LieState, id: string, aid: string) => reduce(s, { playerId: id, type: 'like', payload: { answerId: aid } }, ctx(5000))

  it('+100 to the author, toggles, never your own, never the truth or the House', () => {
    let s = revealState()
    const base = { ...s.scores }
    const wombats = answerId(s, byText('giant wombats'))
    expect(like(s, J, wombats)).toBe(s)
    expect(like(s, D, answerId(s, truthOf))).toBe(s)
    expect(like(s, D, answerId(s, houseOf))).toBe(s)
    expect(like(s, D, 'zzz')).toBe(s)
    s = like(s, D, wombats)
    s = like(s, T, wombats)
    expect(s.scores[J]).toBe(base[J] + 200)
    expect(s.cur.gains[J].likes).toBe(200)
    expect(s.cur.likes[wombats]).toEqual([D, T])
    s = like(s, T, wombats)
    expect(s.scores[J]).toBe(base[J] + 100)
    expect(s.cur.likes[wombats]).toEqual([D])
    expect(s.stats[J].likes).toBe(1)
  })

  it('only during the reveal; the most-liked lie goes to the Hall of Fame', () => {
    let s = revealState()
    const wombats = answerId(s, byText('giant wombats'))
    const seagulls = answerId(s, byText('a flock of seagulls'))
    s = like(s, D, wombats)
    s = like(s, T, wombats)
    s = like(s, D, seagulls)
    let now = 5000
    ;({ s, now } = finishReveal(s, now))
    expect(s.best).toMatchObject({ playerId: J, text: 'giant wombats', likes: 2 })
    expect(like(s, D, wombats)).toBe(s)
    // play out the rest
    while (s.stage !== 'final') {
      s = writeAll(s, now)
      for (const id of [D, J, T]) s = pick(s, id, answerId(s, truthOf), now)
      ;({ s, now } = finishReveal(s, now))
    }
    expect(outcome(s, ctx(now))).toBeNull()
    s = tick(s, ctx(now + FINAL_MS))
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(now + FINAL_MS))!
    expect(out.highlights).toEqual([
      { playerId: J, kind: 'answer', label: s.best!.prompt, content: { text: 'giant wombats', likes: 2 } },
    ])
  })
})

describe('a full game', () => {
  it('plays a Short game on timers alone, and places ties together', () => {
    random = rng(99)
    let now = 10_000
    let s = setup(ctx(now), { length: 'short' })
    let guard = 0
    while (s.stage !== 'done' && guard++ < 200) {
      now = s.endsAt
      s = tick(s, ctx(now))
    }
    expect(s.stage).toBe('done')
    const out = outcome(s, ctx(now))!
    expect(out.placements).toHaveLength(3)
    // nobody did anything: everyone ties on 0 and shares first
    expect(out.placements.every((p) => p.place === 1 && p.score === 0)).toBe(true)
    expect(out.highlights).toEqual([])
    expect(out.summary).toContain('tied')
  })

  it('plays a Normal game through phones to an outcome', () => {
    random = rng(3)
    let now = 0
    let s = setup(ctx(now), { length: 'normal' })
    for (let r = 0; r < 7; r++) {
      s = writeAll(s, now)
      s = pick(s, D, answerId(s, truthOf), now)
      s = pick(s, J, answerId(s, byText('dingoes in tuxedos')), now)
      s = pick(s, T, answerId(s, truthOf), now)
      ;({ s, now } = finishReveal(s, now))
    }
    expect(s.stage).toBe('final')
    s = tick(s, ctx(s.endsAt))
    const out = outcome(s, ctx(s.endsAt))!
    expect(out.placements.map((p) => [p.playerId, p.place])).toEqual([[D, 1], [T, 2], [J, 3]])
    // factors 1,1,1,2,2,2,3 = 12; Dixxx: 1500 x 12, Torii: 1000 x 12
    expect(out.placements[0].score).toBe(1500 * 12)
    expect(out.placements[1].score).toBe(1000 * 12)
    expect(out.summary).toContain('Dixxx won with 18000')
  })

  it('works with two players', () => {
    const two = players.slice(0, 2)
    let s = setup(ctx(0, two), { length: 'short' })
    s = reduce(s, { playerId: D, type: 'lie', payload: { text: 'giant wombats' } }, ctx(1, two))
    s = reduce(s, { playerId: J, type: 'lie', payload: { text: 'dingoes in tuxedos' } }, ctx(1, two))
    expect(s.stage).toBe('pick')
    expect(s.cur.answers).toHaveLength(4)
  })
})
