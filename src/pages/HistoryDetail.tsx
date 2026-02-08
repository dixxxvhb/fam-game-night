import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { PLACEMENT_LABELS, PLACEMENT_COLORS, formatDate } from '../lib/constants'
import type { Player, Game } from '../types'

interface GameResult {
  game: Game
  game_order: number
  is_tiebreaker: boolean
  placements: { player: Player; placement: number; points: number }[]
}

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [nightNumber, setNightNumber] = useState(0)
  const [date, setDate] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<GameResult[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    loadDetail()
  }, [id])

  async function loadDetail() {
    if (!id) return

    const [{ data: night }, { data: nightPlayers }, { data: nightGames }] = await Promise.all([
      supabase.from('game_nights').select('*').eq('id', id).single(),
      supabase.from('game_night_players').select('player_id, players(*)').eq('game_night_id', id),
      supabase.from('game_night_games').select('*, games(*), placements(*, players(*))').eq('game_night_id', id).order('game_order'),
    ])

    if (night) {
      setNightNumber(night.night_number)
      setDate(night.date)
    }

    const playerList = nightPlayers?.map((np: any) => np.players).filter(Boolean) || []
    setPlayers(playerList)

    const t: Record<string, number> = {}
    const gameResults: GameResult[] = (nightGames || []).map((ng: any) => {
      const placements = (ng.placements || [])
        .map((p: any) => {
          t[p.player_id] = (t[p.player_id] || 0) + p.points
          return { player: p.players, placement: p.placement, points: p.points }
        })
        .sort((a: any, b: any) => a.placement - b.placement)

      return {
        game: ng.games,
        game_order: ng.game_order,
        is_tiebreaker: ng.is_tiebreaker,
        placements,
      }
    })

    setGames(gameResults)
    setTotals(t)
    setLoading(false)
  }

  async function editNight() {
    if (!id) return
    await supabase.from('game_nights').update({ status: 'active', completed_at: null }).eq('id', id)
    navigate(`/night/${id}`)
  }

  async function deleteNight() {
    if (!id) return
    await supabase.from('game_nights').delete().eq('id', id)
    navigate('/history')
  }

  const sortedPlayers = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))

  if (loading) return <LoadingSpinner className="h-64" />

  return (
    <div className="p-4 space-y-4">
      <div className="text-center py-2">
        <p className="text-midnight-400 text-sm font-bold">Night #{nightNumber}</p>
        <p className="text-lg font-black">{formatDate(date)}</p>
      </div>

      <Card>
        <p className="text-xs font-extrabold text-midnight-400 uppercase tracking-wider mb-3">Final Standings</p>
        <div className="space-y-2.5">
          {sortedPlayers.map((player, idx) => (
            <div key={player.id} className="flex items-center gap-3">
              <span
                className="text-sm font-black w-8 text-right"
                style={{ color: PLACEMENT_COLORS[idx] || '#7a7a9e' }}
              >
                {PLACEMENT_LABELS[idx]}
              </span>
              <PlayerAvatar name={player.name} color={player.color} size="sm" />
              <span className="flex-1 font-bold text-sm">{player.display_name}</span>
              <span className="text-lg font-black">{totals[player.id] || 0}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button onClick={editNight} variant="secondary" className="flex-1 flex items-center justify-center gap-2">
          <Pencil className="w-4 h-4" /> Edit Night
        </Button>
        {!showConfirmDelete ? (
          <Button onClick={() => setShowConfirmDelete(true)} variant="ghost" className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={deleteNight} variant="danger" className="flex items-center gap-2">
            Confirm Delete
          </Button>
        )}
      </div>

      {games.map((game, idx) => (
        <Card key={idx}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-midnight-400 text-sm font-bold">Game {game.game_order}:</span>
            <span className="font-black text-sm">{game.game.name}</span>
            {game.is_tiebreaker && (
              <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full font-bold">Tiebreaker</span>
            )}
          </div>
          <div className="space-y-2">
            {game.placements.map(p => (
              <div key={p.player.id} className="flex items-center gap-2">
                <span
                  className="text-xs font-black w-6 text-right"
                  style={{ color: PLACEMENT_COLORS[p.placement - 1] || '#7a7a9e' }}
                >
                  {PLACEMENT_LABELS[p.placement - 1]}
                </span>
                <PlayerAvatar name={p.player.name} color={p.player.color} size="sm" />
                <span className="flex-1 text-sm font-bold">{p.player.display_name}</span>
                <span className="text-sm font-black">{p.points} pts</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
