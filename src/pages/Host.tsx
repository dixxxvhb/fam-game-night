import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useRoom } from '../engine/useRoom'
import { GameEnvProvider } from '../engine/context'
import { getGame } from '../games/registry'
import { cleanCode, lsSet, makeRoomCode } from '../lib/ids'
import { Avatar, Btn, cx, Label, LinkBtn } from '../ui/kit'
import { QR } from '../ui/QR'
import { BotControls, GameShelf, joinUrl, MuteButton, NightSummary, NightTable, Podium, shortJoinUrl, StatusDot, useRoomSounds } from '../room/shared'
import { getSaveStatus, loadSeason, onSaveStatus, type SaveStatus, type SeasonData } from '../data/api'
import { seasonStats } from '../data/season'

/** /host creates a room and moves to /host/CODE. */
export function HostNew() {
  const nav = useNavigate()
  useEffect(() => {
    nav(`/host/${makeRoomCode()}`, { replace: true })
  }, [nav])
  return null
}

function useSaveStatus() {
  const [s, setS] = useState<SaveStatus>(getSaveStatus())
  useEffect(() => onSaveStatus(setS), [])
  return s
}

/** The TV. Hosts the room in together mode. */
export default function Host() {
  const params = useParams()
  const code = cleanCode(params.code ?? '')
  const room = useRoom(code.length === 4 ? code : null, { host: true, mode: 'together' })
  const save = useSaveStatus()
  const s = room.state
  useRoomSounds(s, true)

  useEffect(() => {
    if (code.length === 4) lsSet('gn-last-room', { code, host: true, at: Date.now() })
  }, [code])

  if (!s) return null

  const def = s.game ? getGame(s.game.id) : null
  const roomView = { code: s.code, mode: s.mode, phase: s.phase, players: s.players, gamePlayers: s.game?.players ?? [], hostClientId: s.hostClientId }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-4 border-b border-line px-6 py-3">
        <Link to="/" className="font-display text-lg text-ink-2 hover:text-ink">Game Night</Link>
        <span className="font-mono text-sm text-ink-3">Room</span>
        <span className="font-display text-xl tracking-[0.12em] text-hot">{s.code}</span>
        <div className="flex-1" />
        {s.phase === 'playing' && def && <span className="font-bold text-ink-2">{def.name}</span>}
        <span className="font-mono text-xs text-ink-3">{save === 'saving' ? 'Saving' : save === 'offline' ? 'Will save when online' : save === 'off' ? 'Not saving' : ''}</span>
        <StatusDot status={room.status} />
        <MuteButton />
        {s.phase === 'playing' && (
          <Btn size="sm" variant="ghost" onClick={() => room.send('room', 'abort')}>End game</Btn>
        )}
      </header>

      <main className="min-h-0 flex-1">
        {s.phase === 'lobby' && <TvLobby room={room} />}

        {s.phase === 'playing' && def && s.game && (
          <GameEnvProvider link={room.link} me={null}>
            <def.Stage
              state={s.game.state}
              room={roomView}
              now={room.now}
              compact={false}
              me={null}
              isHost
              hostAction={(type, payload) => room.send('game', type, payload)}
            />
          </GameEnvProvider>
        )}

        {s.phase === 'results' && (
          <div className="mx-auto grid h-full max-w-5xl grid-cols-1 content-center gap-10 p-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Podium state={s} big />
            <div className="grid content-start gap-6">
              <NightTable state={s} big />
              <div className="flex flex-wrap gap-3">
                <Btn variant="primary" size="lg" onClick={() => room.send('room', 'again')}>Play again</Btn>
                <Btn size="lg" onClick={() => room.send('room', 'lobby')}>Pick another game</Btn>
              </div>
            </div>
          </div>
        )}

        {s.phase === 'summary' && (
          <div className="mx-auto grid h-full max-w-3xl content-center gap-10 p-8">
            <NightSummary state={s} big />
            <div className="flex justify-center gap-3">
              <Btn size="lg" onClick={() => room.send('room', 'newNight')}>Start another night</Btn>
              <LinkBtn to="/season" size="lg" variant="ghost">Season standings</LinkBtn>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function TvLobby({ room }: { room: ReturnType<typeof useRoom> }) {
  const s = room.state!
  const url = joinUrl(s.code)
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-8 overflow-y-auto p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="grid content-start gap-8">
        <div className="flex flex-wrap items-center gap-8">
          <div className="rounded-2xl bg-ink p-3"><QR text={url} size={180} /></div>
          <div className="grid gap-2">
            <Label>Join on your phone</Label>
            <div className="font-mono text-ink-2">{shortJoinUrl()}</div>
            <div className="font-display text-8xl leading-none tracking-[0.08em] text-hot riso">{s.code}</div>
          </div>
        </div>

        <div className="grid gap-3">
          <Label>{s.players.length ? 'In the room' : 'Nobody yet'}</Label>
          {s.players.length === 0 && <div className="text-xl text-ink-2">Scan the code. Pick your name. That's it.</div>}
          <div className="flex flex-wrap gap-4">
            {s.players.filter((p) => !p.bot).map((p) => (
              <div key={p.id} className={cx('flex items-center gap-3 rounded-2xl bg-tile py-2 pl-2 pr-5 animate-pop', !p.connected && 'opacity-40')}>
                <Avatar name={p.name} color={p.color} size={48} />
                <div className="grid">
                  <span className="text-xl font-bold">{p.name}</span>
                  {!p.connected && <span className="text-xs text-ink-3">phone asleep</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <BotControls state={s} big send={(type, payload) => room.send('room', type, payload)} />

        <NightTable state={s} big />
        {s.games.length > 0 && (
          <div>
            <Btn variant="danger" onClick={() => room.send('room', 'endNight')}>End the night</Btn>
          </div>
        )}
        {s.games.length === 0 && <SeasonMini />}
      </section>

      <section className="grid content-start gap-3">
        <Label>Pick a game here or on any phone</Label>
        <GameShelf state={s} onStart={(gameId, opts) => room.send('room', 'start', { gameId, opts })} />
      </section>
    </div>
  )
}

/** Season standings on the TV lobby before the first game, so the stakes are on screen. */
function SeasonMini() {
  const [data, setData] = useState<SeasonData | null>(null)
  useEffect(() => { loadSeason().then(setData) }, [])
  if (!data) return null
  const st = seasonStats(data)
  if (!st.standings.length) return <div className="text-ink-3">Season 1 starts at zero. Tonight sets the board.</div>
  const p = (id: string) => data.players.find((x) => x.id === id)
  return (
    <div className="grid gap-2">
      <Label>Season 1</Label>
      {st.standings.slice(0, 5).map((r, i) => (
        <div key={r.playerId} className="flex items-center gap-3">
          <span className="w-5 font-mono text-ink-3">{i + 1}</span>
          <Avatar name={p(r.playerId)?.name ?? r.playerId} color={p(r.playerId)?.color ?? '#888'} size={30} />
          <span className="flex-1 truncate text-lg font-bold">{p(r.playerId)?.name ?? r.playerId}</span>
          {st.belt === r.playerId && <span className="rounded-full bg-hot px-2 py-0.5 font-mono text-xs font-bold text-paper">BELT</span>}
          <span className="font-mono text-xl tabular">{r.points}</span>
        </div>
      ))}
    </div>
  )
}
