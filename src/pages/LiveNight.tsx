import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Shuffle, X, Trophy, Flame, Undo2, Lock, ChevronRight } from 'lucide-react'
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
  // Predictions
  const [predictionPhase, setPredictionPhase] = useState<'predictions' | 'playing'>('predictions')
  const [allPredictions, setAllPredictions] = useState<Record<string, string[]>>({}) // playerName → predicted order (names)
  const [activePredictingPlayer, setActivePredictingPlayer] = useState<Player | null>(null)
  const [draftOrder, setDraftOrder] = useState<string[]>([]) // names in predicted order being built

  const loadNight = useCallback(async () => {
    if (!id) return

    const [
      { data: nightData, error: nightError },
      { data: nightPlayers, error: playersError },
      { data: games, error: gamesError },
      { data: nightGamesData, error: nightGamesError },
      { data: scalesData, error: scalesError },
      { data: predictionsData },
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
      supabase.from('app_settings').select('value').eq('key', `predictions_${id}`).single(),
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

    // Load existing predictions and determine phase
    if (predictionsData?.value) {
      try {
        const parsed = JSON.parse(predictionsData.value) as Record<string, string[]>
        setAllPredictions(parsed)
        setPredictionPhase('playing')
      } catch { /* no predictions yet */ }
    }
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

  // Subscribe to prediction updates so all devices see who has predicted
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`predictions-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.predictions_${id}` }, () => loadNight())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, loadNight])

  const totals: Record<string, number> = {}
  for (const game of nightGames) {
    for (const p of game.placements) {
      totals[p.player_id] = (totals[p.player_id] || 0) + p.points
    }
  }

  const completedGames = nightGames.filter(ng => ng.placements.length > 0)
  const scoresHidden = completedGames.length < 5
  const sortedPlayers = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
  const lastPlacePlayer = scoresHidden ? null : sortedPlayers[sortedPlayers.length - 1] ?? null
  const showGame6Banner = completedGames.length === 5

  // On-fire detection
  const onFirePlayers = getOnFirePlayers(nightGames)

  function startPredicting(player: Player) {
    setActivePredictingPlayer(player)
    setDraftOrder([])
  }

  function toggleDraftPick(playerName: string) {
    setDraftOrder(prev => {
      if (prev.includes(playerName)) return prev.filter(n => n !== playerName)
      return [...prev, playerName]
    })
  }

  async function lockInPrediction() {
    if (!id || !activePredictingPlayer || draftOrder.length !== players.length) return

    const updated = { ...allPredictions, [activePredictingPlayer.name]: draftOrder }
    setAllPredictions(updated)
    setActivePredictingPlayer(null)
    setDraftOrder([])

    await supabase.from('app_settings').upsert({
      key: `predictions_${id}`,
      value: JSON.stringify(updated),
    }, { onConflict: 'key' })

    toast(`${activePredictingPlayer.display_name} locked in`, 'success')
  }

  function skipPredictions() {
    setPredictionPhase('playing')
  }

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

      navigate(`/night/${id}/summary`)
    } finally {
      setIsEnding(false)
    }
  }

  const gameToRemove = confirmRemoveGameId
    ? nightGames.find(ng => ng.id === confirmRemoveGameId)
    : null

  const corePlayers = players.filter(p => p.is_core)
  const predictedNames = Object.keys(allPredictions)
  const waitingOn = corePlayers.filter(p => !predictedNames.includes(p.name))

  return (
    <div className="p-4 space-y-4">
      {/* Predictions Phase */}
      {predictionPhase === 'predictions' && (
        <Card variant="highlight">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-nin-blue animate-pulse-dot" />
            <p className="text-xs font-display text-nin-blue uppercase tracking-wider">Predictions</p>
          </div>

          {activePredictingPlayer ? (
            /* Draft order picker for one player */
            <div>
              <p className="text-sm font-bold mb-1">
                <span style={{ color: activePredictingPlayer.color }}>{activePredictingPlayer.display_name}</span>
                {' — '}pick your predicted order
              </p>
              <p className="text-xs text-midnight-400 mb-3 font-semibold">Tap players in order: 1st place first, last place last</p>

              <div className="space-y-2 mb-4">
                {players.map(player => {
                  const rank = draftOrder.indexOf(player.name)
                  const isPicked = rank !== -1
                  return (
                    <button
                      key={player.id}
                      onClick={() => toggleDraftPick(player.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-95 ${
                        isPicked
                          ? 'bg-midnight-600/60 border border-midnight-500/40'
                          : 'bg-midnight-800/40 border border-midnight-700/30 hover:bg-midnight-700/40'
                      }`}
                    >
                      <PlayerAvatar name={player.name} color={player.color} size="sm" />
                      <span className="text-sm font-bold flex-1 text-left">{player.display_name}</span>
                      {player.id === activePredictingPlayer.id && (
                        <span className="text-xs text-midnight-500 font-bold">You</span>
                      )}
                      {isPicked && (
                        <span className="text-sm font-display text-gold-400 w-6 text-center">{rank + 1}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={lockInPrediction}
                  disabled={draftOrder.length !== players.length}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Lock In
                </Button>
                <Button onClick={() => setActivePredictingPlayer(null)} variant="ghost" className="flex-1">
                  Back
                </Button>
              </div>
            </div>
          ) : (
            /* Show who still needs to predict */
            <div>
              <div className="space-y-2 mb-4">
                {corePlayers.map(player => {
                  const hasPredicted = predictedNames.includes(player.name)
                  return (
                    <div key={player.id} className="flex items-center gap-3">
                      <PlayerAvatar name={player.name} color={player.color} size="sm" />
                      <span className="text-sm flex-1 font-bold">{player.display_name}</span>
                      {hasPredicted ? (
                        <span className="text-xs font-extrabold text-nin-green">Locked In</span>
                      ) : (
                        <button
                          onClick={() => startPredicting(player)}
                          className="flex items-center gap-1 text-xs font-bold text-midnight-300 hover:text-white transition-colors"
                        >
                          Predict <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {waitingOn.length === 0 ? (
                <Button onClick={() => setPredictionPhase('playing')} className="w-full flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4" /> Start Playing
                </Button>
              ) : (
                <button
                  onClick={skipPredictions}
                  className="w-full text-sm text-midnight-500 hover:text-midnight-300 font-bold py-2 transition-colors"
                >
                  Skip Predictions
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Running Totals Scoreboard */}
      <Card variant="active">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-nin-red animate-pulse-dot" />
          <p className="text-xs font-display text-nin-red uppercase tracking-wider">
            Night #{nightNumber} — {scoresHidden ? `Scores hidden until game 5 (${completedGames.length}/5)` : 'Live Scores'}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {sortedPlayers.map((player, idx) => {
            const isLeader = !scoresHidden && idx === 0 && Object.keys(totals).length > 0
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
                <span className={`text-2xl font-display ${isLeader ? 'text-gold-400' : scoresHidden ? 'text-midnight-500' : 'text-white'}`}>
                  {scoresHidden ? '?' : (totals[player.id] || 0)}
                </span>
                {isOnFire && (
                  <span className="text-[9px] text-nin-orange font-display mt-0.5">ON FIRE</span>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Game 6 pick banner — shown after game 5 results are entered */}
      {showGame6Banner && lastPlacePlayer && (
        <Card>
          <div className="flex items-center gap-3">
            <PlayerAvatar name={lastPlacePlayer.name} color={lastPlacePlayer.color} size="sm" />
            <div>
              <p className="text-xs font-display text-gold-400 uppercase tracking-wider">Scores Revealed</p>
              <p className="text-sm font-bold">
                <span style={{ color: lastPlacePlayer.color }}>{lastPlacePlayer.display_name}</span>
                {' '}picks Game 6
              </p>
            </div>
          </div>
        </Card>
      )}

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
