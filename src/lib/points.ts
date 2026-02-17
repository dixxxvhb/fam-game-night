import type { PointScale } from '../types'

export function getPointsForGame(
  scales: PointScale[],
  gameId: string,
  playerCount: number
): number[] {
  const gameScale = scales.find(
    s => s.game_id === gameId && s.player_count === playerCount
  )
  if (gameScale) return gameScale.points

  const defaultScale = scales.find(
    s => s.game_id === null && s.player_count === playerCount
  )
  if (defaultScale) return defaultScale.points

  return generateDefaultScale(playerCount)
}

function generateDefaultScale(playerCount: number): number[] {
  return Array.from({ length: playerCount }, (_, i) => (playerCount - i) * 5)
}

export function getPointsForPlacement(pointsArray: number[], placement: number): number {
  if (placement < 1 || placement > pointsArray.length) return 0
  return pointsArray[placement - 1]
}

export function calculateNightTotals(
  games: { placements: { player_id: string; points: number }[] }[]
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const game of games) {
    for (const p of game.placements) {
      totals[p.player_id] = (totals[p.player_id] || 0) + p.points
    }
  }
  return totals
}

/**
 * Returns the winner of a night, or null if no players / tied at top.
 * When there's a tie for 1st, returns null (no winner) so the UI can handle it.
 */
export function getNightWinner(totals: Record<string, number>): string | null {
  const entries = Object.entries(totals)
  if (entries.length === 0) return null

  entries.sort(([, a], [, b]) => b - a)
  const [topId, topPts] = entries[0]

  // If second place ties first, it's a draw — no winner
  if (entries.length > 1 && entries[1][1] === topPts) return null

  return topId
}

/**
 * Returns all player IDs tied for the lead (for tie UI display).
 */
export function getNightTiedLeaders(totals: Record<string, number>): string[] {
  const entries = Object.entries(totals)
  if (entries.length === 0) return []

  const maxPoints = Math.max(...entries.map(([, pts]) => pts))
  const leaders = entries.filter(([, pts]) => pts === maxPoints)

  return leaders.length > 1 ? leaders.map(([id]) => id) : []
}
