import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { bot, topOutRate } from './bot'
import { botSnap, botStyle, packJar, simJar, stepsAt } from './botjar'
import { fruit, WORLD_H, WORLD_W } from './fruits'
import { outcome, reduce, READY_MS, setup, tick, type MelonState } from './logic'

const P = (id: string, name: string, isBot = false): RoomPlayer => ({ id, name, color: '#888888', guest: isBot, connected: true, ...(isBot ? { bot: true } : {}) })
const SOLO = [P('dixxx', 'Dixxx'), P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true)]
const BOTS = ['bot-gator', 'bot-pigeon']

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}

/** Run the clock in 200 ms steps; the human's phone does nothing, tick and the bots move the game. */
function playSolo(opts: Record<string, string | number>, seed: number) {
  const random = rng(seed)
  let now = 2_000_000_000
  const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
  let s: MelonState = setup(ctx(), opts)
  const moves: Record<string, number> = {}
  const scores: Record<string, number[]> = { 'bot-gator': [], 'bot-pigeon': [] }
  for (let i = 0; i < 5000 && !outcome(s, ctx()); i++) {
    now += 200
    s = tick(s, ctx())
    for (const id of BOTS) {
      const m = bot(s, id, ctx())
      if (!m) continue
      const next = reduce(s, { playerId: id, type: m.type, payload: m.payload }, ctx())
      // Attacks can bounce off a full queue; everything else a bot sends lands.
      if (m.type !== 'attack') expect(next, `${id} ${m.type}`).not.toBe(s)
      moves[m.type] = (moves[m.type] ?? 0) + (next !== s ? 1 : 0)
      if (m.type === 'score') scores[id].push((m.payload as { score: number }).score)
      s = next
    }
  }
  return { s, out: outcome(s, ctx()), moves, scores, now }
}

describe('Melon bots', () => {
  it('race a whole solo game to the clock while the human does nothing', () => {
    const { s, out, moves, scores } = playSolo({ mode: 'race', length: 2 }, 5)
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    expect(s.endedBy === 'clock' || s.endedBy === 'out').toBe(true)
    for (const id of BOTS) {
      expect(s.players[id].score).toBeGreaterThan(200)
      expect(s.players[id].best).toBeGreaterThanOrEqual(5)
      // Bursts: the score only goes up, in jumps, not every tick.
      const xs = scores[id]
      expect(xs.every((v, i) => i === 0 || v > xs[i - 1])).toBe(true)
      expect(xs.length).toBeLessThan(2 * 60 * 5 * 0.5)
      expect(s.players[id].sent).toBeUndefined() // no attacks in Race
    }
    expect(moves.attack ?? 0).toBe(0)
    expect(out!.placements.find((p) => p.playerId === 'dixxx')!.place).toBe(3)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('play Attack: throw junk, take junk in, and the game ends', () => {
    const { s, out, moves } = playSolo({ mode: 'attack' }, 6)
    expect(out).not.toBeNull()
    expect(moves.attack).toBeGreaterThan(3)
    expect(moves.absorb).toBeGreaterThan(0)
    const sent = BOTS.reduce((a, id) => a + (s.players[id].sent ?? 0), 0)
    expect(sent).toBe(moves.attack)
    expect(BOTS.some((id) => (s.players[id].junkIn ?? []).length > 0)).toBe(true)
    // The human never plays, so the bots bury each other first.
    expect(BOTS.some((id) => !s.players[id].alive)).toBe(true)
  })

  it('a bot tops out sometimes in a 3 minute race, but not every time', () => {
    let outs = 0
    for (let seed = 1; seed <= 16; seed++) {
      const { s } = playSolo({ mode: 'race', length: 3 }, seed * 13)
      outs += BOTS.filter((id) => !s.players[id].alive).length
    }
    expect(outs).toBeGreaterThan(0)
    expect(outs).toBeLessThan(28)
  })

  it('never acts outside play or after topping out', () => {
    const random = rng(2)
    const ctx = (now: number): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
    const s = setup(ctx(1_000_000), {})
    expect(bot(s, 'bot-gator', ctx(1_000_000 + 1000))).toBeNull()
    const playing = tick(s, ctx(1_000_000 + READY_MS))
    const out = { ...playing, players: { ...playing.players, 'bot-gator': { ...playing.players['bot-gator'], alive: false } } }
    for (let i = 0; i < 50; i++) expect(bot(out, 'bot-gator', ctx(1_000_000 + 60_000))).toBeNull()
    expect(bot(playing, 'nobody', ctx(1_000_000 + 60_000))).toBeNull()
  })

  it('top-out odds climb with a crowded jar and late in a race', () => {
    const s = { mode: 'race' as const, startsAt: 0, total: 180_000 }
    expect(topOutRate(s, { fill: 0.5 }, 170_000)).toBe(0)
    expect(topOutRate(s, { fill: 0.9 }, 170_000)).toBeGreaterThan(topOutRate(s, { fill: 0.9 }, 30_000))
    expect(topOutRate(s, { fill: 0.95 }, 30_000)).toBeGreaterThan(topOutRate(s, { fill: 0.8 }, 30_000))
  })

  it('only bots get the bookkeeping fields, humans play exactly as before', () => {
    const random = rng(4)
    const ctx = (now: number): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
    let s = tick(setup(ctx(0), { mode: 'attack' }), ctx(READY_MS))
    // Pigeon leads, so both attacks below land on Pigeon.
    s = reduce(s, { playerId: 'bot-pigeon', type: 'score', payload: { score: 50 } }, ctx(4000))
    s = reduce(s, { playerId: 'dixxx', type: 'attack', payload: { n: 2 } }, ctx(5000))
    expect(s.players.dixxx.sent).toBeUndefined()
    s = reduce(s, { playerId: 'bot-gator', type: 'attack', payload: { n: 3 } }, ctx(5100))
    expect(s.players['bot-gator'].sent).toBe(1)
    const [a, b] = s.players['bot-pigeon'].incoming
    s = reduce(s, { playerId: 'bot-pigeon', type: 'absorb', payload: { id: a.id } }, ctx(6000))
    expect(s.players['bot-pigeon'].junkIn).toEqual([{ at: 6000, n: 2 }])
    s = reduce(s, { playerId: 'bot-pigeon', type: 'absorb', payload: { id: b.id } }, ctx(6100))
    expect(s.players['bot-pigeon'].junkIn).toEqual([{ at: 6000, n: 2 }, { at: 6100, n: 3 }])
    // Now the human leads and takes a hit: same shape as before bots existed.
    s = reduce(s, { playerId: 'dixxx', type: 'score', payload: { score: 500 } }, ctx(6200))
    s = reduce(s, { playerId: 'bot-gator', type: 'attack', payload: { n: 4 } }, ctx(6300))
    const hit = s.players.dixxx.incoming[0]
    s = reduce(s, { playerId: 'dixxx', type: 'absorb', payload: { id: hit.id } }, ctx(6400))
    expect(s.players.dixxx).toEqual({ score: 500, alive: true, best: 0, bestAt: 0, outAt: null, incoming: [] })
  })
})

describe('bot jar model and picture', () => {
  it('fills a jar plausibly as the clock runs: more fruit, bigger fruit, all inside the walls', () => {
    const style = botStyle('bot-gator', 123)
    let prevScore = -1
    for (const secs of [5, 30, 60, 120, 180]) {
      const steps = stepsAt(style, 0, secs * 1000)
      const jar = simJar(style, steps, 0)
      expect(jar.score).toBeGreaterThanOrEqual(prevScore)
      prevScore = jar.score
      const placed = packJar(jar.fruits)
      expect(placed).toHaveLength(jar.fruits.length)
      for (const f of placed) {
        const r = fruit(f.tier).r
        expect(f.x).toBeGreaterThanOrEqual(r - 0.01)
        expect(f.x).toBeLessThanOrEqual(WORLD_W - r + 0.01)
        expect(f.y).toBeLessThanOrEqual(WORLD_H - r + 0.01)
      }
      // Resting fruit barely overlap (a picture, not physics, but no stacking through each other).
      for (let i = 0; i < placed.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = placed[i]
          const b = placed[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (a.y > fruit(a.tier).r) expect(d).toBeGreaterThan((fruit(a.tier).r + fruit(b.tier).r) * 0.97)
        }
      }
    }
    expect(simJar(style, stepsAt(style, 0, 120_000), 0).best).toBeGreaterThanOrEqual(5)
  })

  it('is the same jar on every screen, and junk lands in it', () => {
    const a = botSnap('bot-pigeon', 777, 777 + 90_000)
    const b = botSnap('bot-pigeon', 777, 777 + 90_000)
    expect(b).toBe(a) // cached
    const style = botStyle('bot-pigeon', 777)
    const fresh = simJar(style, stepsAt(style, 777, 777 + 90_000), 777)
    expect(a.s).toBe(fresh.score)
    expect(a.f).toHaveLength(fresh.fruits.length)
    const junky = simJar(style, stepsAt(style, 777, 777 + 90_000), 777, [{ at: 777 + 40_000, n: 6 }, { at: 777 + 50_000, n: 6 }])
    expect(junky.fill).not.toBe(fresh.fill)
    expect(botSnap('bot-gator', 777, 777 + 90_000)).not.toEqual(a)
  })
})
