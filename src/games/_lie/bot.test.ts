import { describe, expect, it } from 'vitest'
import type { GameCtx, GameDef, RoomPlayer } from '../../engine/types'
import bluff from '../bluff'
import fakeword from '../fakeword'
import { BEAT_FLIP_MS, createLieGame, isCopout, type LieItem, type LieState } from './logic'

const P = (id: string, name: string, isBot = false): RoomPlayer => ({ id, name, color: '#888888', guest: isBot, connected: true, ...(isBot ? { bot: true } : {}) })
const SOLO = [P('dixxx', 'Dixxx'), P('bot-gator', 'Gator', true), P('bot-pigeon', 'Pigeon', true)]
const BOTS = ['bot-gator', 'bot-pigeon']

function rng(seed: number) {
  let x = seed
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646 }
}

/** Run the clock in 200 ms steps; the human does nothing, tick and the bots move the game. */
function playSolo(def: GameDef<LieState>, seed: number, length: string) {
  const random = rng(seed)
  let now = 5_000_000
  const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
  let s = def.setup(ctx(), { length })
  const rounds: LieState['cur'][] = []
  let likes = 0
  const lieAt: number[] = []
  for (let i = 0; i < 30_000 && !def.outcome(s, ctx()); i++) {
    now += 200
    const before = s
    s = def.tick!(s, ctx())
    if (before.stage === 'reveal' && s.stage !== 'reveal') rounds.push(before.cur)
    for (const id of BOTS) {
      const m = def.bot!(s, id, ctx())
      if (!m) continue
      if (m.type === 'like') likes++
      if (m.type === 'lie') lieAt.push(now - s.stageStartedAt)
      const next = def.reduce(s, { playerId: id, type: m.type, payload: m.payload }, ctx())
      expect(next).not.toBe(s) // every bot move is legal
      s = next
    }
  }
  return { s, out: def.outcome(s, ctx()), rounds, likes, lieAt }
}

describe('lie engine bots', () => {
  for (const [def, length, seed] of [[bluff, 'normal', 3], [fakeword, 'normal', 4], [bluff, 'short', 5], [fakeword, 'short', 6]] as const) {
    it(`play a whole solo ${def.name} game (${length}) to an outcome while the human does nothing`, () => {
      const { s, out, rounds, lieAt } = playSolo(def, seed, length)
      expect(out).not.toBeNull()
      expect(out!.placements).toHaveLength(3)
      expect(rounds).toHaveLength(s.items.length)
      for (const cur of rounds) {
        for (const id of BOTS) {
          const l = cur.lies[id]
          expect(l.auto).toBeUndefined() // wrote its own, the House never had to
          expect(l.text).not.toBe(cur.decoy)
          expect(cur.picks[id]).toBeDefined()
          const picked = cur.answers.find((a) => a.id === cur.picks[id])!
          expect(picked.by).not.toContain(id)
        }
        // The two bots never share one lie.
        expect(cur.lies['bot-gator'].text).not.toBe(cur.lies['bot-pigeon'].text)
      }
      expect(Math.min(...lieAt)).toBeGreaterThanOrEqual(6000)
      expect(Math.max(...lieAt)).toBeLessThanOrEqual(25_200)
      expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    })
  }

  it('picks the truth about a third of the time, never its own lie, and hearts a lie now and then', () => {
    let truths = 0
    let total = 0
    let hearts = 0
    for (let seed = 1; seed <= 40; seed++) {
      const { rounds, likes } = playSolo(bluff, seed * 7, 'short')
      hearts += likes
      for (const cur of rounds) {
        for (const id of BOTS) {
          total++
          if (cur.answers.find((a) => a.id === cur.picks[id])?.truth) truths++
        }
      }
    }
    expect(truths / total).toBeGreaterThan(0.25)
    expect(truths / total).toBeLessThan(0.45)
    expect(hearts).toBeGreaterThan(0)
    expect(hearts / (40 * 5)).toBeLessThan(1.5) // now and then, not every lie
  })

  it('borrows a lie from another question when the spare House lies are taken', () => {
    const bank: LieItem[] = [
      { id: 'a', prompt: 'A ____', truth: 'apple', house: ['banana', 'cherry', 'grape'] },
      { id: 'b', prompt: 'B ____', truth: 'boat', house: ['canoe', 'raft', 'yacht'] },
    ]
    const g = createLieGame(bank, { kind: 'blank', maxLen: 40 })
    const random = rng(2)
    let now = 1_000_000
    const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
    let s = g.setup(ctx(), { length: 'short' })
    const item = s.cur.item
    const humanLie = s.cur.spares[0]
    s = g.reduce(s, { playerId: 'dixxx', type: 'lie', payload: { text: humanLie } }, ctx())
    now += 30_000
    const m1 = g.bot(s, 'bot-gator', ctx())!
    expect(m1.type).toBe('lie')
    s = g.reduce(s, { playerId: 'bot-gator', type: 'lie', payload: m1.payload }, ctx())
    const m2 = g.bot(s, 'bot-pigeon', ctx())!
    const text = (m2.payload as { text: string }).text
    const other = bank.find((b) => b.id !== item.id)!
    expect(other.house).toContain(text)
    expect(isCopout(text, item)).toBe(false)
  })

  it('likes only the lie on screen, never its own, never twice', () => {
    const random = rng(3)
    let now = 1_000_000
    const ctx = (): GameCtx => ({ now, players: SOLO, mode: 'apart', random })
    const g = createLieGame([{ id: 'a', prompt: 'A ____', truth: 'apple', house: ['banana', 'cherry', 'grape'] }], { kind: 'blank', maxLen: 40 })
    let s = g.setup(ctx(), { length: 'short' })
    for (const [id, text] of [['dixxx', 'pear'], ['bot-gator', 'plum'], ['bot-pigeon', 'kiwi']]) s = g.reduce(s, { playerId: id, type: 'lie', payload: { text } }, ctx())
    const ans = (t: string) => s.cur.answers.find((a) => a.text === t)!.id
    s = g.reduce(s, { playerId: 'dixxx', type: 'pick', payload: { answerId: ans('plum') } }, ctx())
    s = g.reduce(s, { playerId: 'bot-gator', type: 'pick', payload: { answerId: ans('pear') } }, ctx())
    s = g.reduce(s, { playerId: 'bot-pigeon', type: 'pick', payload: { answerId: ans('plum') } }, ctx())
    expect(s.stage).toBe('reveal')
    const step = s.cur.steps[s.cur.step]
    expect(step.kind).toBe('lie')
    const shown = s.cur.answers.find((a) => a.id === step.answerId)!
    now += BEAT_FLIP_MS + 100
    const author = shown.by[0]
    for (let i = 0; i < 200; i++) expect(g.bot(s, author, ctx())).toBeNull()
    const fan = BOTS.find((b) => b !== author)!
    let liked = s
    for (let i = 0; i < 2000 && liked === s; i++) {
      const m = g.bot(s, fan, ctx())
      if (m) { expect(m).toEqual({ type: 'like', payload: { answerId: shown.id } }); liked = g.reduce(s, { playerId: fan, type: m.type, payload: m.payload }, ctx()) }
    }
    expect(liked.cur.likes[shown.id]).toEqual([fan])
    for (let i = 0; i < 200; i++) expect(g.bot(liked, fan, ctx())).toBeNull()
  })
})
