import { placeByScore } from '../../engine/points'
import { scoreCard } from './score'
import type { BowlState } from './logic'

/** Pure numbers for the podium: places, totals, strikes, and the one moment worth a sentence. */

export interface Standing { id: string; place: number; score: number; strikes: number; spares: number }

export function standings(s: BowlState): Standing[] {
  const rows = s.order.map((id) => {
    const rolls = s.rolls[id] ?? []
    const card = scoreCard(rolls, s.frames)
    let strikes = 0
    let spares = 0
    for (const c of card.cells) for (const m of c.marks) { if (m === 'X') strikes++; if (m === '/') spares++ }
    return { id, score: card.total, strikes, spares }
  })
  const placed = placeByScore(rows.map((r) => ({ playerId: r.id, score: r.score })))
  return placed.map((p) => {
    const r = rows.find((x) => x.id === p.playerId)!
    return { ...r, place: p.place }
  })
}

/** The best thing that happened, as a short line, given names. */
export function bestMoment(s: BowlState, name: (id: string) => string): string {
  const big = [...s.moments].reverse().find((m) => /bagger|six-pack|turkey|in a row|picked up/.test(m.text))
  if (big) return `${big.text}, frame ${big.frame}.`
  const rows = standings(s)
  const most = [...rows].sort((a, b) => b.strikes - a.strikes)[0]
  if (most && most.strikes >= 2) return `${name(most.id)} threw ${most.strikes} strikes.`
  if (most && most.strikes === 1) return `${name(most.id)} threw the only strike. Frame it.`
  const spare = [...rows].sort((a, b) => b.spares - a.spares)[0]
  if (spare && spare.spares > 0) return `${name(spare.id)} picked up ${spare.spares} spare${spare.spares > 1 ? 's' : ''}. Responsible.`
  return 'No strikes, no spares. Everyone had fun. Probably.'
}
