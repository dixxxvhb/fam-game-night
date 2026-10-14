import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { botBet, botGuess, bot } from './bot'
import { outcome, reduce, setup, tick, type PercentState } from './logic'

const P = (id: string, name: string, isBot = false): RoomPlayer => ({ id, name, color: '#888888', guest: isBot, connected: true, ...(isBot ? { bot: true } : {}) })
const SOLO = [P('dixxx', 'Dixxx'), P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true)]

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}

/** Run the clock in 200 ms steps; only tick and the bots move the game. */
function playSolo(seed: number, rounds: number) {
  const random = rng(seed)
  let now = 5_000_000
  const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
  let s: PercentState = setup(ctx(), { rounds })
  const moves: { id: string; type: string; at: number; stage: string }[] = []
  for (let i = 0; i < 20_000 && !outcome(s, ctx()); i++) {
    now += 200
    s = tick(s, ctx())
    for (const p of SOLO.filter((x) => x.bot)) {
      const m = bot(s, p.id, ctx())
      if (!m) continue
      moves.push({ id: p.id, type: m.type, at: now - s.stageStartedAt, stage: s.stage })
      const next = reduce(s, { playerId: p.id, type: m.type, payload: m.payload }, ctx())
      expect(next).not.toBe(s) // a bot never sends a move the game rejects
      s = next
    }
  }
  return { s, out: outcome(s, ctx()), moves }
}

describe('Guess the Percent bots', () => {
  it('play a whole solo game to an outcome while the human does nothing', () => {
    const { s, out, moves } = playSolo(3, 2)
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    // Bots were the Spy twice each, locked in every time, and bet on every round they could.
    const botSpyRounds = s.history.filter((r) => r.spy !== 'dixxx')
    expect(botSpyRounds).toHaveLength(4)
    expect(botSpyRounds.every((r) => r.locked)).toBe(true)
    for (const r of s.history) {
      for (const id of ['bot-gator', 'bot-pigeon'].filter((x) => x !== r.spy)) expect(r.bets[id]).toBeDefined()
    }
    expect(Object.keys(s.final!.guesses).sort()).toEqual(['bot-gator', 'bot-pigeon'])
    // Human pace: Spy locks take 4 to 12 seconds, bets at least 2.5.
    for (const m of moves.filter((x) => x.type === 'lock')) { expect(m.at).toBeGreaterThanOrEqual(4000); expect(m.at).toBeLessThanOrEqual(12_200) }
    for (const m of moves.filter((x) => x.type === 'bet')) expect(m.at).toBeGreaterThanOrEqual(2500)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('a bot as Spy lands near the truth on average, and is sometimes way off', () => {
    const random = rng(11)
    const misses = Array.from({ length: 2000 }, () => botGuess(50, random) - 50)
    const mean = misses.reduce((a, b) => a + b, 0) / misses.length
    const sd = Math.sqrt(misses.reduce((a, b) => a + b * b, 0) / misses.length)
    expect(Math.abs(mean)).toBeLessThan(1.5)
    expect(sd).toBeGreaterThan(12)
    expect(sd).toBeLessThan(18)
    expect(botGuess(2, random)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...Array.from({ length: 500 }, () => botGuess(99, random)))).toBeLessThanOrEqual(100)
  })

  it('bets the right way about 62% of the time and goes "much" when the gap is big', () => {
    const random = rng(5)
    const far = Array.from({ length: 2000 }, () => botBet(20, 60, random))
    const right = far.filter((b) => b === 'higher' || b === 'muchHigher').length / far.length
    expect(right).toBeGreaterThan(0.57)
    expect(right).toBeLessThan(0.67)
    expect(far.filter((b) => b === 'muchHigher').length / far.length).toBeGreaterThan(0.4)
    const close = Array.from({ length: 2000 }, () => botBet(55, 60, random))
    expect(close.filter((b) => b === 'muchHigher' || b === 'muchLower').length / close.length).toBeLessThan(0.15)
  })

  it('never acts out of turn', () => {
    const random = rng(9)
    let now = 1_000_000
    const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
    const s = setup(ctx(), { rounds: 1 })
    const notSpy = SOLO.find((p) => p.id !== s.spy)!.id
    now += 20_000
    for (let i = 0; i < 50; i++) expect(bot(s, notSpy, ctx())).toBeNull()
    // Spy round over: a bot that already bet waits.
    const betting = { ...s, stage: 'bet' as const, guess: 40, stageStartedAt: now - 20_000, bets: { [notSpy]: 'higher' as const } }
    expect(bot(betting, notSpy, ctx())).toBeNull()
    expect(bot({ ...s, stage: 'reveal' }, notSpy, ctx())).toBeNull()
  })
})
