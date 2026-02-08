import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { Card } from '../components/common/Card'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { formatDate } from '../lib/constants'
import type { Player } from '../types'

interface NightSummary {
  id: string
  night_number: number
  date: string
  status: string
  winner: Player | null
  winnerPoints: number
  gameCount: number
}

export default function History() {
  const navigate = useNavigate()
  const [nights, setNights] = useState<NightSummary[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    try {
      const { data } = await supabase
        .from('game_nights')
        .select(`
          id, night_number, date, status,
          game_night_games(
            id,
            placements(player_id, points)
          ),
          game_night_players(
            player_id,
            players(*)
          )
        `)
        .eq('status', 'completed')
        .order('date', { ascending: false })

      if (!data) return

      const allYears = new Set<number>()
      const summaries: NightSummary[] = data.map((night: any) => {
        allYears.add(new Date(night.date).getFullYear())

        const totals: Record<string, number> = {}
        let gameCount = 0
        for (const game of night.game_night_games || []) {
          gameCount++
          for (const p of game.placements || []) {
            totals[p.player_id] = (totals[p.player_id] || 0) + p.points
          }
        }

        const winnerId = Object.entries(totals).sort(([, a], [, b]) => b - a)[0]?.[0]
        const winnerPlayer = night.game_night_players?.find(
          (np: any) => np.player_id === winnerId
        )?.players

        return {
          id: night.id,
          night_number: night.night_number,
          date: night.date,
          status: night.status,
          winner: winnerPlayer || null,
          winnerPoints: winnerId ? totals[winnerId] : 0,
          gameCount,
        }
      })

      setYears(Array.from(allYears).sort((a, b) => b - a))
      setNights(summaries)
      if (!selectedYear && allYears.size > 0) {
        setSelectedYear(Math.max(...allYears))
      }
    } catch {
      // Supabase not configured
    } finally {
      setLoading(false)
    }
  }

  const filtered = selectedYear
    ? nights.filter(n => new Date(n.date).getFullYear() === selectedYear)
    : nights

  if (loading) return <LoadingSpinner className="h-64" />

  return (
    <div className="p-4 space-y-4">
      {/* Year pills */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {years.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-5 py-2 rounded-xl text-sm font-display transition-all duration-150 active:scale-95 whitespace-nowrap ${
              selectedYear === year
                ? 'bg-nin-red text-white shadow-[0_3px_0_0_#9a000d,0_0_16px_rgba(230,0,18,0.3)]'
                : 'bg-midnight-800 text-midnight-300 border border-midnight-600/40 hover:bg-midnight-700'
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-midnight-400 py-8 font-semibold">No game nights recorded yet</p>
      ) : (
        /* Timeline layout */
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-midnight-700/60" />

          <div className="space-y-3">
            {filtered.map((night, idx) => (
              <div key={night.id} className="animate-slide-up relative" style={{ animationDelay: `${idx * 60}ms` }}>
                {/* Timeline dot */}
                <div
                  className="absolute left-[14px] top-5 w-3 h-3 rounded-full border-2 border-midnight-950 z-10"
                  style={{ backgroundColor: night.winner?.color || '#7a7a9e' }}
                />

                <div className="pl-10">
                  <div className="flex rounded-2xl overflow-hidden">
                    {/* Left accent bar in winner color */}
                    <div
                      className="w-1 shrink-0"
                      style={{ backgroundColor: night.winner?.color || '#7a7a9e' }}
                    />
                    <div className="flex-1">
                      <Card className="rounded-l-none border-l-0" onClick={() => navigate(`/history/${night.id}`)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-midnight-400 font-display uppercase tracking-wider">
                              Night #{night.night_number}
                            </p>
                            <p className="font-display text-base mt-0.5">{formatDate(night.date)}</p>
                            <p className="text-xs text-midnight-500 mt-1 font-semibold">{night.gameCount} games</p>
                          </div>
                          {night.winner && (
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <Crown className="w-3.5 h-3.5 text-gold-400" />
                                  <p className="text-sm font-display" style={{ color: night.winner.color }}>
                                    {night.winner.display_name}
                                  </p>
                                </div>
                                <p className="text-xs text-gold-400 font-display">{night.winnerPoints} pts</p>
                              </div>
                              <PlayerAvatar name={night.winner.name} color={night.winner.color} size="sm" />
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
