import type { SeasonData } from './api'

export interface SeasonRow { playerId: string; points: number; gameWins: number; games: number; nightWins: number; nights: number }
export interface Record_ { gameId: string; playerId: string; score: number; at: string }
export interface H2H { a: string; b: string; aWins: number; bWins: number }

export function seasonStats(d: SeasonData) {
  const rows = new Map<string, SeasonRow>()
  const row = (id: string) => {
    let r = rows.get(id)
    if (!r) { r = { playerId: id, points: 0, gameWins: 0, games: 0, nightWins: 0, nights: 0 }; rows.set(id, r) }
    return r
  }
  const records = new Map<string, Record_>()
  const h2h = new Map<string, H2H>()
  const gameCounts = new Map<string, number>()

  for (const n of d.nights) {
    const inNight = new Set<string>()
    for (const r of n.results) {
      gameCounts.set(r.game_id, (gameCounts.get(r.game_id) ?? 0) + 1)
      for (const p of r.placements) {
        const x = row(p.player_id)
        x.points += p.points
        x.games += 1
        if (p.place === 1) x.gameWins += 1
        inNight.add(p.player_id)
        if (typeof p.score === 'number') {
          const best = records.get(r.game_id)
          if (!best || p.score > best.score) records.set(r.game_id, { gameId: r.game_id, playerId: p.player_id, score: p.score, at: r.played_at })
        }
      }
      for (let i = 0; i < r.placements.length; i++) {
        for (let j = i + 1; j < r.placements.length; j++) {
          const A = r.placements[i]
          const B = r.placements[j]
          if (A.place === B.place) continue
          const [a, b] = [A.player_id, B.player_id].sort()
          const key = `${a}|${b}`
          const h = h2h.get(key) ?? { a, b, aWins: 0, bWins: 0 }
          const winner = A.place < B.place ? A.player_id : B.player_id
          if (winner === a) h.aWins += 1
          else h.bWins += 1
          h2h.set(key, h)
        }
      }
    }
    for (const id of inNight) row(id).nights += 1
    for (const id of n.winner_ids ?? []) row(id).nightWins += 1
  }

  const standings = [...rows.values()].sort((a, b) => b.points - a.points || b.nightWins - a.nightWins || b.gameWins - a.gameWins)
  const belt = standings.length && standings[0].points > 0 ? standings[0].playerId : null
  return {
    standings,
    belt,
    records: [...records.values()],
    h2h: [...h2h.values()],
    gameCounts: [...gameCounts.entries()].sort((a, b) => b[1] - a[1]),
    nights: d.nights,
  }
}
