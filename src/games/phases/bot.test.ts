import { describe, expect, it } from 'vitest'
import type { GameCtx, PlayerAction, RoomPlayer } from '../../engine/types'
import { COLORS, PHASES, isWild, type Color, type Req } from './cards'
import { bot, phaseDeficit, pickDiscard, skipTarget, solveLay, wantsDiscard } from './bot'
import { autoDiscardPick, checkGroup, outcome, reduce, reqsFor, setup, tick, type PhasesState } from './logic'

const P = (id: string, name: string, isBot = false): RoomPlayer => ({ id, name, color: '#888888', guest: isBot, connected: true, ...(isBot ? { bot: true } : {}) })
const HUMAN = P('dixxx', 'Dixxx')
const GATOR = P('bot-gator', 'Gator', true)
const PIGEON = P('bot-pigeon', 'Pigeon', true)
const TOASTER = P('bot-toaster', 'Toaster', true)

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
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

/** A lay-down is valid: one group per requirement, each passes, no card twice, all from the hand. */
function expectValid(hand: number[], reqs: Req[], groups: number[][] | null) {
  expect(groups).not.toBeNull()
  expect(groups!).toHaveLength(reqs.length)
  const all = groups!.flat()
  expect(new Set(all).size).toBe(all.length)
  for (const id of all) expect(hand).toContain(id)
  groups!.forEach((g, i) => expect(checkGroup(reqs[i], g).ok, `group ${i}: ${JSON.stringify(g)}`).toBe(true))
}

const reqs = (phase: number) => PHASES[phase].reqs

// One hand per phase that makes it with real cards only, one that needs wilds, and one that can't.
const CASES: { phase: number; plain: number[]; wild: number[]; wildsNeeded: number; no: number[] }[] = [
  { phase: 0, plain: [R(3), B(3), G(3), R(8), Y(8), B(8), R(1), G(11), Y(5), B(12)], wild: [R(3), B(3), W(0), R(8), Y(8), W(1), G(11), Y(5), B(12), R(1)], wildsNeeded: 2, no: [R(3), B(3), G(3), R(8), Y(8), R(1), G(11), Y(5), B(12), S(0)] },
  { phase: 1, plain: [R(7), B(7), G(7), Y(2), R(3), B(4), G(5), R(11), Y(12), S(0)], wild: [R(7), B(7), G(7), Y(2), R(3), W(0), G(5), R(11), Y(12), S(0)], wildsNeeded: 1, no: [R(7), B(7), Y(2), R(3), G(5), R(11), Y(12), S(0), B(9), G(1)] },
  { phase: 2, plain: [R(9), B(9), G(9), Y(9), R(4), B(5), G(6), Y(7), R(1), B(12)], wild: [R(9), B(9), G(9), W(0), Y(4), B(5), W(1), Y(7), R(1), B(12)], wildsNeeded: 2, no: [R(9), B(9), G(9), Y(4), B(5), G(6), Y(7), R(1), B(12), S(1)] },
  { phase: 3, plain: [R(2), B(3), G(4), Y(5), R(6), B(7), G(8), R(12), Y(12), B(1)], wild: [R(2), B(3), W(0), Y(5), R(6), W(1), G(8), R(12), Y(12), B(12)], wildsNeeded: 2, no: [R(2), B(3), G(4), Y(5), R(6), G(8), R(12), Y(12), B(12), S(0)] },
  { phase: 4, plain: [R(5), B(6), G(7), Y(8), R(9), B(10), G(11), Y(12), R(1), B(1)], wild: [R(5), W(0), G(7), Y(8), R(9), B(10), W(1), Y(12), R(1), B(1)], wildsNeeded: 2, no: [R(5), G(7), Y(8), R(9), B(10), Y(12), R(1), B(1), G(1), S(0)] },
  { phase: 5, plain: [R(1), B(2), G(3), Y(4), R(5), B(6), G(7), Y(8), R(9), B(9)], wild: [W(0), B(2), G(3), Y(4), R(5), W(1), G(7), Y(8), W(2), B(12)], wildsNeeded: 3, no: [R(1), B(2), G(3), Y(4), R(5), G(7), Y(8), R(9), B(12), S(0)] },
  { phase: 6, plain: [R(4), B(4), G(4), Y(4), R(10), B(10), G(10), Y(10), R(1), B(2)], wild: [R(4), B(4), W(0), Y(4), R(10), B(10), G(10), W(1), R(1), B(2)], wildsNeeded: 2, no: [R(4), B(4), G(4), R(10), B(10), G(10), R(1), B(2), G(12), S(0)] },
  { phase: 7, plain: [G(1), G(3), G(5), G(7), G(9), G(11), G(12), R(1), B(2), Y(3)], wild: [G(1), G(3), W(0), G(7), G(9), W(1), G(12), R(1), B(2), Y(3)], wildsNeeded: 2, no: [G(1), G(3), G(5), G(7), G(9), G(11), R(1), B(2), Y(3), S(0)] },
  { phase: 8, plain: [R(6), B(6), G(6), Y(6), R(6, 1), R(2), B(2), Y(11), G(12), S(0)], wild: [R(6), B(6), G(6), W(0), W(1), R(2), W(2), Y(11), G(12), S(0)], wildsNeeded: 3, no: [R(6), B(6), G(6), Y(6), R(2), Y(11), G(12), S(0), B(9), R(4)] },
  { phase: 9, plain: [R(12), B(12), G(12), Y(12), R(12, 1), R(5), B(5), G(5), Y(1), S(0)], wild: [R(12), B(12), W(0), Y(12), W(1), R(5), B(5), W(2), Y(1), S(0)], wildsNeeded: 3, no: [R(12), B(12), G(12), Y(12), R(5), B(5), Y(1), S(0), G(3), B(8)] },
]

describe('Phases lay-down solver', () => {
  for (const k of CASES) {
    const r = reqs(k.phase)
    it(`Phase ${k.phase + 1} (${PHASES[k.phase].label}): real cards, with wilds, and not yet`, () => {
      const plain = solveLay(k.plain, r)
      expectValid(k.plain, r, plain)
      expect(plain!.flat().some(isWild)).toBe(false)
      const wild = solveLay(k.wild, r)
      expectValid(k.wild, r, wild)
      expect(wild!.flat().filter(isWild)).toHaveLength(k.wildsNeeded)
      expect(solveLay(k.no, r)).toBeNull()
      expect(phaseDeficit(k.no, r)).toBeGreaterThan(0)
      expect(phaseDeficit(k.plain, r)).toBe(0)
    })
  }

  it('uses fewer copies than it has when that is the only way (set of 5 + set of 2 from four 6s and three wilds)', () => {
    const hand = [R(6), B(6), G(6), Y(6), W(0), W(1), W(2), S(0), R(1)]
    // R1 + wild could be the set of 2, but the greedy split (all four 6s, then a wild) also works; force the hard one.
    const hard = [R(6), B(6), G(6), Y(6), W(0), W(1), W(2), S(0)]
    expectValid(hand, reqs(8), solveLay(hand, reqs(8)))
    expectValid(hard, reqs(8), solveLay(hard, reqs(8)))
  })

  it('leaves a card for the run when the set has a spare (set of 3 + run of 4)', () => {
    const hand = [R(5), B(5), G(5), Y(5), R(3), B(4), G(6), S(0), Y(12), R(1)]
    const g = solveLay(hand, reqs(1))
    expectValid(hand, reqs(1), g)
    expect(g![0].filter(isWild)).toHaveLength(0)
  })

  it('a group never gets only wilds', () => {
    // One real card and five wilds can't make two sets of 3; seven wilds can't make a run.
    expect(solveLay([R(3), W(0), W(1), W(2), W(3), W(4), S(0)], reqs(0))).toBeNull()
    expect(solveLay([W(0), W(1), W(2), W(3), W(4), W(5), W(6)], reqs(3))).toBeNull()
    expect(solveLay([W(0), W(1), W(2), W(3), W(4), W(5), W(6)], reqs(7))).toBeNull()
    // But 3,3 + wild and 3 + two wilds is.
    expectValid([R(3), B(3), G(3), Y(3), W(0), W(1), S(0)], reqs(0), solveLay([R(3), B(3), G(3), Y(3), W(0), W(1), S(0)], reqs(0)))
  })

  it('agrees with a brute-force search on random hands, every phase', () => {
    const random = rng(42)
    for (let phase = 0; phase < 10; phase++) {
      const r = reqs(phase)
      let found = 0
      for (let t = 0; t < 60; t++) {
        // Small number ranges and extra wilds make lay-downs common enough to test both ways.
        const top = 4 + Math.floor(random() * 9)
        const pool = [...Array.from({ length: 96 }, (_, i) => i).filter((id) => (id % 12) + 1 <= top), W(0), W(1), W(2), W(3), S(0)]
        const hand: number[] = []
        while (hand.length < 11) {
          const id = pool[Math.floor(random() * pool.length)]
          if (!hand.includes(id)) hand.push(id)
        }
        const brute = bruteLay(hand, r)
        const got = solveLay(hand, r)
        expect(got !== null, `phase ${phase + 1} hand ${JSON.stringify(hand)}`).toBe(brute)
        if (got) { expectValid(hand, r, got); found++ }
        expect(phaseDeficit(hand, r) === 0).toBe(brute)
      }
      expect(found).toBeGreaterThan(0)
    }
  })
})

/** Every subset, every way: is there any valid lay-down at all? */
function bruteLay(hand: number[], r: Req[]): boolean {
  const n = hand.length
  const valid = r.map((req) => {
    const out: number[] = []
    for (let m = 0; m < 1 << n; m++) {
      let bits = 0
      for (let x = m; x; x &= x - 1) bits++
      if (bits !== req.size) continue
      const ids = hand.filter((_, i) => m & (1 << i))
      if (checkGroup(req, ids).ok) out.push(m)
    }
    return out
  })
  if (r.length === 1) return valid[0].length > 0
  return valid[0].some((a) => valid[1].some((b) => (a & b) === 0))
}

describe('Phases bot choices', () => {
  const base = (patch: Partial<PhasesState>): PhasesState => {
    const ctx: GameCtx = { now: 1_000_000, players: [HUMAN, GATOR, PIGEON], mode: 'apart', random: rng(3) }
    return { ...structuredClone(setup(ctx, { length: 'full' })), ...structuredClone(patch) }
  }

  it('takes the discard only when it helps the phase', () => {
    const hand = [R(3), B(3), R(8), Y(8), R(1), G(11), Y(5), B(12), G(6), R(10)]
    const s = base({ current: 'bot-gator', turnStage: 'draw', hands: { 'bot-gator': hand, dixxx: [], 'bot-pigeon': [] } })
    expect(wantsDiscard(s, 'bot-gator', G(3))).toBe(true) // makes a set of 3
    expect(wantsDiscard(s, 'bot-gator', G(2))).toBe(false)
    expect(wantsDiscard(s, 'bot-gator', W(0))).toBe(true)
    expect(wantsDiscard(s, 'bot-gator', S(0))).toBe(false)
  })

  it('throws the least useful card, high penalty first, never a wild unless forced', () => {
    const hand = [R(3), B(3), G(3), R(8), Y(8), W(0), R(1), G(11), B(12), S(0)]
    expect(pickDiscard(hand, reqs(0), false)).toBe(S(0))
    const noSkip = [R(3), B(3), G(3), R(8), Y(8), W(0), R(1), G(11), B(4)]
    expect(pickDiscard(noSkip, reqs(0), false)).toBe(G(11)) // 10 points beats 5
    expect(isWild(pickDiscard([W(0), W(1)], reqs(0), false))).toBe(true)
    expect(isWild(pickDiscard([W(0), R(5)], reqs(0), true))).toBe(false)
  })

  it('aims Skips at whoever is closest to winning', () => {
    const s = base({ progress: { dixxx: 1, 'bot-gator': 0, 'bot-pigeon': 3 } })
    expect(skipTarget(s, 'bot-gator')).toBe('bot-pigeon')
    const s2 = base({ progress: { dixxx: 2, 'bot-gator': 0, 'bot-pigeon': 2 }, down: { dixxx: true, 'bot-gator': false, 'bot-pigeon': false } })
    expect(skipTarget(s2, 'bot-gator')).toBe('dixxx')
  })

  it('waits its turn and paces itself: 1.5 to 4 seconds before drawing', () => {
    const random = rng(8)
    const s = base({ current: 'bot-gator', turnStage: 'draw', stage: 'play' })
    const at = s.log.at(-1)!.at
    const ctx = (now: number): GameCtx => ({ now, players: [HUMAN, GATOR, PIGEON], mode: 'apart', random })
    expect(bot(s, 'bot-pigeon', ctx(at + 10_000))).toBeNull()
    for (let i = 0; i < 50; i++) expect(bot(s, 'bot-gator', ctx(at + 1400))).toBeNull()
    expect(bot(s, 'bot-gator', ctx(at + 4000))?.type).toBe('draw')
    expect(bot({ ...s, stage: 'roundEnd' }, 'bot-gator', ctx(at + 9000))).toBeNull()
  })
})

// ---------------- whole games: tick + bot only ----------------

interface Run { s: PhasesState; out: ReturnType<typeof outcome>; moves: Record<string, number>; draws: number[]; skipsAimed: number }

/** Step the clock; bots play through bot(), the human (if any) draws from the deck and throws the worst card. */
function playGame(players: RoomPlayer[], length: string, seed: number, step: number): Run {
  const random = rng(seed)
  let now = 10_000_000
  const ctx = (): GameCtx => ({ now, players, mode: 'apart', random })
  let s = setup(ctx(), { length })
  const moves: Record<string, number> = { draw: 0, lay: 0, hit: 0, discard: 0 }
  const draws: number[] = []
  let skipsAimed = 0
  for (let i = 0; i < 400_000 && !outcome(s, ctx()); i++) {
    now += step
    s = tick(s, ctx())
    const human = players.find((p) => !p.bot)
    if (human && s.stage === 'play' && s.current === human.id) {
      if (s.turnStage === 'draw') s = reduce(s, act(human.id, 'draw', { from: 'deck' }), ctx())
      const hand = s.hands[human.id]
      const pick = autoDiscardPick(hand)
      const next = s.order[(s.order.indexOf(human.id) + 1) % s.order.length]
      s = reduce(s, act(human.id, 'discard', { cardId: pick, target: pick >= 104 && hand.length > 1 ? next : undefined }), ctx())
    }
    for (const p of players.filter((x) => x.bot)) {
      const m = bot(s, p.id, ctx())
      if (!m) continue
      if (m.type === 'draw') draws.push(now - s.log.at(-1)!.at)
      if (m.type === 'discard' && (m.payload as { target?: string }).target) {
        skipsAimed++
        expect((m.payload as { target: string }).target).toBe(skipTarget(s, p.id))
      }
      const next = reduce(s, act(p.id, m.type, m.payload), ctx())
      expect(next, `${p.id} ${m.type} ${JSON.stringify(m.payload)}`).not.toBe(s) // every bot move is legal
      moves[m.type] += 1
      s = next
    }
  }
  return { s, out: outcome(s, ctx()), moves, draws, skipsAimed }
}

describe('Phases bots play whole games', () => {
  it('a Short solo game: the human does the minimum, two bots carry it to an outcome', () => {
    const { s, out, moves, draws } = playGame([HUMAN, GATOR, PIGEON], 'short', 21, 200)
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    // The human never lays down, so a bot finished all five phases.
    expect(s.progress.dixxx).toBe(0)
    expect(Math.max(s.progress['bot-gator'], s.progress['bot-pigeon'])).toBe(5)
    expect(out!.placements[0].playerId).not.toBe('dixxx')
    expect(moves.lay).toBeGreaterThanOrEqual(5)
    expect(moves.hit).toBeGreaterThan(0)
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(1500)
    expect(Math.max(...draws)).toBeLessThanOrEqual(4200)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  for (const [length, seed] of [['full', 31], ['odds', 32]] as const) {
    it(`three bots play a ${length} game through every phase type`, () => {
      const { s, out, moves, skipsAimed } = playGame([GATOR, PIGEON, TOASTER], length, seed, 400)
      expect(out).not.toBeNull()
      expect(Math.max(...Object.values(s.progress))).toBe(s.list.length)
      expect(moves.lay).toBeGreaterThanOrEqual(s.list.length)
      expect(skipsAimed).toBeGreaterThan(0)
    })
  }

  it('two bots alone finish a Short game too', () => {
    const { out } = playGame([GATOR, PIGEON], 'short', 41, 300)
    expect(out).not.toBeNull()
  })
})

// Keep the helpers honest: reqsFor matches the phase list.
it('reqsFor gives the bot the right phase', () => {
  const ctx: GameCtx = { now: 1, players: [GATOR, PIGEON], mode: 'apart', random: rng(1) }
  const s = setup(ctx, { length: 'odds' })
  expect(reqsFor(s, 'bot-gator')).toEqual(PHASES[0].reqs)
  expect(reqsFor({ ...s, progress: { ...s.progress, 'bot-gator': 2 } }, 'bot-gator')).toEqual(PHASES[4].reqs)
})
