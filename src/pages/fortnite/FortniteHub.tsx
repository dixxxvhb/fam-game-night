import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crosshair, Users, Settings, Clock, ArrowLeft } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { supabase } from '../../lib/supabase'
import type { FortniteChallenge, FortniteResult } from '../../types'
import { ALL_STARTER_CHALLENGES } from '../../lib/fortniteData'

export default function FortniteHub() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<FortniteChallenge[]>([])
  const [results, setResults] = useState<FortniteResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)

    // Load challenges (and seed if empty)
    let { data: challengeData } = await supabase
      .from('fortnite_challenges')
      .select('*')

    if (!challengeData || challengeData.length === 0) {
      // Seed starter pack
      const { data: seeded } = await supabase
        .from('fortnite_challenges')
        .insert(ALL_STARTER_CHALLENGES.map(c => ({ ...c })))
        .select('*')
      challengeData = seeded
    }

    setChallenges(challengeData ?? [])

    // Load results for this night (or all standalone results)
    const resultQuery = id
      ? supabase.from('fortnite_results').select('*, fortnite_challenges(*)').eq('game_night_id', id)
      : supabase.from('fortnite_results').select('*, fortnite_challenges(*)').is('game_night_id', null)

    const { data: resultData } = await resultQuery
    setResults(
      (resultData ?? []).map(r => ({
        ...r,
        challenge: r.fortnite_challenges,
      }))
    )

    setLoading(false)
  }

  const soloCount = challenges.filter(c => c.format === 'solo' && c.is_active).length
  const squadCount = challenges.filter(c => c.format === 'squad' && c.is_active).length
  const completedCount = results.filter(r => r.completed_at).length

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
          onClick={() => navigate(id ? `/night/${id}` : '/')}
          className="p-2 rounded-xl hover:bg-midnight-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <div>
          <h1 className="text-xl font-display text-white">Fortnite</h1>
          {completedCount > 0 && (
            <p className="text-xs text-midnight-400 font-semibold">
              {completedCount} challenge{completedCount !== 1 ? 's' : ''} played {id ? 'tonight' : 'for fun'}
            </p>
          )}
        </div>
      </div>

      {/* Solo Rotation Card */}
      <Card
        onClick={() => navigate(id ? `/night/${id}/fortnite/generate/solo` : '/fortnite/generate/solo')}
        className="active:scale-[0.97]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nin-blue/20 flex items-center justify-center shrink-0">
            <Crosshair className="w-6 h-6 text-nin-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg text-white">Solo Rotation</h2>
            <p className="text-sm text-midnight-300 font-semibold mt-0.5">
              Players take turns in solo matches
            </p>
            <p className="text-xs text-nin-blue font-bold mt-2">
              {soloCount} challenges available
            </p>
          </div>
        </div>
      </Card>

      {/* Squad Up Card */}
      <Card
        onClick={() => navigate(id ? `/night/${id}/fortnite/generate/squad` : '/fortnite/generate/squad')}
        className="active:scale-[0.97]"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nin-green/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-nin-green" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg text-white">Squad Up</h2>
            <p className="text-sm text-midnight-300 font-semibold mt-0.5">
              All 4 play together in squads
            </p>
            <p className="text-xs text-nin-green font-bold mt-2">
              {squadCount} challenges available
            </p>
          </div>
        </div>
      </Card>

      {/* Bottom Links */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate('/fortnite/challenges')}
          variant="ghost"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" /> Manage
        </Button>
        <Button
          onClick={() => navigate(id ? `/night/${id}/fortnite/history` : '/fortnite/history')}
          variant="ghost"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <Clock className="w-4 h-4" /> History
        </Button>
      </div>
    </div>
  )
}
