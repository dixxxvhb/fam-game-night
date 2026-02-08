import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Gamepad2, X, ChevronDown, ChevronUp, Trophy, Calendar, ShieldCheck, Crown } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { PLACEMENT_COLORS, formatDate } from '../lib/constants'
import type { GameNight, Player } from '../types'

interface YearStats {
  year: number
  nightsPlayed: number
  standings: { player: Player; points: number; wins: number }[]
}

interface AllTimeEntry {
  player: Player
  totalPoints: number
}

export default function Home() {
  const navigate = useNavigate()
  const [activeNight, setActiveNight] = useState<GameNight | null>(null)
  const [pendingNight, setPendingNight] = useState<GameNight | null>(null)
  const [yearStats, setYearStats] = useState<YearStats[]>([])
  const [allTime, setAllTime] = useState<AllTimeEntry[]>([])
  const [expandedYear, setExpandedYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [{ data: active }, { data: pending }, { data: players }, { data: nights }] = await Promise.all([
        supabase.from('game_nights').select('*').eq('status', 'active').limit(1).single(),
        supabase.from('game_nights').select('*').eq('status', 'pending_approval').limit(1).single(),
        supabase.from('players').select('*').eq('is_core', true),
        supabase.from('game_nights').select(`
          id, date, status,
          game_night_players(player_id),
          game_night_games(id, placements(player_id, points))
        `).eq('status', 'completed'),
      ])

      setActiveNight(active)
      setPendingNight(pending)

      if (!players || !nights) return

      const yearMap: Record<number, typeof nights> = {}
      for (const n of nights) {
        const y = new Date((n as any).date).getFullYear()
        if (!yearMap[y]) yearMap[y] = []
        yearMap[y].push(n)
      }

      const allTotals: Record<string, number> = {}
      for (const p of players) allTotals[p.id] = 0

      const stats: YearStats[] = []
      for (const [yearStr, yearNights] of Object.entries(yearMap)) {
        const year = parseInt(yearStr)
        const playerPoints: Record<string, number> = {}
        const playerWins: Record<string, number> = {}
        for (const p of players) { playerPoints[p.id] = 0; playerWins[p.id] = 0 }

        for (const night of yearNights) {
          const nightTotals: Record<string, number> = {}
          for (const game of (night as any).game_night_games || []) {
            for (const p of game.placements || []) {
              nightTotals[p.player_id] = (nightTotals[p.player_id] || 0) + p.points
            }
          }

          for (const [pid, pts] of Object.entries(nightTotals)) {
            if (playerPoints[pid] !== undefined) playerPoints[pid] += pts
            if (allTotals[pid] !== undefined) allTotals[pid] += pts
          }

          let winnerId: string | null = null
          let maxPts = -1
          for (const [pid, pts] of Object.entries(nightTotals)) {
            if (pts > maxPts) { maxPts = pts; winnerId = pid }
          }
          if (winnerId && playerWins[winnerId] !== undefined) playerWins[winnerId]++
        }

        const standings = players
          .map(p => ({ player: p, points: playerPoints[p.id], wins: playerWins[p.id] }))
          .sort((a, b) => b.points - a.points)

        stats.push({ year, nightsPlayed: yearNights.length, standings })
      }

      stats.sort((a, b) => b.year - a.year)
      setYearStats(stats)

      const allTimeBoard = players
        .map(p => ({ player: p, totalPoints: allTotals[p.id] }))
        .sort((a, b) => b.totalPoints - a.totalPoints)
      setAllTime(allTimeBoard)
    } catch {
      // Not configured
    } finally {
      setLoading(false)
    }
  }

  async function startNewNight() {
    try {
      const { data: existing } = await supabase
        .from('game_nights')
        .select('night_number')
        .order('night_number', { ascending: false })
        .limit(1)

      const nextNumber = (existing?.[0]?.night_number || 0) + 1

      const { data: night, error } = await supabase
        .from('game_nights')
        .insert({
          night_number: nextNumber,
          date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      const { data: players } = await supabase.from('players').select('id').eq('is_core', true)

      if (players && night) {
        await supabase.from('game_night_players').insert(
          players.map(p => ({ game_night_id: night.id, player_id: p.id }))
        )
        navigate(`/night/${night.id}`)
      }
    } catch (err) {
      console.error('Failed to start game night:', err)
    }
  }

  async function cancelNight() {
    if (!activeNight) return
    const { error } = await supabase.from('game_nights').delete().eq('id', activeNight.id)
    if (error) {
      console.error('Failed to delete game night:', error)
      alert(`Delete failed: ${error.message}`)
    } else {
      setActiveNight(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-midnight-600 border-t-nin-red rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Active Night or Start Button */}
      {activeNight ? (
        <Card
          className="border-nin-red/40 bg-nin-red/10"
          onClick={() => navigate(`/night/${activeNight.id}`)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-nin-red text-sm font-extrabold uppercase tracking-wider">Live Game Night</p>
              <p className="text-2xl font-black mt-1">Night #{activeNight.night_number}</p>
              <p className="text-midnight-400 text-sm font-semibold">{formatDate(activeNight.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-9 h-9 text-nin-red" />
              <button
                onClick={(e) => { e.stopPropagation(); cancelNight() }}
                className="text-midnight-500 hover:text-red-400 transition-colors p-1.5 rounded-xl hover:bg-midnight-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Button onClick={startNewNight} size="lg" className="w-full flex items-center justify-center gap-2 text-lg">
          <Plus className="w-6 h-6" />
          Start Game Night
        </Button>
      )}

      {/* Pending Approval Night */}
      {pendingNight && (
        <Card
          className="border-gold-400/30 bg-gold-400/5"
          onClick={() => navigate(`/night/${pendingNight.id}/summary`)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gold-400" />
                <p className="text-gold-400 text-sm font-extrabold uppercase tracking-wider">Pending Approval</p>
              </div>
              <p className="text-xl font-black mt-1">Night #{pendingNight.night_number}</p>
              <p className="text-midnight-400 text-sm font-semibold">Tap to review and approve</p>
            </div>
          </div>
        </Card>
      )}

      {/* All-Time Leader Widget */}
      {allTime.length > 0 && (
        <Card className="cursor-pointer" onClick={() => navigate('/leaderboard')}>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-gold-400" />
            <p className="font-black text-sm uppercase tracking-wider text-gold-400">All-Time Leaderboard</p>
          </div>
          <div className="space-y-3">
            {allTime.map((e, i) => (
              <div key={e.player.id} className={`flex items-center gap-3 ${i === 0 ? 'py-1' : ''}`}>
                <span
                  className="text-lg font-black w-8 text-center"
                  style={{ color: PLACEMENT_COLORS[i] || '#7a7a9e' }}
                >
                  {i === 0 ? '' : `#${i + 1}`}
                </span>
                {i === 0 && <Crown className="w-6 h-6 text-gold-400 -mr-1" />}
                <PlayerAvatar name={e.player.name} color={e.player.color} size={i === 0 ? 'md' : 'sm'} />
                <span className={`font-bold flex-1 ${i === 0 ? 'text-lg' : ''}`}>{e.player.display_name}</span>
                <span className={`font-black ${i === 0 ? 'text-2xl text-shimmer-gold' : 'text-xl text-white'}`}>
                  {e.totalPoints}
                </span>
                <span className="text-xs text-midnight-400 font-bold">pts</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Year-by-Year Standings */}
      {yearStats.map(ys => {
        const isExpanded = expandedYear === ys.year

        return (
          <Card key={ys.year}>
            <button
              className="w-full text-left"
              onClick={() => setExpandedYear(isExpanded ? null : ys.year)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-nin-blue" />
                  <span className="font-black text-xl">{ys.year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-midnight-400 text-sm font-bold">{ys.nightsPlayed} nights</span>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-midnight-400" />
                    : <ChevronDown className="w-4 h-4 text-midnight-400" />
                  }
                </div>
              </div>

              <div className="space-y-2.5">
                {ys.standings.map((s, i) => (
                  <div key={s.player.id} className="flex items-center gap-3">
                    <span
                      className="text-sm font-black w-7 text-center"
                      style={{ color: PLACEMENT_COLORS[i] || '#7a7a9e' }}
                    >
                      #{i + 1}
                    </span>
                    <PlayerAvatar name={s.player.name} color={s.player.color} size="sm" />
                    <span className="text-sm font-bold flex-1">{s.player.display_name}</span>
                    <span className="text-lg font-black">{s.points}</span>
                    <span className="text-xs text-midnight-400 font-bold w-7">pts</span>
                    <span className="text-sm font-black text-gold-400">{s.wins}W</span>
                  </div>
                ))}
              </div>
            </button>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t-2 border-midnight-600/40">
                <p className="text-xs text-midnight-400 uppercase tracking-wider font-extrabold mb-3">Season Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  {ys.standings.map((s) => (
                    <div key={s.player.id} className="bg-midnight-700/40 border-2 border-midnight-600/30 rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <PlayerAvatar name={s.player.name} color={s.player.color} size="sm" />
                        <span className="text-sm font-black">{s.player.display_name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-center">
                        <div>
                          <p className="text-xl font-black">{s.points}</p>
                          <p className="text-[10px] text-midnight-400 font-bold">Points</p>
                        </div>
                        <div>
                          <p className="text-xl font-black text-gold-400">{s.wins}</p>
                          <p className="text-[10px] text-midnight-400 font-bold">Wins</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
