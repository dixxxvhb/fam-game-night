import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import { supabase } from '../../lib/supabase'
import { CATEGORY_COLORS, SCORING_METHOD_LABELS } from '../../lib/fortnite'
import { ALL_STARTER_CHALLENGES } from '../../lib/fortniteData'
import type { FortniteChallenge, FortniteFormat, FortniteCategory, FortniteScoringMethod } from '../../types'

const FORMAT_OPTIONS: { value: FortniteFormat; label: string }[] = [
  { value: 'solo', label: 'Solo Rotation' },
  { value: 'squad', label: 'Squad Up' },
]

const CATEGORY_OPTIONS: { value: FortniteCategory; label: string }[] = [
  { value: 'kill', label: 'Kill' },
  { value: 'location', label: 'Location' },
  { value: 'loot', label: 'Loot' },
  { value: 'survival', label: 'Survival' },
  { value: 'stunt', label: 'Stunt' },
  { value: 'restriction', label: 'Restriction' },
  { value: 'teamwork', label: 'Teamwork' },
]

const SCORING_OPTIONS: { value: FortniteScoringMethod; label: string }[] = [
  { value: 'raw_count', label: 'Raw Count' },
  { value: 'ranked', label: 'Ranked (High Wins)' },
  { value: 'inverse_ranked', label: 'Ranked (Low Wins)' },
  { value: 'binary', label: 'Pass / Fail' },
  { value: 'custom', label: 'Custom Multiplier' },
]

type FilterTab = 'all' | 'solo' | 'squad'

interface FormState {
  name: string
  description: string
  format: FortniteFormat
  category: FortniteCategory
  time_limit_minutes: string
  win_condition: string
  scoring_method: FortniteScoringMethod
  multiplier: string
  binary_points: string
  team_bonus_points: string
  team_bonus_condition: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  format: 'solo',
  category: 'kill',
  time_limit_minutes: '',
  win_condition: '',
  scoring_method: 'ranked',
  multiplier: '',
  binary_points: '',
  team_bonus_points: '',
  team_bonus_condition: '',
}

export default function ChallengePool() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [challenges, setChallenges] = useState<FortniteChallenge[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadChallenges() }, [])

  async function loadChallenges() {
    setLoading(true)
    let { data } = await supabase.from('fortnite_challenges').select('*').order('category').order('name')

    if (!data || data.length === 0) {
      const { data: seeded } = await supabase
        .from('fortnite_challenges')
        .insert(ALL_STARTER_CHALLENGES.map(c => ({ ...c })))
        .select('*')
        .order('category')
        .order('name')
      data = seeded
    }

    setChallenges(data ?? [])
    setLoading(false)
  }

  function filtered() {
    if (filter === 'all') return challenges
    return challenges.filter(c => c.format === filter)
  }

  function groupByCategory(list: FortniteChallenge[]) {
    const groups: Record<string, FortniteChallenge[]> = {}
    for (const c of list) {
      if (!groups[c.category]) groups[c.category] = []
      groups[c.category].push(c)
    }
    return groups
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(c: FortniteChallenge) {
    setForm({
      name: c.name,
      description: c.description,
      format: c.format,
      category: c.category,
      time_limit_minutes: c.time_limit_minutes?.toString() ?? '',
      win_condition: c.win_condition,
      scoring_method: c.scoring_method,
      multiplier: c.multiplier?.toString() ?? '',
      binary_points: c.binary_points?.toString() ?? '',
      team_bonus_points: c.team_bonus_points?.toString() ?? '',
      team_bonus_condition: c.team_bonus_condition ?? '',
    })
    setEditingId(c.id)
    setShowForm(true)
  }

  async function saveChallenge() {
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      format: form.format,
      category: form.category,
      time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes, 10) : null,
      win_condition: form.win_condition.trim(),
      scoring_method: form.scoring_method,
      multiplier: form.scoring_method === 'custom' && form.multiplier ? parseFloat(form.multiplier) : null,
      binary_points: form.scoring_method === 'binary' && form.binary_points ? parseFloat(form.binary_points) : null,
      team_bonus_points: form.format === 'squad' && form.team_bonus_points ? parseFloat(form.team_bonus_points) : null,
      team_bonus_condition: form.format === 'squad' && form.team_bonus_condition ? form.team_bonus_condition.trim() : null,
    }

    if (!data.name || !data.description || !data.win_condition) {
      toast('Fill in all required fields', 'error')
      return
    }

    if (editingId) {
      const { error } = await supabase.from('fortnite_challenges').update(data).eq('id', editingId)
      if (error) { toast('Failed to update', 'error'); return }
      toast('Challenge updated', 'success')
    } else {
      const { error } = await supabase.from('fortnite_challenges').insert(data)
      if (error) { toast('Failed to create', 'error'); return }
      toast('Challenge created', 'success')
    }

    setShowForm(false)
    loadChallenges()
  }

  async function toggleActive(c: FortniteChallenge) {
    await supabase.from('fortnite_challenges').update({ is_active: !c.is_active }).eq('id', c.id)
    loadChallenges()
  }

  async function deleteChallenge() {
    if (!deleteId) return
    const { error } = await supabase.from('fortnite_challenges').delete().eq('id', deleteId)
    if (error) { toast('Failed to delete', 'error') } else { toast('Challenge deleted') }
    setDeleteId(null)
    loadChallenges()
  }

  const groups = groupByCategory(filtered())
  const deleteTarget = deleteId ? challenges.find(c => c.id === deleteId) : null

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
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-midnight-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-midnight-300" />
        </button>
        <h1 className="text-xl font-display text-white flex-1">Challenge Pool</h1>
        <Button onClick={openAdd} size="sm" className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'solo', 'squad'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              filter === tab
                ? 'bg-nin-purple/20 text-nin-purple border border-nin-purple/30'
                : 'bg-midnight-800 text-midnight-400'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'solo' ? 'Solo' : 'Squad'}
          </button>
        ))}
      </div>

      {/* Challenge List by Category */}
      {Object.entries(groups).map(([category, items]) => (
        <div key={category}>
          <p
            className="text-xs font-black uppercase tracking-wider mb-2 px-1"
            style={{ color: CATEGORY_COLORS[category as FortniteCategory] }}
          >
            {category} ({items.length})
          </p>
          <div className="space-y-2">
            {items.map(c => (
              <Card key={c.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-sm font-bold ${c.is_active ? 'text-white' : 'text-midnight-500 line-through'}`}>
                        {c.name}
                      </h3>
                      <span
                        className="text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                        style={{
                          backgroundColor: c.format === 'solo' ? 'rgba(10,181,245,0.15)' : 'rgba(0,200,83,0.15)',
                          color: c.format === 'solo' ? '#0ab5f5' : '#00c853',
                        }}
                      >
                        {c.format}
                      </span>
                    </div>
                    <p className="text-xs text-midnight-400 font-semibold">
                      {SCORING_METHOD_LABELS[c.scoring_method]}
                      {c.time_limit_minutes ? ` · ${c.time_limit_minutes}m` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                        c.is_active
                          ? 'bg-nin-green/15 text-nin-green'
                          : 'bg-midnight-700 text-midnight-500'
                      }`}
                    >
                      {c.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-midnight-700 text-midnight-400">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-midnight-700 text-midnight-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-midnight-900 w-full max-w-lg rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-white">
                {editingId ? 'Edit Challenge' : 'New Challenge'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-midnight-800">
                <X className="w-5 h-5 text-midnight-300" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-midnight-400 mb-1 block">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-nin-purple/50"
                  placeholder="Blood Bath"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-midnight-400 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-nin-purple/50 resize-none"
                  placeholder="What are players doing?"
                />
              </div>

              {/* Format + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Format</label>
                  <select
                    value={form.format}
                    onChange={e => {
                      const fmt = e.target.value as FortniteFormat
                      setForm(f => ({
                        ...f,
                        format: fmt,
                        category: fmt === 'solo' && f.category === 'teamwork' ? 'kill' : f.category,
                      }))
                    }}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {FORMAT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as FortniteCategory }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {CATEGORY_OPTIONS
                      .filter(o => form.format === 'squad' || o.value !== 'teamwork')
                      .map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Time Limit + Scoring */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Time Limit (min)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.time_limit_minutes}
                    onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    placeholder="Empty = full match"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Scoring</label>
                  <select
                    value={form.scoring_method}
                    onChange={e => setForm(f => ({ ...f, scoring_method: e.target.value as FortniteScoringMethod }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  >
                    {SCORING_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Win Condition */}
              <div>
                <label className="text-xs font-bold text-midnight-400 mb-1 block">Win Condition</label>
                <input
                  value={form.win_condition}
                  onChange={e => setForm(f => ({ ...f, win_condition: e.target.value }))}
                  className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  placeholder="Most eliminations"
                />
              </div>

              {/* Conditional: Multiplier */}
              {form.scoring_method === 'custom' && (
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Multiplier</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.multiplier}
                    onChange={e => setForm(f => ({ ...f, multiplier: e.target.value }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    placeholder="2"
                  />
                </div>
              )}

              {/* Conditional: Binary Points */}
              {form.scoring_method === 'binary' && (
                <div>
                  <label className="text-xs font-bold text-midnight-400 mb-1 block">Points for Success</label>
                  <input
                    type="number"
                    value={form.binary_points}
                    onChange={e => setForm(f => ({ ...f, binary_points: e.target.value }))}
                    className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    placeholder="4"
                  />
                </div>
              )}

              {/* Conditional: Team Bonus (squad only) */}
              {form.format === 'squad' && (
                <div className="space-y-3 bg-midnight-800/50 rounded-xl p-3">
                  <p className="text-xs font-display text-gold-400 uppercase tracking-wider">Team Bonus (Optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-midnight-400 mb-1 block">Bonus Points</label>
                      <input
                        type="number"
                        value={form.team_bonus_points}
                        onChange={e => setForm(f => ({ ...f, team_bonus_points: e.target.value }))}
                        className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-midnight-400 mb-1 block">Condition</label>
                      <input
                        value={form.team_bonus_condition}
                        onChange={e => setForm(f => ({ ...f, team_bonus_condition: e.target.value }))}
                        className="w-full bg-midnight-800 border border-midnight-600/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        placeholder="Victory Royale"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={saveChallenge} className="w-full" size="lg">
                {editingId ? 'Save Changes' : 'Create Challenge'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && deleteTarget && (
        <ConfirmDialog
          title="Delete Challenge"
          message={`Delete "${deleteTarget.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteChallenge}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
