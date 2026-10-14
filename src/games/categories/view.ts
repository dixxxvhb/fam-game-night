import type { RoomView } from '../../engine/types'
import { judgeCategory, similar, textsFor, type CategoriesState, type Judged, type Status } from './logic'

export function finder(room: RoomView) {
  return (id: string) => room.players.find((p) => p.id === id)
}

/** The answers for the category on screen: live while voting, locked once the verdict is in. */
export function shownAnswers(s: CategoriesState, ids: string[]): Judged[] {
  if (s.stage === 'verdict') {
    const last = s.results.at(-1)?.cats.at(-1)
    if (last && last.idx === s.judgeIdx) return last.answers
  }
  return judgeCategory(ids, textsFor(s, s.judgeIdx), s.letter, s.ups, s.downs)
}

/** Who shares a duplicate answer with this one (for "Same as Torii"). */
export function dupPartners(list: Judged[], j: Judged): string[] {
  if (j.status !== 'dup') return []
  return list.filter((x) => x.playerId !== j.playerId && x.status === 'dup' && similar(x.text, j.text)).map((x) => x.playerId)
}

export function statusText(j: Judged, partners: string[], nameOf: (id: string) => string): string {
  const map: Record<Status, string> = {
    ok: j.allit ? 'Alliteration bonus' : 'Counts',
    blank: 'Nothing',
    letter: 'Wrong letter',
    dup: partners.length ? `Same as ${partners.map(nameOf).join(' and ')}` : 'Duplicate',
    out: 'Thrown out',
  }
  return map[j.status]
}
