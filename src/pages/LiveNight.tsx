import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Check, Shuffle, X } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { getPointsForGame, getPointsForPlacement } from '../lib/points'
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from '../lib/constants'
import type { Player, Game, GameNightGame, Placement, PointScale } from '../types'

interface GameWithPlacements extends GameNightGame {
  game: Game
  placements: (Placement & { player?: Player })[]
}

export default function LiveNight() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [allGames, setAllGames] = useState<Game[]>([])
  const [nightGames, setNightGames] = useState<GameWithPlacements[]>([])
  const [scales, setScales] = useState<PointScale[]>([])
  const [showGamePicker, setShowGamePicker] = useState(false)
  const [nightNumber, setNightNumber] = useState(0)

  const loadNight = useCallback(async () => {
    if (!id) return

    const [
      { data: nightData },
      { data: nightPlayers },
      { data: games },
      { data: nightGamesData },
      { data: scalesData },
    ] = await Promise.all([
      supabase.from('game_nights').select('*').eq('id', id).single(),
      supabase.from('game_night_players').select('player_id, players(*)').eq('game_night_id', id),
      supabase.from('games').select('*').order('name'),
      supabase
        .from('game_night_games')
        .select('*, games(*), placements(*, players(*))')
        .eq('game_night_id', id)
        .order('game_order'),
      supabase.from('point_scales').select('*'),
    ])

    if (nightData) setNightNumber(nightData.night_number)
    if (nightPlayers) {
      setPlayers(nightPlayers.map((np: any) => np.players).filter(Boolean))
    }
    if (games) setAllGames(games)
    if (nightGamesData) {
      setNightGames(nightGamesData.map((ng: any) => ({
        ...ng,
        game: ng.games,
        placements: ng.placements || [],
      })))
    }
    if (scalesData) setScales(scalesData)
  }, [id])

  useEffect(() => {
    loadNight()
  }, [loadNight])

  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`night-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'placements' }, () => loadNight())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_night_games', filter: `game_night_id=eq.${id}` }, () => loadNight())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, loadNight])

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') loadNight()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [loadNight])

  const totals: Record<string, number> = {}
  for (const game of nightGames) {
    for (const p of game.placements) {
      totals[p.player_id] = (totals[p.player_id] || 0) + p.points
    }
  }

  const sortedPlayers = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))

  async function addGame(game: Game) {
    if (!id) return
    const nextOrder = nightGames.length + 1

    await supabase.from('game_night_games').insert({
      game_night_id: id,
      game_id: game.id,
      game_order: nextOrder,
      is_tiebreaker: false,
    })

    setShowGamePicker(false)
    loadNight()
  }

  async function removeGame(gameNightGameId: string) {
    await supabase.from('game_night_games').delete().eq('id', gameNightGameId)
    loadNight()
  }

  async function setPlacement(gameNightGameId: string, playerId: string, placement: number) {
    const game = nightGames.find(g => g.id === gameNightGameId)
    if (!game) return

    const pointsArray = getPointsForGame(scales, game.game_id, players.length)
    const points = getPointsForPlacement(pointsArray, placement)

    const existing = game.placements.find(p => p.player_id === playerId)

    // Tap same placement to unset
    if (existing?.placement === placement) {
      await supabase.from('placements').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('placements').update({ placement, points }).eq('id', existing.id)
    } else {
      await supabase.from('placements').insert({
        game_night_game_id: gameNightGameId,
        player_id: playerId,
        placement,
        points,
      })
    }

    loadNight()
  }

  async function endNight() {
    if (!id) return
    await supabase
      .from('game_nights')
      .update({ status: 'pending_approval' })
      .eq('id', id)

    await supabase.from('app_settings').upsert({
      key: `approvals_${id}`,
      value: JSON.stringify([]),
    }, { onConflict: 'key' })

    navigate(`/night/${id}/summary`)
  }

  return (
    <div className="p-4 space-y-4">
      <Card className="border-nin-red/30 bg-nin-red/5">
        <p className="text-xs font-extrabold text-nin-red uppercase tracking-wider mb-3">
          Night #{nightNumber} - Running Totals
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {sortedPlayers.map((player, idx) => (
            <div key={player.id} className="flex flex-col items-center min-w-[64px]">
              <PlayerAvatar name={player.name} color={player.color} size="sm" />
              <span className="text-xs mt-1.5 text-midnight-300 truncate max-w-[64px] font-bold">{player.display_name}</span>
              <span className={`text-xl font-black ${idx === 0 && Object.keys(totals).length > 0 ? 'text-gold-400' : 'text-white'}`}>
                {totals[player.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {nightGames.map((ng, gameIdx) => (
        <Card key={ng.id}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black">
              <span className="text-midnight-400 text-sm">Game {gameIdx + 1}:</span>{' '}
              {ng.game.name}
            </h3>
            <button
              onClick={() => removeGame(ng.id)}
              className="text-midnight-500 hover:text-red-400 transition-colors p-1.5 rounded-xl hover:bg-midnight-700/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            {players.map(player => {
              const placement = ng.placements.find(p => p.player_id === player.id)
              const pointsArray = getPointsForGame(scales, ng.game_id, players.length)

              return (
                <div key={player.id} className="flex items-center gap-3">
                  <PlayerAvatar name={player.name} color={player.color} size="sm" />
                  <span className="text-sm flex-1 truncate font-bold">{player.display_name}</span>
                  <div className="flex gap-1.5">
                    {players.map((_, i) => {
                      const pos = i + 1
                      const isSelected = placement?.placement === pos
                      const pts = getPointsForPlacement(pointsArray, pos)

                      return (
                        <button
                          key={pos}
                          onClick={() => setPlacement(ng.id, player.id, pos)}
                          className={`w-11 h-11 rounded-xl text-xs font-black transition-all duration-150 border-2 ${
                            isSelected
                              ? 'scale-105 shadow-lg'
                              : 'opacity-50 hover:opacity-80 border-transparent'
                          }`}
                          style={{
                            backgroundColor: isSelected
                              ? PLACEMENT_COLORS[i] || '#4b5563'
                              : '#1e1e3a',
                            color: isSelected && i < 1 ? '#000' : '#fff',
                            borderColor: isSelected
                              ? '#ffffff50'
                              : 'transparent',
                          }}
                        >
                          <div>{PLACEMENT_LABELS[i]}</div>
                          <div className="text-[10px] opacity-75">{pts}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ))}

      {showGamePicker ? (
        <Card>
          <p className="text-sm font-black mb-3">Pick a game</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {allGames.filter(g => !/^Game \d+$/.test(g.name)).map(game => (
              <button
                key={game.id}
                onClick={() => addGame(game)}
                className="text-left px-3 py-2.5 bg-midnight-700/50 border-2 border-midnight-600/30 rounded-xl text-sm font-bold hover:bg-midnight-600/50 hover:border-midnight-500/40 transition-all active:scale-95"
              >
                {game.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowGamePicker(false)}
            className="mt-3 text-sm text-midnight-400 hover:text-midnight-300 font-bold"
          >
            Cancel
          </button>
        </Card>
      ) : (
        <div className="flex gap-3">
          <Button onClick={() => setShowGamePicker(true)} variant="secondary" className="flex-1 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Game
          </Button>
          <Button onClick={() => {}} variant="ghost" className="flex items-center gap-2">
            <Shuffle className="w-4 h-4" />
          </Button>
        </div>
      )}

      {nightGames.length > 0 && (
        <Button onClick={endNight} variant="primary" size="lg" className="w-full flex items-center justify-center gap-2">
          <Check className="w-5 h-5" /> End Night
        </Button>
      )}
    </div>
  )
}
