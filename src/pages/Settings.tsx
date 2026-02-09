import { useState, useEffect } from 'react'
import { Plus, Trash2, Gamepad2, Users, Type } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import type { Game, Player } from '../types'

export default function Settings() {
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [newGameName, setNewGameName] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [appName, setAppName] = useState('VHBUN FAM GAME NIGHT')
  const [proposedName, setProposedName] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const [{ data: gamesData }, { data: playersData }, { data: settings }] = await Promise.all([
      supabase.from('games').select('*').order('name'),
      supabase.from('players').select('*').order('is_core', { ascending: false }),
      supabase.from('app_settings').select('*').eq('key', 'app_name').single(),
    ])

    if (gamesData) setGames(gamesData)
    if (playersData) setPlayers(playersData)
    if (settings) setAppName(settings.value)
  }

  async function addGame() {
    const name = newGameName.trim()
    if (!name) return

    const { error } = await supabase.from('games').insert({ name })
    if (!error) {
      setNewGameName('')
      loadSettings()
    }
  }

  async function deleteGame(id: string) {
    await supabase.from('games').delete().eq('id', id)
    loadSettings()
  }

  async function addGuestPlayer() {
    const name = newPlayerName.trim()
    if (!name) return

    const { error } = await supabase.from('players').insert({
      name,
      display_name: name,
      is_core: false,
      color: '#6b7280',
    })

    if (!error) {
      setNewPlayerName('')
      loadSettings()
    }
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
                  onClick={() => deleteGame(game.id)}
                  className="text-midnight-500 hover:text-red-400 transition-colors p-1.5 rounded-xl hover:bg-midnight-700/50"
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
            <Button onClick={addGame} size="sm">
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
          <div className="space-y-2.5 mb-4">
            {players.map(player => (
              <div key={player.id} className="flex items-center gap-2.5 py-1">
                <PlayerAvatar name={player.name} color={player.color} size="sm" />
                <span className="text-sm flex-1 font-bold">{player.display_name}</span>
                {player.is_core && (
                  <span className="text-xs text-gold-400 font-display bg-gold-400/10 px-2 py-0.5 rounded-lg">Core</span>
                )}
              </div>
            ))}
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
            <Button onClick={addGuestPlayer} size="sm" variant="secondary">
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
    </div>
  )
}
