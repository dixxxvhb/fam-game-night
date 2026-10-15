import { describe, expect, it } from 'vitest'
import type { GameCtx, PlayerAction, RoomPlayer } from '../../engine/types'
import { card, COLORS, LENGTHS, PHASES, isSkip, isWild, penalty, type Color, type Req } from './cards'
import {
  AWAY_MS, FINAL_END_MS, ROUND_END_MS, checkGroup, hitSpots, outcome, reduce, reqsFor, setup, tick,
  type Group, type PhasesState,
} from './logic'

// ---------------- fixtures ----------------

const P = (id: string, name: string, connected = true): RoomPlayer => ({ id, name, color: '#888888', guest: false, connected })
const SIX = [P('dixxx', 'Dixxx'), P('johnnyboy', 'Johnnyboy'), P('torii', 'Torii'), P('g-a', 'Ana'), P('g-b', 'Bo'), P('g-c', 'Cy')]
const THREE = SIX.slice(0, 3)
const TWO = SIX.slice(0, 2)

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}
function mk(players: RoomPlayer[], now = 1_000_000, seed = 7): GameCtx {
  return { now, players, mode: 'together', random: rng(seed) }
}
const act = (playerId: string, type: string, payload?: unknown): PlayerAction => ({ playerId, type, payload })

/** Card ids: color, number, copy (0 or 1). */
const c = (color: Color, n: number, copy = 0) => COLORS.indexOf(color) * 24 + copy * 12 + (n - 1)
const R = (n: number, copy = 0) => c('red', n, copy)
const B = (n: number, copy = 0) => c('blue', n, copy)
const G = (n: number, copy = 0) => c('green', n, copy)
const Y = (n: number, copy = 0) => c('yellow', n, copy)
const W = (k = 0) => 96 + k
const S = (k = 0) => 104 + k

/** Override parts of a state for a rule test (a fresh copy, nothing shared). */
function rig(s: PhasesState, patch: Partial<PhasesState>): PhasesState {
  return { ...structuredClone(s), ...structuredClone(patch) }
}

const base3 = () => rig(setup(mk(THREE), {}), { current: 'dixxx', turnStage: 'draw', discard: [R(5)] })

// ---------------- deal ----------------

describe('deck and deal', () => {
  it('has 108 cards: two of each number per color, 8 wilds, 4 skips', () => {
    const ids = Array.from({ length: 108 }, (_, i) => i)
    expect(ids.filter(isWild)).toHaveLength(8)
    expect(ids.filter(isSkip)).toHaveLength(4)
    for (const col of COLORS) {
      for (let n = 1; n <= 12; n++) expect(ids.filter((id) => card(id).color === col && card(id).n === n)).toHaveLength(2)
    }
    expect(penalty(R(1))).toBe(5)
    expect(penalty(R(9))).toBe(5)
    expect(penalty(R(10))).toBe(10)
    expect(penalty(Y(12))).toBe(10)
    expect(penalty(S())).toBe(15)
    expect(penalty(W())).toBe(25)
  })

  it('deals 10 each, flips one, keeps every card, player after the dealer starts', () => {
    for (const n of [2, 3, 6]) {
      const players = SIX.slice(0, n)
      const s = setup(mk(players), {})
      for (const p of players) expect(s.hands[p.id]).toHaveLength(10)
      expect(s.discard).toHaveLength(1)
      expect(s.deck).toHaveLength(108 - 10 * n - 1)
      const all = [...s.deck, ...s.discard, ...Object.values(s.hands).flat()]
      expect(new Set(all).size).toBe(108)
      expect(s.current).toBe(s.order[(s.dealer + 1) % n])
      expect(s.turnStage).toBe('draw')
      expect(s.round).toBe(1)
    }
  })

  it('length option picks the phase list', () => {
    expect(setup(mk(THREE), {}).list).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(setup(mk(THREE), { length: 'short' }).list).toEqual([0, 1, 2, 3, 4])
    expect(setup(mk(THREE), { length: 'odds' }).list).toEqual([0, 2, 4, 6, 8])
    expect(setup(mk(THREE), { length: 'banana' }).list).toEqual(LENGTHS.full)
  })
})

// ---------------- turns ----------------

describe('turn order', () => {
  it('draw then discard passes the turn in seat order', () => {
    const ctx = mk(THREE)
    let s = base3()
    s = reduce(s, act('dixxx', 'draw', { from: 'deck' }), ctx)
    expect(s.hands.dixxx).toHaveLength(11)
    expect(s.turnStage).toBe('play')
    expect(s.drawn).toBe(s.hands.dixxx.at(-1))
    const toss = s.hands.dixxx.find((id) => !isSkip(id))!
    s = reduce(s, act('dixxx', 'discard', { cardId: toss }), ctx)
    expect(s.discard.at(-1)).toBe(toss)
    expect(s.hands.dixxx).toHaveLength(10)
    expect(s.current).toBe('johnnyboy')
    expect(s.turnStage).toBe('draw')

    // next player takes the top of the discard
    s = rig(s, { discard: [R(5)], hands: { ...s.hands, johnnyboy: s.hands.johnnyboy.filter((id) => id !== R(5)) } })
    s = reduce(s, act('johnnyboy', 'draw', { from: 'discard' }), ctx)
    expect(s.hands.johnnyboy).toContain(R(5))
    expect(s.discard).toHaveLength(0)
    expect(s.log.at(-1)?.t).toBe('Johnnyboy took the red 5 from the discard')
    const j = s.hands.johnnyboy.find((id) => !isSkip(id))!
    s = reduce(s, act('johnnyboy', 'discard', { cardId: j }), ctx)
    expect(s.current).toBe('torii')
    const t = s
    s = reduce(s, act('torii', 'draw', { from: 'deck' }), ctx)
    s = reduce(s, act('torii', 'discard', { cardId: s.hands.torii.find((id) => !isSkip(id))! }), ctx)
    expect(t.current).toBe('torii')
    expect(s.current).toBe('dixxx')
  })

  it('rejects illegal moves by returning the same state', () => {
    const ctx = mk(THREE)
    const s0 = base3()
    // wrong player
    expect(reduce(s0, act('johnnyboy', 'draw', { from: 'deck' }), ctx)).toBe(s0)
    expect(reduce(s0, act('stranger', 'draw', { from: 'deck' }), ctx)).toBe(s0)
    // discarding, laying or hitting before drawing
    expect(reduce(s0, act('dixxx', 'discard', { cardId: s0.hands.dixxx[0] }), ctx)).toBe(s0)
    expect(reduce(s0, act('dixxx', 'lay', { groups: [[], []] }), ctx)).toBe(s0)
    expect(reduce(s0, act('dixxx', 'hit', { cardId: s0.hands.dixxx[0], groupId: 'g0' }), ctx)).toBe(s0)
    // junk
    expect(reduce(s0, act('dixxx', 'draw', { from: 'floor' }), ctx)).toBe(s0)
    expect(reduce(s0, act('dixxx', 'draw', null), ctx)).toBe(s0)
    expect(reduce(s0, act('dixxx', 'shuffle', {}), ctx)).toBe(s0)
    // a Skip on the discard can't be taken
    const sk = rig(s0, { discard: [R(2), S(1)] })
    expect(reduce(sk, act('dixxx', 'draw', { from: 'discard' }), ctx)).toBe(sk)
    // empty discard can't be taken
    const empty = rig(s0, { discard: [] })
    expect(reduce(empty, act('dixxx', 'draw', { from: 'discard' }), ctx)).toBe(empty)

    const s1 = reduce(s0, act('dixxx', 'draw', { from: 'deck' }), ctx)
    expect(s1).not.toBe(s0)
    // no second draw
    expect(reduce(s1, act('dixxx', 'draw', { from: 'deck' }), ctx)).toBe(s1)
    // discard a card you don't hold, or junk ids
    const notMine = s1.hands.johnnyboy[0]
    expect(reduce(s1, act('dixxx', 'discard', { cardId: notMine }), ctx)).toBe(s1)
    expect(reduce(s1, act('dixxx', 'discard', { cardId: 999 }), ctx)).toBe(s1)
    expect(reduce(s1, act('dixxx', 'discard', { cardId: '5' }), ctx)).toBe(s1)
    expect(reduce(s1, act('dixxx', 'discard', {}), ctx)).toBe(s1)
    // hit before your phase is down
    const own: Group = { id: 'gx', owner: 'torii', type: 'set', cards: [R(9), B(9), G(9)], n: 9, color: null }
    const s2 = rig(s1, { table: [own], hands: { ...s1.hands, dixxx: [Y(9), ...s1.hands.dixxx.slice(1)] } })
    expect(reduce(s2, act('dixxx', 'hit', { cardId: Y(9), groupId: 'gx' }), ctx)).toBe(s2)
  })
})

// ---------------- phase validation ----------------

/** A valid hand for every phase, using wilds where it's interesting. */
const VALID: number[][][] = [
  [[R(3), B(3), W(0)], [G(7), Y(7), R(7)]],
  [[R(9), B(9), G(9)], [R(4), W(0), B(6), G(7)]],
  [[R(1), B(1), G(1), W(0)], [Y(9), R(10), B(11), G(12)]],
  [[R(2), B(3), W(0), G(5), Y(6), W(1), R(8)]],
  [[R(1), B(2), G(3), Y(4), R(5), B(6), G(7), W(0)]],
  [[R(4), B(5), G(6), Y(7), R(8), B(9), G(10), Y(11), W(0)]],
  [[R(12), B(12), G(12), Y(12)], [W(0), W(1), R(2), B(2)]],
  [[B(1), B(3), B(5), B(7), B(9), W(0), B(12)]],
  [[R(6), B(6), G(6), Y(6), W(0)], [R(11), W(1)]],
  [[R(8), B(8), G(8), Y(8), R(8, 1)], [W(0), W(1), B(4)]],
]
const EXTRA = S(3)

function readyToLay(phaseIdx: number, groups: number[][], length = 'full'): PhasesState {
  const s = setup(mk(THREE), { length })
  const at = s.list.indexOf(phaseIdx)
  return rig(s, {
    current: 'dixxx',
    turnStage: 'play',
    progress: { dixxx: at, johnnyboy: 0, torii: 0 },
    hands: { ...s.hands, dixxx: [...groups.flat(), EXTRA] },
    table: [],
  })
}

describe('phase validation', () => {
  it('lays down every phase type, wilds included', () => {
    const ctx = mk(THREE)
    PHASES.forEach((_, i) => {
      const s = readyToLay(i, VALID[i])
      const n = reduce(s, act('dixxx', 'lay', { groups: VALID[i] }), ctx)
      expect(n, `phase ${i + 1}`).not.toBe(s)
      expect(n.down.dixxx).toBe(true)
      expect(n.table).toHaveLength(VALID[i].length)
      expect(n.hands.dixxx).toEqual([EXTRA])
      expect(n.log.at(-1)?.t).toBe(`Dixxx laid down Phase ${i + 1}`)
      // can't lay down twice
      expect(reduce(n, act('dixxx', 'lay', { groups: VALID[i] }), ctx)).toBe(n)
    })
  })

  it('arranges runs with wilds in the gaps', () => {
    const ctx = mk(THREE)
    const p2 = reduce(readyToLay(1, VALID[1]), act('dixxx', 'lay', { groups: VALID[1] }), ctx)
    expect(p2.table[1]).toMatchObject({ type: 'run', n: 4, cards: [R(4), W(0), B(6), G(7)] })
    const p4 = reduce(readyToLay(3, VALID[3]), act('dixxx', 'lay', { groups: VALID[3] }), ctx)
    expect(p4.table[0]).toMatchObject({ n: 2, cards: [R(2), B(3), W(0), G(5), Y(6), W(1), R(8)] })
    // extra wild goes on top unless that passes 12
    const p6 = reduce(readyToLay(5, VALID[5]), act('dixxx', 'lay', { groups: VALID[5] }), ctx)
    expect(p6.table[0].n).toBe(4)
    expect(p6.table[0].cards.at(-1)).toBe(W(0))
    expect(checkGroup({ type: 'run', size: 4 }, [R(11), W(0), B(12), W(1)])).toMatchObject({ ok: true, n: 9, cards: [W(0), W(1), R(11), B(12)] })
    expect(checkGroup({ type: 'run', size: 4 }, [W(0), R(1), W(1), B(2)])).toMatchObject({ ok: true, n: 1, cards: [R(1), B(2), W(0), W(1)] })
  })

  it('explains what is wrong in plain words', () => {
    const set3: Req = { type: 'set', size: 3 }
    const run4: Req = { type: 'run', size: 4 }
    const col7: Req = { type: 'color', size: 7 }
    expect(checkGroup(set3, [R(3), B(4)]).problem).toBe('A set is one number. You have 3 and 4.')
    expect(checkGroup(set3, [W(0), W(1), W(2)]).problem).toMatch(/All wilds/)
    expect(checkGroup(set3, [W(0), W(1)])).toMatchObject({ ok: false, problem: null, need: 1 })
    expect(checkGroup(set3, [R(3)])).toMatchObject({ ok: false, problem: null, need: 2 })
    expect(checkGroup(set3, [R(3), S(0)]).problem).toMatch(/Skips/)
    expect(checkGroup(set3, [R(3), B(3), G(3), Y(3)]).problem).toMatch(/exactly 3/)
    expect(checkGroup(run4, [R(4), B(4)]).problem).toBe("A run can't repeat a number. You have two 4s.")
    expect(checkGroup(run4, [R(1), B(6)]).problem).toBe("Too spread out. 1 to 6 won't fit in a run of 4.")
    expect(checkGroup(run4, [W(0), W(1), W(2), W(3)]).problem).toMatch(/All wilds/)
    expect(checkGroup(run4, [R(1), W(0), W(1), B(4)]).ok).toBe(true)
    expect(checkGroup(col7, [R(1), B(2)]).problem).toBe('One color only. You have red and blue.')
    expect(checkGroup(col7, [W(0), W(1), W(2), W(3), W(4), W(5), W(6)]).problem).toMatch(/All wilds/)
    expect(checkGroup(col7, [G(1), G(1, 1), G(4), W(0), G(9), G(11), G(12)]).ok).toBe(true)
  })

  it('rejects bad lay-downs', () => {
    const ctx = mk(THREE)
    const s = readyToLay(0, VALID[0])
    const bad = [
      [[R(3), B(3), W(0)]], // one group short
      [[R(3), B(3)], [G(7), Y(7), R(7)]], // too few
      [[R(3), B(3), W(0)], [G(7), Y(7), R(7), EXTRA]], // skip inside
      [[R(3), B(3), W(0)], [G(7), Y(7), B(3)]], // card used twice
      [[R(3), B(3), W(0)], [G(7), Y(7), Y(1)]], // not in hand
      [[R(3), B(3), G(7)], [W(0), Y(7), R(7)]], // mixed set
      'junk',
      [[1.5, 2, 3], [4, 5, 6]],
    ]
    for (const g of bad) expect(reduce(s, act('dixxx', 'lay', { groups: g }), ctx)).toBe(s)
    // wild-only group can't be laid
    const allWild = readyToLay(0, [[W(0), W(1), W(2)], [G(7), Y(7), R(7)]])
    expect(reduce(allWild, act('dixxx', 'lay', { groups: [[W(0), W(1), W(2)], [G(7), Y(7), R(7)]] }), ctx)).toBe(allWild)
    // a run laid where a set is needed
    const wrongShape = readyToLay(0, [[R(3), B(4), G(5)], [G(7), Y(7), R(7)]])
    expect(reduce(wrongShape, act('dixxx', 'lay', { groups: [[R(3), B(4), G(5)], [G(7), Y(7), R(7)]] }), ctx)).toBe(wrongShape)
  })
})

// ---------------- hitting ----------------

describe('hitting', () => {
  const set7: Group = { id: 'gs', owner: 'torii', type: 'set', cards: [R(7), B(7), G(7)], n: 7, color: null }
  const run36: Group = { id: 'gr', owner: 'dixxx', type: 'run', cards: [R(3), R(4), W(5), R(6)], n: 3, color: null }
  const green: Group = { id: 'gc', owner: 'johnnyboy', type: 'color', cards: [G(1), G(2), G(4), G(5), G(8), G(9), G(11)], n: 0, color: 'green' }
  const low: Group = { id: 'gl', owner: 'dixxx', type: 'run', cards: [B(1), B(2), B(3), B(4)], n: 1, color: null }
  const high: Group = { id: 'gh', owner: 'dixxx', type: 'run', cards: [B(9), B(10), B(11), B(12)], n: 9, color: null }
  const full: Group = { id: 'gf', owner: 'dixxx', type: 'run', cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => Y(n)), n: 1, color: null }

  function ready(hand: number[], table: Group[] = [set7, run36, green, low, high, full]): PhasesState {
    return rig(base3(), { turnStage: 'play', down: { dixxx: true, johnnyboy: true, torii: true }, hands: { ...base3().hands, dixxx: hand }, table })
  }
  const ctx = mk(THREE)
  const hitIt = (s: PhasesState, cardId: number, groupId: string, end?: string) => reduce(s, act('dixxx', 'hit', { cardId, groupId, end }), ctx)

  it('sets take the same number or a wild', () => {
    const s = ready([Y(7), W(1), B(5), R(1, 1)])
    const a = hitIt(s, Y(7), 'gs')
    expect(a.table[0].cards).toEqual([R(7), B(7), G(7), Y(7)])
    expect(a.hands.dixxx).toEqual([W(1), B(5), R(1, 1)])
    expect(a.log.at(-1)?.t).toBe("Dixxx put the yellow 7 on Torii's set of 7s")
    expect(hitIt(a, W(1), 'gs').table[0].cards).toHaveLength(5)
    expect(hitIt(s, B(5), 'gs')).toBe(s)
  })

  it('runs extend at either end, wilds too', () => {
    const s = ready([B(2), Y(7), B(8), W(1), R(1, 1)])
    const a = hitIt(s, B(2), 'gr')
    expect(a.table[1]).toMatchObject({ n: 2, cards: [B(2), R(3), R(4), W(5), R(6)] })
    expect(a.log.at(-1)?.t).toBe('Dixxx put the blue 2 on their own run 3 to 6')
    const b = hitIt(a, Y(7), 'gr')
    expect(b.table[1].cards.at(-1)).toBe(Y(7))
    expect(hitIt(b, B(8), 'gr').table[1].cards).toHaveLength(7)
    expect(hitIt(s, B(8), 'gr')).toBe(s) // gap: 7 isn't there yet
    // wild: default high end, or the end you ask for
    expect(hitIt(s, W(1), 'gr').table[1]).toMatchObject({ n: 3, cards: [R(3), R(4), W(5), R(6), W(1)] })
    expect(hitIt(s, W(1), 'gr', 'low').table[1]).toMatchObject({ n: 2, cards: [W(1), R(3), R(4), W(5), R(6)] })
    expect(hitIt(s, W(1), 'gr', 'middle')).toBe(s)
  })

  it('runs stop at 1 and 12', () => {
    const s = ready([W(1), R(5, 1), B(8, 1), R(1, 1), R(12, 1)])
    expect(hitSpots(low, W(1))).toEqual(['high'])
    expect(hitSpots(high, W(1))).toEqual(['low'])
    expect(hitSpots(full, W(1))).toEqual([])
    expect(hitIt(s, W(1), 'gl', 'low')).toBe(s)
    expect(hitIt(s, W(1), 'gl').table[3]).toMatchObject({ n: 1, cards: [B(1), B(2), B(3), B(4), W(1)] })
    expect(hitIt(s, W(1), 'gh').table[4]).toMatchObject({ n: 8, cards: [W(1), B(9), B(10), B(11), B(12)] })
    expect(hitIt(s, W(1), 'gh', 'high')).toBe(s)
    expect(hitIt(s, W(1), 'gf')).toBe(s)
    expect(hitIt(s, R(5, 1), 'gl').table[3].cards.at(-1)).toBe(R(5, 1))
    expect(hitIt(s, B(8, 1), 'gh').table[4].n).toBe(8)
    expect(hitIt(s, R(12, 1), 'gh')).toBe(s) // no 13
    expect(hitIt(s, R(1, 1), 'gl')).toBe(s) // no 0
  })

  it('color groups take the same color or a wild', () => {
    const s = ready([G(12), R(12), W(1)])
    expect(hitIt(s, G(12), 'gc').table[2].cards).toHaveLength(8)
    expect(hitIt(s, R(12), 'gc')).toBe(s)
    expect(hitIt(s, W(1), 'gc').table[2].cards).toHaveLength(8)
  })

  it("rejects skips, missing groups and cards you don't hold", () => {
    const s = ready([S(0), G(12), R(7, 1)])
    expect(hitIt(s, S(0), 'gs')).toBe(s)
    expect(hitIt(s, G(12), 'nope')).toBe(s)
    expect(hitIt(s, Y(7), 'gs')).toBe(s)
  })

  it('hitting your last card ends the round', () => {
    const s = ready([Y(7)])
    const n = hitIt(s, Y(7), 'gs')
    expect(n.stage).toBe('roundEnd')
    expect(n.summary?.wentOut).toBe('dixxx')
  })
})

// ---------------- skips ----------------

describe('skips', () => {
  const ctx = mk(THREE)
  const ready = (hand: number[]) => rig(base3(), { turnStage: 'play', hands: { ...base3().hands, dixxx: hand } })

  it('needs a target, never yourself, and the target loses their next turn', () => {
    const s = ready([S(0), R(5), R(6)])
    expect(reduce(s, act('dixxx', 'discard', { cardId: S(0) }), ctx)).toBe(s)
    expect(reduce(s, act('dixxx', 'discard', { cardId: S(0), target: 'dixxx' }), ctx)).toBe(s)
    expect(reduce(s, act('dixxx', 'discard', { cardId: S(0), target: 'nobody' }), ctx)).toBe(s)
    let n = reduce(s, act('dixxx', 'discard', { cardId: S(0), target: 'torii' }), ctx)
    expect(n.skips.torii).toBe(1)
    expect(n.log.at(-1)?.t).toBe('Dixxx skipped Torii')
    expect(n.current).toBe('johnnyboy')
    n = reduce(n, act('johnnyboy', 'draw', { from: 'deck' }), ctx)
    n = reduce(n, act('johnnyboy', 'discard', { cardId: n.hands.johnnyboy.find((id) => !isSkip(id))! }), ctx)
    expect(n.current).toBe('dixxx')
    expect(n.skips.torii).toBe(0)
    expect(n.log.at(-1)?.t).toBe('Torii is skipped')
  })

  it('skipping the next player passes straight over them', () => {
    const n = reduce(ready([S(0), R(5)]), act('dixxx', 'discard', { cardId: S(0), target: 'johnnyboy' }), ctx)
    expect(n.current).toBe('torii')
    expect(n.skips.johnnyboy).toBe(0)
  })

  it('with 2 players a Skip just skips the other one', () => {
    const c2 = mk(TWO)
    const s = rig(setup(c2, {}), { current: 'dixxx', turnStage: 'play' })
    const s2 = rig(s, { hands: { ...s.hands, dixxx: [S(0), R(5)] } })
    const n = reduce(s2, act('dixxx', 'discard', { cardId: S(0) }), c2)
    expect(n.current).toBe('dixxx')
    expect(n.turnStage).toBe('draw')
    expect(n.log.map((l) => l.t).slice(-2)).toEqual(['Dixxx skipped Johnnyboy', 'Johnnyboy is skipped'])
  })

  it('a Skip as your last card goes out without a target', () => {
    const s = rig(ready([S(0)]), { down: { dixxx: true, johnnyboy: false, torii: false } })
    const n = reduce(s, act('dixxx', 'discard', { cardId: S(0) }), ctx)
    expect(n.stage).toBe('roundEnd')
  })

  it('saves a moment when someone is skipped 3 times in a round', () => {
    let s = ready([S(0), S(1), S(2), R(5), R(6)])
    for (const k of [0, 1, 2]) {
      s = rig(s, { current: 'dixxx', turnStage: 'play' })
      s = reduce(s, act('dixxx', 'discard', { cardId: S(k), target: 'torii' }), ctx)
    }
    expect(s.skipped.torii).toBe(3)
    expect(s.moments).toEqual([{ playerId: 'torii', text: 'Torii got skipped 3 times in round 1' }])
  })
})

// ---------------- deck ----------------

describe('deck reshuffle', () => {
  it('shuffles the discard (minus the top) back in when the deck runs out', () => {
    const ctx = mk(THREE)
    const s = rig(base3(), { deck: [], discard: [R(1), R(2), R(3), R(4)] })
    const n = reduce(s, act('dixxx', 'draw', { from: 'deck' }), ctx)
    expect(n.discard).toEqual([R(4)])
    expect(n.deck).toHaveLength(2)
    expect([R(1), R(2), R(3)]).toContain(n.hands.dixxx.at(-1))
    expect(n.log.map((l) => l.t)).toContain('The deck ran out. Shuffled the discards back in.')
  })
})

// ---------------- rounds ----------------

describe('round end', () => {
  it('scores what is left, advances whoever laid down, then deals the next round', () => {
    const ctx = mk(THREE, 2_000_000)
    const s0 = setup(ctx, {})
    const s = rig(s0, {
      current: 'dixxx',
      turnStage: 'play',
      down: { dixxx: true, johnnyboy: false, torii: true },
      hands: { dixxx: [R(5)], johnnyboy: [R(3), R(11), W(0), S(0)], torii: [B(12)] },
      totals: { dixxx: 10, johnnyboy: 20, torii: 0 },
    })
    const n = reduce(s, act('dixxx', 'discard', { cardId: R(5) }), ctx)
    expect(n.stage).toBe('roundEnd')
    expect(n.summary?.rows).toEqual([
      { id: 'dixxx', points: 0, left: 0, advanced: true, before: 0, total: 10 },
      { id: 'johnnyboy', points: 55, left: 4, advanced: false, before: 0, total: 75 },
      { id: 'torii', points: 10, left: 1, advanced: true, before: 0, total: 10 },
    ])
    expect(n.progress).toEqual({ dixxx: 1, johnnyboy: 0, torii: 1 })
    expect(n.summary?.final).toBe(false)
    expect(n.endsAt).toBe(ctx.now + ROUND_END_MS)
    expect(outcome(n, ctx)).toBeNull()
    // nobody acts during the summary
    expect(reduce(n, act('johnnyboy', 'draw', { from: 'deck' }), ctx)).toBe(n)
    expect(tick(n, mk(THREE, ctx.now + ROUND_END_MS - 1))).toBe(n)
    const r2 = tick(n, mk(THREE, ctx.now + ROUND_END_MS))
    expect(r2.round).toBe(2)
    expect(r2.stage).toBe('play')
    expect(r2.dealer).toBe((s0.dealer + 1) % 3)
    expect(r2.current).toBe(r2.order[(r2.dealer + 1) % 3])
    for (const id of r2.order) expect(r2.hands[id]).toHaveLength(10)
    expect(r2.down).toEqual({ dixxx: false, johnnyboy: false, torii: false })
    expect(r2.table).toEqual([])
    expect(r2.totals).toEqual({ dixxx: 10, johnnyboy: 75, torii: 10 })
    expect(reqsFor(r2, 'dixxx')).toEqual(PHASES[1].reqs)
    expect(reqsFor(r2, 'johnnyboy')).toEqual(PHASES[0].reqs)
  })
})

// ---------------- game end ----------------

describe('game end', () => {
  const LAST: Record<string, number[][]> = {
    full: VALID[9],
    short: VALID[4],
    odds: VALID[8],
  }
  for (const length of ['full', 'short', 'odds']) {
    it(`ends after the round someone finishes the last phase (${length})`, () => {
      const ctx = mk(THREE, 3_000_000)
      const s0 = setup(ctx, { length })
      const last = s0.list.length - 1
      expect(PHASES[s0.list[last]].reqs).toEqual(PHASES[length === 'full' ? 9 : length === 'short' ? 4 : 8].reqs)
      let s = rig(s0, {
        current: 'dixxx',
        turnStage: 'play',
        progress: { dixxx: last, johnnyboy: last, torii: 1 },
        totals: { dixxx: 100, johnnyboy: 40, torii: 5 },
        hands: { dixxx: [...LAST[length].flat(), R(10, 1)], johnnyboy: [R(2, 1)], torii: [B(1, 1), W(7)] },
        table: [],
      })
      s = reduce(s, act('dixxx', 'lay', { groups: LAST[length] }), ctx)
      expect(s.down.dixxx).toBe(true)
      s = reduce(s, act('dixxx', 'discard', { cardId: R(10, 1) }), ctx)
      expect(s.stage).toBe('roundEnd')
      expect(s.summary?.final).toBe(true)
      expect(outcome(s, ctx)).toBeNull()
      // The final summary holds longer (tally, then the winner's scene).
      expect(s.endsAt).toBe(ctx.now + FINAL_END_MS)
      expect(tick(s, mk(THREE, ctx.now + ROUND_END_MS)).stage).toBe('roundEnd')
      s = tick(s, mk(THREE, ctx.now + FINAL_END_MS))
      expect(s.stage).toBe('done')
      const out = outcome(s, ctx)!
      // dixxx finished every phase; johnnyboy is one short despite fewer points
      expect(out.placements).toEqual([
        { playerId: 'dixxx', place: 1, score: 100 },
        { playerId: 'johnnyboy', place: 2, score: 45 },
        { playerId: 'torii', place: 3, score: 35 },
      ])
      expect(out.summary).toBe(`Dixxx finished all ${s.list.length} phases with 100 points. Points are penalties, lower is better.`)
      expect(out.highlights?.at(-1)?.kind).toBe('moment')
    })
  }

  it('ties on phases go to the lower score, full ties share a place', () => {
    const ctx = mk(THREE)
    const done = rig(setup(ctx, { length: 'short' }), {
      stage: 'done',
      progress: { dixxx: 5, johnnyboy: 5, torii: 5 },
      totals: { dixxx: 90, johnnyboy: 60, torii: 90 },
    })
    expect(outcome(done, ctx)!.placements).toEqual([
      { playerId: 'johnnyboy', place: 1, score: 60 },
      { playerId: 'dixxx', place: 2, score: 90 },
      { playerId: 'torii', place: 2, score: 90 },
    ])
    const tie = rig(done, { totals: { dixxx: 60, johnnyboy: 60, torii: 90 } })
    const out = outcome(tie, ctx)!
    expect(out.placements.map((p) => p.place)).toEqual([1, 1, 3])
    expect(out.summary).toBe('Dixxx and Johnnyboy tied: all 5 phases, 60 points each. Points are penalties, lower is better.')
  })
})

// ---------------- asleep phones ----------------

describe('disconnected auto-play', () => {
  const asleep = [P('dixxx', 'Dixxx'), P('johnnyboy', 'Johnnyboy'), P('torii', 'Torii', false)]

  it('plays the turn after 45 seconds: draw from the deck, throw the highest-penalty card', () => {
    const t0 = 5_000_000
    const s = rig(setup(mk(asleep, t0), {}), {
      current: 'torii',
      turnStage: 'draw',
      deck: [R(2, 1)],
      hands: { dixxx: [R(1)], johnnyboy: [R(2)], torii: [R(3), Y(12), W(0), S(0), B(9)] },
    })
    const a = tick(s, mk(asleep, t0))
    expect(a.awaySince).toBe(t0)
    expect(tick(a, mk(asleep, t0 + AWAY_MS - 1))).toBe(a)
    const b = tick(a, mk(asleep, t0 + AWAY_MS))
    expect(b.hands.torii).toHaveLength(5)
    expect(b.hands.torii).toContain(R(2, 1))
    expect(b.hands.torii).not.toContain(W(0))
    expect(b.discard.at(-1)).toBe(W(0))
    expect(b.current).toBe('dixxx')
    expect(b.awaySince).toBeNull()
    expect(b.log.some((l) => l.t.includes('asleep'))).toBe(true)
  })

  it('a Skip thrown for an asleep player hits the next seat', () => {
    const t0 = 6_000_000
    const s = rig(setup(mk(asleep, t0), {}), {
      current: 'torii',
      turnStage: 'play',
      awaySince: t0 - AWAY_MS,
      hands: { dixxx: [R(1)], johnnyboy: [R(2)], torii: [R(3), Y(12), S(0)] },
    })
    const n = tick(s, mk(asleep, t0))
    expect(n.discard.at(-1)).toBe(S(0))
    expect(n.log.map((l) => l.t)).toContain('Torii skipped Dixxx')
    expect(n.current).toBe('johnnyboy')
  })

  it('forgets the clock when the phone comes back, and never touches connected players', () => {
    const t0 = 7_000_000
    const s = rig(setup(mk(THREE, t0), {}), { current: 'torii', awaySince: t0 - 1000 })
    expect(tick(s, mk(THREE, t0)).awaySince).toBeNull()
    const fine = rig(s, { awaySince: null })
    expect(tick(fine, mk(THREE, t0 + 10 * AWAY_MS))).toBe(fine)
  })
})

// ---------------- full games with a simple bot ----------------

function candidates(req: Req, avail: number[]): number[][] {
  const wilds = avail.filter(isWild)
  const nums = avail.filter((id) => card(id).kind === 'num')
  const out: number[][] = []
  if (req.type === 'set') {
    for (const n of new Set(nums.map((id) => card(id).n))) {
      const same = nums.filter((id) => card(id).n === n).slice(0, req.size)
      const w = req.size - same.length
      if (w <= wilds.length) out.push([...same, ...wilds.slice(0, w)])
    }
  } else if (req.type === 'color') {
    for (const col of COLORS) {
      const same = nums.filter((id) => card(id).color === col).slice(0, req.size)
      const w = req.size - same.length
      if (same.length && w <= wilds.length) out.push([...same, ...wilds.slice(0, w)])
    }
  } else {
    for (let s = 1; s + req.size - 1 <= 12; s++) {
      const picks: number[] = []
      let w = 0
      for (let v = s; v < s + req.size; v++) {
        const hit = nums.find((id) => card(id).n === v)
        if (hit !== undefined) picks.push(hit)
        else w++
      }
      if (picks.length && w <= wilds.length) out.push([...picks, ...wilds.slice(0, w)])
    }
  }
  return out.sort((a, b) => a.filter(isWild).length - b.filter(isWild).length)
}

function findLay(hand: number[], reqs: Req[]): number[][] | null {
  if (!reqs.length) return []
  for (const g of candidates(reqs[0], hand)) {
    const rest = findLay(hand.filter((id) => !g.includes(id)), reqs.slice(1))
    if (rest) return [g, ...rest]
  }
  return null
}

function keepScore(s: PhasesState, me: string, id: number, hand: number[]): number {
  if (isSkip(id)) return -100
  if (isWild(id)) return 1000
  const cd = card(id)
  const others = hand.filter((x) => x !== id)
  let best = 0
  for (const r of reqsFor(s, me)) {
    if (r.type === 'set') best = Math.max(best, others.filter((x) => card(x).n === cd.n).length * 2)
    if (r.type === 'color') best = Math.max(best, others.filter((x) => card(x).color === cd.color).length)
    if (r.type === 'run') {
      const dupe = others.some((x) => card(x).n === cd.n)
      const near = others.filter((x) => Math.abs(card(x).n - cd.n) <= 3 && card(x).kind === 'num').length
      best = Math.max(best, dupe ? 0 : near)
    }
  }
  return best
}

function botTurn(s: PhasesState, ctx: GameCtx): PhasesState {
  const me = s.current
  const top = s.discard.at(-1)
  let useful = false
  if (top !== undefined && !isSkip(top)) {
    useful = isWild(top) || (s.down[me] ? s.table.some((g) => hitSpots(g, top).length > 0) : keepScore(s, me, top, s.hands[me]) >= 2)
  }
  s = reduce(s, act(me, 'draw', { from: useful ? 'discard' : 'deck' }), ctx)
  if (!s.down[me]) {
    const lay = findLay(s.hands[me], reqsFor(s, me))
    if (lay) s = reduce(s, act(me, 'lay', { groups: lay }), ctx)
  }
  if (s.stage !== 'play') return s
  if (s.down[me]) {
    let again = true
    while (again && s.stage === 'play') {
      again = false
      for (const id of s.hands[me]) {
        const g = s.table.find((x) => hitSpots(x, id).length > 0)
        if (g) { s = reduce(s, act(me, 'hit', { cardId: id, groupId: g.id }), ctx); again = true; break }
      }
    }
    if (s.stage !== 'play') return s
  }
  const hand = s.hands[me]
  const pick = [...hand].sort((a, b) => keepScore(s, me, a, hand) - keepScore(s, me, b, hand) || penalty(b) - penalty(a))[0]
  const next = s.order[(s.order.indexOf(me) + 1) % s.order.length]
  return reduce(s, act(me, 'discard', { cardId: pick, target: isSkip(pick) ? next : undefined }), ctx)
}

function playWhole(players: RoomPlayer[], length: string, seed: number) {
  const random = rng(seed)
  let now = 10_000_000
  const ctx = () => ({ now, players, mode: 'together' as const, random })
  let s = setup(ctx(), { length })
  for (let step = 0; step < 40_000 && s.stage !== 'done'; step++) {
    if (s.stage === 'roundEnd') { now += ROUND_END_MS; s = tick(s, ctx()); continue }
    const before = s
    s = botTurn(s, ctx())
    expect(s).not.toBe(before)
    now += 1000
    // every card is somewhere, exactly once
    if (step % 50 === 0) {
      const all = [...s.deck, ...s.discard, ...Object.values(s.hands).flat(), ...s.table.flatMap((g) => g.cards)]
      expect(all.length).toBe(108)
      expect(new Set(all).size).toBe(108)
    }
  }
  return { s, out: outcome(s, ctx()) }
}

describe('whole games', () => {
  for (const [length, players, seed] of [['short', THREE, 11], ['odds', THREE, 12], ['full', THREE, 13], ['short', TWO, 14], ['short', SIX, 15]] as const) {
    it(`plays a ${length} game with ${players.length} players to an outcome`, () => {
      const { s, out } = playWhole([...players], length, seed)
      expect(s.stage).toBe('done')
      expect(out).not.toBeNull()
      expect(out!.placements).toHaveLength(players.length)
      expect(out!.placements[0].place).toBe(1)
      expect(Math.max(...Object.values(s.progress))).toBe(s.list.length)
      expect(out!.summary).toMatch(/lower is better/)
      expect(JSON.stringify(out!.highlights ?? []).length).toBeLessThan(40_000)
      expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    })
  }
})

// ---------------- last move (for the screens) ----------------

describe('last move', () => {
  it('records each move with a rising seq', () => {
    const ctx = mk(THREE, 5_000_000)
    const s0 = setup(ctx, {})
    expect(s0.last).toMatchObject({ k: 'deal', who: s0.order[s0.dealer], seq: 1, at: ctx.now })

    let s = rig(s0, {
      current: 'dixxx', turnStage: 'draw', discard: [R(5)], deck: [G(9), B(2)],
      hands: { dixxx: [R(7), B(7), G(7), Y(4), Y(4, 1), W(0), S(0), R(12), B(7, 1)], johnnyboy: [R(1)], torii: [R(2)] },
    })
    s = reduce(s, act('dixxx', 'draw', { from: 'discard' }), ctx)
    expect(s.last).toMatchObject({ k: 'draw', who: 'dixxx', from: 'discard', card: R(5), seq: 2 })

    s = reduce(s, act('dixxx', 'lay', { groups: [[R(7), B(7), G(7)], [Y(4), Y(4, 1), W(0)]] }), ctx)
    expect(s.last?.k).toBe('lay')
    expect(s.last?.phase).toBe(0)
    expect(s.last?.groups).toEqual(s.table.map((g) => g.id))

    const sevens = s.table.find((g) => g.n === 7)!
    s = reduce(s, act('dixxx', 'hit', { cardId: B(7, 1), groupId: sevens.id }), ctx)
    expect(s.last).toMatchObject({ k: 'hit', who: 'dixxx', card: B(7, 1), group: sevens.id, seq: 4 })

    s = reduce(s, act('dixxx', 'discard', { cardId: S(0), target: 'torii' }), ctx)
    expect(s.last).toMatchObject({ k: 'skip', who: 'dixxx', card: S(0), target: 'torii', seq: 5 })
    // no undefined fields: the state stays plain JSON
    expect(Object.values(s.last!).every((v) => v !== undefined)).toBe(true)
  })

  it('a deck draw does not reveal the card', () => {
    const ctx = mk(THREE)
    const s = reduce(rig(setup(ctx, {}), { current: 'dixxx', turnStage: 'draw' }), act('dixxx', 'draw', { from: 'deck' }), ctx)
    expect(s.last).toMatchObject({ k: 'draw', from: 'deck' })
    expect(s.last?.card).toBeUndefined()
  })

  it('going out keeps how it happened', () => {
    const ctx = mk(THREE, 6_000_000)
    const s = rig(setup(ctx, {}), {
      current: 'dixxx', turnStage: 'play',
      down: { dixxx: true, johnnyboy: false, torii: false },
      hands: { dixxx: [R(5)], johnnyboy: [R(3)], torii: [B(12)] },
    })
    const n = reduce(s, act('dixxx', 'discard', { cardId: R(5) }), ctx)
    expect(n.stage).toBe('roundEnd')
    expect(n.last).toMatchObject({ k: 'out', who: 'dixxx', via: 'discard', card: R(5), seq: (s.last?.seq ?? 0) + 2 })
    expect(n.endsAt).toBe(ctx.now + ROUND_END_MS)
    const r2 = tick(n, mk(THREE, ctx.now + ROUND_END_MS))
    expect(r2.last).toMatchObject({ k: 'deal', who: r2.order[r2.dealer] })
    expect(r2.last!.seq).toBeGreaterThan(n.last!.seq)
  })
})
