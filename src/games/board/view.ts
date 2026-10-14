import type { RoomPlayer } from '../../engine/types'
import type { SpaceKind } from './map'
import type { BoardState, MgRun } from './logic'
import { curId } from './logic'
import { eventCard } from './events'
import { minigame } from './minigames/registry'

/** Shared words and colors for the TV and the phone. */

export type Who = (id: string) => RoomPlayer

export function whoFrom(players: RoomPlayer[]): Who {
  return (id: string) => players.find((p) => p.id === id) ?? { id, name: id, color: '#8790B6', guest: true, connected: false }
}

export function names(ids: string[], who: Who): string {
  const w = ids.map((id) => who(id).name)
  if (w.length <= 1) return w.join('')
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`
}

/** Replace @{playerId} with names. */
export function fill(text: string, who: Who): string {
  return text.replace(/@\{([^}]+)\}/g, (_, id: string) => who(id).name)
}

export const SPACE_COLOR: Record<SpaceKind, string> = {
  blue: '#4C7DFF',
  red: '#FF4D5E',
  event: '#FFC23D',
  shop: '#2BC3B4',
  duel: '#FF6B3D',
  lucky: '#F27FD0',
}

export const SPACE_NAME: Record<SpaceKind, string> = {
  blue: 'Blue',
  red: 'Red',
  event: 'Event',
  shop: 'Shop',
  duel: 'Duel',
  lucky: 'Lucky',
}

export const STAR_COLOR = '#FFD84D'
export const COIN_COLOR = '#FFC23D'

export function formatLine(run: Pick<MgRun, 'format' | 'players' | 'solo'>, who: Who): string {
  if (run.format === '1v2' && run.solo) return `${who(run.solo).name} vs ${names(run.players.filter((id) => id !== run.solo), who)}`
  if (run.format === 'coop') return 'Everyone vs the House'
  if (run.format === 'duel') return `${who(run.players[0]).name} vs ${who(run.players[1]).name}`
  return 'Free for all'
}

export function formatTag(run: Pick<MgRun, 'format' | 'players'>): string {
  if (run.format === '1v2') return `1 vs ${run.players.length - 1}`
  if (run.format === 'coop') return 'Co-op'
  if (run.format === 'duel') return 'Duel'
  return 'Free for all'
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** One plain line about what is happening, for phones and the compact view. */
export function caption(s: BoardState, who: Who): string {
  const c = who(curId(s)).name
  switch (s.stage) {
    case 'intro': return `Board Night. ${s.turns} turns.`
    case 'turnStart': return `New turn. ${who(s.order[0]).name} goes first.`
    case 'lastFive': return s.notice?.text ?? 'Last five turns'
    case 'roll': return `${c} is up. Waiting on the roll.`
    case 'rolling': return `${c} rolled ${s.roll?.total ?? ''}`
    case 'moving': return `${c} is moving`
    case 'fork': return `${c} is picking a path`
    case 'star': return `${c} can buy the Star`
    case 'land': return s.notice ? `${who(s.notice.who).name}: ${s.notice.title}` : ''
    case 'event': return `Event: ${eventCard(s.event ?? '')?.title ?? ''}`
    case 'eventPick': return `${c} is picking someone`
    case 'shop': return `${c} is shopping`
    case 'duelPick': return `${c} is picking a duel`
    case 'mgIntro': case 'mgPlay': case 'mgResult': return s.mg ? `${s.mg.kind === 'duel' ? 'Duel' : 'Minigame'}: ${minigame(s.mg.id)?.name ?? ''}` : ''
    case 'bonus': return 'Bonus Stars'
    case 'final': case 'done': return 'Final scores'
  }
  return ''
}
