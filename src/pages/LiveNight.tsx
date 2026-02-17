import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Shuffle, X, Trophy, Flame, Undo2 } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useToast } from '../components/common/Toast'
import { supabase } from '../lib/supabase'
import { getPointsForGame, getPointsForPlacement } from '../lib/points'
import { getOnFirePlayers } from '../lib/stats'
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from '../lib/constants'
import type { Player, Game, GameNightGame, Placement, PointScale } from '../types'

interface GameWithPlacements extends GameNightGame {
  game: Game
  placements: (Placement & { player?: Player })[]
}

interface UndoAction {
  type: 'set' | 'update' | 'delete'
  placementId?: string
  gameNightGameId: string
  playerId: string
  previousPlacement?: number
  previousPoints?: number
}

export default function LiveNight() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [players, setPlayers] = useState<Player[]>([])
  const [allGames, setAllGames] = useState<Game[]>([])
  const [nightGames, setNightGames] = useState<GameWithPlacements[]>([])
  const [scales, setScales] = useState<PointScale[]>([])
  const [showGamePicker, setShowGamePicker] = useState(false)
  const [nightNumber, setNightNumber] = useState(0)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [isEnding, setIsEnding] = useState(false)
  const [confirmRemoveGameId, setConfirmRemoveGameId] = useState<string | null>(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  const loadNight = useCallback(async () => {
    if (!id) return

    const [
      { data: nightData, error: nightError },
      { data: nightPlayers, error: playersError },
      { data: games, error: gamesError },
      { data: nightGamesData, error: nightGamesError },
      { data: scalesData, error: scalesError },
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

    if (nightError || playersError || gamesError || nightGamesError || scalesError) {
      toast('Failed to load night data', 'error')
      return
    }

    if (nightData) setNightNumber(nightData.night_number)
    if (nightPlayers) {
      const mapped = (nightPlayers as unknown as { player_id: string; players: Player }[])
        .map(np => np.players)
        .filter((p): p is Player => p !== null)
      setPlayers(mapped)
    }
    if (games) setAllGames(games)
    if (nightGamesData) {
      setNightGames(
        (nightGamesData as (GameNightGame & { games: Game; placements: (Placement & { players?: Player })[] })[]).map(
          ng => ({
            ...ng,
            game: ng.games,
            placements: (ng.placements || []).map(p => ({
              ...p,
              player: p.players,
            })),
          })
        )
      )
    }
    if (scalesData) setScales(scalesData)
  }, [id, toast])

  useEffect(() => {
    loadNight()
  }, [loadNight])

  useEffect(() => {
    if (!id) return

    // NOTE: The placements subscription is unfiltered because placements don't have
    // a direct game_night_id column — they reference game_night_games. Supabase
    // realtime filters only support top-level columns, so we can't filter by the
    // parent night. This means we'll reload on ANY placement change across all nights.
    // This is an acceptable tradeoff for simplicity; the reload is cheap and nights
    // rarely overlap.
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

  // On-fire detection
  const onFirePlayers = getOnFirePlayers(nightGames)

  async function addGame(game: Game) {
    if (!id) return
    const nextOrder = nightGames.length + 1

    const { error } = await supabase.from('game_night_games').insert({
      game_night_id: id,
      game_id: game.id,
      game_order: nextOrder,
      is_tiebreaker: false,
    })

    if (error) {
      toast('Failed to add game', 'error')
      return
    }

    setShowGamePicker(false)
    loadNight()
  }

  async function removeGame(gameNightGameId: string) {
    const { error } = await supabase.from('game_night_games').delete().eq('id', gameNightGameId)

    if (error) {
      toast('Failed to remove game', 'error')
      return
    }

    toast('Game removed')
    loadNight()
  }

  async function setPlacement(gameNightGameId: string, playerId: string, placement: number) {
    const game = nightGames.find(g => g.id === gameNightGameId)
    if (!game) return

    const pointsArray = getPointsForGame(scales, game.game_id, players.length)
    const points = getPointsForPlacement(pointsArray, placement)

    const existing = game.placements.find(p => p.player_id === playerId)

    if (existing?.placement === placement) {
      // Toggling off — save undo as "delete" (we're removing it, undo would restore it)
      setUndoStack(prev => [...prev.slice(-9), {
        type: 'delete',
        placementId: existing.id,
        gameNightGameId,
        playerId,
        previousPlacement: existing.placement,
        previousPoints: existing.points,
      }])
      const { error } = await supabase.from('placements').delete().eq('id', existing.id)
      if (error) {
        toast('Failed to update placement', 'error')
        setUndoStack(prev => prev.slice(0, -1))
        return
      }
    } else if (existing) {
      // Updating — save undo as "update"
      setUndoStack(prev => [...prev.slice(-9), {
        type: 'update',
        placementId: existing.id,
        gameNightGameId,
        playerId,
        previousPlacement: existing.placement,
        previousPoints: existing.points,
      }])
      const { error } = await supabase.from('placements').update({ placement, points }).eq('id', existing.id)
      if (error) {
        toast('Failed to update placement', 'error')
        setUndoStack(prev => prev.slice(0, -1))
        return
      }
    } else {
      // New placement — save undo as "set" (undo would delete it)
      setUndoStack(prev => [...prev.slice(-9), {
        type: 'set',
        gameNightGameId,
        playerId,
      }])
      const { error } = await supabase.from('placements').insert({
        game_night_game_id: gameNightGameId,
        player_id: playerId,
        placement,
        points,
      })
      if (error) {
        toast('Failed to set placement', 'error')
        setUndoStack(prev => prev.slice(0, -1))
        return
      }
    }

    loadNight()
  }

  async function undoLastPlacement() {
    const action = undoStack[undoStack.length - 1]
    if (!action) return

    setUndoStack(prev => prev.slice(0, -1))

    if (action.type === 'set') {
      // Was a new insert — find and delete the placement for this player in this game
      const game = nightGames.find(g => g.id === action.gameNightGameId)
      const placement = game?.placements.find(p => p.player_id === action.playerId)
      if (placement) {
        const { error } = await supabase.from('placements').delete().eq('id', placement.id)
        if (error) {
          toast('Undo failed', 'error')
          return
        }
      }
    } else if (action.type === 'update' && action.placementId) {
      // Was an update — restore previous values
      const { error } = await supabase.from('placements').update({
        placement: action.previousPlacement,
        points: action.previousPoints,
      }).eq('id', action.placementId)
      if (error) {
        toast('Undo failed', 'error')
        return
      }
    } else if (action.type === 'delete' && action.previousPlacement !== undefined) {
      // Was a delete (toggle off) — re-insert
      const { error } = await supabase.from('placements').insert({
        game_night_game_id: action.gameNightGameId,
        player_id: action.playerId,
        placement: action.previousPlacement,
        points: action.previousPoints,
      })
      if (error) {
        toast('Undo failed', 'error')
        return
      }
    }

    loadNight()
  }

  async function endNight() {
    if (!id || isEnding) return
    setIsEnding(true)

    try {
      const { error: updateError } = await supabase
        .from('game_nights')
        .update({ status: 'pending_approval' })
        .eq('id', id)

      if (updateError) {
        toast('Failed to end night', 'error')
        return
      }

      const { error: settingsError } = await supabase.from('app_settings').upsert({
        key: `approvals_${id}`,
        value: JSON.stringify([]),
      }, { onConflict: 'key' })

      if (settingsError) {
        toast('Night ended but approval tracking failed', 'warning')
      }

      navigate(`/night/${id}/summary`)
    } finally {
      setIsEnding(false)
    }
  }

  const gameToRemove = confirmRemoveGameId
    ? nightGames.find(ng => ng.id === confirmRemoveGameId)
    : null

  return (
    <div className="p-4 space-y-4">
      {/* Running Totals Scoreboard */}
      <Card variant="active">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-nin-red animate-pulse-dot" />
          <p className="text-xs font-display text-nin-red uppercase tracking-wider">
            Night #{nightNumber} — Live Scores
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {sortedPlayers.map((player, idx) => {
            const isLeader = idx === 0 && Object.keys(totals).length > 0
            const isOnFire = onFirePlayers.has(player.id)

            return (
              <div
                key={player.id}
                className={`flex flex-col items-center min-w-[72px] py-2 px-1 rounded-2xl transition-all ${
                  isLeader ? 'bg-gold-400/[0.08]' : ''
                }`}
              >
                <div className="relative">
                  <PlayerAvatar name={player.name} color={player.color} size="sm" glow={isLeader} />
                  {isOnFire && (
                    <Flame className="w-4 h-4 text-nin-orange absolute -top-1 -right-1 animate-pulse drop-shadow-[0_0_6px_rgba(255,149,0,0.6)]" />
                  )}
                </div>
                <span className="text-[11px] mt-1.5 text-midnight-300 truncate max-w-[72px] font-bold">{player.display_name}</span>
                <span className={`text-2xl font-display ${isLeader ? 'text-gold-400' : 'text-white'}`}>
                  {totals[player.id] || 0}
                </span>
                {isOnFire && (
                  <span className="text-[9px] text-nin-orange font-display mt-0.5">ON FIRE</span>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Game Cards with Numbered Headers */}
      {nightGames.map((ng, gameIdx) => (
        <div key={ng.id} className="animate-slide-up" style={{ animationDelay: `${gameIdx * 60}ms` }}>
          <Card>
            {/* Game header stripe */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="bg-nin-red/20 text-nin-red text-xs font-black px-2.5 py-1 rounded-lg">
                  {gameIdx + 1}
                </span>
                <h3 className="font-display text-base">{ng.game.name}</h3>
              </div>
              <button
                onClick={() => setConfirmRemoveGameId(ng.id)}
                aria-label={`Remove ${ng.game.name}`}
                className="text-midnight-500 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-midnight-700/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {players.map(player => {
                const placement = ng.placements.find(p => p.player_id === player.id)
                const pointsArray = getPointsForGame(scales, ng.game_id, players.length)

                return (
                  <div key={player.id} className="flex items-center gap-2.5">
                    <PlayerAvatar name={player.name} color={player.color} size="sm" />
                    <span className="text-sm flex-1 truncate font-bold min-w-0">{player.display_name}</span>
                    <div className="flex gap-1.5">
                      {players.map((_, i) => {
                        const pos = i + 1
                        const isSelected = placement?.placement === pos
                        const pts = getPointsForPlacement(pointsArray, pos)

                        return (
                          <button
                            key={pos}
                            onClick={() => setPlacement(ng.id, player.id, pos)}
                            aria-label={`${PLACEMENT_LABELS[i]} place for ${player.display_name} in ${ng.game.name} (${pts} pts)`}
                            className={`w-11 h-11 rounded-xl text-xs font-black transition-all duration-100 ${
                              isSelected
                                ? 'shadow-[0_3px_0_0_rgba(0,0,0,0.3)] translate-y-0'
                                : 'opacity-40 hover:opacity-70 shadow-[0_3px_0_0_rgba(0,0,0,0.15)]'
                            }`}
                            style={{
                              backgroundColor: isSelected
                                ? PLACEMENT_COLORS[i] || '#4b5563'
                                : '#1e1e3a',
                              color: isSelected && i < 1 ? '#000' : '#fff',
                              boxShadow: isSelected
                                ? `0 3px 0 0 rgba(0,0,0,0.3), 0 0 12px ${PLACEMENT_COLORS[i]}40`
                                : undefined,
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
        </div>
      ))}

      {/* Add Game / Shuffle / Undo */}
      {showGamePicker ? (
        <Card>
          <p className="text-sm font-display mb-3">Pick a game</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {allGames.filter(g => !/^Game \d+$/.test(g.name)).map(game => (
              <button
                key={game.id}
                onClick={() => addGame(game)}
                className="text-left px-3 py-2.5 bg-midnight-700/40 border border-midnight-600/20 rounded-xl text-sm font-bold hover:bg-midnight-600/40 hover:border-midnight-500/30 transition-all active:scale-95"
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
          <Button onClick={() => navigate(`/night/${id}/randomizer`)} variant="ghost" className="flex items-center gap-2">
            <Shuffle className="w-4 h-4" />
          </Button>
          {undoStack.length > 0 && (
            <Button onClick={undoLastPlacement} variant="ghost" className="flex items-center gap-2">
              <Undo2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* End Night — dramatic gold button */}
      {nightGames.length > 0 && (
        <Button
          onClick={() => setShowEndConfirm(true)}
          disabled={isEnding}
          variant="glow"
          size="lg"
          className="w-full flex items-center justify-center gap-2"
        >
          <Trophy className="w-5 h-5" /> {isEnding ? 'Ending...' : 'End Night'}
        </Button>
      )}

      {/* Confirm remove game dialog */}
      {confirmRemoveGameId && gameToRemove && (
        <ConfirmDialog
          title="Remove Game"
          message={`Remove "${gameToRemove.game.name}" and all its placements from this night?`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeGame(confirmRemoveGameId)
            setConfirmRemoveGameId(null)
          }}
          onCancel={() => setConfirmRemoveGameId(null)}
        />
      )}

      {/* Confirm end night dialog */}
      {showEndConfirm && (
        <ConfirmDialog
          title="End Night"
          message="Lock in all scores and move to the summary screen? This can't be undone."
          confirmLabel="End Night"
          onConfirm={() => {
            setShowEndConfirm(false)
            endNight()
          }}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  )
}
