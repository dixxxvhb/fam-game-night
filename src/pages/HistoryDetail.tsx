import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Crown, RotateCcw } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useToast } from '../components/common/Toast'
import { supabase } from '../lib/supabase'
import { quickRematch } from '../lib/quickRematch'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { PLACEMENT_LABELS, PLACEMENT_COLORS, formatDate } from '../lib/constants'
import type { Player, Game } from '../types'

interface GameResult {
  game: Game
  game_order: number
  is_tiebreaker: boolean
  placements: { player: Player; placement: number; points: number }[]
}

interface NightPlayerRow {
  player_id: string
  players: Player | null
}

interface PlacementRow {
  player_id: string
  placement: number
  points: number
  players: Player | null
}

interface NightGameRow {
  game_order: number
  is_tiebreaker: boolean
  games: Game | null
  placements: PlacementRow[] | null
}

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [nightNumber, setNightNumber] = useState(0)
  const [date, setDate] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<GameResult[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

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

    const playerList = (nightPlayers as NightPlayerRow[] | null)
      ?.map(np => np.players)
      .filter((p): p is Player => p !== null) || []
    setPlayers(playerList)

    const t: Record<string, number> = {}
    const gameResults: GameResult[] = ((nightGames as NightGameRow[] | null) || []).map(ng => {
      const placements = (ng.placements || [])
        .filter((p): p is PlacementRow & { players: Player } => p.players !== null)
        .map(p => {
          t[p.player_id] = (t[p.player_id] || 0) + p.points
          return { player: p.players, placement: p.placement, points: p.points }
        })
        .sort((a, b) => a.placement - b.placement)

      return {
        game: ng.games!,
        game_order: ng.game_order,
        is_tiebreaker: ng.is_tiebreaker,
        placements,
      }
    })

    setGames(gameResults)
    setTotals(t)
    setLoading(false)
  }

  async function handleEditNight() {
    if (!id || actionLoading) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('game_nights').update({ status: 'active', completed_at: null }).eq('id', id)
      if (error) {
        toast('Failed to reopen game night', 'error')
        return
      }
      navigate(`/night/${id}`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteNight() {
    if (!id || actionLoading) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('game_nights').delete().eq('id', id)
      if (error) {
        toast('Failed to delete game night', 'error')
        return
      }
      toast('Game night deleted', 'success')
      navigate('/history')
    } finally {
      setActionLoading(false)
      setShowConfirmDelete(false)
    }
  }

  async function handleQuickRematch() {
    if (!id || actionLoading) return
    setActionLoading(true)
    try {
      const newId = await quickRematch(id)
      if (newId) {
        navigate('/night/' + newId)
      } else {
        toast('Failed to create rematch', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const sortedPlayers = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))

  if (loading) return <LoadingSpinner className="h-64" />

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center py-2 animate-slide-up">
        <p className="text-midnight-400 text-sm font-display uppercase tracking-wider">Night #{nightNumber}</p>
        <p className="text-xl font-display mt-1">{formatDate(date)}</p>
      </div>

      {/* Final Standings -- Report card style */}
      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <Card>
          {/* Report card header stripe */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-midnight-600/30">
            <div className="bg-gradient-to-r from-gold-500 to-gold-400 rounded-lg px-3 py-1">
              <span className="text-midnight-950 text-xs font-display uppercase tracking-wider">Final Standings</span>
            </div>
          </div>

          <div className="space-y-3">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 ${
                  idx === 0 ? 'py-2 bg-gold-400/[0.06] -mx-3 px-3 rounded-xl' : ''
                }`}
              >
                <span
                  className={`font-display text-right ${idx === 0 ? 'text-lg w-8' : 'text-sm w-8'}`}
                  style={{ color: PLACEMENT_COLORS[idx] || '#7a7a9e' }}
                >
                  {PLACEMENT_LABELS[idx]}
                </span>
                {idx === 0 && <Crown className="w-5 h-5 text-gold-400 -mr-1" />}
                <PlayerAvatar name={player.name} color={player.color} size={idx === 0 ? 'md' : 'sm'} glow={idx === 0} />
                <span className={`flex-1 ${idx === 0 ? 'font-display text-base' : 'font-bold text-sm'}`}>
                  {player.display_name}
                </span>
                <span className={`font-display ${idx === 0 ? 'text-xl text-gold-400' : 'text-lg'}`}>
                  {totals[player.id] || 0}
                </span>
                <span className="text-xs text-midnight-400 font-bold">pts</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 animate-slide-up" style={{ animationDelay: '160ms' }}>
        <Button onClick={handleQuickRematch} variant="secondary" disabled={actionLoading} className="flex-1 flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> Rematch
        </Button>
        <Button onClick={handleEditNight} variant="ghost" disabled={actionLoading} className="flex items-center justify-center gap-2" aria-label="Edit game night">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button onClick={() => setShowConfirmDelete(true)} variant="ghost" disabled={actionLoading} className="flex items-center gap-2 text-red-400" aria-label="Delete game night">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Confirm delete modal */}
      {showConfirmDelete && (
        <ConfirmDialog
          title="Delete Game Night"
          message={`Are you sure you want to delete Night #${nightNumber}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteNight}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}

      {/* Game Cards -- Numbered gradient headers */}
      {games.map((game, idx) => (
        <div key={idx} className="animate-slide-up" style={{ animationDelay: `${220 + idx * 60}ms` }}>
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-nin-red/20 text-nin-red text-xs font-black px-2.5 py-1 rounded-lg">
                {game.game_order}
              </span>
              <span className="font-display text-base">{game.game.name}</span>
              {game.is_tiebreaker && (
                <span className="text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full font-display">Tiebreaker</span>
              )}
            </div>
            <div className="space-y-2">
              {game.placements.map(p => (
                <div
                  key={p.player.id}
                  className={`flex items-center gap-2 ${
                    p.placement === 1 ? 'bg-gold-400/[0.06] -mx-2 px-2 py-1.5 rounded-xl' : ''
                  }`}
                >
                  <span
                    className="text-xs font-display w-7 text-right"
                    style={{ color: PLACEMENT_COLORS[p.placement - 1] || '#7a7a9e' }}
                  >
                    {PLACEMENT_LABELS[p.placement - 1]}
                  </span>
                  <PlayerAvatar name={p.player.name} color={p.player.color} size="sm" />
                  <span className="flex-1 text-sm font-bold">{p.player.display_name}</span>
                  <span className="text-sm font-display">{p.points} pts</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}
