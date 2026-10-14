import { useEffect, useRef, useState } from 'react'
import { Bot, Volume2, VolumeX, X } from 'lucide-react'
import { sfx } from '../ui/sfx'
import { useTicker } from '../engine/context'
import type { GameDef, RoomPlayer, RoomState } from '../engine/types'
import { GAMES } from '../games/registry'
import { nightStandings } from '../engine/points'
import { Avatar, Btn, cx, Label } from '../ui/kit'
import { CORE, GUEST_COLORS, guestId } from '../lib/players'
import type { SavedMe } from '../lib/ids'
import { getSaveStatus, loadSeason } from '../data/api'
import { seasonStats } from '../data/season'

export function joinUrl(code: string) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/join/${code}`
}

export function shortJoinUrl() {
  return `${window.location.host}${window.location.pathname.replace(/\/$/, '')}`
}

export function playerById(state: RoomState | null, id: string): RoomPlayer | undefined {
  return state?.players.find((p) => p.id === id)
}

/** Game shelf: pick a game, set its options, start. Works on the TV and on phones. */
export function GameShelf({
  state,
  onStart,
  compact = false,
}: {
  state: RoomState
  onStart: (gameId: string, opts: Record<string, string | number>) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [opts, setOpts] = useState<Record<string, string | number>>({})
  const humans = state.players.filter((p) => p.connected && !p.bot).length
  const bots = state.players.filter((p) => p.bot).length
  const playable = GAMES.filter((g) => g.modes.includes(state.mode))

  function choose(g: GameDef) {
    if (open === g.id) { setOpen(null); return }
    const o: Record<string, string | number> = {}
    for (const op of g.options ?? []) o[op.key] = op.default
    setOpts(o)
    setOpen(g.id)
  }

  return (
    <div className={cx('grid gap-3', !compact && 'sm:grid-cols-2')}>
      {playable.map((g) => {
        // Bots only sit in games that can play them.
        const ready = humans + (g.bot ? bots : 0)
        const tooFew = ready < g.minPlayers
        const tooMany = ready > g.maxPlayers
        const isOpen = open === g.id
        const played = state.games.filter((x) => x.gameId === g.id).length
        return (
          <div key={g.id} className={cx('rounded-2xl border bg-tile p-4 transition-colors', isOpen ? 'border-hot sm:col-span-2' : 'border-line')}>
            <button className="grid w-full gap-1 text-left" onClick={() => choose(g)} aria-expanded={isOpen}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl">{g.name}</span>
                <span className="shrink-0 font-mono text-xs text-ink-3">{g.minutes} min{played ? ` · played ${played}` : ''}</span>
              </div>
              <span className="text-ink-2">{g.tagline}</span>
              {g.instead && <span className="text-sm text-ink-3">{g.instead}</span>}
              {bots > 0 && !g.bot && <span className="text-sm text-hot-ink">Bots sit this one out</span>}
            </button>
            {isOpen && (
              <div className="mt-4 grid gap-4 animate-rise">
                {(g.options ?? []).map((op) => (
                  <div key={op.key} className="grid gap-2">
                    <Label>{op.label}</Label>
                    <div className="flex flex-wrap gap-2">
                      {op.choices.map((c) => (
                        <Btn
                          key={String(c.value)}
                          size="sm"
                          variant={opts[op.key] === c.value ? 'primary' : 'secondary'}
                          onClick={() => setOpts({ ...opts, [op.key]: c.value })}
                        >
                          {c.label}
                        </Btn>
                      ))}
                    </div>
                  </div>
                ))}
                <Btn variant="primary" size="lg" disabled={tooFew || tooMany} onClick={() => onStart(g.id, opts)}>
                  {tooFew ? `Needs ${g.minPlayers} players` : tooMany ? `Max ${g.maxPlayers} players` : `Start ${g.name}`}
                </Btn>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function NightTable({ state, big = false }: { state: RoomState; big?: boolean }) {
  const standings = nightStandings(state.games, state.players.map((p) => p.id))
  if (!state.games.length) return null
  return (
    <div className="grid gap-2">
      <Label>Tonight · {state.games.length} {state.games.length === 1 ? 'game' : 'games'}{state.games.some((g) => g.practice) ? ' · games with bots are practice' : ''}</Label>
      {standings.map((s, i) => {
        const p = playerById(state, s.playerId)
        const tied = i > 0 && standings[i - 1].points === s.points
        return (
          <div key={s.playerId} className="flex items-center gap-3">
            <span className="w-5 font-mono text-ink-3">{tied ? '' : i + 1}</span>
            <Avatar name={p?.name ?? s.playerId} color={p?.color ?? '#888'} size={big ? 34 : 26} />
            <span className={cx('flex-1 truncate font-bold', big && 'text-xl')}>{p?.name ?? s.playerId}</span>
            <span className={cx('font-mono tabular', big ? 'text-2xl' : 'text-lg')}>{s.points}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Podium for the last finished game. */
export function Podium({ state, big = false }: { state: RoomState; big?: boolean }) {
  const last = state.games[state.games.length - 1]
  if (!last) return null
  const game = GAMES.find((g) => g.id === last.gameId)
  return (
    <div className="grid gap-4">
      <div className="grid gap-1 text-center">
        <Label>{game?.name ?? last.gameId}</Label>
        {last.summary && <div className={cx('text-ink-2', big && 'text-xl')}>{last.summary}</div>}
        {last.practice && <div className="mx-auto rounded-full border border-line px-3 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-ink-3">Practice · not saved</div>}
      </div>
      <div className="grid gap-2">
        {last.placements.map((pl, i) => {
          const p = playerById(state, pl.playerId)
          return (
            <div
              key={pl.playerId}
              className={cx('flex items-center gap-3 rounded-2xl px-4 animate-rise', pl.place === 1 ? 'bg-hot/15 py-4' : 'bg-tile py-3')}
              style={{ animationDelay: `${i * 90}ms`, animationFillMode: 'backwards' }}
            >
              <span className={cx('font-display', pl.place === 1 ? 'text-hot text-3xl' : 'text-ink-3 text-2xl', big && 'text-4xl')}>{pl.place}</span>
              <Avatar name={p?.name ?? pl.playerId} color={p?.color ?? '#888'} size={big ? 48 : 36} />
              <span className={cx('flex-1 truncate font-bold', big ? 'text-2xl' : 'text-lg')}>{p?.name ?? pl.playerId}</span>
              {pl.score !== undefined && <span className="font-mono text-ink-3 tabular">{pl.score}</span>}
              <span className={cx('font-mono font-bold tabular', big ? 'text-3xl' : 'text-xl')}>+{pl.points}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function NightSummary({ state, big = false }: { state: RoomState; big?: boolean }) {
  const night = state.night
  if (!night) return null
  const winners = night.winners.map((id) => playerById(state, id)?.name ?? id)
  const everyone = winners.length > 1 && winners.length === night.standings.length
  return (
    <div className="grid gap-6 text-center">
      <div className="grid gap-2">
        <Label>Tonight's winner</Label>
        {everyone ? (
          <div className={cx('font-display riso', big ? 'text-7xl' : 'text-5xl')}>Dead even</div>
        ) : winners.length ? (
          <div className={cx('font-display riso', big ? 'text-7xl' : 'text-5xl')}>{winners.join(' & ')}</div>
        ) : (
          <div className={cx('font-display', big ? 'text-5xl' : 'text-3xl')}>No games, no winner</div>
        )}
        <div className="text-ink-2">{state.games.length} {state.games.length === 1 ? 'game' : 'games'} played. {state.games.every((g) => g.practice) ? 'Practice night with bots. Nothing saved.' : getSaveStatus() === 'off' ? 'Test mode, not saved.' : 'Saved to the season.'}</div>
        <BeltCall state={state} big={big} />
      </div>
      <div className="mx-auto grid w-full max-w-md gap-2 text-left">
        {night.standings.map((s, i) => {
          const p = playerById(state, s.playerId)
          return (
            <div key={s.playerId} className="flex items-center gap-3 rounded-xl bg-tile px-4 py-3">
              <span className="w-5 font-mono text-ink-3">{i + 1}</span>
              <Avatar name={p?.name ?? s.playerId} color={p?.color ?? '#888'} size={32} />
              <span className="flex-1 truncate font-bold">{p?.name ?? s.playerId}</span>
              <span className="font-mono text-xl tabular">{s.points}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Pick who you are: the three regulars or a guest. */
export function WhoAreYou({ taken = [], onPick }: { taken?: string[]; onPick: (me: SavedMe) => void }) {
  const [guest, setGuest] = useState(false)
  const [name, setName] = useState('')
  return (
    <div className="grid gap-3">
      {CORE.map((p) => {
        const busy = taken.includes(p.id)
        return (
          <button
            key={p.id}
            onClick={() => onPick({ id: p.id, name: p.name, color: p.color, guest: false })}
            className={cx('flex min-h-16 items-center gap-4 rounded-2xl border-2 bg-tile px-4 text-left transition-transform active:scale-[0.98]', busy ? 'border-line opacity-60' : 'border-line hover:border-ink-3')}
          >
            <Avatar name={p.name} color={p.color} size={44} />
            <span className="flex-1 font-display text-2xl">{p.name}</span>
            {busy && <span className="text-sm text-ink-3">on another phone</span>}
          </button>
        )
      })}
      {!guest ? (
        <Btn variant="ghost" onClick={() => setGuest(true)}>I'm a guest</Btn>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = name.trim().slice(0, 24)
            if (!n) return
            const id = guestId(n)
            const color = GUEST_COLORS[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % GUEST_COLORS.length]
            onPick({ id, name: n, color, guest: true })
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Your name"
            aria-label="Guest name"
            className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-line bg-tile px-4 text-lg outline-none focus:border-hot"
          />
          <Btn type="submit" variant="primary" size="lg">Join</Btn>
        </form>
      )}
    </div>
  )
}

export function StatusDot({ status }: { status: string }) {
  const color = status === 'live' ? 'bg-good' : status === 'connecting' ? 'bg-hot animate-pulse' : 'bg-bad'
  const label = status === 'live' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'off' ? 'Offline mode' : 'Reconnecting'
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-3" title={label}>
      <span className={cx('h-2 w-2 rounded-full', color)} />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  )
}

/** Plays the room's sounds on screens that show the game (TV, or phones in apart mode). */
export function useRoomSounds(state: RoomState | null, enabled: boolean) {
  const prev = useRef<{ phase: string; players: number; games: number } | null>(null)
  useEffect(() => { sfx.enable(enabled) }, [enabled])
  useEffect(() => {
    if (!state) return
    const p = prev.current
    const cur = { phase: state.phase, players: state.players.length, games: state.games.length }
    prev.current = cur
    if (!p) return
    if (cur.players > p.players) sfx.play('join')
    if (cur.phase !== p.phase) {
      if (cur.phase === 'playing') sfx.play('start')
      if (cur.phase === 'results') sfx.play('reveal')
      if (cur.phase === 'summary') sfx.play('win')
    }
  }, [state])
}

export function MuteButton() {
  const [m, setM] = useState(sfx.isMuted())
  useEffect(() => sfx.onMuted(setM), [])
  return (
    <button
      onClick={() => sfx.setMuted(!m)}
      className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:text-ink"
      aria-label={m ? 'Sound off. Turn on' : 'Sound on. Turn off'}
      title={m ? 'Sound off' : 'Sound on'}
    >
      {m ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  )
}

/** Shows up when a phone hasn't heard the host for a while. */
export function LostHost({ heardAt, isHost, what = 'the TV' }: { heardAt: () => number; isHost: boolean; what?: string }) {
  useTicker(1000)
  if (isHost) return null
  const gone = Date.now() - heardAt() > 10_000
  if (!gone) return null
  return (
    <div className="border-b border-hot/40 bg-hot/15 px-4 py-2 text-center text-sm text-hot-ink" role="status">
      Lost {what}. Waiting for it to come back.
    </div>
  )
}

/** "Torii takes the Belt from Dixxx." Season leader before tonight vs after tonight. */
export function BeltCall({ state, big = false }: { state: RoomState; big?: boolean }) {
  const [line, setLine] = useState<string | null>(null)
  const night = state.night
  useEffect(() => {
    // Practice-only nights (bots) never touch the season, so no Belt talk either.
    if (!night || !state.games.some((g) => !g.practice)) return
    let alive = true
    loadSeason().then((d) => {
      if (!alive || !d) return
      const prior = { ...d, nights: d.nights.filter((n) => n.id !== state.nightId) }
      const before = seasonStats(prior)
      const totals = new Map(before.standings.map((r) => [r.playerId, r.points]))
      for (const s of night.standings) {
        if (state.players.find((p) => p.id === s.playerId)?.bot) continue
        totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)
      }
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
      if (!ranked.length || ranked[0][1] <= 0) return
      if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
        setLine('The Belt is tied. Somebody has to want it.')
        return
      }
      const name = (id: string) => playerById(state, id)?.name ?? d.players.find((p) => p.id === id)?.name ?? id
      const after = ranked[0][0]
      if (!before.belt) setLine(`${name(after)} takes the first Belt of the season.`)
      else if (before.belt === after) setLine(`${name(after)} keeps the Belt.`)
      else setLine(`${name(after)} takes the Belt from ${name(before.belt)}.`)
    })
    return () => { alive = false }
  }, [night, state.nightId, state.games.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!line) return null
  return <div className={cx('mx-auto mt-2 rounded-full bg-hot/15 px-5 py-2 font-bold text-hot-ink animate-pop', big ? 'text-2xl' : 'text-base')}>{line}</div>
}

/** Bots in the room: add one, or send one home. Bots only play games that support them. */
export function BotControls({ state, send, big = false }: { state: RoomState; send: (type: string, payload?: unknown) => void; big?: boolean }) {
  const bots = state.players.filter((p) => p.bot)
  const canAdd = state.players.length < 8 && bots.length < 5 && state.phase !== 'playing'
  return (
    <div className="flex flex-wrap items-center gap-2">
      {bots.map((b) => (
        <span key={b.id} className={cx('flex items-center gap-2 rounded-full border border-dashed border-line py-1 pl-1 pr-1', big && 'py-1.5')}>
          <Avatar name={b.name} color={b.color} size={big ? 32 : 26} />
          <span className={cx('font-bold', big ? 'text-lg' : 'text-sm')}>{b.name}</span>
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-3">bot</span>
          <button onClick={() => send('removeBot', { id: b.id })} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:text-ink" aria-label={`Remove ${b.name}`}>
            <X size={16} />
          </button>
        </span>
      ))}
      {canAdd && (
        <Btn size="sm" variant="ghost" onClick={() => send('addBot')}>
          <Bot size={16} />{bots.length ? 'Another bot' : 'Add a bot'}
        </Btn>
      )}
    </div>
  )
}
