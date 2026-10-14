import type { GameOutcome, NightGame, PlacementPoints } from './types'

/** Points by place for a given player count. Three players: 10 / 7 / 4. */
export function scaleFor(n: number): number[] {
  if (n <= 1) return [10]
  if (n === 2) return [10, 5]
  if (n === 3) return [10, 7, 4]
  if (n === 4) return [10, 7, 4, 2]
  return [10, 7, 4, 2, ...Array(n - 4).fill(1)]
}

/** Normalize places (1-based, ties share) and attach points. */
export function toPoints(placements: GameOutcome['placements'], playerCount: number): PlacementPoints[] {
  const scale = scaleFor(playerCount)
  const sorted = [...placements].sort((a, b) => a.place - b.place)
  return sorted.map((p) => ({
    playerId: p.playerId,
    place: p.place,
    points: scale[Math.min(Math.max(p.place, 1), scale.length) - 1] ?? 0,
    ...(p.score !== undefined ? { score: p.score } : {}),
  }))
}

/**
 * Turn per-player scores into placements. Higher is better unless lowerWins.
 * Ties share a place (1, 1, 3).
 */
export function placeByScore(
  scores: { playerId: string; score: number }[],
  lowerWins = false,
): GameOutcome['placements'] {
  const sorted = [...scores].sort((a, b) => (lowerWins ? a.score - b.score : b.score - a.score))
  let place = 0
  let prev: number | null = null
  return sorted.map((s, i) => {
    if (prev === null || s.score !== prev) place = i + 1
    prev = s.score
    return { playerId: s.playerId, place, score: s.score }
  })
}

export interface Standing {
  playerId: string
  points: number
  wins: number
  played: number
}

export function standingsFrom(games: { placements: PlacementPoints[] }[], playerIds?: string[]): Standing[] {
  const map = new Map<string, Standing>()
  for (const id of playerIds ?? []) map.set(id, { playerId: id, points: 0, wins: 0, played: 0 })
  for (const g of games) {
    for (const p of g.placements) {
      const s = map.get(p.playerId) ?? { playerId: p.playerId, points: 0, wins: 0, played: 0 }
      s.points += p.points
      s.played += 1
      if (p.place === 1) s.wins += 1
      map.set(p.playerId, s)
    }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins)
}

export function winnersOf(standings: Standing[]): string[] {
  if (!standings.length || standings[0].points === 0) return []
  const top = standings[0].points
  return standings.filter((s) => s.points === top).map((s) => s.playerId)
}

export function nightStandings(games: NightGame[], playerIds: string[]): Standing[] {
  return standingsFrom(games, playerIds)
}
