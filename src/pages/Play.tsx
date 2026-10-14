import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useRoom } from '../engine/useRoom'
import { GameEnvProvider } from '../engine/context'
import { getGame } from '../games/registry'
import { cleanCode, getTabMe, lsSet } from '../lib/ids'
import { Avatar, Btn, cx, Label, Spinner } from '../ui/kit'
import { GameShelf, LostHost, MuteButton, NightSummary, NightTable, Podium, StatusDot, useRoomSounds } from '../room/shared'
import { LogOut, Share2, X } from 'lucide-react'

/** A phone in the room. In apart mode the hosting phone also runs the room. */
export default function Play() {
  const params = useParams()
  const [search] = useSearchParams()
  const code = cleanCode(params.code ?? '')
  const host = search.get('host') === '1'
  const [me] = useState(() => getTabMe(code))
  const room = useRoom(code.length === 4 && me ? code : null, { me, host, mode: host ? 'apart' : undefined })
  const s = room.state
  const nav = useNavigate()
  const [confirmEnd, setConfirmEnd] = useState(false)
  useRoomSounds(s, s?.mode === 'apart')

  useEffect(() => {
    if (code.length === 4 && me) lsSet('gn-last-room', { code, host, at: Date.now() })
  }, [code, host, me])

  function leave() {
    if (!me) return
    room.send('room', 'leave', { id: me.id })
    lsSet('gn-last-room', null)
    nav('/', { replace: true })
  }

  // Keep the screen awake while in a room.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const req = () => { nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {}) }
    req()
    const onVis = () => { if (document.visibilityState === 'visible') req() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}) }
  }, [])

  if (code.length !== 4) return <Navigate to="/join" replace />
  if (!me) return <Navigate to={`/join/${code}`} replace />

  const header = (
    <header className="flex items-center gap-3 border-b border-line px-4 py-2 safe-top">
      <Link to="/" className="font-display text-sm text-ink-3">GN</Link>
      <span className="font-display text-lg tracking-[0.12em] text-hot">{code}</span>
      <div className="flex-1" />
      <StatusDot status={room.status} />
      {s?.mode === 'apart' && <MuteButton />}
      {s?.phase === 'playing' && (
        <button onClick={() => setConfirmEnd(true)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:text-ink" aria-label="End this game" title="End this game">
          <X size={18} />
        </button>
      )}
      {s?.phase === 'lobby' && !room.isHost && (
        <button onClick={leave} className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:text-ink" aria-label="Leave room" title="Leave room">
          <LogOut size={18} />
        </button>
      )}
      <Avatar name={me.name} color={me.color} size={28} />
    </header>
  )

  if (!s) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="grid justify-items-center gap-4">
            <Spinner label={room.status === 'live' ? 'Looking for the TV' : 'Connecting'} />
            {room.status === 'live' && <p className="max-w-xs text-ink-3">Make sure the TV has the room open. The code is {code}.</p>}
          </div>
        </div>
      </div>
    )
  }

  const def = s.game ? getGame(s.game.id) : null
  const roomView = { code: s.code, mode: s.mode, phase: s.phase, players: s.players, gamePlayers: s.game?.players ?? [], hostClientId: s.hostClientId }
  const apart = s.mode === 'apart'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <LostHost heardAt={room.heardAt} isHost={room.isHost} what={apart ? 'the host phone' : 'the TV'} />
      {confirmEnd && s.phase === 'playing' && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-tile px-4 py-3" role="alertdialog" aria-label="End this game?">
          <span className="flex-1 font-bold">End this game for everyone? No points.</span>
          <Btn size="sm" variant="danger" onClick={() => { setConfirmEnd(false); room.send('room', 'abort') }}>End it</Btn>
          <Btn size="sm" onClick={() => setConfirmEnd(false)}>Keep playing</Btn>
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {s.phase === 'lobby' && <PhoneLobby room={room} />}

        {s.phase === 'playing' && def && s.game && (
          <GameEnvProvider link={room.link} me={me.id}>
            {apart && (
              <div className="border-b border-line p-3">
                <def.Stage state={s.game.state} room={roomView} now={room.now} compact me={me.id} isHost={room.isHost} hostAction={(t, p) => room.send('game', t, p)} />
              </div>
            )}
            <def.Controller state={s.game.state} room={roomView} me={me.id} now={room.now} send={(t, p) => room.send('game', t, p)} />
          </GameEnvProvider>
        )}

        {s.phase === 'results' && (
          <div className="grid gap-6 p-4">
            <Podium state={s} />
            <div className="grid grid-cols-2 gap-3">
              <Btn variant="primary" size="lg" onClick={() => room.send('room', 'again')}>Again</Btn>
              <Btn size="lg" onClick={() => room.send('room', 'lobby')}>Next game</Btn>
            </div>
            <NightTable state={s} />
          </div>
        )}

        {s.phase === 'summary' && (
          <div className="grid gap-8 p-4 py-10">
            <NightSummary state={s} />
            <div className="grid gap-3">
              <Btn size="lg" onClick={() => room.send('room', 'newNight')}>Start another night</Btn>
              <Link to="/season" className="text-center text-ink-2 underline">Season standings</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function PhoneLobby({ room }: { room: ReturnType<typeof useRoom> }) {
  const s = room.state!
  const [copied, setCopied] = useState(false)
  const apart = s.mode === 'apart'
  const link = `${window.location.origin}${window.location.pathname}#/join/${s.code}`

  async function share() {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> }
    try {
      if (nav.share) await nav.share({ title: 'Game night', text: `Room ${s.code}`, url: link })
      else { await navigator.clipboard.writeText(link); setCopied(true) }
    } catch { /* cancelled */ }
  }

  return (
    <div className="grid gap-6 p-4">
      <div className="grid gap-1">
        <div className="font-display text-3xl">You're in.</div>
        <div className="text-ink-2">{apart ? 'Send the code to the others. Everyone plays on their own phone.' : 'Watch the TV. Pick a game here or there.'}</div>
      </div>

      {apart && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-tile p-4">
          <div>
            <Label>Room code</Label>
            <div className="font-display text-4xl tracking-[0.12em] text-hot">{s.code}</div>
          </div>
          <Btn onClick={share}><Share2 size={18} />{copied ? 'Copied' : 'Send link'}</Btn>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {s.players.map((p) => (
          <span key={p.id} className={cx('flex items-center gap-2 rounded-full bg-tile py-1 pl-1 pr-3', !p.connected && 'opacity-40')}>
            <Avatar name={p.name} color={p.color} size={28} />
            <span className="font-bold">{p.name}</span>
          </span>
        ))}
      </div>

      <div className="grid gap-3">
        <Label>Pick a game</Label>
        <GameShelf compact state={s} onStart={(gameId, opts) => room.send('room', 'start', { gameId, opts })} />
      </div>

      <NightTable state={s} />
      {s.games.length > 0 && (
        <Btn variant="danger" onClick={() => room.send('room', 'endNight')}>End the night</Btn>
      )}
    </div>
  )
}
