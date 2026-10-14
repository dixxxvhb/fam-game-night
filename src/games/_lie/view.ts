import type { RoomView } from '../../engine/types'
import type { LieState } from './logic'

/** What differs between Bluff and Fake Word on screen. */
export interface LieView {
  kind: 'blank' | 'word'
  maxLen: number
  /** Phone, lie phase. */
  writeLabel: string
  placeholder: string
  /** TV, lie phase. */
  writeHint: string
  /** Pick phase. */
  pickLabel: string
}

export function playerOf(room: RoomView, id: string) {
  return room.players.find((p) => p.id === id)
}

export function nameOf(room: RoomView, id: string) {
  return playerOf(room, id)?.name ?? id
}

export function colorOf(room: RoomView, id: string) {
  return playerOf(room, id)?.color ?? '#8790B6'
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Players who still have to act in this phase. */
export function waitingOn(s: LieState, room: RoomView): string[] {
  if (s.stage === 'lie') return room.gamePlayers.filter((id) => !s.cur.lies[id])
  if (s.stage === 'pick') return room.gamePlayers.filter((id) => !s.cur.picks[id])
  return []
}

/** Scores to show right now: last round's until this round's tally comes up. */
export function shownScores(s: LieState): Record<string, number> {
  const step = s.cur.steps[s.cur.step]
  if (s.stage === 'reveal' && step?.kind !== 'tally') return s.before
  return s.scores
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

export function placeOf(s: LieState, room: RoomView, id: string): number {
  const mine = s.scores[id] ?? 0
  return 1 + room.gamePlayers.filter((x) => (s.scores[x] ?? 0) > mine).length
}
