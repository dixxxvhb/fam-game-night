import type { RoomPlayer } from '../../engine/types'
import { POINTS, type BEntry, type BOption } from './logic'

export type Who = (id: string) => RoomPlayer | undefined

/** "Dixxx", "Dixxx and Torii", "Dixxx, Torii and you". */
export function names(ids: string[], who: Who, me?: string | null): string {
  const n = ids.map((id) => (id === me ? 'you' : who(id)?.name ?? id))
  if (n.length <= 1) return n.join('')
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

export function pickersOf(e: BEntry, optionId: string): string[] {
  return Object.entries(e.picks).filter(([, o]) => o === optionId).map(([p]) => p)
}

/** The line under a revealed title. */
export function verdictFor(e: BEntry, o: BOption, who: Who, me?: string | null): { title: string; detail: string; tone: 'good' | 'bad' | 'hot' } {
  const pickers = pickersOf(e, o.id)
  if (o.kind === 'real') {
    return {
      title: `The truth. ${e.artist === me ? 'You' : who(e.artist)?.name ?? 'Someone'} drew it.`,
      detail: pickers.length ? `Found by ${names(pickers, who, me)}. +${POINTS.found} each.` : 'Nobody found it.',
      tone: 'good',
    }
  }
  if (o.kind === 'house') {
    return {
      title: "The House's lie.",
      detail: pickers.length ? `Got ${names(pickers, who, me)}. -${POINTS.house} each.` : 'Nobody bit.',
      tone: 'bad',
    }
  }
  const title = o.by.length === 1
    ? o.by[0] === me ? 'Your lie.' : `${who(o.by[0])?.name ?? 'Someone'}'s lie.`
    : `A lie by ${names(o.by, who, me)}.`
  return {
    title,
    detail: pickers.length ? `Fooled ${names(pickers, who, me)}. +${POINTS.fooled * pickers.length}${o.by.length > 1 ? ' each' : ''}.` : 'Nobody bit.',
    tone: 'hot',
  }
}
