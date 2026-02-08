import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/common/Card'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {years.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95 whitespace-nowrap border-2 ${
              selectedYear === year
                ? 'bg-nin-red text-white border-red-400/30 shadow-lg shadow-nin-red/20'
                : 'bg-midnight-800 text-midnight-300 border-midnight-600/40 hover:bg-midnight-700'
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-midnight-400 py-8 font-semibold">No game nights recorded yet</p>
      ) : (
        filtered.map(night => (
          <Card key={night.id} onClick={() => navigate(`/history/${night.id}`)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-midnight-400 font-bold">Night #{night.night_number}</p>
                <p className="font-bold">{night.date}</p>
                <p className="text-xs text-midnight-500 mt-1 font-semibold">{night.gameCount} games</p>
              </div>
              {night.winner && (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: night.winner.color }}>
                      {night.winner.display_name}
                    </p>
                    <p className="text-xs text-gold-400 font-bold">{night.winnerPoints} pts</p>
                  </div>
                  <PlayerAvatar name={night.winner.name} color={night.winner.color} size="sm" />
                </div>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
