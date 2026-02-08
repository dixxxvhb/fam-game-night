import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Shuffle, Dices, Hash, Users, Gamepad2, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PlayerAvatar } from '../components/common/PlayerAvatar'
import { supabase } from '../lib/supabase'
import type { Game, Player } from '../types'

interface ToolSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const tools: ToolSection[] = [
  { id: 'game-order', title: 'Game Order', icon: Shuffle, color: '#3b82f6' },
  { id: 'game-pick', title: 'Random Game', icon: Gamepad2, color: '#e60012' },
  { id: 'number', title: 'Number', icon: Hash, color: '#22c55e' },
  { id: 'dice', title: 'Dice Roll', icon: Dices, color: '#f59e0b' },
  { id: 'player-order', title: 'Player Order', icon: Users, color: '#a855f7' },
]

export default function Randomizer() {
  const { id: nightId } = useParams<{ id: string }>()
  const [openTool, setOpenTool] = useState<string | null>('game-order')
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<Player[]>([])

  // Game Order state
  const [selectedGames, setSelectedGames] = useState<Game[]>([])
  const [shuffledGames, setShuffledGames] = useState<Game[]>([])
  const [lockedIndices, setLockedIndices] = useState<Set<number>>(new Set())
  const [isShuffling, setIsShuffling] = useState(false)

  // Random Game Pick state
  const [pickedGame, setPickedGame] = useState<Game | null>(null)
  const [pickPool, setPickPool] = useState<Game[]>([])
  const [isPicking, setIsPicking] = useState(false)

  // Number state
  const [numMin, setNumMin] = useState(1)
  const [numMax, setNumMax] = useState(10)
  const [randomNumber, setRandomNumber] = useState<number | null>(null)
  const [isRollingNumber, setIsRollingNumber] = useState(false)

  // Dice state
  const [diceType, setDiceType] = useState(6)
  const [diceResult, setDiceResult] = useState<number | null>(null)
  const [isRollingDice, setIsRollingDice] = useState(false)

  // Player Order state
  const [shuffledPlayers, setShuffledPlayers] = useState<Player[]>([])
  const [isShufflingPlayers, setIsShufflingPlayers] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [{ data: gamesData }, { data: playersData }] = await Promise.all([
      supabase.from('games').select('*').order('name'),
      nightId
        ? supabase.from('game_night_players').select('players(*)').eq('game_night_id', nightId)
        : supabase.from('players').select('*').eq('is_core', true),
    ])

    if (gamesData) {
      const filtered = gamesData.filter((g: Game) => !/^Game \d+$/.test(g.name))
      setGames(filtered)
      setPickPool(filtered)
    }
    if (playersData) {
      const pList = nightId
        ? playersData.map((p: any) => p.players).filter(Boolean)
        : playersData
      setPlayers(pList)
    }
  }

  function toggleTool(id: string) {
    setOpenTool(openTool === id ? null : id)
  }

  function toggleGameSelection(game: Game) {
    setSelectedGames(prev =>
      prev.find(g => g.id === game.id)
        ? prev.filter(g => g.id !== game.id)
        : [...prev, game]
    )
  }

  async function shuffleGameOrder() {
    if (selectedGames.length < 2) return
    const unlocked = selectedGames.filter((_, i) => !lockedIndices.has(i))
    const locked = selectedGames.map((g, i) => lockedIndices.has(i) ? g : null)

    setIsShuffling(true)
    for (let i = 0; i < 8; i++) {
      const temp = [...locked]
      const shuffledUnlocked = [...unlocked].sort(() => Math.random() - 0.5)
      let ui = 0
      for (let j = 0; j < temp.length; j++) {
        if (!temp[j]) temp[j] = shuffledUnlocked[ui++]
      }
      setShuffledGames(temp as Game[])
      await new Promise(r => setTimeout(r, 80 + i * 20))
    }

    const finalUnlocked = [...unlocked].sort(() => Math.random() - 0.5)
    const final = [...locked]
    let ui = 0
    for (let j = 0; j < final.length; j++) {
      if (!final[j]) final[j] = finalUnlocked[ui++]
    }
    setShuffledGames(final as Game[])
    setIsShuffling(false)

    if (nightId) {
      await supabase.from('random_results').insert({
        game_night_id: nightId,
        type: 'game_order',
        result: { order: (final as Game[]).map(g => g!.name) },
      })
    }
  }

  function toggleLock(idx: number) {
    setLockedIndices(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function pickRandomGame() {
    if (pickPool.length === 0) return
    setIsPicking(true)
    for (let i = 0; i < 10; i++) {
      const rand = pickPool[Math.floor(Math.random() * pickPool.length)]
      setPickedGame(rand)
      await new Promise(r => setTimeout(r, 60 + i * 25))
    }
    const final = pickPool[Math.floor(Math.random() * pickPool.length)]
    setPickedGame(final)
    setIsPicking(false)

    if (nightId) {
      await supabase.from('random_results').insert({
        game_night_id: nightId,
        type: 'game_pick',
        result: { game: final.name },
      })
    }
  }

  async function rollNumber() {
    setIsRollingNumber(true)
    for (let i = 0; i < 10; i++) {
      setRandomNumber(Math.floor(Math.random() * (numMax - numMin + 1)) + numMin)
      await new Promise(r => setTimeout(r, 50 + i * 20))
    }
    const final = Math.floor(Math.random() * (numMax - numMin + 1)) + numMin
    setRandomNumber(final)
    setIsRollingNumber(false)

    if (nightId) {
      await supabase.from('random_results').insert({
        game_night_id: nightId,
        type: 'number',
        result: { number: final, min: numMin, max: numMax },
      })
    }
  }

  async function rollDice() {
    setIsRollingDice(true)
    for (let i = 0; i < 12; i++) {
      setDiceResult(Math.floor(Math.random() * diceType) + 1)
      await new Promise(r => setTimeout(r, 40 + i * 18))
    }
    const final = Math.floor(Math.random() * diceType) + 1
    setDiceResult(final)
    setIsRollingDice(false)

    if (nightId) {
      await supabase.from('random_results').insert({
        game_night_id: nightId,
        type: 'dice',
        result: { value: final, sides: diceType },
      })
    }
  }

  async function shufflePlayerOrder() {
    if (players.length < 2) return
    setIsShufflingPlayers(true)
    for (let i = 0; i < 8; i++) {
      setShuffledPlayers([...players].sort(() => Math.random() - 0.5))
      await new Promise(r => setTimeout(r, 80 + i * 20))
    }
    const final = [...players].sort(() => Math.random() - 0.5)
    setShuffledPlayers(final)
    setIsShufflingPlayers(false)

    if (nightId) {
      await supabase.from('random_results').insert({
        game_night_id: nightId,
        type: 'player_order',
        result: { order: final.map(p => p.name) },
      })
    }
  }

  const diceTypes = [4, 6, 8, 10, 12, 20]

  return (
    <div className="p-4 space-y-3">
      {tools.map((tool, toolIdx) => {
        const Icon = tool.icon
        const isOpen = openTool === tool.id

        return (
          <div key={tool.id} className="animate-slide-up" style={{ animationDelay: `${toolIdx * 60}ms` }}>
            <div className="flex rounded-2xl overflow-hidden">
              {/* Color accent bar */}
              <div
                className={`w-1.5 shrink-0 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-40'}`}
                style={{ backgroundColor: tool.color }}
              />
              <div className="flex-1">
                <Card className="rounded-l-none border-l-0 overflow-hidden">
                  <button
                    onClick={() => toggleTool(tool.id)}
                    className="flex items-center gap-3 w-full text-left"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: tool.color + '20' }}
                    >
                      <div style={{ color: tool.color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <span className="font-display flex-1">{tool.title}</span>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-midnight-400" />
                      : <ChevronDown className="w-4 h-4 text-midnight-400" />
                    }
                  </button>

                  {isOpen && tool.id === 'game-order' && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs text-midnight-400 font-bold">Select games, then shuffle the order</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {games.map(game => (
                          <button
                            key={game.id}
                            onClick={() => toggleGameSelection(game)}
                            className={`text-left px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 ${
                              selectedGames.find(g => g.id === game.id)
                                ? 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30'
                                : 'bg-midnight-700/50 text-midnight-300 border border-midnight-600/30 hover:bg-midnight-600/50'
                            }`}
                          >
                            {game.name}
                          </button>
                        ))}
                      </div>

                      {shuffledGames.length > 0 && (
                        <div className="space-y-1.5">
                          {shuffledGames.map((game, idx) => (
                            <div key={idx} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                              isShuffling ? 'bg-midnight-700/80 border-midnight-600/40 animate-pulse' : 'bg-midnight-700/40 border-midnight-600/30'
                            }`}>
                              <span className="font-display text-sm w-5" style={{ color: tool.color }}>{idx + 1}</span>
                              <span className="text-sm flex-1 font-bold">{game.name}</span>
                              <button onClick={() => toggleLock(idx)} className="text-midnight-400 hover:text-white p-0.5">
                                {lockedIndices.has(idx) ? <Lock className="w-3.5 h-3.5 text-gold-400" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        onClick={shuffleGameOrder}
                        disabled={selectedGames.length < 2 || isShuffling}
                        variant="secondary"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Shuffle className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
                        {shuffledGames.length > 0 ? 'Re-Shuffle' : 'Shuffle Order'}
                      </Button>
                    </div>
                  )}

                  {isOpen && tool.id === 'game-pick' && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs text-midnight-400 font-bold">Randomly pick the next game</p>

                      {pickedGame && (
                        <div className={`text-center py-5 rounded-2xl border transition-all ${
                          isPicking ? 'bg-midnight-700/80 scale-95 border-midnight-600/40' : 'border-nin-red/30 bg-nin-red/10'
                        }`}>
                          <p className={`text-2xl font-display text-nin-red ${isPicking ? 'animate-pulse' : ''}`}>
                            {pickedGame.name}
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={pickRandomGame}
                        disabled={pickPool.length === 0 || isPicking}
                        variant="secondary"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Gamepad2 className={`w-4 h-4 ${isPicking ? 'animate-bounce' : ''}`} />
                        Pick Next Game
                      </Button>
                    </div>
                  )}

                  {isOpen && tool.id === 'number' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-midnight-400 block mb-1 font-bold">Min</label>
                          <input
                            type="number"
                            value={numMin}
                            onChange={e => setNumMin(Number(e.target.value))}
                            className="w-full bg-midnight-900 border border-midnight-600/40 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#22c55e]/50 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)] transition-all"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-midnight-400 block mb-1 font-bold">Max</label>
                          <input
                            type="number"
                            value={numMax}
                            onChange={e => setNumMax(Number(e.target.value))}
                            className="w-full bg-midnight-900 border border-midnight-600/40 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#22c55e]/50 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)] transition-all"
                          />
                        </div>
                      </div>

                      {randomNumber !== null && (
                        <div className={`text-center py-5 rounded-2xl border transition-all ${
                          isRollingNumber ? 'bg-midnight-700/80 scale-95 border-midnight-600/40' : 'border-[#22c55e]/30 bg-[#22c55e]/10'
                        }`}>
                          <p className={`text-5xl font-display ${isRollingNumber ? 'animate-pulse' : ''}`} style={{ color: '#22c55e' }}>
                            {randomNumber}
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={rollNumber}
                        disabled={isRollingNumber || numMin >= numMax}
                        variant="secondary"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Hash className={`w-4 h-4 ${isRollingNumber ? 'animate-spin' : ''}`} />
                        Roll Number
                      </Button>
                    </div>
                  )}

                  {isOpen && tool.id === 'dice' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {diceTypes.map(d => (
                          <button
                            key={d}
                            onClick={() => setDiceType(d)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-display transition-all duration-150 active:scale-95 ${
                              diceType === d
                                ? 'bg-[#f59e0b] text-midnight-950 shadow-[0_3px_0_0_#b87a00,0_0_12px_rgba(245,158,11,0.3)]'
                                : 'bg-midnight-700 text-midnight-300 border border-midnight-600/40 hover:bg-midnight-600'
                            }`}
                          >
                            d{d}
                          </button>
                        ))}
                      </div>

                      {diceResult !== null && (
                        <div className={`text-center py-5 rounded-2xl border transition-all ${
                          isRollingDice ? 'bg-midnight-700/80 scale-95 border-midnight-600/40' : 'border-[#f59e0b]/30 bg-[#f59e0b]/10'
                        }`}>
                          <p className={`text-5xl font-display ${isRollingDice ? 'animate-shake' : ''}`} style={{ color: '#f59e0b' }}>
                            {diceResult}
                          </p>
                          <p className="text-xs text-midnight-400 mt-1 font-display">d{diceType}</p>
                        </div>
                      )}

                      <Button
                        onClick={rollDice}
                        disabled={isRollingDice}
                        variant="secondary"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Dices className={`w-4 h-4 ${isRollingDice ? 'animate-shake' : ''}`} />
                        Roll d{diceType}
                      </Button>
                    </div>
                  )}

                  {isOpen && tool.id === 'player-order' && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs text-midnight-400 font-bold">Shuffle who goes first</p>

                      {shuffledPlayers.length > 0 && (
                        <div className="space-y-1.5">
                          {shuffledPlayers.map((player, idx) => (
                            <div key={player.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                              isShufflingPlayers ? 'bg-midnight-700/80 border-midnight-600/40 animate-pulse' : 'bg-midnight-700/40 border-midnight-600/30'
                            }`}>
                              <span className="font-display text-sm w-5" style={{ color: tool.color }}>{idx + 1}</span>
                              <PlayerAvatar name={player.name} color={player.color} size="sm" />
                              <span className="text-sm font-bold">{player.display_name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        onClick={shufflePlayerOrder}
                        disabled={players.length < 2 || isShufflingPlayers}
                        variant="secondary"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Users className={`w-4 h-4 ${isShufflingPlayers ? 'animate-spin' : ''}`} />
                        {shuffledPlayers.length > 0 ? 'Re-Shuffle' : 'Shuffle Players'}
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
