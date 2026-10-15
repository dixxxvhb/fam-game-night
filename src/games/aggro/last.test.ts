import { describe, expect, it } from 'vitest'
import type { GameCtx, RoomPlayer } from '../../engine/types'
import { BASE, HOME0, isHome, posAtProgress, posXY } from './geometry'
import { AUTO_MS, HIT_MS, HOP_MS, ROLL_SHOW_MS, SETTLE_MS, WIN_MS, reduce, setup, tick, type AggroState } from './logic'
import { KNOCK_DELAY, KNOCK_MS, cameraAt, frameAt, hopEndOf, hopStyle, moverAt } from './look/moment'

const P = (id: string, name: string, color: string): RoomPlayer => ({ id, name, color, guest: false, connected: true })
const three = [P('dixxx', 'Dixxx', '#3CCB72'), P('johnnyboy', 'Johnnyboy', '#6A9BFF'), P('torii', 'Torii', '#B67CFF')]
const dieTo = (r: number) => () => (r - 1) / 6 + 0.01
let seed = 7
const seeded = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const ctx = (now: number, random: () => number = seeded): GameCtx => ({ now, players: three, mode: 'together', random })
const board = (marbles: number[][]): AggroState => ({ ...setup(ctx(0), { speed: 'classic' }), turn: 0, marbles })
const allBase = () => [BASE, BASE, BASE, BASE]
const at = (arm: number, q: number) => posAtProgress(arm, q)
const roll = (s: AggroState, r: number, now: number) => reduce(s, { playerId: s.seats[s.turn], type: 'roll', payload: { seq: s.seq } }, ctx(now, dieTo(r)))
const pick = (s: AggroState, i: number, now: number) => reduce(s, { playerId: s.seats[s.turn], type: 'move', payload: { i, seq: s.seq } }, ctx(now))

describe('the move record the board animates from', () => {
  it('carries the kind, the landing hole and the victim', () => {
    let s = board([[at(0, 10), BASE, BASE, BASE], [at(0, 13), BASE, BASE, BASE], allBase()])
    s = roll(s, 3, 1000)
    s = tick(s, ctx(1000 + AUTO_MS))
    expect(s.last).toMatchObject({ kind: 'walk', to: at(0, 13), hit: 1, hitM: 0, hops: 0, won: false, extra: false })
    expect(s.marbles[1][0]).toBe(BASE)
  })
  it('never starts hopping before the die settles, and the phase waits for the hops', () => {
    let s = board([[at(0, 10), at(0, 20), BASE, BASE], allBase(), allBase()])
    s = roll(s, 2, 1000)
    expect(s.moves.length).toBeGreaterThan(1)
    s = pick(s, 0, 1100)
    expect(s.last!.at).toBe(1000 + ROLL_SHOW_MS)
    expect(s.endsAt).toBe(s.last!.at + s.last!.path.length * HOP_MS + SETTLE_MS)
    expect(s.phaseTotal).toBe(s.endsAt - 1100)
    let t = board([[at(0, 10), at(0, 20), BASE, BASE], allBase(), allBase()])
    t = roll(t, 2, 1000)
    t = pick(t, 0, 5000)
    expect(t.last!.at).toBe(5000)
  })
  it('a capture holds the board for the Aggro', () => {
    let s = board([[at(0, 10), at(0, 30), BASE, BASE], [at(0, 13), BASE, BASE, BASE], allBase()])
    s = roll(s, 3, 0)
    const hit = s.moves.findIndex((m) => m.hit === 1)
    s = pick(s, hit, 5000)
    expect(s.endsAt - 5000).toBe(3 * HOP_MS + SETTLE_MS + HIT_MS)
  })
  it('the winning move holds the board for the winner scene, then ends', () => {
    let s = board([[HOME0 + 3, HOME0 + 2, HOME0 + 1, at(0, 55)], allBase(), allBase()])
    s = roll(s, 1, 0)
    s = pick(s, s.moves.findIndex((m) => isHome(m.to)), 5000)
    expect(s.last).toMatchObject({ won: true, extra: false })
    expect(s.endsAt - 5000).toBe(HOP_MS + SETTLE_MS + WIN_MS)
    expect(tick(s, ctx(s.endsAt - 1)).phase).toBe('move')
    expect(tick(s, ctx(s.endsAt)).phase).toBe('done')
  })
  it('star hops are counted for the zap', () => {
    let s = board([[14, BASE, BASE, BASE], allBase(), allBase()])
    s = roll(s, 3, 0)
    const i = s.moves.findIndex((m) => m.kind === 'stars' && m.hops === 2)
    s = pick(s, i, 5000)
    expect(s.last).toMatchObject({ kind: 'stars', hops: 2 })
    expect(hopStyle(s.last!, 0)).toBe('zap')
    expect(hopStyle(s.last!, 2)).toBe('hop')
  })
})

describe('the board timeline', () => {
  function hitState() {
    let s = board([[at(0, 10), at(0, 30), BASE, BASE], [at(0, 13), BASE, BASE, BASE], allBase()])
    s = roll(s, 3, 0)
    return pick(s, s.moves.findIndex((m) => m.hit === 1), 5000)
  }
  it('keeps the mover home and the victim on the board until the hop lands', () => {
    const s = hitState()
    const L = s.last!
    const before = frameAt(s, L.at - 10)
    const mover = before.marbles.find((d) => d.seat === 0 && d.m === L.m)!
    expect([mover.x, mover.y]).toEqual(posXY(at(0, 10), 0, L.m))
    const victim = before.marbles.find((d) => d.seat === 1 && d.m === 0)!
    expect([victim.x, victim.y]).toEqual(posXY(at(0, 13), 1, 0))
    expect(before.fx.aggro).toBe(-1)
  })
  it('hops hole by hole with an arc, lands, then knocks the victim home', () => {
    const s = hitState()
    const L = s.last!
    const mid = moverAt(s, L, L.at + HOP_MS * 1.5)!
    expect(mid.i).toBe(1)
    expect(mid.lift).toBeGreaterThan(0.5)
    const end = hopEndOf(L)
    const land = frameAt(s, end + 10)
    expect(land.fx.aggro).toBe(10)
    expect(land.fx.shake).toBeGreaterThan(0.9)
    const flying = frameAt(s, end + KNOCK_DELAY + KNOCK_MS / 2).marbles.find((d) => d.seat === 1 && d.m === 0)!
    expect(flying.flying).toBe(true)
    expect(flying.lift).toBeGreaterThan(3)
    const back = frameAt(s, end + KNOCK_DELAY + KNOCK_MS + 500).marbles.find((d) => d.seat === 1 && d.m === 0)!
    expect([back.x, back.y]).toEqual(posXY(BASE, 1, 0))
    expect(frameAt(s, end + HIT_MS + 500).fx.aggro).toBe(-1)
  })
  it('the camera leans in for the move and settles back', () => {
    const s = hitState()
    const L = s.last!
    expect(cameraAt(s, L.at - 1000).w).toBe(0)
    expect(cameraAt(s, L.at + HOP_MS).w).toBe(1)
    expect(cameraAt(s, hopEndOf(L) + 5000).w).toBe(0)
  })
})
