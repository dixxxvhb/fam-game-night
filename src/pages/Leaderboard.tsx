import { useState, useEffect } from 'react'
import { Trophy, Crown, Flame, Star } from 'lucide-react'
import { Card } from '../components/common/Card'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { PLACEMENT_COLORS } from '../lib/constants'
import type { Player } from '../types'

interface ChampEntry {
  player: Player
  totalPoints: number
  totalWins: number
  nightsPlayed: number
  bestStreak: number
  currentStreak: number
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<ChampEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [{ data: players }, { data: nights }] = await Promise.all([
        supabase.from('players').select('*').eq('is_core', true),
        supabase.from('game_nights').select(`
          id, date, status,
          game_night_players(player_id),
          game_night_games(id,
            placements(player_id, points)
          )
        `).eq('status', 'completed'),
      ])

      if (!players || !nights) return

      const stats: Record<string, { points: number; wins: number; nights: number; streak: number; bestStreak: number }> = {}
      for (const p of players) {
        stats[p.id] = { points: 0, wins: 0, nights: 0, streak: 0, bestStreak: 0 }
      }

      const sorted = [...nights].sort((a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      for (const night of sorted) {
        const nightTotals: Record<string, number> = {}
        const nightPlayerIds = new Set((night as any).game_night_players?.map((np: any) => np.player_id) || [])

        for (const game of (night as any).game_night_games || []) {
          for (const p of game.placements || []) {
            nightTotals[p.player_id] = (nightTotals[p.player_id] || 0) + p.points
          }
        }

        let winnerId: string | null = null
        let maxPts = -1
        for (const [pid, pts] of Object.entries(nightTotals)) {
          if (pts > maxPts) { maxPts = pts; winnerId = pid }
        }

        for (const pid of Object.keys(stats)) {
          if (!nightPlayerIds.has(pid)) {
            stats[pid].streak = 0
            continue
          }
          stats[pid].points += nightTotals[pid] || 0
          stats[pid].nights++
          if (winnerId === pid) {
            stats[pid].wins++
            stats[pid].streak++
            if (stats[pid].streak > stats[pid].bestStreak) stats[pid].bestStreak = stats[pid].streak
          } else {
            stats[pid].streak = 0
          }
        }
      }

      const board: ChampEntry[] = players
        .map(p => ({
          player: p,
          totalPoints: stats[p.id].points,
          totalWins: stats[p.id].wins,
          nightsPlayed: stats[p.id].nights,
          bestStreak: stats[p.id].bestStreak,
          currentStreak: stats[p.id].streak,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints)

      setEntries(board)
    } catch {
      // Not configured
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner className="h-64" />

  return (
    <div className="p-4 space-y-4">
      <div className="text-center py-3">
        <Trophy className="w-10 h-10 text-gold-400 mx-auto mb-2" />
        <h1 className="text-2xl font-black">All-Time Leaderboard</h1>
        <p className="text-midnight-400 text-sm font-semibold">Total points across all game nights</p>
      </div>

      {entries.map((entry, idx) => (
        <Card
          key={entry.player.id}
          className={idx === 0 ? 'border-gold-400/40 bg-gold-400/5 glow-gold' : ''}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-black w-10 text-center"
              style={{ color: PLACEMENT_COLORS[idx] || '#7a7a9e' }}
            >
              {idx === 0 ? '' : `#${idx + 1}`}
            </span>
            {idx === 0 && <Crown className="w-8 h-8 text-gold-400" />}
            <PlayerAvatar name={entry.player.name} color={entry.player.color} size="lg" />
            <div className="flex-1">
              <p className={`font-black ${idx === 0 ? 'text-xl' : 'text-lg'}`}>{entry.player.display_name}</p>
              <p className="text-sm text-midnight-400 font-semibold">
                {entry.nightsPlayed} nights | {entry.totalWins} wins
              </p>
            </div>
            <div className="text-right">
              <p className={`font-black ${idx === 0 ? 'text-4xl text-shimmer-gold' : 'text-3xl text-gold-400'}`}>
                {entry.totalPoints}
              </p>
              <p className="text-xs text-midnight-400 font-bold">total pts</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t-2 border-midnight-600/40">
            <div className="text-center bg-midnight-700/30 rounded-xl py-2">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-4 h-4 text-gold-400" />
                <p className="text-xl font-black">{entry.totalWins}</p>
              </div>
              <p className="text-xs text-midnight-400 font-bold">Wins</p>
            </div>
            <div className="text-center bg-midnight-700/30 rounded-xl py-2">
              <p className="text-xl font-black">
                {entry.nightsPlayed > 0 ? Math.round((entry.totalWins / entry.nightsPlayed) * 100) : 0}%
              </p>
              <p className="text-xs text-midnight-400 font-bold">Win Rate</p>
            </div>
            <div className="text-center bg-midnight-700/30 rounded-xl py-2">
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 text-nin-orange" />
                <p className="text-xl font-black">{entry.bestStreak}</p>
              </div>
              <p className="text-xs text-midnight-400 font-bold">Best Streak</p>
            </div>
          </div>
        </Card>
      ))}

      {entries.length === 0 && (
        <p className="text-center text-midnight-400 py-8 font-semibold">No completed game nights yet</p>
      )}
    </div>
  )
}
