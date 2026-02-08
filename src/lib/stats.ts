import type { Player, GameNightWithDetails, LeaderboardEntry } from '../types'
import { getNightWinner } from './points'

export function calculateLeaderboard(
  players: Player[],
  nights: GameNightWithDetails[],
  year?: number
): LeaderboardEntry[] {
  const filteredNights = year
    ? nights.filter(n => new Date(n.date).getFullYear() === year)
    : nights

  const completedNights = filteredNights
    .filter(n => n.status === 'completed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return players.map(player => {
    const nightsPlayed = completedNights.filter(n =>
      n.players.some(p => p.id === player.id)
    )

    let totalWins = 0
    let totalPoints = 0
    let currentStreak = 0
    let bestStreak = 0
    let tempStreak = 0

    for (const night of completedNights) {
      const participated = night.players.some(p => p.id === player.id)
      if (!participated) {
        tempStreak = 0
        continue
      }

      totalPoints += night.totals[player.id] || 0

      const winnerId = getNightWinner(night.totals)
      if (winnerId === player.id) {
        totalWins++
        tempStreak++
        if (tempStreak > bestStreak) bestStreak = tempStreak
      } else {
        tempStreak = 0
      }
    }

    currentStreak = tempStreak

    return {
      player,
      totalWins,
      totalPoints,
      avgPlacement: nightsPlayed.length > 0
        ? Math.round(calculateAvgPlacement(player.id, nightsPlayed) * 10) / 10
        : 0,
      nightsPlayed: nightsPlayed.length,
      winPercentage: nightsPlayed.length > 0
        ? Math.round((totalWins / nightsPlayed.length) * 100)
        : 0,
      currentStreak,
      bestStreak,
    }
  }).sort((a, b) => b.totalWins - a.totalWins || b.totalPoints - a.totalPoints)
}

function calculateAvgPlacement(playerId: string, nights: GameNightWithDetails[]): number {
  let totalPlacement = 0
  let count = 0

  for (const night of nights) {
    const sorted = Object.entries(night.totals).sort(([, a], [, b]) => b - a)
    const rank = sorted.findIndex(([id]) => id === playerId)
    if (rank >= 0) {
      totalPlacement += rank + 1
      count++
    }
  }

  return count > 0 ? totalPlacement / count : 0
}

export function getAvailableYears(nights: GameNightWithDetails[]): number[] {
  const years = new Set(nights.map(n => new Date(n.date).getFullYear()))
  return Array.from(years).sort((a, b) => b - a)
}
