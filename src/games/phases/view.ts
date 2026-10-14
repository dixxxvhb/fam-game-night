import type { RoomPlayer } from '../../engine/types'
import { PHASES } from './cards'
import { phaseOf, type Group, type PhasesState } from './logic'

/** Shared words for the TV and the phone. */
export const LENGTH_NAME: Record<string, string> = { full: 'Full game', short: 'Short game', odds: 'Odd phases' }

export function groupTitle(g: Group): string {
  if (g.type === 'set') return `Set of ${g.n}s`
  if (g.type === 'run') return `Run ${g.n} to ${g.n + g.cards.length - 1}`
  return `${g.color![0].toUpperCase()}${g.color!.slice(1)}s`
}

export function phaseLine(s: PhasesState, id: string): { title: string; label: string } {
  const p = phaseOf(s, id)
  if (p === null) return { title: 'All done', label: 'Every phase finished' }
  return { title: `Phase ${p + 1}`, label: PHASES[p].label }
}

export type Who = (id: string) => RoomPlayer

export function whoFrom(players: RoomPlayer[]): Who {
  return (id: string) => players.find((p) => p.id === id) ?? { id, name: id, color: '#8790B6', guest: true, connected: false }
}
