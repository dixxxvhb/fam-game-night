import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, Undo2, Crown, RotateCcw, Clock } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { CountUp } from '../components/common/CountUp'
import { Confetti } from '../components/common/Confetti'
import { useToast } from '../components/common/Toast'
import { supabase } from '../lib/supabase'
import { quickRematch } from '../lib/quickRematch'
import { formatDate } from '../lib/constants'
import { scorePredictions } from '../lib/points'
import type { Player, Placement } from '../types'

const MAJORITY_THRESHOLD = 3
const AUTO_APPROVE_MS = 4 * 60 * 60 * 1000 // 4 hours

interface NightGameWithPlacements {
  id: string
  game_night_id: string
  game_id: string
  game_order: number
  is_tiebreaker: boolean
  created_at: string
  placements: Pick<Placement, 'player_id' | 'points'>[]
}

interface NightPlayerJoin {
  player_id: string
  players: Player
}

export default function NightSummary() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [players, setPlayers] = useState<Player[]>([])
  const [corePlayers, setCorePlayers] = useState<Player[]>([])
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [nightNumber, setNightNumber] = useState(0)
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const [approvals, setApprovals] = useState<string[]>([])
  const [showApproveAs, setShowApproveAs] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [revealStage, setRevealStage] = useState(0) // 0=hidden, 1=title, 2=crown, 3=name, 4=points
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<Record<string, string[]>>({})

  const prevStatus = useRef(status)
  const hasRevealed = useRef(false)

  const loadSummary = useCallback(async () => {
    if (!id) return

    const [{ data: night }, { data: nightPlayers }, { data: nightGames }, { data: core }, { data: approvalData }, { data: predData }] = await Promise.all([
      supabase.from('game_nights').select('*').eq('id', id).single(),
      supabase.from('game_night_players').select('player_id, players(*)').eq('game_night_id', id),
      supabase.from('game_night_games').select('*, placements(player_id, points)').eq('game_night_id', id),
      supabase.from('players').select('*').eq('is_core', true),
      supabase.from('app_settings').select('key').like('key', `approval_${id}_%`),
      supabase.from('app_settings').select('value').eq('key', `predictions_${id}`).single(),
    ])

    if (night) {
      setNightNumber(night.night_number)
      setDate(night.date)
      setStatus(night.status)
    }

    const playerList = (nightPlayers as unknown as NightPlayerJoin[] | null)
      ?.map(np => np.players)
      .filter(Boolean) || []
    setPlayers(playerList)
    if (core) setCorePlayers(core)

    const t: Record<string, number> = {}
    for (const game of (nightGames as unknown as NightGameWithPlacements[] | null) || []) {
      for (const p of game.placements || []) {
        t[p.player_id] = (t[p.player_id] || 0) + p.points
      }
    }
    setTotals(t)

    if (predData?.value) {
      try { setPredictions(JSON.parse(predData.value)) } catch { setPredictions({}) }
    }

    // Each approved player has their own row: key = approval_${id}_${playerName}
    const prefix = `approval_${id}_`
    const approvedNames = (approvalData as { key: string }[] | null)
      ?.map(row => row.key.slice(prefix.length))
      .filter(Boolean) || []
    setApprovals(approvedNames)
  }, [id])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  // Staged reveal animation — runs once when totals first populate
  useEffect(() => {
    if (Object.keys(totals).length === 0) return
    if (hasRevealed.current) return
    hasRevealed.current = true

    const timers = [
      setTimeout(() => setRevealStage(1), 200),
      setTimeout(() => setRevealStage(2), 500),
      setTimeout(() => setRevealStage(3), 800),
      setTimeout(() => setRevealStage(4), 1100),
      setTimeout(() => setShowConfetti(true), 1200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [totals])

  // Confetti when night gets completed
  useEffect(() => {
    if (prevStatus.current !== 'completed' && status === 'completed') {
      setShowConfetti(true)
    }
    prevStatus.current = status
  }, [status])

  // Clear confetti particles when hidden
  useEffect(() => {
    if (!showConfetti) return
    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [showConfetti])

  // Re-fetch when app comes back to foreground (iOS PWA drops WS connections)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') loadSummary()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [loadSummary])

  // Realtime subscription for approvals and night status changes
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`approvals-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => loadSummary())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_nights' }, () => loadSummary())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, loadSummary])

  // 4-hour auto-approve: if pending_approval for 4+ hours, auto-complete
  useEffect(() => {
    if (status !== 'pending_approval' || !id) return

    const timer = setTimeout(async () => {
      await supabase.from('game_nights').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', id)
      setStatus('completed')
      toast('Night auto-approved after 4 hours', 'success')
    }, AUTO_APPROVE_MS)

    return () => clearTimeout(timer)
  }, [status, id, toast])

  async function completeNight() {
    if (!id) return
    await supabase.from('game_nights').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', id)
    setStatus('completed')
  }

  async function approve(playerName: string) {
    if (!id || approvals.includes(playerName)) return

    setApprovals(prev => [...prev, playerName])
    setShowApproveAs(false)

    // Each player writes only their own row — no read-modify-write, no concurrent conflicts
    await supabase.from('app_settings').upsert({
      key: `approval_${id}_${playerName}`,
      value: 'true',
    }, { onConflict: 'key' })

    toast(`${playerName} approved`, 'success')

    // Majority override: 3 of 4 core players = auto-complete
    const coreNames = corePlayers.map(p => p.name)
    const updatedApprovals = [...approvals, playerName]
    const approvedCount = coreNames.filter(name => updatedApprovals.includes(name)).length

    if (approvedCount >= MAJORITY_THRESHOLD) {
      await completeNight()
    }
  }

  async function reopenNight() {
    if (!id || loading) return
    setLoading(true)
    try {
      await supabase.from('game_nights').update({ status: 'active' }).eq('id', id)
      await supabase.from('app_settings').delete().like('key', `approval_${id}_%`)
      toast('Night reopened', 'warning')
      navigate(`/night/${id}`)
    } catch {
      toast('Failed to reopen night', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickRematch() {
    if (!id || loading) return
    setLoading(true)
    try {
      const newId = await quickRematch(id)
      if (newId) {
        toast('Rematch created', 'success')
        navigate('/night/' + newId)
      } else {
        toast('Failed to create rematch', 'error')
      }
    } catch {
      toast('Failed to create rematch', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sorted = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
  const isPending = status === 'pending_approval'
  const isCompleted = status === 'completed'
  const unapprovedCore = corePlayers.filter(p => !approvals.includes(p.name))

  const PODIUM_COLORS = ['#ffd700', '#b0c4de', '#cd853f', '#7a7a9e']
  const PODIUM_HEIGHTS = ['h-28', 'h-20', 'h-16', 'h-12']

  return (
    <div className="p-4 space-y-4">
      <Confetti trigger={showConfetti} />

      {/* Winner Reveal Header */}
      <div className="text-center py-4">
        <p className={`text-midnight-400 text-sm font-bold transition-all duration-500 ${revealStage >= 1 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
          Night #{nightNumber} — {formatDate(date)}
        </p>
        {sorted[0] && (
          <>
            <Crown className={`w-10 h-10 text-gold-400 mx-auto mt-3 drop-shadow-[0_0_12px_rgba(255,202,40,0.6)] transition-all duration-500 ${
              revealStage >= 2 ? 'opacity-100 animate-crown-bounce' : 'opacity-0 scale-0'
            }`} />
            <h2 className={`text-3xl font-display mt-2 transition-all duration-500 ${revealStage >= 3 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              <span style={{ color: sorted[0].color }}>{sorted[0].display_name}</span>
              <span className="text-gold-400"> Wins!</span>
            </h2>
            <div className={`text-gold-400 text-3xl font-display mt-2 transition-all duration-500 ${revealStage >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              <CountUp to={totals[sorted[0].id] || 0} duration={1200} />
              <span className="text-lg ml-1">pts</span>
            </div>
          </>
        )}
      </div>

      {/* Podium Layout */}
      {sorted.length >= 3 && (
        <div className="animate-slide-up" style={{ animationDelay: '1200ms' }}>
          <div className="flex items-end justify-center gap-2 px-4 mb-2">
            {/* 2nd place - left */}
            <div className="flex-1 flex flex-col items-center">
              <PlayerAvatar name={sorted[1].name} color={sorted[1].color} size="md" />
              <p className="text-sm font-bold mt-1 text-midnight-300">{sorted[1].display_name}</p>
              <p className="text-lg font-display">{totals[sorted[1].id] || 0}</p>
              <div className={`w-full ${PODIUM_HEIGHTS[1]} rounded-t-xl mt-1`} style={{ backgroundColor: PODIUM_COLORS[1] + '30', borderTop: `3px solid ${PODIUM_COLORS[1]}` }}>
                <p className="text-center font-display text-lg mt-2" style={{ color: PODIUM_COLORS[1] }}>2nd</p>
              </div>
            </div>
            {/* 1st place - center */}
            <div className="flex-1 flex flex-col items-center">
              <PlayerAvatar name={sorted[0].name} color={sorted[0].color} size="lg" glow />
              <p className="text-base font-display mt-1">{sorted[0].display_name}</p>
              <p className="text-2xl font-display text-gold-400">{totals[sorted[0].id] || 0}</p>
              <div className={`w-full ${PODIUM_HEIGHTS[0]} rounded-t-xl mt-1`} style={{ backgroundColor: PODIUM_COLORS[0] + '20', borderTop: `3px solid ${PODIUM_COLORS[0]}` }}>
                <p className="text-center font-display text-xl mt-3 text-shimmer-gold">1st</p>
              </div>
            </div>
            {/* 3rd place - right */}
            <div className="flex-1 flex flex-col items-center">
              <PlayerAvatar name={sorted[2].name} color={sorted[2].color} size="md" />
              <p className="text-sm font-bold mt-1 text-midnight-300">{sorted[2].display_name}</p>
              <p className="text-lg font-display">{totals[sorted[2].id] || 0}</p>
              <div className={`w-full ${PODIUM_HEIGHTS[2]} rounded-t-xl mt-1`} style={{ backgroundColor: PODIUM_COLORS[2] + '30', borderTop: `3px solid ${PODIUM_COLORS[2]}` }}>
                <p className="text-center font-display text-lg mt-1" style={{ color: PODIUM_COLORS[2] }}>3rd</p>
              </div>
            </div>
          </div>
          {/* 4th place below */}
          {sorted[3] && (
            <div className="flex items-center justify-center gap-3 py-2 px-4 bg-midnight-800/40 rounded-xl mx-4">
              <span className="text-sm font-black" style={{ color: PODIUM_COLORS[3] }}>4th</span>
              <PlayerAvatar name={sorted[3].name} color={sorted[3].color} size="sm" />
              <span className="text-sm font-bold text-midnight-300">{sorted[3].display_name}</span>
              <span className="text-base font-display ml-auto">{totals[sorted[3].id] || 0}</span>
            </div>
          )}
        </div>
      )}

      {/* Approval Section */}
      {isPending && (
        <div className="animate-slide-up" style={{ animationDelay: '1400ms' }}>
          <Card variant="highlight">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-gold-400" />
              <p className="text-xs font-display text-gold-400 uppercase tracking-wider">
                Waiting for Approval ({approvals.length}/4)
              </p>
            </div>
            <p className="text-sm text-midnight-300 mb-2 font-semibold">
              {MAJORITY_THRESHOLD} of 4 players must approve to make it official
            </p>
            <p className="text-xs text-midnight-500 mb-4 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Auto-approves after 4 hours if not completed
            </p>

            <div className="space-y-2.5 mb-4">
              {corePlayers.map(player => {
                const hasApproved = approvals.includes(player.name)
                return (
                  <div key={player.id} className="flex items-center gap-3">
                    <PlayerAvatar name={player.name} color={player.color} size="sm" />
                    <span className="text-sm flex-1 font-bold">{player.display_name}</span>
                    {hasApproved ? (
                      <span className="text-xs font-extrabold text-nin-green flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 drop-shadow-[0_0_6px_rgba(0,200,83,0.5)]" /> Approved
                      </span>
                    ) : (
                      <span className="text-xs text-midnight-500 font-bold animate-pulse">Waiting</span>
                    )}
                  </div>
                )
              })}
            </div>

            {showApproveAs ? (
              <div className="space-y-2">
                <p className="text-sm text-midnight-300 font-bold">Who are you?</p>
                <div className="grid grid-cols-2 gap-2">
                  {unapprovedCore.map(player => (
                    <button
                      key={player.id}
                      onClick={() => approve(player.name)}
                      aria-label={`Approve as ${player.display_name}`}
                      className="flex items-center gap-2 px-3 py-2.5 bg-midnight-700/40 border border-midnight-600/30 rounded-xl hover:bg-midnight-600/40 hover:border-midnight-500/30 transition-all active:scale-95"
                    >
                      <PlayerAvatar name={player.name} color={player.color} size="sm" />
                      <span className="text-sm font-bold">{player.display_name}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowApproveAs(false)}
                  aria-label="Cancel approval"
                  className="text-sm text-midnight-400 hover:text-midnight-300 mt-1 font-bold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              unapprovedCore.length > 0 && (
                <Button
                  onClick={() => setShowApproveAs(true)}
                  size="lg"
                  className="w-full flex items-center justify-center gap-2"
                  aria-label="Open approval selection"
                >
                  <Check className="w-5 h-5" /> Approve Results
                </Button>
              )
            )}
          </Card>
        </div>
      )}

      {isCompleted && (
        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-nin-green drop-shadow-[0_0_8px_rgba(0,200,83,0.4)]" />
            <p className="text-sm font-display text-nin-green">
              Official — {approvals.length >= corePlayers.length ? 'All' : `${approvals.length} of ${corePlayers.length}`} Approved
            </p>
          </div>
        </Card>
      )}

      {/* Prediction Results */}
      {Object.keys(predictions).length > 0 && (
        <div className="animate-slide-up" style={{ animationDelay: '1600ms' }}>
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-display text-nin-blue uppercase tracking-wider">Prediction Results</p>
            </div>
            {(() => {
              const actualOrder = sorted.map(p => p.name)
              const scored = Object.entries(predictions).map(([playerName, predicted]) => ({
                playerName,
                ...scorePredictions(predicted, actualOrder),
              })).sort((a, b) => b.score - a.score)

              const topScore = scored[0]?.score ?? 0

              return (
                <div className="space-y-2.5">
                  {scored.map(({ playerName, score, exactMatches, offByOne, perfectBonus }) => {
                    const player = players.find(p => p.name === playerName)
                    if (!player) return null
                    const isTopPredictor = score === topScore && score > 0

                    return (
                      <div key={playerName} className={`flex items-center gap-3 py-1 px-2 rounded-xl ${isTopPredictor ? 'bg-nin-blue/10' : ''}`}>
                        <PlayerAvatar name={player.name} color={player.color} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{player.display_name}</span>
                            {isTopPredictor && (
                              <span className="text-[10px] font-display text-nin-blue bg-nin-blue/20 px-1.5 py-0.5 rounded-md">Best Predictor</span>
                            )}
                            {perfectBonus && (
                              <span className="text-[10px] font-display text-gold-400 bg-gold-400/10 px-1.5 py-0.5 rounded-md">Perfect!</span>
                            )}
                          </div>
                          <p className="text-xs text-midnight-400 font-semibold">
                            {exactMatches} exact · {offByOne} close{perfectBonus ? ' · +5 bonus' : ''}
                          </p>
                        </div>
                        <span className="text-lg font-display text-nin-blue">+{score}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isPending && (
          <Button
            onClick={reopenNight}
            variant="ghost"
            className="flex-1 flex items-center justify-center gap-2"
            disabled={loading}
            aria-label="Reopen this game night"
          >
            <Undo2 className="w-4 h-4" /> Reopen Night
          </Button>
        )}
        {isCompleted && (
          <Button
            onClick={handleQuickRematch}
            variant="secondary"
            className="flex-1 flex items-center justify-center gap-2"
            disabled={loading}
            aria-label="Start a quick rematch with same games"
          >
            <RotateCcw className="w-4 h-4" /> Quick Rematch
          </Button>
        )}
        <Button onClick={() => navigate('/')} variant="secondary" className="flex-1">
          Back to Home
        </Button>
      </div>
    </div>
  )
}
