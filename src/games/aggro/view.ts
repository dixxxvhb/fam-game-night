import { useEffect, useReducer } from 'react'
import type { RoomView } from '../../engine/types'
import { HOP_MS, type AggroState } from './logic'

/** View helpers shared by the Stage and the Controller (no components here, for fast refresh). */

const FALLBACK = ['#3CCB72', '#6A9BFF', '#B67CFF', '#FFB547']

export function seatInfo(s: AggroState, room: RoomView) {
  const players = s.seats.map((id) => room.players.find((p) => p.id === id))
  return {
    colors: players.map((p, k) => p?.color ?? FALLBACK[k % FALLBACK.length]),
    names: players.map((p, k) => p?.name ?? s.seats[k]),
  }
}

/** False while the moving marble is still hopping (so nobody reads the Aggro before it lands). */
export function hasLanded(s: AggroState, t: number): boolean {
  return !(s.phase === 'move' && s.last && t < s.last.at + s.last.path.length * HOP_MS)
}

/** The log as the room should see it: a move's line shows up once its marble lands. */
export function shownLog(s: AggroState, t: number) {
  if (!hasLanded(s, t) && s.log.at(-1)?.seq === s.last?.seq) return s.log.slice(0, -1)
  return s.log
}

/** The board as the room should see it: until the mover lands, it and its victim stay put. */
export function shownMarbles(s: AggroState, t: number): number[][] {
  const L = s.last
  if (!L || hasLanded(s, t)) return s.marbles
  const rows = s.marbles.map((r) => [...r])
  rows[L.seat][L.m] = L.from
  if (L.hit >= 0) rows[L.hit][L.hitM] = L.path[L.path.length - 1]
  return rows
}

/** Short status for whoever's turn it is: "Rolled a 4. Picking a move." */
export function turnStatus(s: AggroState, t: number): string {
  if (s.phase === 'roll') return s.again ? 'Rolled a 6. Rolls again.' : 'Up to roll.'
  if (s.phase === 'choose') {
    if (!s.moves.length) return `Rolled a ${s.roll}. No moves.${s.extra ? ' The 6 still rolls again.' : ''}`
    if (s.auto) return `Rolled a ${s.roll}. Only one way to go.`
    return `Rolled a ${s.roll}. Picking a move.`
  }
  if (s.phase === 'move') return s.last && s.last.hit >= 0 && hasLanded(s, t) ? 'Aggro.' : `Rolled a ${s.roll}.`
  return 'Done.'
}

/** Re-render every animation frame until the host clock passes `until` (0 = idle). */
export function useFrames(until: number, now: () => number) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!until || now() >= until) return
    let id = 0
    const loop = () => {
      bump()
      if (now() < until) id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [until, now])
}
