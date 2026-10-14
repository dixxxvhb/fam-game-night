import type { RoomView } from '../../engine/types'
import { HOUSE, roundIdx, votesPer, type QuipState } from './logic'

export function roundTitle(r: number): string {
  return r === 3 ? 'Last Quip' : `Round ${r}`
}

export function roundBlurb(r: number, perRound: number): string {
  const n = perRound === 3 ? 'Three' : 'Two'
  if (r === 1) return `Answer on your phone. ${n} prompts each.`
  if (r === 2) return `${n} new prompts. Points double.`
  return 'One prompt for everyone. Three votes each. Points triple.'
}

/** "Round 1 · Prompt 1 of 2", or "Last Quip". */
export function promptLabel(s: QuipState): string {
  if (s.round === 3) return 'Last Quip · three votes each'
  const ids = roundIdx(s, s.round)
  return `Round ${s.round} · Prompt ${Math.max(1, ids.indexOf(s.current) + 1)} of ${ids.length}`
}

export function nameOf(room: RoomView, id: string): string {
  if (id === HOUSE) return 'The House'
  return room.players.find((p) => p.id === id)?.name ?? id
}

export function colorOf(room: RoomView, id: string): string {
  return room.players.find((p) => p.id === id)?.color ?? '#8790B6'
}

/** "Torii", "Torii and Dixxx", "Torii, Dixxx and Johnnyboy". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** How many of this round's prompts each player has answered. */
export function answeredCount(s: QuipState, id: string): number {
  return roundIdx(s, s.round).filter((i) => s.prompts[i].answers[id]).length
}

export function stillAnswering(s: QuipState): string[] {
  const total = roundIdx(s, s.round).length
  return s.players.filter((id) => answeredCount(s, id) < total)
}

export function stillVoting(s: QuipState): string[] {
  const p = s.prompts[s.current]
  if (!p) return []
  const need = votesPer(s.round)
  return s.players.filter((id) => (p.votes[id]?.length ?? 0) < need)
}

/** Answer text size for the TV cards, by card count and answer length. */
export function cardFont(n: number, len: number): number {
  const steps = n <= 3 ? [2.6, 2.2, 1.85, 1.6] : n <= 4 ? [2.35, 2, 1.7, 1.45] : n <= 6 ? [1.75, 1.5, 1.3, 1.15] : [1.4, 1.22, 1.06, 0.96]
  const k = len <= 24 ? 0 : len <= 44 ? 1 : len <= 62 ? 2 : 3
  return steps[k]
}

export function promptFont(len: number, compactGrid: boolean): string {
  const base = len <= 40 ? 3 : len <= 62 ? 2.6 : 2.25
  return `${compactGrid ? base * 0.85 : base}rem`
}
