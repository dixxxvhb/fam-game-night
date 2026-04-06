import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { PlayerAvatar } from '../../components/common/PlayerAvatar'
import { supabase } from '../../lib/supabase'
import { CATEGORY_COLORS } from '../../lib/fortnite'
import { formatDate } from '../../lib/constants'
import type { FortniteResult, FortnitePlayerScore, Player } from '../../types'

type FilterTab = 'all' | 'solo' | 'squad'

export default function FortniteHistory() {
  const navigate = useNavigate()
  const [results, setResults] = useState<FortniteResult[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: resultData }, { data: playerData }] = await Promise.all([
        supabase
          .from('fortnite_results')
          .select('*, fortnite_challenges(*)')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }),
        supabase.from('players').select('*'),
      ])

      setResults(
        (resultData ?? []).map(r => ({
          ...r,
          challenge: r.fortnite_challenges,
        }))
      )
      setPlayers(playerData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return results
    return results.filter(r => r.format === filter)
  }, [results, filter])

  // Stats
  const stats = useMemo(() => {
    const playerPoints: Record<string, number> = {}
    const playerWins: Record<string, number> = {}
    const challengeCounts: Record<string, number> = {}
    let teamBonusHits = 0
    let squadCount = 0

    for (const r of filtered) {
      const scores = r.player_scores as FortnitePlayerScore[]

      // Points
      for (const s of scores) {
        playerPoints[s.player_id] = (playerPoints[s.player_id] || 0) + s.total_points
      }

      // Winner (highest calculated_points)
      const sorted = [...scores].sort((a, b) => b.calculated_points - a.calculated_points)
      if (sorted.length > 0) {
        playerWins[sorted[0].player_id] = (playerWins[sorted[0].player_id] || 0) + 1
      }

      // Challenge frequency
      const name = r.challenge?.name ?? 'Unknown'
      challengeCounts[name] = (challengeCounts[name] || 0) + 1

      // Team bonus
      if (r.format === 'squad') {
        squadCount++
        if (r.team_bonus_awarded) teamBonusHits++
      }
    }

    const mostPlayed = Object.entries(challengeCounts).sort(([, a], [, b]) => b - a)[0]
    const topWinner = Object.entries(playerWins).sort(([, a], [, b]) => b - a)[0]

    return {
      totalRounds: filtered.length,
      playerPoints,
      mostPlayed: mostPlayed ? mostPlayed[0] : null,
      topWinner: topWinner ? { id: topWinner[0], wins: topWinner[1] } : null,
      teamBonusRate: squadCount > 0 ? Math.round((teamBonusHits / squadCount) * 100) : 0,
      showTeamBonus: filter === 'squad' || (filter === 'all' && squadCount > 0),
    }
  }, [filtered])

  function getPlayer(pid: string) {
    return players.find(p => p.id === pid)
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-midnight-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <h1 className="text-xl font-display text-white">Fortnite History</h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'solo', 'squad'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              filter === tab
                ? 'bg-nin-purple/20 text-nin-purple border border-nin-purple/30'
                : 'bg-midnight-800 text-midnight-400'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'solo' ? 'Solo' : 'Squad'}
          </button>
        ))}
      </div>

      {/* Stats Summary */}
      {stats.totalRounds > 0 && (
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-midnight-500 font-bold">Rounds Played</p>
              <p className="text-lg font-display text-white">{stats.totalRounds}</p>
            </div>
            {stats.topWinner && (
              <div>
                <p className="text-xs text-midnight-500 font-bold">Most Wins</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <PlayerAvatar
                    name={getPlayer(stats.topWinner.id)?.name ?? ''}
                    color={getPlayer(stats.topWinner.id)?.color ?? '#888'}
                    size="sm"
                  />
                  <span className="text-sm font-bold text-white">
                    {getPlayer(stats.topWinner.id)?.display_name} ({stats.topWinner.wins})
                  </span>
                </div>
              </div>
            )}
            {stats.mostPlayed && (
              <div>
                <p className="text-xs text-midnight-500 font-bold">Most Played</p>
                <p className="text-sm font-bold text-white">{stats.mostPlayed}</p>
              </div>
            )}
            {stats.showTeamBonus && (
              <div>
                <p className="text-xs text-midnight-500 font-bold">Team Bonus Rate</p>
                <p className="text-lg font-display text-gold-400">{stats.teamBonusRate}%</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Results List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-midnight-500 font-semibold">No challenges played yet</p>
        </div>
      ) : (
        filtered.map(r => {
          const scores = (r.player_scores as FortnitePlayerScore[]).sort(
            (a, b) => b.total_points - a.total_points
          )
          return (
            <Card key={r.id}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                  style={{
                    backgroundColor: r.format === 'solo' ? 'rgba(10,181,245,0.15)' : 'rgba(0,200,83,0.15)',
                    color: r.format === 'solo' ? '#0ab5f5' : '#00c853',
                  }}
                >
                  {r.format}
                </span>
                {r.challenge && (
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[r.challenge.category]}15`,
                      color: CATEGORY_COLORS[r.challenge.category],
                    }}
                  >
                    {r.challenge.category}
                  </span>
                )}
                {r.team_bonus_awarded && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gold-400/15 text-gold-400 uppercase">
                    Bonus
                  </span>
                )}
              </div>
              <h3 className="text-sm font-display text-white mb-1">{r.challenge?.name ?? 'Unknown'}</h3>
              <p className="text-[10px] text-midnight-500 font-semibold mb-2">
                {r.completed_at ? formatDate(r.completed_at.split('T')[0]) : ''}
              </p>
              <div className="flex gap-3">
                {scores.map((s, idx) => {
                  const player = getPlayer(s.player_id)
                  return (
                    <div key={s.player_id} className="flex flex-col items-center min-w-[48px]">
                      <PlayerAvatar
                        name={player?.name ?? ''}
                        color={player?.color ?? '#888'}
                        size="sm"
                        glow={idx === 0}
                      />
                      <span className="text-[10px] text-midnight-400 font-bold mt-1 truncate max-w-[48px]">
                        {player?.display_name}
                      </span>
                      <span className={`text-sm font-display ${idx === 0 ? 'text-gold-400' : 'text-white'}`}>
                        {s.total_points}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
