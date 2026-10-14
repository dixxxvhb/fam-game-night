import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../data/api', () => ({
  startNight: vi.fn(),
  recordResult: vi.fn(),
  endNight: vi.fn(),
}))

import * as api from '../data/api'
import { HostEngine, newRoomState } from './host'
import type { ActionEnvelope } from './types'

let n = 0
const act = (from: string, kind: 'room' | 'game', type: string, payload?: unknown): ActionEnvelope => ({ aid: `a${n++}`, from, kind, type, payload })

describe('HostEngine', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seats players, runs a game to results, and ends the night', () => {
    const e = new HostEngine(newRoomState('TEST', 'together', 'host-client'), null)
    for (const id of ['dixxx', 'johnnyboy', 'torii']) e.dispatch(act(id, 'room', 'join', { id, name: id, color: '#123456' }))
    expect(e.state.players).toHaveLength(3)

    // duplicate action ids are ignored
    const dup = act('dixxx', 'room', 'leave', { id: 'dixxx' })
    e.dispatch(dup)
    e.dispatch(act('dixxx', 'room', 'join', { id: 'dixxx', name: 'dixxx', color: '#123456' }))
    e.dispatch(dup)
    expect(e.state.players.map((p) => p.id).sort()).toEqual(['dixxx', 'johnnyboy', 'torii'])

    e.dispatch(act('torii', 'room', 'start', { gameId: 'sketch', opts: { rounds: 1, drawTime: 60 } }))
    expect(e.state.phase).toBe('playing')
    expect(e.state.game?.players).toHaveLength(3)

    // Drive sketch to the end: everyone guesses right every turn.
    for (let t = 0; t < 3; t++) {
      const gs = e.state.game!.state as { drawer: string; choices: string[]; word: string; stage: string }
      e.dispatch(act(gs.drawer, 'game', 'choose', { word: gs.choices[0] }))
      const g2 = e.state.game!.state as { drawer: string; word: string }
      for (const id of ['dixxx', 'johnnyboy', 'torii'].filter((x) => x !== g2.drawer)) {
        e.dispatch(act(id, 'game', 'guess', { text: g2.word }))
      }
      // skip the reveal pause
      const g3 = e.state.game!.state as { endsAt: number }
      const spy = vi.spyOn(Date, 'now').mockReturnValue(g3.endsAt + 1)
      ;(e as unknown as { tick: () => void }).tick()
      spy.mockRestore()
    }
    expect(e.state.phase).toBe('results')
    expect(e.state.games).toHaveLength(1)
    expect(e.state.games[0].placements.map((p) => p.points).sort((a, b) => b - a)[0]).toBe(10)
    expect(api.recordResult).toHaveBeenCalledTimes(1)

    e.dispatch(act('dixxx', 'room', 'endNight'))
    expect(e.state.phase).toBe('summary')
    expect(e.state.night?.winners.length).toBeGreaterThan(0)
    expect(api.endNight).toHaveBeenCalledTimes(1)
  })

  it('refuses to start without enough connected players', () => {
    const e = new HostEngine(newRoomState('TEST', 'together', 'h'), null)
    e.dispatch(act('dixxx', 'room', 'join', { id: 'dixxx', name: 'Dixxx', color: '#123456' }))
    e.dispatch(act('dixxx', 'room', 'start', { gameId: 'sketch' }))
    expect(e.state.phase).toBe('lobby')
  })

  it('plays a solo game with bots as practice and never saves it', () => {
    const e = new HostEngine(newRoomState('SOLO', 'apart', 'h'), null)
    e.dispatch(act('dixxx', 'room', 'join', { id: 'dixxx', name: 'Dixxx', color: '#123456' }))
    e.dispatch(act('dixxx', 'room', 'addBot'))
    e.dispatch(act('dixxx', 'room', 'addBot'))
    expect(e.state.players.filter((p) => p.bot)).toHaveLength(2)
    e.dispatch(act('dixxx', 'room', 'start', { gameId: 'sketch', opts: { rounds: 1, drawTime: 60 } }))
    expect(e.state.phase).toBe('playing')
    expect(e.state.game?.players).toHaveLength(3)

    // Run the clock forward in 200 ms steps; the human does nothing but guess when it's not their turn.
    let t = Date.now()
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => t)
    for (let i = 0; i < 4000 && e.state.phase === 'playing'; i++) {
      t += 200
      ;(e as unknown as { tick: () => void }).tick()
    }
    spy.mockRestore()
    expect(e.state.phase).toBe('results')
    expect(e.state.games[0].practice).toBe(true)
    expect(api.recordResult).not.toHaveBeenCalled()
    expect(api.startNight).not.toHaveBeenCalled()

    // Remove a bot back in the lobby
    e.dispatch(act('dixxx', 'room', 'lobby'))
    e.dispatch(act('dixxx', 'room', 'removeBot', { id: 'bot-gator' }))
    expect(e.state.players.some((p) => p.id === 'bot-gator')).toBe(false)

    // A practice-only night ends without saving
    e.dispatch(act('dixxx', 'room', 'endNight'))
    expect(e.state.phase).toBe('summary')
    expect(api.endNight).not.toHaveBeenCalled()
  })
})
