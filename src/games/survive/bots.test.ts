import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { bot, outcome, reduce, setup, sortKey, tick, type SurviveState } from './logic'
import { botTrap, makeRun, trapInput, trapTimeout, TRAP_KINDS, type TrapKind } from './traps'

const human: RoomPlayer = { id: 'dixxx', name: 'Dixxx', color: '#3CCB72', guest: false, connected: true }
const bots: RoomPlayer[] = [
  { id: 'bot-a', name: 'Bot A', color: '#FFB547', guest: true, connected: true, bot: true },
  { id: 'bot-b', name: 'Bot B', color: '#4FD1C5', guest: true, connected: true, bot: true },
]
const players = [human, ...bots]
let seed = 1234
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, used: string[] = []): GameCtx => ({ now, players, mode: 'apart', random, used })

function playOut(s: SurviveState, start: number, used: string[] = []) {
  let now = start
  const moves: { id: string; type: string; phase: string }[] = []
  for (let i = 0; i < 60_000 && !outcome(s, ctx(now, used)); i++) {
    now += 200
    s = tick(s, ctx(now, used))
    for (const b of bots) {
      const m = bot(s, b.id, ctx(now, used))
      if (!m) continue
      moves.push({ id: b.id, type: m.type, phase: s.phase })
      const next = reduce(s, { playerId: b.id, type: m.type, payload: m.payload }, ctx(now, used))
      expect(next, `${b.id} ${m.type} in ${s.phase} was refused`).not.toBe(s)
      s = next
    }
  }
  return { s, now, moves }
}

describe('Survive the Quiz bots', () => {
  it('an idle human and two bots finish a whole game on tick + bot alone', () => {
    const { s, now, moves } = playOut(setup(ctx(0)), 0)
    const out = outcome(s, ctx(now))
    expect(out).not.toBeNull()
    expect(out!.placements).toHaveLength(3)
    // The idle human never answers, so the first trap times out and makes a ghost.
    expect(s.alive.dixxx === false || s.finale!.revived.includes('dixxx')).toBe(true)
    expect(s.diedOn.dixxx).toBe(1)
    // Bots answered every question they saw and sorted in the finale.
    expect(moves.filter((m) => m.type === 'answer').length).toBe(2 * s.qNum)
    expect(moves.some((m) => m.type === 'sort')).toBe(true)
    // Used ids cover the questions and the sorts.
    expect(out!.used!.filter((x) => x.startsWith('sort:')).length).toBe(s.finale!.round)
    expect(out!.used!.length).toBe(s.qNum + s.finale!.round)
  })

  it('bots pass traps at a realistic rate, through the same judge as a phone', () => {
    for (const kind of TRAP_KINDS as TrapKind[]) {
      let lived = 0
      const n = 400
      for (let i = 0; i < n; i++) {
        let run = makeRun(kind, ['bot-a'], i * 100_000, random)
        for (let t = run.startAt - 1_000; t < run.endsAt && run.seats['bot-a'].status === 'playing'; t += 200) {
          const m = botTrap(run, 'bot-a', { now: t, random })
          if (m) run = trapInput(run, 'bot-a', m.payload, t)
        }
        run = trapTimeout(run)
        if (run.seats['bot-a'].status === 'survived') lived++
      }
      const rate = lived / n
      expect(rate, kind).toBeGreaterThan(0.45)
      expect(rate, kind).toBeLessThan(0.85)
    }
  })

  it('bots never act in a trap they are not in, or before it starts', () => {
    const run = makeRun('math', ['bot-a'], 0, random)
    expect(botTrap(run, 'bot-b', { now: run.startAt + 5_000, random })).toBeNull()
    expect(botTrap(run, 'bot-a', { now: run.startAt - 1, random })).toBeNull()
  })

  it('prefers questions and sorts this group has not seen on earlier nights', () => {
    const first = playOut(setup(ctx(0)), 0)
    const used = outcome(first.s, ctx(first.now))!.used!
    const second = playOut(setup(ctx(0, used)), 0, used)
    const again = outcome(second.s, ctx(second.now, used))!.used!
    expect(again.filter((id) => used.includes(id))).toEqual([])
    expect(sortKey('pixar')).toBe('sort:pixar')
  })
})
