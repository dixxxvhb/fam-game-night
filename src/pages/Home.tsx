import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gamepad2, X, ChevronDown, ChevronUp, Trophy, Calendar, ShieldCheck, Crown, Shuffle, Hash, Dices, Users, Wrench } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { useToast } from '../components/common/Toast'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { PLACEMENT_COLORS, formatDate } from '../lib/constants'
import type { GameNight, Player } from '../types'

interface NightWithGames {
  id: string
  date: string
  status: string
  game_night_players: { player_id: string }[]
  game_night_games: {
    id: string
    placements: { player_id: string; points: number }[]
  }[]
}

interface YearStats {
  year: number
  nightsPlayed: number
  standings: { player: Player; points: number; wins: number }[]
}

interface AllTimeEntry {
  player: Player
  totalPoints: number
}

export default function Home() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeNight, setActiveNight] = useState<GameNight | null>(null)
  const [pendingNight, setPendingNight] = useState<GameNight | null>(null)
  const [yearStats, setYearStats] = useState<YearStats[]>([])
  const [allTime, setAllTime] = useState<AllTimeEntry[]>([])
  const [expandedYear, setExpandedYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [{ data: active }, { data: pending }, { data: players }, { data: nights }] = await Promise.all([
        supabase.from('game_nights').select('*').eq('status', 'active').limit(1).single(),
        supabase.from('game_nights').select('*').eq('status', 'pending_approval').limit(1).single(),
        supabase.from('players').select('*').eq('is_core', true),
        supabase.from('game_nights').select(`
          id, date, status,
          game_night_players(player_id),
          game_night_games(id, placements(player_id, points))
        `).eq('status', 'completed'),
      ])

      setActiveNight(active)
      setPendingNight(pending)

      if (!players || !nights) return

      const typedNights = nights as NightWithGames[]

      const yearMap: Record<number, NightWithGames[]> = {}
      for (const n of typedNights) {
        const y = new Date(n.date).getFullYear()
        if (!yearMap[y]) yearMap[y] = []
        yearMap[y].push(n)
      }

      const allTotals: Record<string, number> = {}
      for (const p of players) allTotals[p.id] = 0

      const stats: YearStats[] = []
      for (const [yearStr, yearNights] of Object.entries(yearMap)) {
        const year = parseInt(yearStr)
        const playerPoints: Record<string, number> = {}
        const playerWins: Record<string, number> = {}
        for (const p of players) { playerPoints[p.id] = 0; playerWins[p.id] = 0 }

        for (const night of yearNights) {
          const nightTotals: Record<string, number> = {}
          const games = night.game_night_games ?? []
          for (const game of games) {
            for (const p of game.placements || []) {
              nightTotals[p.player_id] = (nightTotals[p.player_id] || 0) + p.points
            }
          }

          for (const [pid, pts] of Object.entries(nightTotals)) {
            if (playerPoints[pid] !== undefined) playerPoints[pid] += pts
            if (allTotals[pid] !== undefined) allTotals[pid] += pts
          }

          let winnerId: string | null = null
          let maxPts = -1
          for (const [pid, pts] of Object.entries(nightTotals)) {
            if (pts > maxPts) { maxPts = pts; winnerId = pid }
          }
          if (winnerId && playerWins[winnerId] !== undefined) playerWins[winnerId]++
        }

        const standings = players
          .map(p => ({ player: p, points: playerPoints[p.id], wins: playerWins[p.id] }))
          .sort((a, b) => b.points - a.points)

        stats.push({ year, nightsPlayed: yearNights.length, standings })
      }

      stats.sort((a, b) => b.year - a.year)
      setYearStats(stats)

      const allTimeBoard = players
        .map(p => ({ player: p, totalPoints: allTotals[p.id] }))
        .sort((a, b) => b.totalPoints - a.totalPoints)
      setAllTime(allTimeBoard)
    } catch {
      // Not configured
    } finally {
      setLoading(false)
    }
  }

  async function startNewNight() {
    if (isStarting) return
    setIsStarting(true)
    try {
      const { data: existing } = await supabase
        .from('game_nights')
        .select('night_number')
        .order('night_number', { ascending: false })
        .limit(1)

      const nextNumber = (existing?.[0]?.night_number || 0) + 1

      const { data: night, error } = await supabase
        .from('game_nights')
        .insert({
          night_number: nextNumber,
          date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      const { data: players } = await supabase.from('players').select('id').eq('is_core', true)

      if (players && night) {
        await supabase.from('game_night_players').insert(
          players.map(p => ({ game_night_id: night.id, player_id: p.id }))
        )
        navigate(`/night/${night.id}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast(`Failed to start game night: ${message}`, 'error')
    } finally {
      setIsStarting(false)
    }
  }

  async function cancelNight() {
    if (!activeNight) return
    const { error } = await supabase.from('game_nights').delete().eq('id', activeNight.id)
    if (error) {
      toast(`Failed to cancel game night: ${error.message}`, 'error')
    } else {
      setActiveNight(null)
      setShowCancelConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Gamepad2 className="w-10 h-10 text-nin-red animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel Game Night"
          message="Are you sure you want to cancel this game night? All progress will be lost."
          confirmLabel="Cancel Night"
          onConfirm={cancelNight}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Active Night — Glowing Red Card */}
      {activeNight ? (
        <div className="animate-slide-up">
          <Card
            variant="active"
            onClick={() => navigate(`/night/${activeNight.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-nin-red animate-pulse-dot" />
                  <p className="text-nin-red text-sm font-extrabold uppercase tracking-wider">Live Game Night</p>
                </div>
                <p className="text-2xl font-display mt-1">Night #{activeNight.night_number}</p>
                <p className="text-midnight-400 text-sm font-semibold">{formatDate(activeNight.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-9 h-9 text-nin-red drop-shadow-[0_0_12px_rgba(230,0,18,0.5)]" />
                <button
                  aria-label="Cancel game night"
                  onClick={(e) => { e.stopPropagation(); setShowCancelConfirm(true) }}
                  className="text-midnight-500 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-midnight-700/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="animate-slide-up">
          <Button onClick={startNewNight} disabled={isStarting} variant="glow" size="lg" className="w-full flex items-center justify-center gap-3 text-lg">
            <Gamepad2 className="w-6 h-6" />
            {isStarting ? 'Starting...' : 'Start Game Night'}
          </Button>
        </div>
      )}

      {/* Pending Approval Night */}
      {pendingNight && (
        <div className="animate-slide-up" style={{ animationDelay: '80ms' }}>
          <Card
            variant="highlight"
            onClick={() => navigate(`/night/${pendingNight.id}/summary`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gold-400" />
                  <p className="text-gold-400 text-sm font-extrabold uppercase tracking-wider">Pending Approval</p>
                </div>
                <p className="text-xl font-display mt-1">Night #{pendingNight.night_number}</p>
                <p className="text-midnight-400 text-sm font-semibold">Tap to review and approve</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Fortnite Quick Play */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        <Card onClick={() => navigate('/fortnite')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-nin-purple/20 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-6 h-6 text-nin-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base text-white">Fortnite Challenges</h3>
              <p className="text-sm text-midnight-400 font-semibold mt-0.5">Play anytime — no game night needed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* All-Time Leader Widget */}
      {allTime.length > 0 && (
        <div className="animate-slide-up" style={{ animationDelay: '160ms' }}>
          <Card onClick={() => navigate('/leaderboard')}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-6 h-6 text-gold-400 drop-shadow-[0_0_8px_rgba(255,202,40,0.4)]" />
              <p className="font-display text-sm uppercase tracking-wider text-gold-400">All-Time Leaderboard</p>
            </div>
            <div className="space-y-3">
              {allTime.map((e, i) => (
                <div key={e.player.id} className={`flex items-center gap-3 ${i === 0 ? 'py-1' : ''}`}>
                  <span
                    className="text-lg font-black w-8 text-center"
                    style={{ color: PLACEMENT_COLORS[i] || '#7a7a9e' }}
                  >
                    {i === 0 ? '' : `#${i + 1}`}
                  </span>
                  {i === 0 && <Crown className="w-6 h-6 text-gold-400 animate-crown-bounce -mr-1 drop-shadow-[0_0_8px_rgba(255,202,40,0.5)]" />}
                  <PlayerAvatar name={e.player.name} color={e.player.color} size={i === 0 ? 'md' : 'sm'} glow={i === 0} />
                  <span className={`font-bold flex-1 ${i === 0 ? 'text-lg font-display' : ''}`}>{e.player.display_name}</span>
                  <span className={`font-black ${i === 0 ? 'text-2xl text-shimmer-gold' : 'text-xl text-white'}`}>
                    {e.totalPoints}
                  </span>
                  <span className="text-xs text-midnight-400 font-bold">pts</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Quick Tools */}
      <div className="animate-slide-up" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-5 h-5 text-midnight-400" />
          <p className="font-display text-sm uppercase tracking-wider text-midnight-400">Quick Tools</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'game-order', label: 'Game Order', icon: Shuffle, color: '#3b82f6' },
            { id: 'game-pick', label: 'Game Pick', icon: Gamepad2, color: '#e60012' },
            { id: 'number', label: 'Number', icon: Hash, color: '#22c55e' },
            { id: 'dice', label: 'Dice Roll', icon: Dices, color: '#f59e0b' },
            { id: 'player-order', label: 'Player Order', icon: Users, color: '#a855f7' },
          ].map(tool => {
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                onClick={() => navigate(`/randomizer?tool=${tool.id}`)}
                className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl bg-surface-card border border-midnight-600/20 hover:bg-surface-card-hover transition-all duration-150 active:scale-95"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: tool.color + '20' }}
                >
                  <Icon className="w-5 h-5" style={{ color: tool.color }} />
                </div>
                <span className="text-[11px] font-bold text-midnight-300">{tool.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Year-by-Year Standings */}
      {yearStats.map((ys, yIdx) => {
        const isExpanded = expandedYear === ys.year

        return (
          <div key={ys.year} className="animate-slide-up" style={{ animationDelay: `${320 + yIdx * 80}ms` }}>
            <Card>
              <button
                className="w-full text-left"
                onClick={() => setExpandedYear(isExpanded ? null : ys.year)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-nin-blue" />
                    <span className="font-display text-xl">{ys.year}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-midnight-400 text-sm font-bold">{ys.nightsPlayed} nights</span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-midnight-400" />
                      : <ChevronDown className="w-4 h-4 text-midnight-400" />
                    }
                  </div>
                </div>

                <div className="space-y-2.5">
                  {ys.standings.map((s, i) => (
                    <div key={s.player.id} className="flex items-center gap-3">
                      <span
                        className="text-sm font-black w-7 text-center"
                        style={{ color: PLACEMENT_COLORS[i] || '#7a7a9e' }}
                      >
                        #{i + 1}
                      </span>
                      <PlayerAvatar name={s.player.name} color={s.player.color} size="sm" />
                      <span className="text-sm font-bold flex-1">{s.player.display_name}</span>
                      <span className="text-lg font-black">{s.points}</span>
                      <span className="text-xs text-midnight-400 font-bold w-7">pts</span>
                      <span className="text-sm font-black text-gold-400">{s.wins}W</span>
                    </div>
                  ))}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-midnight-600/30">
                  <p className="text-xs text-midnight-400 uppercase tracking-wider font-extrabold mb-3">Season Breakdown</p>
                  <div className="grid grid-cols-2 gap-3">
                    {ys.standings.map((s) => (
                      <div key={s.player.id} className="bg-midnight-700/30 border border-midnight-600/20 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <PlayerAvatar name={s.player.name} color={s.player.color} size="sm" />
                          <span className="text-sm font-display">{s.player.display_name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-center">
                          <div>
                            <p className="text-xl font-black">{s.points}</p>
                            <p className="text-[10px] text-midnight-400 font-bold uppercase">Points</p>
                          </div>
                          <div>
                            <p className="text-xl font-black text-gold-400">{s.wins}</p>
                            <p className="text-[10px] text-midnight-400 font-bold uppercase">Wins</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )
      })}
    </div>
  )
}
