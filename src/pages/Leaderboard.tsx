import { useState, useEffect } from 'react'
import { Trophy, Crown, Flame, Star, Percent } from 'lucide-react'
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
      {/* Header */}
      <div className="text-center py-3 animate-slide-up">
        <Trophy className="w-10 h-10 text-gold-400 mx-auto mb-2 drop-shadow-[0_0_12px_rgba(255,202,40,0.5)]" />
        <h1 className="text-2xl font-display">All-Time Leaderboard</h1>
        <p className="text-midnight-400 text-sm font-semibold">Total points across all game nights</p>
      </div>

      {/* Champion Card (#1) */}
      {entries[0] && (
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Card variant="winner">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-gold-400 animate-crown-bounce drop-shadow-[0_0_10px_rgba(255,202,40,0.5)]" />
              <PlayerAvatar name={entries[0].player.name} color={entries[0].player.color} size="lg" glow />
              <div className="flex-1">
                <p className="text-xl font-display">{entries[0].player.display_name}</p>
                <p className="text-sm text-midnight-300 font-semibold">
                  {entries[0].nightsPlayed} nights | {entries[0].totalWins} wins
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-display text-shimmer-gold">
                  {entries[0].totalPoints}
                </p>
                <p className="text-xs text-midnight-400 font-bold">total pts</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-midnight-600/30">
              <div className="text-center bg-midnight-800/40 rounded-xl py-2.5">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-gold-400" />
                  <p className="text-xl font-display">{entries[0].totalWins}</p>
                </div>
                <p className="text-xs text-midnight-400 font-bold">Wins</p>
              </div>
              <div className="text-center bg-midnight-800/40 rounded-xl py-2.5">
                <div className="flex items-center justify-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-nin-blue" />
                  <p className="text-xl font-display">
                    {entries[0].nightsPlayed > 0 ? Math.round((entries[0].totalWins / entries[0].nightsPlayed) * 100) : 0}%
                  </p>
                </div>
                <p className="text-xs text-midnight-400 font-bold">Win Rate</p>
              </div>
              <div className="text-center bg-midnight-800/40 rounded-xl py-2.5">
                <div className="flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 text-nin-orange" />
                  <p className="text-xl font-display">{entries[0].bestStreak}</p>
                </div>
                <p className="text-xs text-midnight-400 font-bold">Best Streak</p>
              </div>
            </div>

            {entries[0].currentStreak >= 2 && (
              <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-nin-orange/10 rounded-xl border border-nin-orange/20">
                <Flame className="w-4 h-4 text-nin-orange animate-pulse" />
                <span className="text-sm font-display text-nin-orange">{entries[0].currentStreak}-Night Win Streak!</span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Players #2-4 */}
      {entries.slice(1).map((entry, idx) => (
        <div key={entry.player.id} className="animate-slide-up" style={{ animationDelay: `${200 + idx * 80}ms` }}>
          <div className="flex rounded-2xl overflow-hidden">
            {/* Left accent bar */}
            <div className="w-1.5 shrink-0" style={{ backgroundColor: PLACEMENT_COLORS[idx + 1] || '#7a7a9e' }} />
            <div className="flex-1">
              <Card className="rounded-l-none border-l-0">
                <div className="flex items-center gap-3">
                  <span
                    className="text-2xl font-display w-10 text-center"
                    style={{ color: PLACEMENT_COLORS[idx + 1] || '#7a7a9e' }}
                  >
                    #{idx + 2}
                  </span>
                  <PlayerAvatar name={entry.player.name} color={entry.player.color} size="md" />
                  <div className="flex-1">
                    <p className="text-lg font-display">{entry.player.display_name}</p>
                    <p className="text-sm text-midnight-400 font-semibold">
                      {entry.nightsPlayed} nights | {entry.totalWins} wins
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-display text-gold-400">
                      {entry.totalPoints}
                    </p>
                    <p className="text-xs text-midnight-400 font-bold">total pts</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-midnight-600/30">
                  <div className="text-center bg-midnight-700/30 rounded-xl py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 text-gold-400" />
                      <p className="text-lg font-display">{entry.totalWins}</p>
                    </div>
                    <p className="text-xs text-midnight-400 font-bold">Wins</p>
                  </div>
                  <div className="text-center bg-midnight-700/30 rounded-xl py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Percent className="w-3 h-3 text-nin-blue" />
                      <p className="text-lg font-display">
                        {entry.nightsPlayed > 0 ? Math.round((entry.totalWins / entry.nightsPlayed) * 100) : 0}%
                      </p>
                    </div>
                    <p className="text-xs text-midnight-400 font-bold">Win Rate</p>
                  </div>
                  <div className="text-center bg-midnight-700/30 rounded-xl py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-nin-orange" />
                      <p className="text-lg font-display">{entry.bestStreak}</p>
                    </div>
                    <p className="text-xs text-midnight-400 font-bold">Best Streak</p>
                  </div>
                </div>

                {entry.currentStreak >= 2 && (
                  <div className="mt-3 flex items-center justify-center gap-2 py-1.5 bg-nin-orange/10 rounded-xl border border-nin-orange/20">
                    <Flame className="w-3.5 h-3.5 text-nin-orange animate-pulse" />
                    <span className="text-xs font-display text-nin-orange">{entry.currentStreak}-Night Streak!</span>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      ))}

      {entries.length === 0 && (
        <p className="text-center text-midnight-400 py-8 font-semibold">No completed game nights yet</p>
      )}
    </div>
  )
}
