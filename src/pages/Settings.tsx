import { useState, useEffect } from 'react'
import { Plus, Trash2, Gamepad2, Users, Type, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useToast } from '../components/common/Toast'
import { supabase } from '../lib/supabase'
import { AVAILABLE_ICONS, getIconKey, setPlayerIconOverrides } from '../components/common/PlayerIcon'
import type { Game, Player } from '../types'

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ef4444', // red
  '#eab308', // yellow
  '#ec4899', // pink
  '#14b8a6', // teal
]

export default function Settings() {
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [newGameName, setNewGameName] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [appName, setAppName] = useState('VHBUN FAM GAME NIGHT')
  const [proposedName, setProposedName] = useState('')
  const [addingGame, setAddingGame] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Game | null>(null)
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [playerIcons, setPlayerIcons] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const [{ data: gamesData }, { data: playersData }, { data: settings }, { data: iconSettings }] = await Promise.all([
      supabase.from('games').select('*').order('name'),
      supabase.from('players').select('*').order('is_core', { ascending: false }),
      supabase.from('app_settings').select('*').eq('key', 'app_name').single(),
      supabase.from('app_settings').select('value').eq('key', 'player_icons').single(),
    ])

    if (gamesData) setGames(gamesData)
    if (playersData) setPlayers(playersData)
    if (settings) setAppName(settings.value)
    if (iconSettings?.value) {
      try {
        const icons = JSON.parse(iconSettings.value)
        setPlayerIcons(icons)
        setPlayerIconOverrides(icons)
      } catch { /* keep defaults */ }
    }
  }

  async function addGame() {
    const name = newGameName.trim()
    if (!name) return

    setAddingGame(true)
    try {
      const { error } = await supabase.from('games').insert({ name })
      if (error) {
        toast(error.message, 'error')
      } else {
        setNewGameName('')
        toast(`${name} added`)
        loadSettings()
      }
    } catch {
      toast('Failed to add game', 'error')
    } finally {
      setAddingGame(false)
    }
  }

  async function deleteGame(game: Game) {
    setDeletingGameId(game.id)
    try {
      const { error } = await supabase.from('games').delete().eq('id', game.id)
      if (error) {
        toast(error.message, 'error')
      } else {
        toast(`${game.name} removed`)
        loadSettings()
      }
    } catch {
      toast('Failed to delete game', 'error')
    } finally {
      setDeletingGameId(null)
      setConfirmDelete(null)
    }
  }

  async function addGuestPlayer() {
    const name = newPlayerName.trim()
    if (!name) return

    setAddingPlayer(true)
    try {
      const { error } = await supabase.from('players').insert({
        name,
        display_name: name,
        is_core: false,
        color: '#6b7280',
      })

      if (error) {
        toast(error.message, 'error')
      } else {
        setNewPlayerName('')
        toast(`${name} added as guest`)
        loadSettings()
      }
    } catch {
      toast('Failed to add player', 'error')
    } finally {
      setAddingPlayer(false)
    }
  }

  async function updatePlayerColor(player: Player, color: string) {
    setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, color } : p))
    await supabase.from('players').update({ color }).eq('id', player.id)
    toast('Color updated', 'success')
  }

  async function updatePlayerIcon(player: Player, iconKey: string) {
    const updated = { ...playerIcons, [player.name]: iconKey }
    setPlayerIcons(updated)
    setPlayerIconOverrides(updated)
    await supabase.from('app_settings').upsert({
      key: 'player_icons',
      value: JSON.stringify(updated),
    }, { onConflict: 'key' })
    toast('Icon updated', 'success')
  }

  async function proposeNameChange() {
    const name = proposedName.trim()
    if (!name) return

    await supabase.from('app_votes').insert({
      proposed_name: name,
      votes: {},
      status: 'pending',
    })

    setProposedName('')
  }

  const iconKeys = Object.keys(AVAILABLE_ICONS)

  return (
    <div className="p-4 space-y-6">
      {/* Games Section */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Gamepad2 className="w-4 h-4 text-nin-red" />
          <h2 className="text-sm font-display text-midnight-300 uppercase tracking-wider">Games</h2>
        </div>
        <Card>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {games.filter(g => !/^Game \d+$/.test(g.name)).map(game => (
              <div key={game.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm font-bold">{game.name}</span>
                <button
                  onClick={() => setConfirmDelete(game)}
                  disabled={deletingGameId === game.id}
                  aria-label={`Delete ${game.name}`}
                  className="text-midnight-500 hover:text-red-400 transition-colors p-1.5 rounded-xl hover:bg-midnight-700/50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newGameName}
              onChange={e => setNewGameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGame()}
              placeholder="New game name..."
              className="flex-1 bg-midnight-900 border border-midnight-600/40 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-nin-red/50 focus:shadow-[0_0_0_3px_rgba(230,0,18,0.1)] transition-all"
            />
            <Button onClick={addGame} size="sm" disabled={addingGame}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Players Section */}
      <div className="animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-nin-blue" />
          <h2 className="text-sm font-display text-midnight-300 uppercase tracking-wider">Players</h2>
        </div>
        <Card>
          <div className="space-y-1 mb-4">
            {players.map(player => {
              const isExpanded = expandedPlayerId === player.id
              const currentIconKey = playerIcons[player.name] ?? getIconKey(player.name)

              return (
                <div key={player.id}>
                  {/* Player row */}
                  <button
                    onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                    className="w-full flex items-center gap-2.5 py-2 px-1 rounded-xl hover:bg-midnight-700/30 transition-all"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${player.display_name} settings`}
                  >
                    <PlayerAvatar name={player.name} color={player.color} size="sm" />
                    <span className="text-sm flex-1 text-left font-bold">{player.display_name}</span>
                    {player.is_core && (
                      <span className="text-xs text-gold-400 font-display bg-gold-400/10 px-2 py-0.5 rounded-lg">Core</span>
                    )}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-midnight-400" />
                      : <ChevronDown className="w-4 h-4 text-midnight-500" />
                    }
                  </button>

                  {/* Expanded picker */}
                  {isExpanded && (
                    <div className="ml-11 mb-3 space-y-3">
                      {/* Color picker */}
                      <div>
                        <p className="text-xs text-midnight-400 font-bold mb-2">Color</p>
                        <div className="flex gap-2 flex-wrap">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => updatePlayerColor(player, color)}
                              aria-label={`Set color to ${color}`}
                              className="w-8 h-8 rounded-xl transition-all active:scale-90"
                              style={{
                                backgroundColor: color,
                                outline: player.color === color ? `3px solid white` : '3px solid transparent',
                                outlineOffset: '1px',
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Icon picker */}
                      <div>
                        <p className="text-xs text-midnight-400 font-bold mb-2">Icon</p>
                        <div className="flex gap-2 flex-wrap">
                          {iconKeys.map(key => {
                            const Icon = AVAILABLE_ICONS[key]
                            const isSelected = currentIconKey === key
                            return (
                              <button
                                key={key}
                                onClick={() => updatePlayerIcon(player, key)}
                                aria-label={`Set icon to ${key}`}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                                  isSelected
                                    ? 'bg-midnight-600 border-2 border-white/40'
                                    : 'bg-midnight-800 border-2 border-midnight-600/30 opacity-50 hover:opacity-80'
                                }`}
                              >
                                <Icon className="w-5 h-5 text-white" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGuestPlayer()}
              placeholder="Add guest player..."
              className="flex-1 bg-midnight-900 border border-midnight-600/40 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-nin-blue/50 focus:shadow-[0_0_0_3px_rgba(0,120,215,0.1)] transition-all"
            />
            <Button onClick={addGuestPlayer} size="sm" variant="secondary" disabled={addingPlayer}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* App Name Section */}
      <div className="animate-slide-up" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Type className="w-4 h-4 text-nin-orange" />
          <h2 className="text-sm font-display text-midnight-300 uppercase tracking-wider">App Name</h2>
        </div>
        <Card>
          <p className="text-sm mb-1 font-semibold">Current: <span className="font-display">{appName}</span></p>
          <p className="text-xs text-midnight-400 mb-3 font-semibold">All 4 core players must agree to change the name</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={proposedName}
              onChange={e => setProposedName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && proposeNameChange()}
              placeholder="Propose new name..."
              className="flex-1 bg-midnight-900 border border-midnight-600/40 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:border-nin-orange/50 focus:shadow-[0_0_0_3px_rgba(255,149,0,0.1)] transition-all"
            />
            <Button onClick={proposeNameChange} size="sm" variant="secondary">
              Propose
            </Button>
          </div>
        </Card>
      </div>

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Game"
          message={`Remove "${confirmDelete.name}" from the game list? This won't affect past game night records.`}
          confirmLabel="Delete"
          onConfirm={() => deleteGame(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
