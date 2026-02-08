import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, Undo2, Crown, RotateCcw } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { CountUp } from '../components/common/CountUp'
import { Confetti } from '../components/common/Confetti'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/constants'
import type { Player } from '../types'

export default function NightSummary() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
  const prevStatus = useRef(status)

  const loadSummary = useCallback(async () => {
    if (!id) return

    const [{ data: night }, { data: nightPlayers }, { data: nightGames }, { data: core }, { data: approvalData }] = await Promise.all([
      supabase.from('game_nights').select('*').eq('id', id).single(),
      supabase.from('game_night_players').select('player_id, players(*)').eq('game_night_id', id),
      supabase.from('game_night_games').select('*, placements(player_id, points)').eq('game_night_id', id),
      supabase.from('players').select('*').eq('is_core', true),
      supabase.from('app_settings').select('value').eq('key', `approvals_${id}`).single(),
    ])

    if (night) {
      setNightNumber(night.night_number)
      setDate(night.date)
      setStatus(night.status)
    }

    const playerList = nightPlayers?.map((np: any) => np.players).filter(Boolean) || []
    setPlayers(playerList)
    if (core) setCorePlayers(core)

    const t: Record<string, number> = {}
    for (const game of nightGames || []) {
      for (const p of (game as any).placements || []) {
        t[p.player_id] = (t[p.player_id] || 0) + p.points
      }
    }
    setTotals(t)

    if (approvalData?.value) {
      try { setApprovals(JSON.parse(approvalData.value)) } catch { setApprovals([]) }
    }
  }, [id])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  // Staged reveal animation on mount
  useEffect(() => {
    if (Object.keys(totals).length === 0) return
    const timers = [
      setTimeout(() => setRevealStage(1), 200),
      setTimeout(() => setRevealStage(2), 500),
      setTimeout(() => setRevealStage(3), 800),
      setTimeout(() => setRevealStage(4), 1100),
      setTimeout(() => setShowConfetti(true), 1200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [Object.keys(totals).length > 0]) // eslint-disable-line

  // Confetti when night gets completed
  useEffect(() => {
    if (prevStatus.current !== 'completed' && status === 'completed') {
      setShowConfetti(true)
    }
    prevStatus.current = status
  }, [status])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`approvals-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => loadSummary())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_nights' }, () => loadSummary())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, loadSummary])

  async function approve(playerName: string) {
    if (!id || approvals.includes(playerName)) return

    const updated = [...approvals, playerName]
    setApprovals(updated)
    setShowApproveAs(false)

    await supabase.from('app_settings').upsert({
      key: `approvals_${id}`,
      value: JSON.stringify(updated),
    }, { onConflict: 'key' })

    const coreNames = corePlayers.map(p => p.name)
    const allApproved = coreNames.every(name => updated.includes(name))

    if (allApproved) {
      await supabase.from('game_nights').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', id)
      setStatus('completed')
    }
  }

  async function reopenNight() {
    if (!id) return
    await supabase.from('game_nights').update({ status: 'active' }).eq('id', id)
    await supabase.from('app_settings').delete().eq('key', `approvals_${id}`)
    navigate(`/night/${id}`)
  }

  async function quickRematch() {
    if (!id) return
    // Get the games from this night
    const { data: nightGames } = await supabase
      .from('game_night_games')
      .select('game_id, game_order')
      .eq('game_night_id', id)
      .order('game_order')

    // Get next night number
    const { data: existing } = await supabase
      .from('game_nights')
      .select('night_number')
      .order('night_number', { ascending: false })
      .limit(1)

    const nextNumber = (existing?.[0]?.night_number || 0) + 1

    // Create new night
    const { data: newNight } = await supabase
      .from('game_nights')
      .insert({
        night_number: nextNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single()

    if (!newNight) return

    // Add same players
    const { data: corePlayers } = await supabase.from('players').select('id').eq('is_core', true)
    if (corePlayers) {
      await supabase.from('game_night_players').insert(
        corePlayers.map(p => ({ game_night_id: newNight.id, player_id: p.id }))
      )
    }

    // Add same games (no placements)
    if (nightGames) {
      await supabase.from('game_night_games').insert(
        nightGames.map(g => ({
          game_night_id: newNight.id,
          game_id: g.game_id,
          game_order: g.game_order,
          is_tiebreaker: false,
        }))
      )
    }

    navigate(`/night/${newNight.id}`)
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
            <p className="text-sm text-midnight-300 mb-4 font-semibold">
              All 4 players must approve to make it official
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
                      className="flex items-center gap-2 px-3 py-2.5 bg-midnight-700/40 border border-midnight-600/30 rounded-xl hover:bg-midnight-600/40 hover:border-midnight-500/30 transition-all active:scale-95"
                    >
                      <PlayerAvatar name={player.name} color={player.color} size="sm" />
                      <span className="text-sm font-bold">{player.display_name}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowApproveAs(false)}
                  className="text-sm text-midnight-400 hover:text-midnight-300 mt-1 font-bold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              unapprovedCore.length > 0 && (
                <Button onClick={() => setShowApproveAs(true)} size="lg" className="w-full flex items-center justify-center gap-2">
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
            <p className="text-sm font-display text-nin-green">Official — All 4 Approved</p>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isPending && (
          <Button onClick={reopenNight} variant="ghost" className="flex-1 flex items-center justify-center gap-2">
            <Undo2 className="w-4 h-4" /> Reopen Night
          </Button>
        )}
        {isCompleted && (
          <Button onClick={quickRematch} variant="secondary" className="flex-1 flex items-center justify-center gap-2">
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
