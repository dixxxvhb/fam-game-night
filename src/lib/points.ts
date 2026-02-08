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

export function getNightWinner(totals: Record<string, number>): string | null {
  let winnerId: string | null = null
  let maxPoints = -1
  for (const [playerId, points] of Object.entries(totals)) {
    if (points > maxPoints) {
      maxPoints = points
      winnerId = playerId
    }
  }
  return winnerId
}
