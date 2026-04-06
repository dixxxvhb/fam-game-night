import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft, Clock, Target } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { PlayerAvatar } from '../../components/common/PlayerAvatar'
import { supabase } from '../../lib/supabase'
import { selectChallenge, CATEGORY_COLORS, SCORING_METHOD_LABELS } from '../../lib/fortnite'
import type { FortniteChallenge, FortniteFormat, FortnitePlayerScore, Player } from '../../types'

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default function GenerateChallenge() {
  const { id, format } = useParams<{ id: string; format: string }>()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<FortniteChallenge[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<FortniteChallenge | null>(null)
  const [turnOrder, setTurnOrder] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [starting, setStarting] = useState(false)

  const validFormat = (format === 'solo' || format === 'squad' ? format : 'solo') as FortniteFormat

  useEffect(() => {
    async function load() {
      const [{ data: challengeData }] = await Promise.all([
        supabase.from('fortnite_challenges').select('*'),
      ])
      setChallenges(challengeData ?? [])

      // Load players: from night if in game night, or all core players if standalone
      if (id) {
        const { data: nightPlayers } = await supabase
          .from('game_night_players')
          .select('player_id, players(*)')
          .eq('game_night_id', id)
        if (nightPlayers) {
          const mapped = (nightPlayers as unknown as { player_id: string; players: Player }[])
            .map(np => np.players)
            .filter((p): p is Player => p !== null)
          setPlayers(mapped)
        }
      } else {
        const { data: allPlayers } = await supabase
          .from('players')
          .select('*')
          .eq('is_core', true)
        setPlayers(allPlayers ?? [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  function generate() {
    setGenerating(true)
    const challenge = selectChallenge(challenges, validFormat)
    // Brief delay for dramatic effect
    setTimeout(() => {
      setSelected(challenge)
      if (challenge && validFormat === 'solo') {
        setTurnOrder(shuffleArray(players))
      }
      setGenerating(false)
    }, 600)
  }

  async function startChallenge() {
    if (!selected || starting) return
    setStarting(true)

    const playerScores: FortnitePlayerScore[] = players.map((p) => ({
      player_id: p.id,
      raw_score: 0,
      calculated_points: 0,
      team_bonus_points: 0,
      total_points: 0,
      turn_order: validFormat === 'solo' ? turnOrder.findIndex(t => t.id === p.id) + 1 : null,
    }))

    const { data: result, error } = await supabase
      .from('fortnite_results')
      .insert({
        game_night_id: id ?? null,
        challenge_id: selected.id,
        format: validFormat,
        team_bonus_awarded: false,
        player_scores: playerScores,
      })
      .select('id')
      .single()

    if (error || !result) {
      setStarting(false)
      return
    }

    navigate(id ? `/night/${id}/fortnite/score/${result.id}` : `/fortnite/score/${result.id}`)
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
        <button
          onClick={() => navigate(id ? `/night/${id}/fortnite` : '/fortnite')}
          className="p-2 rounded-xl hover:bg-midnight-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <h1 className="text-xl font-display text-white">
          {validFormat === 'solo' ? 'Solo Rotation' : 'Squad Up'}
        </h1>
      </div>

      {/* Generate button (before selection) */}
      {!selected && (
        <div className="flex flex-col items-center justify-center py-16">
          <Button
            onClick={generate}
            disabled={generating}
            variant="glow"
            size="lg"
            className="flex items-center gap-3 text-lg px-10"
          >
            <Zap className={`w-6 h-6 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Challenge'}
          </Button>
          <p className="text-sm text-midnight-500 font-semibold mt-4">
            No re-rolls — you get what you get
          </p>
        </div>
      )}

      {/* Challenge Card (after selection) */}
      {selected && (
        <div className="animate-bounce-in">
          <Card variant="highlight">
            {/* Format + Category badges */}
            <div className="flex gap-2 mb-3">
              <span
                className="text-xs font-black px-2.5 py-1 rounded-lg uppercase"
                style={{
                  backgroundColor: validFormat === 'solo' ? 'rgba(10,181,245,0.2)' : 'rgba(0,200,83,0.2)',
                  color: validFormat === 'solo' ? '#0ab5f5' : '#00c853',
                }}
              >
                {validFormat === 'solo' ? 'Solo' : 'Squad'}
              </span>
              <span
                className="text-xs font-black px-2.5 py-1 rounded-lg uppercase"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[selected.category]}20`,
                  color: CATEGORY_COLORS[selected.category],
                }}
              >
                {selected.category}
              </span>
            </div>

            {/* Challenge name */}
            <h2 className="text-2xl font-display text-white mb-2">{selected.name}</h2>
            <p className="text-sm text-midnight-300 font-semibold mb-4">{selected.description}</p>

            {/* Details */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-midnight-400" />
                <span className="text-midnight-300 font-semibold">
                  {selected.time_limit_minutes ? `${selected.time_limit_minutes} minutes` : 'Full Match'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-midnight-400" />
                <span className="text-midnight-300 font-semibold">{selected.win_condition}</span>
              </div>
              <div className="text-xs text-midnight-500 font-bold">
                Scoring: {SCORING_METHOD_LABELS[selected.scoring_method]}
                {selected.scoring_method === 'custom' && selected.multiplier
                  ? ` (x${selected.multiplier})`
                  : ''}
                {selected.scoring_method === 'binary' && selected.binary_points
                  ? ` (${selected.binary_points} pts)`
                  : ''}
              </div>
            </div>

            {/* Turn Order (solo only) */}
            {validFormat === 'solo' && turnOrder.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-display text-gold-400 uppercase tracking-wider mb-2">Turn Order</p>
                <div className="flex gap-3">
                  {turnOrder.map((player, idx) => (
                    <div key={player.id} className="flex flex-col items-center">
                      <span className="text-xs font-display text-gold-400 mb-1">{idx + 1}</span>
                      <PlayerAvatar name={player.name} color={player.color} size="sm" />
                      <span className="text-[10px] text-midnight-400 font-bold mt-1 truncate max-w-[48px]">
                        {player.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Bonus Banner (squad only) */}
            {validFormat === 'squad' && selected.team_bonus_points && (
              <div className="bg-gold-400/10 border border-gold-400/20 rounded-xl p-3 mb-4">
                <p className="text-xs font-display text-gold-400 uppercase tracking-wider mb-1">Team Bonus</p>
                <p className="text-sm text-white font-bold">
                  +{selected.team_bonus_points} pts each
                </p>
                <p className="text-xs text-midnight-300 font-semibold mt-0.5">
                  {selected.team_bonus_condition}
                </p>
              </div>
            )}

            {/* Let's Go button */}
            <Button
              onClick={startChallenge}
              disabled={starting}
              variant="glow"
              size="lg"
              className="w-full flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              {starting ? 'Starting...' : "Let's Go"}
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
