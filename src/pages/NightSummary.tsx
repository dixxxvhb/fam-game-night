import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, Undo2, Crown } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import { PLACEMENT_LABELS, PLACEMENT_COLORS, formatDate } from '../lib/constants'
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

  const sorted = [...players].sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
  const isPending = status === 'pending_approval'
  const isCompleted = status === 'completed'
  const unapprovedCore = corePlayers.filter(p => !approvals.includes(p.name))

  return (
    <div className="p-4 space-y-4">
      <div className="text-center py-4">
        <p className="text-midnight-400 text-sm font-bold">Night #{nightNumber} - {formatDate(date)}</p>
        {sorted[0] && (
          <>
            <Crown className="w-8 h-8 text-gold-400 mx-auto mt-2" />
            <h2 className="text-3xl font-black mt-1">
              <span style={{ color: sorted[0].color }}>{sorted[0].display_name}</span>
              <span className="text-gold-400"> Wins!</span>
            </h2>
            <p className="text-gold-400 text-2xl font-black mt-1">
              {totals[sorted[0].id] || 0} points
            </p>
          </>
        )}
      </div>

      <Card>
        <p className="text-xs font-extrabold text-midnight-400 uppercase tracking-wider mb-4">Final Standings</p>
        <div className="space-y-3">
          {sorted.map((player, idx) => (
            <div key={player.id} className="flex items-center gap-3">
              <span className="text-sm font-black w-8 text-right" style={{
                color: PLACEMENT_COLORS[idx] || '#7a7a9e'
              }}>
                {PLACEMENT_LABELS[idx]}
              </span>
              <PlayerAvatar name={player.name} color={player.color} />
              <span className="flex-1 font-bold">{player.display_name}</span>
              <span className="text-xl font-black">{totals[player.id] || 0}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Approval Section */}
      {isPending && (
        <Card className="border-gold-400/30 bg-gold-400/5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-gold-400" />
            <p className="text-xs font-extrabold text-gold-400 uppercase tracking-wider">
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
                      <Check className="w-3.5 h-3.5" /> Approved
                    </span>
                  ) : (
                    <span className="text-xs text-midnight-500 font-bold">Waiting</span>
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
                    className="flex items-center gap-2 px-3 py-2.5 bg-midnight-700/50 border-2 border-midnight-600/40 rounded-xl hover:bg-midnight-600/50 hover:border-midnight-500/40 transition-all active:scale-95"
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
      )}

      {isCompleted && (
        <Card className="border-nin-green/30 bg-nin-green/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-nin-green" />
            <p className="text-sm font-extrabold text-nin-green">Official - All 4 Approved</p>
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
        <Button onClick={() => navigate('/')} variant="secondary" className="flex-1">
          Back to Home
        </Button>
      </div>
    </div>
  )
}
