import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Award } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { PlayerAvatar } from '../../components/common/PlayerAvatar'
import { useToast } from '../../components/common/Toast'
import { supabase } from '../../lib/supabase'
import {
  calculateFortnitePoints,
  syncFortniteToNight,
  CATEGORY_COLORS,
  SCORING_METHOD_LABELS,
} from '../../lib/fortnite'
import type { FortniteResult, FortniteChallenge, FortnitePlayerScore, Player } from '../../types'

export default function ScoreChallenge() {
  const { id, resultId } = useParams<{ id: string; resultId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [result, setResult] = useState<FortniteResult | null>(null)
  const [challenge, setChallenge] = useState<FortniteChallenge | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [rawScores, setRawScores] = useState<Record<string, number>>({})
  const [teamBonusAwarded, setTeamBonusAwarded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: resultData } = await supabase
        .from('fortnite_results')
        .select('*, fortnite_challenges(*)')
        .eq('id', resultId!)
        .single()

      if (resultData) {
        const mapped: FortniteResult = {
          ...resultData,
          challenge: resultData.fortnite_challenges,
        }
        setResult(mapped)
        setChallenge(resultData.fortnite_challenges)

        const scores: Record<string, number> = {}
        for (const ps of mapped.player_scores) {
          scores[ps.player_id] = ps.raw_score
        }
        setRawScores(scores)
        setTeamBonusAwarded(mapped.team_bonus_awarded)
      }

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
  }, [id, resultId])

  // Sort players: solo = by turn_order, squad = alphabetical
  const sortedPlayers = useMemo(() => {
    if (!result) return players
    if (result.format === 'solo') {
      return [...players].sort((a, b) => {
        const aOrder = result.player_scores.find(s => s.player_id === a.id)?.turn_order ?? 99
        const bOrder = result.player_scores.find(s => s.player_id === b.id)?.turn_order ?? 99
        return aOrder - bOrder
      })
    }
    return [...players].sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [players, result])

  // Live preview of calculated points
  const livePoints = useMemo(() => {
    if (!challenge) return {}
    const scores = Object.entries(rawScores).map(([player_id, raw_score]) => ({
      player_id,
      raw_score,
    }))
    if (scores.length === 0) return {}

    const calculated = calculateFortnitePoints(scores, challenge)
    const result: Record<string, { calculated: number; bonus: number; total: number; rank: number }> = {}

    // Sort by calculated points for ranking
    const sorted = [...calculated].sort((a, b) => b.calculated_points - a.calculated_points)

    for (const c of calculated) {
      const bonus = teamBonusAwarded && challenge.team_bonus_points ? challenge.team_bonus_points : 0
      const rank = sorted.findIndex(s => s.player_id === c.player_id) + 1
      result[c.player_id] = {
        calculated: c.calculated_points,
        bonus,
        total: c.calculated_points + bonus,
        rank,
      }
    }

    return result
  }, [rawScores, teamBonusAwarded, challenge])

  async function submitScores() {
    if (!result || !challenge || submitting) return
    setSubmitting(true)

    const scores = Object.entries(rawScores).map(([player_id, raw_score]) => ({
      player_id,
      raw_score,
    }))

    const calculated = calculateFortnitePoints(scores, challenge)
    const bonusPts = teamBonusAwarded && challenge.team_bonus_points ? challenge.team_bonus_points : 0

    const playerScores: FortnitePlayerScore[] = calculated.map(c => {
      const existingScore = result.player_scores.find(s => s.player_id === c.player_id)
      return {
        player_id: c.player_id,
        raw_score: rawScores[c.player_id] ?? 0,
        calculated_points: c.calculated_points,
        team_bonus_points: bonusPts,
        total_points: c.calculated_points + bonusPts,
        turn_order: existingScore?.turn_order ?? null,
      }
    })

    // Update result
    const { error: resultError } = await supabase
      .from('fortnite_results')
      .update({
        player_scores: playerScores,
        team_bonus_awarded: teamBonusAwarded,
        completed_at: new Date().toISOString(),
      })
      .eq('id', result.id)

    if (resultError) {
      toast('Failed to submit scores', 'error')
      setSubmitting(false)
      return
    }

    // Update last_played_at on the challenge
    await supabase
      .from('fortnite_challenges')
      .update({ last_played_at: new Date().toISOString() })
      .eq('id', challenge.id)

    // Sync shadow placements (only during game nights)
    if (id) {
      await syncFortniteToNight(id)
    }

    toast('Scores submitted!', 'success')
    navigate(id ? `/night/${id}/fortnite` : '/fortnite')
  }

  if (loading || !challenge) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-nin-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isBinary = challenge.scoring_method === 'binary'

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
        <div>
          <h1 className="text-xl font-display text-white">{challenge.name}</h1>
          <p className="text-xs text-midnight-400 font-semibold">
            {SCORING_METHOD_LABELS[challenge.scoring_method]}
          </p>
        </div>
      </div>

      {/* Challenge Summary */}
      <Card>
        <div className="flex gap-2 mb-2">
          <span
            className="text-xs font-black px-2 py-0.5 rounded-lg uppercase"
            style={{
              backgroundColor: `${CATEGORY_COLORS[challenge.category]}20`,
              color: CATEGORY_COLORS[challenge.category],
            }}
          >
            {challenge.category}
          </span>
        </div>
        <p className="text-sm text-midnight-300 font-semibold">{challenge.description}</p>
        <p className="text-xs text-midnight-500 font-bold mt-1">{challenge.win_condition}</p>
      </Card>

      {/* Team Bonus Toggle (squad only) */}
      {result?.format === 'squad' && challenge.team_bonus_points && (
        <Card>
          <button
            onClick={() => setTeamBonusAwarded(!teamBonusAwarded)}
            className="w-full flex items-center gap-3"
          >
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                teamBonusAwarded
                  ? 'bg-gold-400 border-gold-400'
                  : 'border-midnight-500 bg-transparent'
              }`}
            >
              {teamBonusAwarded && <Check className="w-4 h-4 text-midnight-950" />}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-white">
                Team Bonus: +{challenge.team_bonus_points} pts each
              </p>
              <p className="text-xs text-midnight-400 font-semibold">
                {challenge.team_bonus_condition}
              </p>
            </div>
            {teamBonusAwarded && (
              <Award className="w-5 h-5 text-gold-400 animate-glow-breathe" />
            )}
          </button>
        </Card>
      )}

      {/* Player Scores */}
      <Card>
        <p className="text-xs font-display text-midnight-400 uppercase tracking-wider mb-3">
          {isBinary ? 'Did they do it?' : 'Enter Scores'}
        </p>
        <div className="space-y-3">
          {sortedPlayers.map(player => {
            const preview = livePoints[player.id]
            const playerTurnOrder = result?.player_scores.find(s => s.player_id === player.id)?.turn_order

            return (
              <div key={player.id} className="flex items-center gap-3">
                <div className="relative">
                  <PlayerAvatar name={player.name} color={player.color} size="sm" />
                  {result?.format === 'solo' && playerTurnOrder && (
                    <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-midnight-700 text-[9px] font-display text-gold-400 flex items-center justify-center">
                      {playerTurnOrder}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold flex-1 min-w-0 truncate">{player.display_name}</span>

                {isBinary ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRawScores(prev => ({ ...prev, [player.id]: 0 }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        rawScores[player.id] === 0 || rawScores[player.id] === undefined
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-midnight-800 text-midnight-500'
                      }`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => setRawScores(prev => ({ ...prev, [player.id]: 1 }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        rawScores[player.id] === 1
                          ? 'bg-nin-green/20 text-nin-green border border-nin-green/30'
                          : 'bg-midnight-800 text-midnight-500'
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rawScores[player.id] ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                      setRawScores(prev => ({ ...prev, [player.id]: isNaN(val) ? 0 : val }))
                    }}
                    className="w-16 bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2 text-center text-sm font-display text-white focus:outline-none focus:border-nin-blue/50"
                  />
                )}

                {/* Live points preview */}
                {preview && (
                  <div className="text-right min-w-[40px]">
                    <span className="text-sm font-display text-gold-400">
                      {preview.total}
                    </span>
                    <span className="text-[9px] text-midnight-500 font-bold block">
                      pts
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Submit */}
      <Button
        onClick={submitScores}
        disabled={submitting}
        variant="glow"
        size="lg"
        className="w-full flex items-center justify-center gap-2"
      >
        <Check className="w-5 h-5" />
        {submitting ? 'Submitting...' : 'Submit Scores'}
      </Button>
    </div>
  )
}
